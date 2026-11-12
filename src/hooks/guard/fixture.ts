import { spawn } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { afterAll, beforeAll } from 'vitest'

export const ROOT = join(import.meta.dirname, '../../..')

// Both trees carry the same guard and nothing else compares them, so a fix
// landing in one and not the other passes every other stage in the gate.
export const TREES = [
  { dir: join(ROOT, '.claude/hooks'), label: '.claude/hooks' },
  {
    dir: join(ROOT, 'tooling/claude/seeds/.claude/hooks'),
    label: 'tooling/claude/seeds/.claude/hooks',
  },
]

// The hooks that read no payload, and so carry no guard to assert on.
export const UNGUARDED = new Set(['bare-flag-repair.sh', 'cloud-setup.sh'])

// A tool name no hook acts on, so every guarded hook falls through to a quiet
// exit 0. This covers the tool filter and nothing else: a mangled payload
// reaches the same fall-through, which is why every hook also carries an
// acting case below.
export const INERT_PAYLOAD = JSON.stringify({
  session_id: 'hooks-guard-inert',
  tool_input: { file_path: '/nowhere/ignored.txt' },
  tool_name: 'Read',
})

// The payload takes a nonce because three hooks dedupe on `session_id`, writing
// a marker under the project dir and staying silent for the rest of that
// session. Both trees run the same hook against one fixture, so a shared id
// silences whichever loses the race.
export interface ActingCase {
  /** Exit code the acting branch leaves, where a blocking hook leaves 2. */
  readonly code?: number
  /**
   * Overrides applied on top of the spawned process's own environment, for a
   * hook whose acting branch reads a variable rather than the payload. A key
   * mapped to `undefined` is deleted rather than left at whatever the runner
   * happens to carry.
   */
  readonly env?: Record<string, string | undefined>
  readonly expect: string
  readonly payload: (nonce: string) => string
  /** Prepended to the stripped PATH, for a hook whose acting branch shells out. */
  readonly path?: string
  /**
   * Where the verdict lands. A hook reaching the session by blocking writes its
   * reason to stderr, since an event that carries no `additionalContext` sends
   * exit-0 output to the debug log alone.
   */
  readonly stream?: 'stderr' | 'stdout'
}

export interface Run {
  readonly code: number | null
  readonly stderr: string
  readonly stdout: string
}

export const BASH_DIAGNOSTIC = /: line \d+: /

// A hook hanging on an open stdin never exits, so the test timeout is what
// fails it. A wall-clock bound on the guard's two seconds left a one-second
// margin that a loaded machine overran with no hook at fault.
export const REFUSAL_TIMEOUT_MS = 15_000

/**
 * The per-file bindings the setup assigns. They live on one object because an
 * ES import of a reassigned `let` reads `undefined` until the importing file's
 * own setup has run, and the object is read at call time.
 */
export interface Context {
  acting: Record<string, ActingCase>
  fixture: string
  hookPath: string
  readOnlyRoot: string
}

export const ctx = {} as Context

// `canon indexes regen` succeeds on the index hook where the CLI is installed
// and is absent on a CI runner, so the acting output would differ by machine.
// Removing it from PATH pins both to the branch that reports a stale index,
// which fires only after the payload parsed and the path guard matched.
const pathWithoutCanon = (): string =>
  (process.env.PATH ?? '')
    .split(delimiter)
    .filter((dir) => dir !== '' && !existsSync(join(dir, 'canon')))
    .join(delimiter)

/** First match on the caller's PATH, which the fixture links rather than copies. */
export const findOnPath = (name: string): string | undefined =>
  (process.env.PATH ?? '')
    .split(delimiter)
    .filter((dir) => dir !== '')
    .map((dir) => join(dir, name))
    .find((path) => existsSync(path))

// Omitting the payload leaves stdin open with nothing written and no EOF, which
// is the descriptor the hang came from. Closing it instead would exercise the
// cheap case and leave the observed one untested.
export const run = (
  hook: string,
  payload?: string,
  path?: string,
  root?: string,
  env?: Record<string, string | undefined>,
): Promise<Run> =>
  new Promise((resolve) => {
    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      CLAUDE_PROJECT_DIR: root ?? join(ctx.fixture, 'project'),
      PATH: path ?? ctx.hookPath,
    }
    for (const [key, value] of Object.entries(env ?? {})) {
      if (value === undefined) delete childEnv[key]
      else childEnv[key] = value
    }
    const child = spawn('bash', [hook], {
      env: childEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on('close', (code) => {
      resolve({ code, stderr, stdout })
    })

    if (payload !== undefined) child.stdin.end(payload)
  })

export const payloadFor = (fields: Record<string, unknown>): string =>
  JSON.stringify(fields)

export const stopPayload = (reply: string, active = false): string =>
  payloadFor({
    cwd: join(ctx.fixture, 'project'),
    hook_event_name: 'Stop',
    last_assistant_message: reply,
    stop_hook_active: active,
  })

export const REVIEWS = "'repos/{owner}/{repo}/pulls/7/reviews'"

// The hook resolves a relative body path against the payload's own cwd, so the
// fixture project is named there rather than left to the spawned process.
export const postPayload = (command: string, cwd?: string): string =>
  payloadFor({
    cwd: cwd ?? join(ctx.fixture, 'project'),
    tool_input: { command },
    tool_name: 'Bash',
  })

export const reviewPost = (
  args: string,
  endpoint = REVIEWS,
  method = '-X POST',
) => postPayload(`gh api ${method} ${endpoint} -f event=COMMENT ${args}`)

/**
 * Registers the fixture setup and teardown on the calling test file, so each
 * file builds its own temp tree and none reads a path another file made.
 */
export function useFixture(): Context {
  beforeAll(() => {
    ctx.fixture = mkdtempSync(join(tmpdir(), 'hooks-guard-'))
    ctx.hookPath = pathWithoutCanon()

    const project = join(ctx.fixture, 'project')
    for (const dir of [
      join(project, 'canon/context/development'),
      // canon-keep-record-root: the records-index hook watches the old folder
      join(project, '.claude/tasks'),
      join(project, '.claude/worktrees/demo'),
      join(project, 'indexed'),
      join(project, 'src'),
      join(ctx.fixture, 'bin'),
      join(ctx.fixture, 'bin-no-runner'),
      join(ctx.fixture, 'bin-reply-links'),
      join(ctx.fixture, 'bin-jq-trap'),
      join(ctx.fixture, 'bin-empty-set'),
      join(ctx.fixture, 'bin-advisory'),
      join(ctx.fixture, 'bin-tables'),
      join(ctx.fixture, 'bin-no-record'),
      join(ctx.fixture, 'bin-due'),
      join(ctx.fixture, 'bin-scan-fail'),
      join(ctx.fixture, 'bin-scan-pass'),
      join(ctx.fixture, 'bin-board'),
      join(ctx.fixture, 'bin-board-refused'),
      join(ctx.fixture, 'no-source'),
      join(ctx.fixture, 'read-only'),
      join(ctx.fixture, 'elsewhere/tmp'),
    ]) {
      mkdirSync(dir, { recursive: true })
    }

    ctx.readOnlyRoot = join(ctx.fixture, 'read-only')

    // The degradation branch needs a PATH carrying neither runner, and it still
    // has to carry what the run itself depends on: `bash` to spawn the hook, and
    // `jq`, which the hook reads its payload through before it reaches that
    // branch. Missing either takes the run somewhere silent for an unrelated
    // reason, which would pass the case against the wrong branch.
    //
    // Linking both into a directory of its own is what holds all of that at
    // once, the way the runner stubs beside it do. Filtering the caller's PATH
    // for a directory holding `jq` and no runner was the alternative, and it
    // reads machine provisioning rather than behavior: a machine carrying `bun`
    // in `/usr/bin` leaves no directory qualifying and the case fails on its own
    // guard.
    for (const name of ['bash', 'jq'] as const) {
      const found = findOnPath(name)
      if (found) symlinkSync(found, join(ctx.fixture, 'bin-no-runner', name))
    }

    // A `jq` that fails loudly, so a hook that reached it on a payload it should
    // have dismissed by shell test alone says so on stderr. `bash` is linked in
    // because the hook still needs a shell to run under.
    const bash = findOnPath('bash')
    if (bash) symlinkSync(bash, join(ctx.fixture, 'bin-jq-trap', 'bash'))
    const trap = join(ctx.fixture, 'bin-jq-trap/jq')
    writeFileSync(
      trap,
      "#!/usr/bin/env bash\nprintf 'jq spawned\\n' >&2\nexit 99\n",
    )
    chmodSync(trap, 0o755)

    // The toolkit's standards-audit reads its findings out of a `markdown audit
    // --json` record, so the acting branch is unreachable with the real binary
    // stripped from PATH. Stubbing both runners pins the output to the fixture
    // rather than to whichever build the machine carries, which is the reason
    // the strip exists. The seed copy of the same hook reads the same record and
    // resolves the `canon` stub alone, since it looks for no checkout source.
    //
    // Each stub reports a `kind` naming itself, which is what lets a test read
    // the runner the hook resolved rather than assume it. The hook prints that
    // field verbatim, and no real record carries either value.
    for (const [name, kind] of [
      ['canon', 'via-canon'],
      ['bun', 'via-bun'],
    ] as const) {
      const stub = join(ctx.fixture, 'bin', name)
      writeFileSync(
        stub,
        `#!/usr/bin/env bash\nprintf '%s\\n' '{"entries":[{"path":"doc.md","bans":[{"line":3,"column":23,"kind":"${kind}","term":"—"}]}]}'\n`,
      )
      chmodSync(stub, 0o755)
    }

    // A record carrying no ban and a set the verb shipped empty, which is the
    // narrowed check the hook reports rather than passing. It stubs `canon` alone,
    // so a root without `src/cli.ts` is what routes the toolkit hook to it, and
    // the seed hook resolves no other branch.
    const narrowed = join(ctx.fixture, 'bin-empty-set/canon')
    writeFileSync(
      narrowed,
      `#!/usr/bin/env bash\nprintf '%s\\n' '{"entries":[],"bans":{"emptySets":["characters"]}}'\n`,
    )
    chmodSync(narrowed, 0o755)

    // A record carrying no ban and two advisory findings, one colon on a line
    // the edits below do or do not introduce and one heading, so the new-text
    // filter and the unfiltered heading read are each observable.
    const advisory = join(ctx.fixture, 'bin-advisory/canon')
    writeFileSync(
      advisory,
      `#!/usr/bin/env bash\nprintf '%s\\n' '{"entries":[{"path":"doc.md","bans":[],"colons":[{"line":3,"column":14,"text":"Prose sentence: another clause.","lead":"sentence"},{"line":5,"column":14,"text":"Ship it 🚀 now: it works.","lead":"now"}],"headingCase":[{"line":1,"text":"Key Changes","words":["Changes"]}]}],"bans":{"emptySets":[]}}'\n`,
    )
    chmodSync(advisory, 0o755)

    // A record carrying table findings alone: two gated density kinds, one counted
    // and one a shape, and one that only reports, so each message is observable.
    const tables = join(ctx.fixture, 'bin-tables/canon')
    writeFileSync(
      tables,
      `#!/usr/bin/env bash\nprintf '%s\\n' '{"entries":[{"path":"doc.md","bans":[],"density":[{"kind":"table-cell","line":7,"value":130,"limit":120,"gating":true},{"kind":"table-then-list","line":8,"value":null,"limit":null,"gating":true}],"tables":[{"kind":"table-token","line":9,"value":31,"limit":30}]}],"bans":{"emptySets":[]}}'\n`,
    )
    chmodSync(tables, 0o755)

    // A verb that declined to measure writes no record at all, which is what it
    // does outside a git repository. Reading the findings alone reports that as a
    // clean file, so the stub writes nothing and the hooks answer emptiness.
    const silent = join(ctx.fixture, 'bin-no-record/canon')
    writeFileSync(silent, '#!/usr/bin/env bash\nexit 1\n')
    chmodSync(silent, 0o755)

    // The reminder reads a due record off `bun src/cli.ts upstream due`, so the
    // stub answers one and the output is the fixture's rather than whichever
    // cursor and network the machine carries.
    const due = join(ctx.fixture, 'bin-due/bun')
    writeFileSync(
      due,
      `#!/usr/bin/env bash\nprintf '%s\\n' '{"due":true,"reason":"week","releases":4}'\n`,
    )
    chmodSync(due, 0o755)

    // The review post hook gates on the scan's exit code and reads no record
    // field, so a stub exiting 2 with a warning line stands in for a finding, and
    // one exiting 0 for a clean body. The real scan is the one the verb's own
    // tests cover.
    const scanFail = join(ctx.fixture, 'bin-scan-fail/canon')
    writeFileSync(
      scanFail,
      `#!/usr/bin/env bash\nprintf '%s\\n' '│ ! 1 board identifier in the title or body.' >&2\nexit 2\n`,
    )
    chmodSync(scanFail, 0o755)

    const scanPass = join(ctx.fixture, 'bin-scan-pass/canon')
    writeFileSync(scanPass, '#!/usr/bin/env bash\nexit 0\n')
    chmodSync(scanPass, 0o755)

    // The board hook reads its findings out of a `tasks validate --json` record
    // and exits 0 whatever the verb exits, so a stub answering one finding with
    // the verb's own exit 2 stands in for a board a hand edit broke.
    const board = join(ctx.fixture, 'bin-board/canon')
    writeFileSync(
      board,
      `#!/usr/bin/env bash\nprintf '%s\\n' '{"ok":true,"findings":[{"kind":"cell-long","group":"Needs a plan","subject":"v1.0-a","message":"carries a long cell."}]}'\nexit 2\n`,
    )
    chmodSync(board, 0o755)

    // A refused validation carries `ok:false`, which jq's `//` reads as absent,
    // so this stub is what makes the refusal branch observable.
    const refused = join(ctx.fixture, 'bin-board-refused/canon')
    writeFileSync(
      refused,
      `#!/usr/bin/env bash\nprintf '%s\\n' '{"ok":false,"message":"no board here."}'\nexit 1\n`,
    )
    chmodSync(refused, 0o755)

    // The reply-links hook decides on the record the verb writes, so a stub
    // answering a missing path stands in for the verb, and logs each call so a
    // test reads whether the hook spawned it at all. The real check is covered
    // by the verb's own tests. It stubs `canon` alone, and the toolkit copy falls
    // to it because the fixture project holds an empty `src/cli.ts` and no `bun`
    // on this PATH.
    for (const name of ['canon', 'bun']) {
      const stub = join(ctx.fixture, 'bin-reply-links', name)
      writeFileSync(
        stub,
        [
          '#!/usr/bin/env bash',
          'echo called >> "${REPLY_LINKS_CALLS:-/dev/null}"',
          `printf '%s\\n' '{"ok":false,"missing":[{"destination":"src/gone.ts","path":"/x/src/gone.ts"}],"message":"The final reply links to paths that do not exist on disk:\\n- src/gone.ts"}'`,
          '',
        ].join('\n'),
      )
      chmodSync(stub, 0o755)
    }

    // An empty file is enough, since the hook tests for the path and the stub
    // runner never reads it. Without it the project root takes the fallback and
    // the branch the hook prefers is exercised by nothing.
    writeFileSync(join(project, 'src/cli.ts'), '')

    writeFileSync(join(project, 'review-body.md'), '## Review\n')
    mkdirSync(join(project, 'hooks-guard-Xray'))
    writeFileSync(
      join(project, 'hooks-guard-Xray/review-body.md'),
      '## Review\n',
    )
    writeFileSync(
      join(project, 'doc.md'),
      '# Doc\n\nA line with an em dash — in it.\n',
    )
    writeFileSync(join(project, 'indexed/index.md'), '# Index\n')
    writeFileSync(
      join(project, 'canon/context/development/local-loop.md'),
      'Dev commands.\n',
    )
    // canon-keep-record-root: the records-index hook watches the old folder
    writeFileSync(join(project, '.claude/tasks/sample.md'), 'no frontmatter\n')
    writeFileSync(join(project, '.claude/worktrees/demo/note.md'), 'note\n')

    // One payload per hook that reaches the branch doing the work, paired with a
    // string only that branch emits. A payload the read mangled produces the
    // quiet fall-through instead, so these are what make the guard's fidelity
    // observable rather than assumed.
    ctx.acting = {
      'board-validate.sh': {
        expect: 'cell-long: v1.0-a carries a long cell.',
        path: [join(ctx.fixture, 'bin-board'), ctx.hookPath].join(delimiter),
        payload: () =>
          payloadFor({
            tool_input: {
              file_path: join(project, '.canon/tasks/priority.md'),
            },
            tool_name: 'Edit',
          }),
      },
      'dev-command-reminder.sh': {
        expect: 'Dev commands have gotchas',
        payload: (nonce) =>
          payloadFor({
            session_id: nonce,
            tool_input: { command: 'bun run check' },
            tool_name: 'Bash',
          }),
      },
      'index-reminder.sh': {
        expect: join(project, 'indexed/index.md'),
        payload: (nonce) =>
          payloadFor({
            session_id: nonce,
            tool_input: { path: join(project, 'indexed') },
            tool_name: 'Grep',
          }),
      },
      'memory-guard.sh': {
        code: 2,
        expect: 'Auto memory is off in this repository',
        payload: () =>
          payloadFor({
            tool_input: {
              file_path: join(ctx.fixture, '.claude/projects/x/memory/note.md'),
            },
            tool_name: 'Write',
          }),
        stream: 'stderr',
      },
      'path-form.sh': {
        expect: 'This write is from a linked worktree',
        payload: () =>
          payloadFor({
            tool_input: {
              file_path: join(project, '.claude/worktrees/demo/note.md'),
            },
            tool_name: 'Write',
          }),
      },
      'plan-guard.sh': {
        code: 2,
        expect: 'Invoke the canon:plan-feature skill',
        payload: (nonce) => {
          const key = nonce.replace(/[^A-Za-z0-9_.-]/g, '_')
          const transcriptPath = join(ctx.fixture, `plan-guard-${key}.jsonl`)
          // A transcript holding no tool call reads as a changed format and
          // passes, so the acting case carries one in today's shape.
          writeFileSync(
            transcriptPath,
            `${JSON.stringify({
              message: {
                content: [
                  { input: { command: 'ls' }, name: 'Bash', type: 'tool_use' },
                ],
              },
              type: 'assistant',
            })}\n`,
          )
          return payloadFor({
            cwd: project,
            session_id: nonce,
            tool_input: {
              command: `cat > .canon/plans/feature-${key}.md <<'EOF'\n# Plan\nEOF`,
            },
            tool_name: 'Bash',
            transcript_path: transcriptPath,
          })
        },
        stream: 'stderr',
      },
      'pr-create-log.sh': {
        expect: 'announce it to the controller now, per role-worker',
        payload: (nonce) =>
          payloadFor({
            session_id: nonce,
            tool_input: { command: 'gh pr create --title x --body y' },
            tool_response: {
              stdout: 'https://github.com/example/repo/pull/42\n',
            },
          }),
      },
      'precompact-handoff.sh': {
        code: 2,
        expect: 'Run the canon:session-compact skill',
        payload: (nonce) =>
          payloadFor({
            hook_event_name: 'PreCompact',
            session_id: nonce,
          }),
        stream: 'stderr',
      },
      'reply-links.sh': {
        code: 2,
        expect: 'src/gone.ts',
        path: [join(ctx.fixture, 'bin-reply-links'), ctx.hookPath].join(
          delimiter,
        ),
        payload: () => stopPayload('See [it](src/gone.ts).'),
        stream: 'stderr',
      },
      'records-index.sh': {
        // canon-keep-record-root: the records-index hook watches the old folder
        expect: '.claude/tasks/index.md',
        payload: () =>
          payloadFor({
            // canon-keep-record-root: the records-index hook watches the old folder
            tool_input: { file_path: join(project, '.claude/tasks/sample.md') },
            tool_name: 'Write',
          }),
      },
      'review-post-scan.sh': {
        code: 2,
        expect: 'board identifier',
        path: [join(ctx.fixture, 'bin-scan-fail'), ctx.hookPath].join(
          delimiter,
        ),
        payload: () =>
          reviewPost(`-F body=@${join(project, 'review-body.md')}`),
        stream: 'stderr',
      },
      'scratch-guard.sh': {
        expect: 'Temporary file write outside',
        payload: (nonce) =>
          payloadFor({
            session_id: nonce,
            tool_input: {
              file_path: join(ctx.fixture, 'elsewhere/tmp/foo.txt'),
            },
            tool_name: 'Write',
          }),
      },
      'search-reminder.sh': {
        expect: 'canon:search-craft',
        payload: (nonce) =>
          payloadFor({
            session_id: nonce,
            tool_input: { query: 'bun test runner' },
            tool_name: 'WebSearch',
          }),
      },
      'silent-turn.sh': {
        code: 2,
        expect: 'did not name:',
        payload: (nonce) => {
          const key = nonce.replace(/[^A-Za-z0-9_.-]/g, '_')
          const transcriptPath = join(ctx.fixture, `transcript-${key}.jsonl`)
          const promptId = `prompt-${key}`
          const writtenPath = join(
            ctx.fixture,
            `silent-turn-written-${key}.txt`,
          )
          const lines = [
            { promptId, type: 'user' },
            {
              message: {
                content: [
                  {
                    input: { file_path: writtenPath },
                    name: 'Write',
                    type: 'tool_use',
                  },
                ],
              },
              type: 'assistant',
            },
          ]
          writeFileSync(
            transcriptPath,
            lines.map((line) => JSON.stringify(line)).join('\n') + '\n',
          )
          return payloadFor({
            hook_event_name: 'Stop',
            last_assistant_message: 'Done.',
            prompt_id: promptId,
            stop_hook_active: false,
            transcript_path: transcriptPath,
          })
        },
        stream: 'stderr',
      },
      'standards-audit.sh': {
        expect: join(project, 'doc.md'),
        path: [join(ctx.fixture, 'bin'), ctx.hookPath].join(delimiter),
        payload: () =>
          payloadFor({
            tool_input: { file_path: join(project, 'doc.md') },
            tool_name: 'Write',
          }),
      },
      'upstream-due.sh': {
        // The runner may itself be a background session reading `0`, which the
        // hook is built to stay silent for.
        env: { CLAUDE_CODE_SESSION_ATTENDED: undefined },
        expect: '4 Claude Code releases since the last upstream digest',
        path: [join(ctx.fixture, 'bin-due'), ctx.hookPath].join(delimiter),
        payload: () => payloadFor({ source: 'startup' }),
      },
    }

    // Last, so nothing else in this setup is writing into it any more. A root the
    // hook cannot create its marker under is what reaches the fail-open branch,
    // and the mode is the only way to produce that without mocking the script.
    chmodSync(ctx.readOnlyRoot, 0o555)
  })

  afterAll(() => {
    // Restored first, so the recursive remove is not the thing the mode refuses.
    chmodSync(ctx.readOnlyRoot, 0o755)
    rmSync(ctx.fixture, { force: true, recursive: true })
  })

  return ctx
}
