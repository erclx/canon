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
export const UNGUARDED = new Set(['bare-flag-repair.sh'])

// A tool name no hook acts on, so every guarded hook falls through to a quiet
// exit 0. A mangled payload reaches the same fall-through, which is why every
// hook also carries an acting case below.
export const INERT_PAYLOAD = JSON.stringify({
  session_id: 'hooks-guard-inert',
  tool_input: { file_path: '/nowhere/ignored.txt' },
  tool_name: 'Read',
})

// The payload takes a nonce because three hooks dedupe on `session_id`, and
// both trees run one hook against one fixture, so a shared id silences
// whichever loses the race.
export interface ActingCase {
  /** Exit code the acting branch leaves, where a blocking hook leaves 2. */
  readonly code?: number
  /**
   * Overrides on the spawned environment, for a hook whose acting branch reads
   * a variable. A key mapped to `undefined` is deleted rather than inherited.
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

// `canon indexes regen` exists on a dev machine and not on a CI runner, so
// removing it from PATH pins both to the stale-index branch, which fires only
// after the payload parsed and the path guard matched.
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

// The one live session the session-name stubs report, whose id prefix a reply
// either names it beside or leaves bare.
export const ROSTER_SESSION = {
  name: 'Review of PR 42',
  sessionId: '631880bb-5e1b-4a01-a360-b4d28698a4ac',
}

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
 * Links `bash` and `jq` into `dir`, a PATH with no runner where the hook can
 * still spawn and read its payload. Filtering the caller's PATH instead would
 * read machine provisioning, since `bun` in `/usr/bin` leaves no dir qualifying.
 */
function linkNoRunnerPath(dir: string): void {
  for (const name of ['bash', 'jq'] as const) {
    const found = findOnPath(name)
    if (found) symlinkSync(found, join(dir, name))
  }
}

let lagCount = 0

/**
 * A PATH whose `sleep` appends `line` to `transcript`, so the line lands after
 * the plan guard's first read and before its retry. The stub records each wait
 * it was asked for in `waits`, which stays absent when the guard never waits.
 */
export const lagTranscript = (
  transcript: string,
  line: string,
): { path: string; waits: string } => {
  lagCount++
  const dir = join(ctx.fixture, `bin-lag-${lagCount}`)
  mkdirSync(dir)
  const waits = join(dir, 'waits')
  const landing = join(dir, 'line')
  writeFileSync(landing, `${line}\n`)
  writeFileSync(
    join(dir, 'sleep'),
    `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >>'${waits}'\ncat '${landing}' >>'${transcript}'\n`,
  )
  chmodSync(join(dir, 'sleep'), 0o755)
  return { path: [dir, ctx.hookPath].join(delimiter), waits }
}

/**
 * Registers the fixture setup and teardown on the calling test file, so each
 * file builds its own temp tree and none reads a path another file made.
 */
export function useFixture(): Context {
  beforeAll(() => {
    ctx.fixture = mkdtempSync(join(tmpdir(), 'hooks-guard-'))
    // The plan guard waits a second before each refusal, which a real `sleep` adds to every blocking case.
    const instant = join(ctx.fixture, 'bin-instant-sleep')
    mkdirSync(instant)
    writeFileSync(join(instant, 'sleep'), '#!/usr/bin/env bash\nexit 0\n')
    chmodSync(join(instant, 'sleep'), 0o755)
    ctx.hookPath = [instant, pathWithoutCanon()].join(delimiter)

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
      join(ctx.fixture, 'bin-session-name'),
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
      join(ctx.fixture, 'bin-records'),
      join(ctx.fixture, 'records-project/.canon/.records.git'),
      join(ctx.fixture, 'records-project/src'),
      join(ctx.fixture, 'records-project/.claude/worktrees/demo'),
      join(ctx.fixture, 'no-source'),
      join(ctx.fixture, 'read-only'),
      join(ctx.fixture, 'elsewhere/tmp'),
    ]) {
      mkdirSync(dir, { recursive: true })
    }

    ctx.readOnlyRoot = join(ctx.fixture, 'read-only')

    linkNoRunnerPath(join(ctx.fixture, 'bin-no-runner'))

    // A `jq` that fails loudly when a shell test should have dismissed the payload.
    const bash = findOnPath('bash')
    if (bash) symlinkSync(bash, join(ctx.fixture, 'bin-jq-trap', 'bash'))
    const trap = join(ctx.fixture, 'bin-jq-trap/jq')
    writeFileSync(
      trap,
      "#!/usr/bin/env bash\nprintf 'jq spawned\\n' >&2\nexit 99\n",
    )
    chmodSync(trap, 0o755)

    // Both runners stubbed, each reporting a `kind` naming itself, so a test reads which ran.
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

    // An empty shipped set, which the hook reports rather than passing.
    const narrowed = join(ctx.fixture, 'bin-empty-set/canon')
    writeFileSync(
      narrowed,
      `#!/usr/bin/env bash\nprintf '%s\\n' '{"entries":[],"bans":{"emptySets":["characters"]}}'\n`,
    )
    chmodSync(narrowed, 0o755)

    // Two advisory findings, so the new-text filter and the heading read each show.
    const advisory = join(ctx.fixture, 'bin-advisory/canon')
    writeFileSync(
      advisory,
      `#!/usr/bin/env bash\nprintf '%s\\n' '{"entries":[{"path":"doc.md","bans":[],"colons":[{"line":3,"column":14,"text":"Prose sentence: another clause.","lead":"sentence"},{"line":5,"column":14,"text":"Ship it 🚀 now: it works.","lead":"now"}],"headingCase":[{"line":1,"text":"Key Changes","words":["Changes"]}]}],"bans":{"emptySets":[]}}'\n`,
    )
    chmodSync(advisory, 0o755)

    // Table findings alone, two gated and one reporting, so each message shows.
    const tables = join(ctx.fixture, 'bin-tables/canon')
    writeFileSync(
      tables,
      `#!/usr/bin/env bash\nprintf '%s\\n' '{"entries":[{"path":"doc.md","bans":[],"density":[{"kind":"table-cell","line":7,"value":130,"limit":120,"gating":true},{"kind":"table-then-list","line":8,"value":null,"limit":null,"gating":true}],"tables":[{"kind":"table-token","line":9,"value":31,"limit":30}]}],"bans":{"emptySets":[]}}'\n`,
    )
    chmodSync(tables, 0o755)

    // A verb that declined to measure writes no record, so the hooks answer emptiness.
    const silent = join(ctx.fixture, 'bin-no-record/canon')
    writeFileSync(silent, '#!/usr/bin/env bash\nexit 1\n')
    chmodSync(silent, 0o755)

    // Pins the due record rather than the machine's cursor and network.
    const due = join(ctx.fixture, 'bin-due/bun')
    writeFileSync(
      due,
      `#!/usr/bin/env bash\nprintf '%s\\n' '{"due":true,"reason":"week","releases":4}'\n`,
    )
    chmodSync(due, 0o755)

    // The hook gates on the scan's exit alone, so exit 2 stands in for a finding.
    const scanFail = join(ctx.fixture, 'bin-scan-fail/canon')
    writeFileSync(
      scanFail,
      `#!/usr/bin/env bash\nprintf '%s\\n' '│ ! 1 board identifier in the title or body.' >&2\nexit 2\n`,
    )
    chmodSync(scanFail, 0o755)

    const scanPass = join(ctx.fixture, 'bin-scan-pass/canon')
    writeFileSync(scanPass, '#!/usr/bin/env bash\nexit 0\n')
    chmodSync(scanPass, 0o755)

    // One finding and exit 2, since the board hook exits 0 whatever the verb exits.
    const board = join(ctx.fixture, 'bin-board/canon')
    writeFileSync(
      board,
      `#!/usr/bin/env bash\nprintf '%s\\n' '{"ok":true,"findings":[{"kind":"cell-long","group":"Needs a plan","subject":"v1.0-a","message":"carries a long cell."}]}'\nexit 2\n`,
    )
    chmodSync(board, 0o755)

    // `ok:false` reads as absent through jq's `//`, so this stub reaches the refusal branch.
    const refused = join(ctx.fixture, 'bin-board-refused/canon')
    writeFileSync(
      refused,
      `#!/usr/bin/env bash\nprintf '%s\\n' '{"ok":false,"message":"no board here."}'\nexit 1\n`,
    )
    chmodSync(refused, 0o755)

    // Answers a missing path and logs each call, showing whether the hook spawned one.
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

    // Refuse and log the arguments, which shows the root each runner was handed.
    for (const name of ['canon', 'bun']) {
      const stub = join(ctx.fixture, 'bin-records', name)
      writeFileSync(
        stub,
        [
          '#!/usr/bin/env bash',
          `echo "${name} $*" >> "\${RECORDS_PUSH_CALLS:-/dev/null}"`,
          `printf '%s\\n' '{"ok":false,"reason":"git-failed","message":"push rejected."}'`,
          'exit 1',
          '',
        ].join('\n'),
      )
      chmodSync(stub, 0o755)
    }
    writeFileSync(join(ctx.fixture, 'records-project/src/cli.ts'), '')

    // Answers one named session and logs each call, showing whether the hook spawned one.
    for (const name of ['canon', 'bun']) {
      const stub = join(ctx.fixture, 'bin-session-name', name)
      writeFileSync(
        stub,
        [
          '#!/usr/bin/env bash',
          'echo called >> "${SESSION_NAME_CALLS:-/dev/null}"',
          `printf '%s\\n' '${JSON.stringify({ sessions: [ROSTER_SESSION] })}'`,
          '',
        ].join('\n'),
      )
      chmodSync(stub, 0o755)
    }

    // Without this the root takes the fallback and the preferred branch goes untested.
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

    // One payload per hook, paired with a string only its acting branch emits.
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
          // A transcript with no tool call reads as a changed format and passes.
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
      'session-name.sh': {
        code: 2,
        expect: ROSTER_SESSION.name,
        path: [join(ctx.fixture, 'bin-session-name'), ctx.hookPath].join(
          delimiter,
        ),
        payload: () => stopPayload('Launched 631880bb for the review.'),
        stream: 'stderr',
      },
      'records-push.sh': {
        env: { CLAUDE_PROJECT_DIR: join(ctx.fixture, 'records-project') },
        expect: 'Records push: not backed up (git-failed)',
        path: [join(ctx.fixture, 'bin-records'), ctx.hookPath].join(delimiter),
        payload: () => payloadFor({ hook_event_name: 'SessionEnd' }),
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
        // The runner may itself be a background session, which the hook stays silent for.
        env: { CLAUDE_CODE_SESSION_ATTENDED: undefined },
        expect: '4 Claude Code releases since the last upstream digest',
        path: [join(ctx.fixture, 'bin-due'), ctx.hookPath].join(delimiter),
        payload: () => payloadFor({ source: 'startup' }),
      },
    }

    // Last, so nothing writes into it, reaching the fail-open branch without a mock.
    chmodSync(ctx.readOnlyRoot, 0o555)
  })

  afterAll(() => {
    // Restored first, so the recursive remove is not the thing the mode refuses.
    chmodSync(ctx.readOnlyRoot, 0o755)
    rmSync(ctx.fixture, { force: true, recursive: true })
  })

  return ctx
}
