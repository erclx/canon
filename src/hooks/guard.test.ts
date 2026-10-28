import { execFileSync, spawn } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '../..')

// Both trees carry the same guard and nothing else compares them, so a fix
// landing in one and not the other passes every other stage in the gate.
const TREES = [
  { dir: join(ROOT, '.claude/hooks'), label: '.claude/hooks' },
  {
    dir: join(ROOT, 'tooling/claude/seeds/.claude/hooks'),
    label: 'tooling/claude/seeds/.claude/hooks',
  },
]

// The hooks that read no payload, and so carry no guard to assert on.
const UNGUARDED = new Set(['bare-flag-repair.sh', 'cloud-setup.sh'])

// A tool name no hook acts on, so every guarded hook falls through to a quiet
// exit 0. This covers the tool filter and nothing else: a mangled payload
// reaches the same fall-through, which is why every hook also carries an
// acting case below.
const INERT_PAYLOAD = JSON.stringify({
  session_id: 'hooks-guard-inert',
  tool_input: { file_path: '/nowhere/ignored.txt' },
  tool_name: 'Read',
})

// The payload takes a nonce because three hooks dedupe on `session_id`, writing
// a marker under the project dir and staying silent for the rest of that
// session. Both trees run the same hook against one fixture, so a shared id
// silences whichever loses the race.
interface ActingCase {
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

interface Run {
  readonly code: number | null
  readonly stderr: string
  readonly stdout: string
}

const BASH_DIAGNOSTIC = /: line \d+: /

// A hook hanging on an open stdin never exits, so the test timeout is what
// fails it. A wall-clock bound on the guard's two seconds left a one-second
// margin that a loaded machine overran with no hook at fault.
const REFUSAL_TIMEOUT_MS = 15_000

let fixture: string
let hookPath: string
let readOnlyRoot: string
let acting: Record<string, ActingCase>

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
const findOnPath = (name: string): string | undefined =>
  (process.env.PATH ?? '')
    .split(delimiter)
    .filter((dir) => dir !== '')
    .map((dir) => join(dir, name))
    .find((path) => existsSync(path))

// Omitting the payload leaves stdin open with nothing written and no EOF, which
// is the descriptor the hang came from. Closing it instead would exercise the
// cheap case and leave the observed one untested.
const run = (
  hook: string,
  payload?: string,
  path?: string,
  root?: string,
  env?: Record<string, string | undefined>,
): Promise<Run> =>
  new Promise((resolve) => {
    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      CLAUDE_PROJECT_DIR: root ?? join(fixture, 'project'),
      PATH: path ?? hookPath,
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

const payloadFor = (fields: Record<string, unknown>): string =>
  JSON.stringify(fields)

const stopPayload = (reply: string, active = false): string =>
  payloadFor({
    cwd: join(fixture, 'project'),
    hook_event_name: 'Stop',
    last_assistant_message: reply,
    stop_hook_active: active,
  })

const REVIEWS = "'repos/{owner}/{repo}/pulls/7/reviews'"

// The hook resolves a relative body path against the payload's own cwd, so the
// fixture project is named there rather than left to the spawned process.
const postPayload = (command: string, cwd?: string): string =>
  payloadFor({
    cwd: cwd ?? join(fixture, 'project'),
    tool_input: { command },
    tool_name: 'Bash',
  })

const reviewPost = (args: string, endpoint = REVIEWS, method = '-X POST') =>
  postPayload(`gh api ${method} ${endpoint} -f event=COMMENT ${args}`)

beforeAll(() => {
  fixture = mkdtempSync(join(tmpdir(), 'hooks-guard-'))
  hookPath = pathWithoutCanon()

  const project = join(fixture, 'project')
  for (const dir of [
    join(project, 'canon/context/development'),
    join(project, '.claude/tasks'),
    join(project, '.claude/worktrees/demo'),
    join(project, 'indexed'),
    join(project, 'src'),
    join(fixture, 'bin'),
    join(fixture, 'bin-no-runner'),
    join(fixture, 'bin-reply-links'),
    join(fixture, 'bin-jq-trap'),
    join(fixture, 'bin-empty-set'),
    join(fixture, 'bin-advisory'),
    join(fixture, 'bin-tables'),
    join(fixture, 'bin-no-record'),
    join(fixture, 'bin-due'),
    join(fixture, 'bin-scan-fail'),
    join(fixture, 'bin-scan-pass'),
    join(fixture, 'bin-board'),
    join(fixture, 'bin-board-refused'),
    join(fixture, 'no-source'),
    join(fixture, 'read-only'),
    join(fixture, 'elsewhere/tmp'),
  ]) {
    mkdirSync(dir, { recursive: true })
  }

  readOnlyRoot = join(fixture, 'read-only')

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
    if (found) symlinkSync(found, join(fixture, 'bin-no-runner', name))
  }

  // A `jq` that fails loudly, so a hook that reached it on a payload it should
  // have dismissed by shell test alone says so on stderr. `bash` is linked in
  // because the hook still needs a shell to run under.
  const bash = findOnPath('bash')
  if (bash) symlinkSync(bash, join(fixture, 'bin-jq-trap', 'bash'))
  const trap = join(fixture, 'bin-jq-trap/jq')
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
    const stub = join(fixture, 'bin', name)
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
  const narrowed = join(fixture, 'bin-empty-set/canon')
  writeFileSync(
    narrowed,
    `#!/usr/bin/env bash\nprintf '%s\\n' '{"entries":[],"bans":{"emptySets":["characters"]}}'\n`,
  )
  chmodSync(narrowed, 0o755)

  // A record carrying no ban and two advisory findings, one colon on a line
  // the edits below do or do not introduce and one heading, so the new-text
  // filter and the unfiltered heading read are each observable.
  const advisory = join(fixture, 'bin-advisory/canon')
  writeFileSync(
    advisory,
    `#!/usr/bin/env bash\nprintf '%s\\n' '{"entries":[{"path":"doc.md","bans":[],"colons":[{"line":3,"column":14,"text":"Prose sentence: another clause.","lead":"sentence"},{"line":5,"column":14,"text":"Ship it 🚀 now: it works.","lead":"now"}],"headingCase":[{"line":1,"text":"Key Changes","words":["Changes"]}]}],"bans":{"emptySets":[]}}'\n`,
  )
  chmodSync(advisory, 0o755)

  // A record carrying table findings alone: two gated density kinds, one counted
  // and one a shape, and one that only reports, so each message is observable.
  const tables = join(fixture, 'bin-tables/canon')
  writeFileSync(
    tables,
    `#!/usr/bin/env bash\nprintf '%s\\n' '{"entries":[{"path":"doc.md","bans":[],"density":[{"kind":"table-cell","line":7,"value":130,"limit":120,"gating":true},{"kind":"table-then-list","line":8,"value":null,"limit":null,"gating":true}],"tables":[{"kind":"table-token","line":9,"value":31,"limit":30}]}],"bans":{"emptySets":[]}}'\n`,
  )
  chmodSync(tables, 0o755)

  // A verb that declined to measure writes no record at all, which is what it
  // does outside a git repository. Reading the findings alone reports that as a
  // clean file, so the stub writes nothing and the hooks answer emptiness.
  const silent = join(fixture, 'bin-no-record/canon')
  writeFileSync(silent, '#!/usr/bin/env bash\nexit 1\n')
  chmodSync(silent, 0o755)

  // The reminder reads a due record off `bun src/cli.ts upstream due`, so the
  // stub answers one and the output is the fixture's rather than whichever
  // cursor and network the machine carries.
  const due = join(fixture, 'bin-due/bun')
  writeFileSync(
    due,
    `#!/usr/bin/env bash\nprintf '%s\\n' '{"due":true,"reason":"week","releases":4}'\n`,
  )
  chmodSync(due, 0o755)

  // The review post hook gates on the scan's exit code and reads no record
  // field, so a stub exiting 2 with a warning line stands in for a finding, and
  // one exiting 0 for a clean body. The real scan is the one the verb's own
  // tests cover.
  const scanFail = join(fixture, 'bin-scan-fail/canon')
  writeFileSync(
    scanFail,
    `#!/usr/bin/env bash\nprintf '%s\\n' '│ ! 1 board identifier in the title or body.' >&2\nexit 2\n`,
  )
  chmodSync(scanFail, 0o755)

  const scanPass = join(fixture, 'bin-scan-pass/canon')
  writeFileSync(scanPass, '#!/usr/bin/env bash\nexit 0\n')
  chmodSync(scanPass, 0o755)

  // The board hook reads its findings out of a `tasks validate --json` record
  // and exits 0 whatever the verb exits, so a stub answering one finding with
  // the verb's own exit 2 stands in for a board a hand edit broke.
  const board = join(fixture, 'bin-board/canon')
  writeFileSync(
    board,
    `#!/usr/bin/env bash\nprintf '%s\\n' '{"ok":true,"findings":[{"kind":"cell-long","group":"Needs a plan","subject":"v1.0-a","message":"carries a long cell."}]}'\nexit 2\n`,
  )
  chmodSync(board, 0o755)

  // A refused validation carries `ok:false`, which jq's `//` reads as absent,
  // so this stub is what makes the refusal branch observable.
  const refused = join(fixture, 'bin-board-refused/canon')
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
    const stub = join(fixture, 'bin-reply-links', name)
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
  writeFileSync(join(project, 'hooks-guard-Xray/review-body.md'), '## Review\n')
  writeFileSync(
    join(project, 'doc.md'),
    '# Doc\n\nA line with an em dash — in it.\n',
  )
  writeFileSync(join(project, 'indexed/index.md'), '# Index\n')
  writeFileSync(
    join(project, 'canon/context/development/local-loop.md'),
    'Dev commands.\n',
  )
  writeFileSync(join(project, '.claude/tasks/sample.md'), 'no frontmatter\n')
  writeFileSync(join(project, '.claude/worktrees/demo/note.md'), 'note\n')

  // One payload per hook that reaches the branch doing the work, paired with a
  // string only that branch emits. A payload the read mangled produces the
  // quiet fall-through instead, so these are what make the guard's fidelity
  // observable rather than assumed.
  acting = {
    'board-validate.sh': {
      expect: 'cell-long: v1.0-a carries a long cell.',
      path: [join(fixture, 'bin-board'), hookPath].join(delimiter),
      payload: () =>
        payloadFor({
          tool_input: { file_path: join(project, '.canon/tasks/priority.md') },
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
            file_path: join(fixture, '.claude/projects/x/memory/note.md'),
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
        const transcriptPath = join(fixture, `plan-guard-${key}.jsonl`)
        writeFileSync(transcriptPath, '')
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
      path: [join(fixture, 'bin-reply-links'), hookPath].join(delimiter),
      payload: () => stopPayload('See [it](src/gone.ts).'),
      stream: 'stderr',
    },
    'records-index.sh': {
      expect: '.claude/tasks/index.md',
      payload: () =>
        payloadFor({
          tool_input: { file_path: join(project, '.claude/tasks/sample.md') },
          tool_name: 'Write',
        }),
    },
    'review-post-scan.sh': {
      code: 2,
      expect: 'board identifier',
      path: [join(fixture, 'bin-scan-fail'), hookPath].join(delimiter),
      payload: () => reviewPost(`-F body=@${join(project, 'review-body.md')}`),
      stream: 'stderr',
    },
    'scratch-guard.sh': {
      expect: 'Temporary file write outside',
      payload: (nonce) =>
        payloadFor({
          session_id: nonce,
          tool_input: { file_path: join(fixture, 'elsewhere/tmp/foo.txt') },
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
        const transcriptPath = join(fixture, `transcript-${key}.jsonl`)
        const promptId = `prompt-${key}`
        const writtenPath = join(fixture, `silent-turn-written-${key}.txt`)
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
      path: [join(fixture, 'bin'), hookPath].join(delimiter),
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
      path: [join(fixture, 'bin-due'), hookPath].join(delimiter),
      payload: () => payloadFor({ source: 'startup' }),
    },
  }

  // Last, so nothing else in this setup is writing into it any more. A root the
  // hook cannot create its marker under is what reaches the fail-open branch,
  // and the mode is the only way to produce that without mocking the script.
  chmodSync(readOnlyRoot, 0o555)
})

afterAll(() => {
  // Restored first, so the recursive remove is not the thing the mode refuses.
  chmodSync(readOnlyRoot, 0o755)
  rmSync(fixture, { force: true, recursive: true })
})

for (const tree of TREES) {
  const hooks = readdirSync(tree.dir).filter(
    (name) => name.endsWith('.sh') && !UNGUARDED.has(name),
  )

  describe(tree.label, () => {
    // Concurrent because every refusal test spends the guard's two seconds
    // waiting, and eleven of them in series would dominate the suite.
    for (const name of hooks) {
      const hook = join(tree.dir, name)

      it.concurrent(
        `should refuse ${name} with a usage line when no payload arrives`,
        async ({ expect }) => {
          const result = await run(hook)

          expect(result.code).not.toBe(0)
          expect(result.stderr).toContain('cannot be run by hand')
        },
        REFUSAL_TIMEOUT_MS,
      )

      it.concurrent(`should leave ${name} silent on a payload it ignores`, async ({
        expect,
      }) => {
        const result = await run(hook, INERT_PAYLOAD)

        expect(result.stderr).toBe('')
        expect(result.stdout).toBe('')
        expect(result.code).toBe(0)
      })

      // A hook added without an acting case fails here rather than passing on
      // the refusal test alone, which is what keeps the directory walk honest.
      it.concurrent(`should carry ${name} through to its verdict on an acting payload`, async ({
        expect,
      }) => {
        const expected = acting[name]
        expect(expected, `no acting case defined for ${name}`).toBeDefined()

        const result = await run(
          hook,
          expected.payload(`${tree.label}-${name}`),
          expected.path,
          undefined,
          expected.env,
        )

        expect(result[expected.stream ?? 'stdout']).toContain(expected.expect)
        expect(result.code).toBe(expected.code ?? 0)
        // A runtime error such as `declare -A` on bash 3.2 leaves the verdict
        // and the exit intact, so only the diagnostic itself shows the break.
        // Several hooks deliver their verdict on stderr, so the stream cannot
        // be asserted empty, and the match is bash's `<file>: line <n>: ` form.
        expect(result.stderr).not.toMatch(BASH_DIAGNOSTIC)
      })
    }
  })
}

// The board hook validates the ordering file alone, so an edit to a sibling
// record exits before the verb, which the finding stub would otherwise report.
describe('board-validate.sh scope', () => {
  for (const tree of TREES) {
    for (const name of ['backlog.md', 'index.md']) {
      it(`should stay silent on an edit to ${name} in ${tree.label}`, async () => {
        const result = await run(
          join(tree.dir, 'board-validate.sh'),
          payloadFor({
            tool_input: {
              file_path: join(fixture, `project/.canon/tasks/${name}`),
            },
            tool_name: 'Edit',
          }),
          [join(fixture, 'bin-board'), hookPath].join(delimiter),
        )

        expect(result.stdout).toBe('')
        expect(result.code).toBe(0)
      })
    }
  }
})

// A refusal carries `ok:false`, and a hook that reads it with `// empty` reports
// the board as unvalidated instead of refused.
describe('board-validate.sh refusal', () => {
  for (const tree of TREES) {
    it(`should report a refused validation on ${tree.label}`, async () => {
      const result = await run(
        join(tree.dir, 'board-validate.sh'),
        payloadFor({
          tool_input: {
            file_path: join(fixture, 'project/.canon/tasks/priority.md'),
          },
          tool_name: 'Edit',
        }),
        [join(fixture, 'bin-board-refused'), hookPath].join(delimiter),
      )

      expect(result.stdout).toContain('refused the board after this edit')
      expect(result.stdout).toContain('no board here.')
      expect(result.code).toBe(0)
    })
  }
})

// The block fires once, and a reply with no link never starts the CLI. The
// acting case above proves the stub still answers, which is what makes the
// silences here mean something.
describe('reply-links.sh firing conditions', () => {
  for (const tree of TREES) {
    const hook = join(tree.dir, 'reply-links.sh')
    const path = (): string =>
      [join(fixture, 'bin-reply-links'), hookPath].join(delimiter)
    const calls = (name: string): string => join(fixture, `${name}.calls`)
    const callCount = (name: string): number =>
      existsSync(calls(name))
        ? readFileSync(calls(name), 'utf8').split('\n').filter(Boolean).length
        : 0
    const runWith = (reply: string, name: string, active = false) =>
      run(hook, stopPayload(reply, active), path(), undefined, {
        REPLY_LINKS_CALLS: calls(name),
      })

    it.concurrent(`should pass the continuation on ${tree.label}`, async ({
      expect,
    }) => {
      const name = `${tree.label.replace(/\W/g, '_')}-active`
      const result = await runWith('See [it](src/gone.ts).', name, true)

      expect(result.code).toBe(0)
      expect(result.stderr).toBe('')
      expect(callCount(name)).toBe(0)
    })

    it.concurrent(`should never spawn the CLI for a reply with no link on ${tree.label}`, async ({
      expect,
    }) => {
      const name = `${tree.label.replace(/\W/g, '_')}-nolink`
      const result = await runWith('Done. Nothing to link here (really).', name)

      expect(result.code).toBe(0)
      expect(result.stderr).toBe('')
      expect(callCount(name)).toBe(0)
    })

    it.concurrent(`should leave ${tree.label} silent on a clean record`, async ({
      expect,
    }) => {
      const clean = join(
        fixture,
        `bin-reply-links-clean-${tree.label.replace(/\W/g, '_')}`,
      )
      mkdirSync(clean, { recursive: true })
      for (const name of ['canon', 'bun']) {
        writeFileSync(
          join(clean, name),
          `#!/usr/bin/env bash\nprintf '%s\\n' '{"ok":true,"missing":[]}'\n`,
        )
        chmodSync(join(clean, name), 0o755)
      }
      const result = await run(
        hook,
        stopPayload('See [it](src/real.ts).'),
        [clean, hookPath].join(delimiter),
      )

      expect(result.code).toBe(0)
      expect(result.stderr).toBe('')
    })

    it.concurrent(`should report rather than pass when no record comes back on ${tree.label}`, async ({
      expect,
    }) => {
      const result = await run(
        hook,
        stopPayload('See [it](src/gone.ts).'),
        [join(fixture, 'bin-no-record'), hookPath].join(delimiter),
      )

      expect(result.code).toBe(1)
      expect(result.stderr).toContain('was not checked')
    })

    it.concurrent(`should report rather than pass when jq is missing on ${tree.label}`, async ({
      expect,
    }) => {
      const bare = join(fixture, 'bin-no-jq-only-bash')
      mkdirSync(bare, { recursive: true })
      const bash = findOnPath('bash')
      if (bash && !existsSync(join(bare, 'bash'))) {
        symlinkSync(bash, join(bare, 'bash'))
      }
      const result = await run(hook, stopPayload('[it](src/gone.ts)'), bare)

      expect(result.code).toBe(1)
      expect(result.stderr).toContain('was not checked')
    })
  }
})

const writeOf = (relative: string): string =>
  payloadFor({
    tool_input: { file_path: join(fixture, 'project', relative) },
    tool_name: 'Write',
  })

// Each folder under each root must name its own index. A merged hook that
// resolved one folder's spelling for every write would pass a single acting case.
describe('records-index.sh folders and roots', () => {
  for (const tree of TREES) {
    const hook = join(tree.dir, 'records-index.sh')

    for (const folder of ['tasks']) {
      for (const root of ['.canon', '.claude']) {
        it.concurrent(`should name ${root}/${folder}/index.md on ${tree.label}`, async ({
          expect,
        }) => {
          const result = await run(hook, writeOf(`${root}/${folder}/x.md`))

          expect(result.stdout).toContain(`${root}/${folder}/index.md`)
          expect(result.code).toBe(0)
        })
      }
    }

    it.concurrent(`should index a task under a review folder on ${tree.label}`, async ({
      expect,
    }) => {
      const result = await run(hook, writeOf('.canon/tasks/review/x.md'))

      expect(result.stdout).toContain('.canon/tasks/index.md')
    })
  }
})

// A folder sits inside the one it archives, and the path guard is a shell
// pattern whose wildcard crosses a separator, so `*/.claude/tasks/*.md` reaches
// an archived task as readily as a live one. A regen fired on it rebuilds the
// live index off a folder it was taken out of.
//
// Silence alone would also be the reading if the hook stopped working, and the
// cases above are what separate the two.
describe('records-index.sh exclusions', () => {
  const excluded = [
    ['tasks', 'archive/v01.0-shipped.md'],
    ['tasks', 'declined/idea.md'],
    ['tasks', 'index.md'],
    ['memory', 'sample.md'],
  ]

  for (const tree of TREES) {
    const hook = join(tree.dir, 'records-index.sh')

    for (const [folder, rest] of excluded) {
      for (const root of ['.canon', '.claude']) {
        it.concurrent(`should leave ${tree.label} silent on ${root}/${folder}/${rest}`, async ({
          expect,
        }) => {
          const result = await run(hook, writeOf(`${root}/${folder}/${rest}`))

          expect(result.stdout).toBe('')
          expect(result.stderr).toBe('')
          expect(result.code).toBe(0)
        })
      }
    }
  }
})

// The reminder fires on a search and nothing else, once per session, and never
// on a key it had to invent. The acting case above proves it still fires, which
// is what makes each silence below mean something.
describe('search-reminder.sh firing conditions', () => {
  for (const tree of TREES) {
    const hook = join(tree.dir, 'search-reminder.sh')
    const search = (session?: string) =>
      payloadFor({
        session_id: session,
        tool_input: { query: 'bun test runner' },
        tool_name: 'WebSearch',
      })

    it.concurrent(`should leave ${tree.label} silent on a fetch`, async ({
      expect,
    }) => {
      const result = await run(
        hook,
        payloadFor({
          session_id: `${tree.label}-fetch`,
          tool_input: { url: 'https://example.com' },
          tool_name: 'WebFetch',
        }),
      )

      expect(result.stdout).toBe('')
      expect(result.code).toBe(0)
    })

    it.concurrent(`should fire once per session on ${tree.label}`, async ({
      expect,
    }) => {
      const session = `${tree.label}-repeat`
      const first = await run(hook, search(session))
      const second = await run(hook, search(session))

      expect(first.stdout).toContain('canon:search-craft')
      expect(second.stdout).toBe('')
    })

    it.concurrent(`should leave ${tree.label} silent on a search with no session id`, async ({
      expect,
    }) => {
      const result = await run(hook, search())

      expect(result.stdout).toBe('')
      expect(result.code).toBe(0)
    })
  }
})

// CLAUDE_PROJECT_DIR is the session's own worktree rather than the main root,
// so a naive read would log a pull request opened from a linked worktree into
// a folder that dies with the worktree, losing exactly the row the log exists
// to keep. The hook strips the worktree segment back to the main root before
// writing, the way records-index.sh already derives its own.
describe('pr-create-log.sh root resolution', () => {
  const hook = join(ROOT, '.claude/hooks/pr-create-log.sh')

  it.concurrent('should log under the main root rather than a linked worktree', async ({
    expect,
  }) => {
    const project = join(fixture, 'project')
    const worktreeRoot = join(project, '.claude/worktrees/demo')
    const result = await run(
      hook,
      payloadFor({
        session_id: 'pr-create-log-worktree-root',
        tool_input: { command: 'gh pr create --title x --body y' },
        tool_response: {
          stdout: 'https://github.com/example/repo/pull/99\n',
        },
      }),
      undefined,
      worktreeRoot,
    )

    expect(result.code).toBe(0)
    expect(existsSync(join(worktreeRoot, '.canon/tmp/pr/log/log.md'))).toBe(
      false,
    )
    expect(
      readFileSync(join(project, '.canon/tmp/pr/log/log.md'), 'utf8'),
    ).toContain('pr=https://github.com/example/repo/pull/99')
  })
})

// git-pr opens a pull request over REST rather than through `gh pr create`, so
// the command string carries no subcommand to match. Its output says which
// path ran, and an edit prints a URL too, so that line is what separates an
// opening from a rewrite of one that already existed.
describe('pr-create-log.sh REST create', () => {
  for (const tree of TREES) {
    const hook = join(tree.dir, 'pr-create-log.sh')
    const payload = (nonce: string, opened: boolean): string =>
      payloadFor({
        session_id: nonce,
        tool_input: {
          command: "gh api -X POST 'repos/{owner}/{repo}/pulls' -f title=x",
        },
        tool_response: {
          stdout: `number=7\nurl=https://github.com/example/repo/pull/7\nhead=feat/x\nopened=${opened}\n`,
        },
      })

    it.concurrent(`should remind on ${tree.label} when the run opened a pull request`, async ({
      expect,
    }) => {
      const result = await run(hook, payload(`${tree.label}-rest-open`, true))

      expect(result.stdout).toContain(
        'Pull request https://github.com/example/repo/pull/7 just opened',
      )
      expect(result.code).toBe(0)
    })

    it.concurrent(`should stay silent on ${tree.label} when the run edited one`, async ({
      expect,
    }) => {
      const result = await run(hook, payload(`${tree.label}-rest-edit`, false))

      expect(result.stdout).toBe('')
      expect(result.code).toBe(0)
    })
  }
})

// A pull request opened with `gh pr create` skipped git-pr, so nothing has
// labelled it and the hook names the verb that does. The line stays off the
// REST path, which already ran the verb, and off a canon that predates it.
describe('pr-create-log.sh label line', () => {
  const byHand = (nonce: string): string =>
    payloadFor({
      session_id: nonce,
      tool_input: { command: 'gh pr create --title x --body y' },
      tool_response: { stdout: 'https://github.com/example/repo/pull/12\n' },
    })

  for (const tree of TREES) {
    const treeHook = join(tree.dir, 'pr-create-log.sh')

    it.concurrent(`should name the apply verb on ${tree.label} after gh pr create`, async ({
      expect,
    }) => {
      const stubs = mkdtempSync(join(tmpdir(), 'hooks-guard-canon-'))
      writeFileSync(join(stubs, 'canon'), '#!/bin/sh\nexit 0\n')
      chmodSync(join(stubs, 'canon'), 0o755)

      const result = await run(
        treeHook,
        byHand(`${tree.label}-label-by-hand`),
        [stubs, hookPath].join(delimiter),
      )

      expect(result.stdout).toContain('Run canon labels apply 12 to label it.')
      rmSync(stubs, { recursive: true, force: true })
    })

    it.concurrent(`should stay off the apply verb on ${tree.label} after git-pr's own open`, async ({
      expect,
    }) => {
      const stubs = mkdtempSync(join(tmpdir(), 'hooks-guard-canon-'))
      writeFileSync(join(stubs, 'canon'), '#!/bin/sh\nexit 0\n')
      chmodSync(join(stubs, 'canon'), 0o755)

      const result = await run(
        treeHook,
        payloadFor({
          session_id: `${tree.label}-label-rest`,
          tool_input: {
            command: "gh api -X POST 'repos/{owner}/{repo}/pulls' -f title=x",
          },
          tool_response: {
            stdout:
              'number=7\nurl=https://github.com/example/repo/pull/7\nhead=feat/x\nopened=true\n',
          },
        }),
        [stubs, hookPath].join(delimiter),
      )

      expect(result.stdout).toContain('just opened')
      expect(result.stdout).not.toContain('canon labels apply')
      rmSync(stubs, { recursive: true, force: true })
    })

    it.concurrent(`should stay off the apply verb on ${tree.label} when the installed canon lacks it`, async ({
      expect,
    }) => {
      const result = await run(treeHook, byHand(`${tree.label}-label-absent`))

      expect(result.stdout).toContain('just opened')
      expect(result.stdout).not.toContain('canon labels apply')
    })
  }
})

// A bare basename match reads as covering both when two written paths share
// one, since a single mention of the shared name would otherwise clear the
// pair. The acting case above never exercises this, since its fixture writes
// one path.
describe('silent-turn.sh basename collision', () => {
  for (const tree of TREES) {
    const hook = join(tree.dir, 'silent-turn.sh')

    it.concurrent(`should block on ${tree.label} when two written paths share a basename and neither full path is named`, async ({
      expect,
    }) => {
      const key = `collision-${tree.label.replace(/[^A-Za-z0-9_.-]/g, '_')}`
      const transcriptPath = join(fixture, `transcript-${key}.jsonl`)
      const promptId = `prompt-${key}`
      const first = join(fixture, `docs/${key}/index.md`)
      const second = join(fixture, `wiki/${key}/index.md`)
      const lines = [
        { promptId, type: 'user' },
        {
          message: {
            content: [
              {
                input: { content: 'a', file_path: first },
                name: 'Write',
                type: 'tool_use',
              },
            ],
          },
          type: 'assistant',
        },
        {
          message: {
            content: [
              {
                input: { content: 'b', file_path: second },
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

      const result = await run(
        hook,
        payloadFor({
          hook_event_name: 'Stop',
          last_assistant_message: 'Wrote index.md with the new content.',
          prompt_id: promptId,
          stop_hook_active: false,
          transcript_path: transcriptPath,
        }),
      )

      expect(result.stderr).toContain('did not name:')
      expect(result.stderr).toContain(first)
      expect(result.stderr).toContain(second)
      expect(result.code).toBe(2)
    })
  }
})

// macOS ships bash 3.2 as `/usr/bin/env bash`, which refuses every construct
// below. A hook using one fails on a stock Mac and passes on every Linux
// runner, so nothing but a scan of the source catches it.
const BASH4_CONSTRUCTS = [
  { label: 'declare -A', pattern: /\bdeclare\s+-[A-Za-z]*A/ },
  { label: 'declare -n', pattern: /\bdeclare\s+-[A-Za-z]*n/ },
  { label: 'local -n', pattern: /\blocal\s+-[A-Za-z]*n/ },
  ...['mapfile', 'readarray', 'coproc'].map((word) => ({
    label: word,
    pattern: new RegExp(`\\b${word}\\b`),
  })),
  { label: 'case modification', pattern: /\$\{[A-Za-z_]\w*(\^\^?|,,?)\}/ },
]

function findBash4Constructs(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.sh'))
    .flatMap((name) =>
      readFileSync(join(dir, name), 'utf8')
        .split('\n')
        .flatMap((line, index) =>
          line.trimStart().startsWith('#')
            ? []
            : BASH4_CONSTRUCTS.filter(({ pattern }) => pattern.test(line)).map(
                ({ label }) => `${name}:${index + 1} ${label}`,
              ),
        ),
    )
}

describe('bash 3.2 compatibility', () => {
  it.each(TREES)('should use no bash-4-only construct in $label', ({ dir }) => {
    expect(findBash4Constructs(dir)).toEqual([])
  })
})

// Both copies shell out to the audit verb, and this one resolves two runners
// where the seed resolves one. The describe below covers the seed.
//
// The acting case above proves the hook reaches a verdict and says nothing
// about which runner produced it, so a branch could stop resolving and stay
// silent with every test still green. Each stub reports a `kind` naming
// itself, which is what makes the answer readable.
describe('.claude/hooks/standards-audit.sh runner', () => {
  const hook = join(ROOT, '.claude/hooks/standards-audit.sh')

  const payload = (): string =>
    JSON.stringify({
      tool_input: { file_path: join(fixture, 'project/doc.md') },
      tool_name: 'Write',
    })

  const withStubs = (): string =>
    [join(fixture, 'bin'), hookPath].join(delimiter)

  it.concurrent('should prefer the checkout CLI when the root carries src/cli.ts', async ({
    expect,
  }) => {
    const result = await run(hook, payload(), withStubs())

    expect(result.stdout).toContain('via-bun')
    expect(result.code).toBe(0)
  })

  it.concurrent('should fall back to the installed binary when the root carries no src/cli.ts', async ({
    expect,
  }) => {
    const root = join(fixture, 'no-source')

    const result = await run(hook, payload(), withStubs(), root)

    expect(result.stdout).toContain('via-canon')
    expect(result.code).toBe(0)
  })

  it.concurrent('should report that nothing ran when the machine carries neither runner', async ({
    expect,
  }) => {
    // The linked dependencies and nothing else, so neither runner resolves
    // whatever the machine carries. A missing link would take the run
    // somewhere silent for a reason this test is not about.
    const path = join(fixture, 'bin-no-runner')
    expect(existsSync(join(path, 'bash')), 'no bash found to link').toBe(true)
    expect(existsSync(join(path, 'jq')), 'no jq found to link').toBe(true)

    const result = await run(hook, payload(), path)

    expect(result.stdout).toContain('nothing checked')
    expect(result.stdout).toContain(join(fixture, 'project/doc.md'))
    expect(result.code).toBe(0)
  })

  it.concurrent('should name a ban set the verb shipped empty', async ({
    expect,
  }) => {
    // `no-source` carries no `src/cli.ts`, which is what sends the hook past
    // the checkout branch to the stubbed binary.
    const path = [join(fixture, 'bin-empty-set'), hookPath].join(delimiter)

    const result = await run(hook, payload(), path, join(fixture, 'no-source'))

    expect(result.stdout).toContain('characters')
    expect(result.stdout).toContain('narrowed set')
    expect(result.code).toBe(0)
  })

  it.concurrent('should report a run that returned no record at all', async ({
    expect,
  }) => {
    const path = [join(fixture, 'bin-no-record'), hookPath].join(delimiter)

    const result = await run(hook, payload(), path, join(fixture, 'no-source'))

    expect(result.stdout).toContain('nothing checked')
    expect(result.stdout).toContain('no record')
    expect(result.code).toBe(0)
  })

  it.concurrent('should hand back a gated cell and trailing list under the density message and a wide token as a report', async ({
    expect,
  }) => {
    const path = [join(fixture, 'bin-tables'), hookPath].join(delimiter)

    const result = await run(hook, payload(), path, join(fixture, 'no-source'))

    expect(result.stdout).toContain(':7  table-cell  130 past 120  gating')
    expect(result.stdout).toContain(
      ':8  table-then-list  a list follows the table with no lead sentence  gating',
    )
    expect(result.stdout).not.toContain('opens with neither')
    expect(result.stdout).toContain(':9  table-token  31 past 30')
    expect(result.stdout).toContain('never fail a push')
    expect(result.code).toBe(0)
  })
})

// The seed reaches one runner where the toolkit copy reaches two, so the branch
// it takes and the two it degrades onto are what these cover. A scaffolded
// project may carry no binary at all, and the pass a silent hook reports there
// covers less than a reader would take it to cover.
describe('seeds standards-audit.sh runner', () => {
  const hook = join(
    ROOT,
    'tooling/claude/seeds/.claude/hooks/standards-audit.sh',
  )

  const payload = (): string =>
    JSON.stringify({
      tool_input: { file_path: join(fixture, 'project/doc.md') },
      tool_name: 'Write',
    })

  it.concurrent('should read its findings out of the installed binary', async ({
    expect,
  }) => {
    // The seed resolves no checkout source, so the `canon` stub is the only
    // branch it can take and `via-canon` is what proves it took one rather
    // than reaching a verdict some other way.
    const path = [join(fixture, 'bin'), hookPath].join(delimiter)

    const result = await run(hook, payload(), path)

    expect(result.stdout).toContain('via-canon')
    expect(result.code).toBe(0)
  })

  it.concurrent('should report that nothing ran when the machine carries no binary', async ({
    expect,
  }) => {
    // The linked dependencies and nothing else, so no runner resolves
    // whatever the machine carries. A missing link would take the run
    // somewhere silent for a reason this test is not about.
    const path = join(fixture, 'bin-no-runner')
    expect(existsSync(join(path, 'bash')), 'no bash found to link').toBe(true)
    expect(existsSync(join(path, 'jq')), 'no jq found to link').toBe(true)

    const result = await run(hook, payload(), path)

    expect(result.stdout).toContain('nothing checked')
    expect(result.stdout).toContain(join(fixture, 'project/doc.md'))
    expect(result.code).toBe(0)
  })

  it.concurrent('should name a ban set the verb shipped empty', async ({
    expect,
  }) => {
    const path = [join(fixture, 'bin-empty-set'), hookPath].join(delimiter)

    const result = await run(hook, payload(), path)

    expect(result.stdout).toContain('shipped ban set is empty')
    expect(result.stdout).toContain('characters')
    expect(result.code).toBe(0)
  })

  it.concurrent('should hand back a gated cell and trailing list under the density message and a wide token as a report', async ({
    expect,
  }) => {
    const path = [join(fixture, 'bin-tables'), hookPath].join(delimiter)

    const result = await run(hook, payload(), path)

    expect(result.stdout).toContain(':7  table-cell  130 past 120  gating')
    expect(result.stdout).toContain(
      ':8  table-then-list  a list follows the table with no lead sentence  gating',
    )
    expect(result.stdout).not.toContain('opens with neither')
    expect(result.stdout).toContain(':9  table-token  31 past 30')
    expect(result.stdout).toContain('never fail a push')
    expect(result.code).toBe(0)
  })

  it.concurrent('should warn on a colon the write introduced and a heading in the file', async ({
    expect,
  }) => {
    const path = [join(fixture, 'bin-advisory'), hookPath].join(delimiter)
    const write = JSON.stringify({
      tool_input: {
        file_path: join(fixture, 'project/doc.md'),
        content: '# Key Changes\n\nProse sentence: another clause.\n',
      },
      tool_name: 'Write',
    })

    const result = await run(hook, write, path)

    expect(result.stdout).toContain('Prose sentence: another clause.')
    expect(result.stdout).toContain('Key Changes')
    expect(result.code).toBe(0)
  })

  it.concurrent('should warn on a colon an edit introduced inside a longer line', async ({
    expect,
  }) => {
    // The record's text is the whole line, so a filter matching the line
    // against the new text drops an edit that rewrote only a phrase of it.
    const path = [join(fixture, 'bin-advisory'), hookPath].join(delimiter)
    const edit = JSON.stringify({
      tool_input: {
        file_path: join(fixture, 'project/doc.md'),
        old_string: 'sentence \u2014 another',
        new_string: 'sentence: another',
      },
      tool_name: 'Edit',
    })

    const result = await run(hook, edit, path)

    expect(result.stdout).toContain('Prose sentence: another clause.')
    expect(result.code).toBe(0)
  })

  it.concurrent('should warn on a colon an edit introduced after an emoji in its line', async ({
    expect,
  }) => {
    // The record names the word before each colon, so a line with an emoji
    // is matched by that word. Slicing its text at a UTF-16 column lands one
    // character off in jq and keys the match on `now::`, which drops it.
    const path = [join(fixture, 'bin-advisory'), hookPath].join(delimiter)
    const edit = JSON.stringify({
      tool_input: {
        file_path: join(fixture, 'project/doc.md'),
        old_string: 'now, it works',
        new_string: 'now: it works',
      },
      tool_name: 'Edit',
    })

    const result = await run(hook, edit, path)

    expect(result.stdout).toContain('Ship it')
    expect(result.code).toBe(0)
  })

  it.concurrent('should stay quiet on a colon an edit left untouched', async ({
    expect,
  }) => {
    const path = [join(fixture, 'bin-advisory'), hookPath].join(delimiter)
    const edit = JSON.stringify({
      tool_input: {
        file_path: join(fixture, 'project/doc.md'),
        old_string: 'one',
        new_string: 'two',
      },
      tool_name: 'Edit',
    })

    const result = await run(hook, edit, path)

    expect(result.stdout).not.toContain('Prose sentence')
    expect(result.stdout).toContain('Key Changes')
    expect(result.code).toBe(0)
  })

  it.concurrent('should report a run that returned no record at all', async ({
    expect,
  }) => {
    const path = [join(fixture, 'bin-no-record'), hookPath].join(delimiter)

    const result = await run(hook, payload(), path)

    expect(result.stdout).toContain('nothing checked')
    expect(result.stdout).toContain('no record')
    expect(result.code).toBe(0)
  })
})

// The acting case proves a finding blocks. These pin what the hook promises
// around it: a clean body, a read, and a post it cannot scan each take their
// own verdict, and none of them reaches the session by stdout on the block path.
describe('review-post-scan.sh verdicts', () => {
  const scanPassPath = (): string =>
    [join(fixture, 'bin-scan-pass'), hookPath].join(delimiter)

  for (const tree of TREES) {
    const hook = join(tree.dir, 'review-post-scan.sh')
    const body = (): string =>
      `-F body=@${join(fixture, 'project/review-body.md')}`

    it.concurrent(`should leave ${tree.label} silent on a clean body`, async ({
      expect,
    }) => {
      const result = await run(hook, reviewPost(body()), scanPassPath())

      expect(result.stdout).toBe('')
      expect(result.stderr).toBe('')
      expect(result.code).toBe(0)
    })

    it.concurrent(`should leave ${tree.label} silent on a read of the same endpoint`, async ({
      expect,
    }) => {
      const result = await run(
        hook,
        postPayload(`gh api ${REVIEWS}`),
        join(fixture, 'bin-scan-fail') + delimiter + hookPath,
      )

      expect(result.stdout).toBe('')
      expect(result.stderr).toBe('')
      expect(result.code).toBe(0)
    })

    it.concurrent(`should block ${tree.label} on a post that names no method but carries fields`, async ({
      expect,
    }) => {
      const result = await run(
        hook,
        postPayload(`gh api ${REVIEWS} -f event=COMMENT ${body()}`),
        join(fixture, 'bin-scan-fail') + delimiter + hookPath,
      )

      expect(result.stderr).toContain('board identifier')
      expect(result.code).toBe(2)
    })

    it.concurrent(`should match a method placed after the endpoint on ${tree.label}`, async ({
      expect,
    }) => {
      const result = await run(
        hook,
        postPayload(`gh api ${REVIEWS} ${body()} -X PATCH`),
        join(fixture, 'bin-scan-fail') + delimiter + hookPath,
      )

      expect(result.code).toBe(2)
    })

    it.concurrent(`should not read a flag inside the body path as the method on ${tree.label}`, async ({
      expect,
    }) => {
      const result = await run(
        hook,
        postPayload(
          `gh api ${REVIEWS} -f event=COMMENT -F body=@${join(fixture, 'project/hooks-guard-Xray/review-body.md')}`,
        ),
        join(fixture, 'bin-scan-fail') + delimiter + hookPath,
      )

      expect(result.stderr).toContain('board identifier')
      expect(result.code).toBe(2)
    })

    it.concurrent(`should cover a pull request comment on ${tree.label}`, async ({
      expect,
    }) => {
      const result = await run(
        hook,
        reviewPost(body(), 'repos/{owner}/{repo}/issues/7/comments'),
        join(fixture, 'bin-scan-fail') + delimiter + hookPath,
      )

      expect(result.code).toBe(2)
    })

    it.concurrent(`should leave ${tree.label} silent on a pull request create`, async ({
      expect,
    }) => {
      const result = await run(
        hook,
        reviewPost(body(), "'repos/{owner}/{repo}/pulls'"),
        join(fixture, 'bin-scan-fail') + delimiter + hookPath,
      )

      expect(result.stderr).toBe('')
      expect(result.code).toBe(0)
    })

    it.concurrent(`should refuse an inline body on ${tree.label}`, async ({
      expect,
    }) => {
      const result = await run(
        hook,
        reviewPost("-f body='looks fine'"),
        scanPassPath(),
      )

      expect(result.stderr).toContain('-F body=@<file>')
      expect(result.stdout).toBe('')
      expect(result.code).toBe(2)
    })

    it.concurrent(`should block ${tree.label} on a body file the call has not written yet`, async ({
      expect,
    }) => {
      const result = await run(
        hook,
        reviewPost('-F body=@.canon/tmp/not-written.md'),
        scanPassPath(),
      )

      expect(result.stderr).toContain('earlier call')
      expect(result.code).toBe(2)
    })

    it.concurrent(`should resolve a relative body path against the payload cwd on ${tree.label}`, async ({
      expect,
    }) => {
      const result = await run(
        hook,
        postPayload(
          `gh api -X POST ${REVIEWS} -F body=@review-body.md`,
          join(fixture, 'project'),
        ),
        scanPassPath(),
        join(fixture, 'elsewhere'),
      )

      expect(result.stderr).toBe('')
      expect(result.code).toBe(0)
    })

    // A command that only mentions a post is not one. The scan stub fails, so
    // a hook that read the whole string would deny each of these.
    const mention = "gh api -X POST repos/o/r/issues/1/comments -f body='x'"
    const quoting: Record<string, string> = {
      'a heredoc quoting the command': `cat > .canon/tmp/notes.md <<'EOF'\n- ${mention}\nEOF`,
      'a search pattern holding the command': `git grep -n '${mention}'`,
      'a quoted string with a separator before the command': `echo 'done; ${mention}'`,
      'an echo of the command': `echo "${mention}"`,
    }

    for (const [label, command] of Object.entries(quoting)) {
      it.concurrent(`should leave ${tree.label} silent on ${label}`, async ({
        expect,
      }) => {
        const result = await run(
          hook,
          postPayload(command),
          join(fixture, 'bin-scan-fail') + delimiter + hookPath,
        )

        expect(result.stderr).toBe('')
        expect(result.stdout).toBe('')
        expect(result.code).toBe(0)
      })
    }

    it.concurrent(`should block ${tree.label} on a post chained after another command`, async ({
      expect,
    }) => {
      const result = await run(
        hook,
        postPayload(`echo ready && gh api -X POST ${REVIEWS} ${body()}`),
        join(fixture, 'bin-scan-fail') + delimiter + hookPath,
      )

      expect(result.stderr).toContain('board identifier')
      expect(result.code).toBe(2)
    })

    // A here-string and an arithmetic shift both carry `<<` and neither opens
    // a heredoc, so the post on the next line must still reach the scan.
    const notHeredocs: Record<string, string> = {
      'a here-string with a space': 'cat <<< word',
      'a here-string with no space': 'cat <<<word',
      'a shift in a command substitution': 'echo $((1<<2))',
      'a shift between names': 'echo $((a<<n))',
      'a shift in an arithmetic command': '(( x<<2 ))',
      'a shift in a let command': 'let x=1<<2',
      'a shift nested in parentheses': 'echo $(( (1<<2) + 3 ))',
    }

    for (const [label, opener] of Object.entries(notHeredocs)) {
      it.concurrent(`should block ${tree.label} on a post after ${label}`, async ({
        expect,
      }) => {
        const result = await run(
          hook,
          postPayload(`${opener}\ngh api -X POST ${REVIEWS} ${body()}`),
          join(fixture, 'bin-scan-fail') + delimiter + hookPath,
        )

        expect(result.stderr).toContain('board identifier')
        expect(result.code).toBe(2)
      })
    }

    it.concurrent(`should block ${tree.label} on a post after a here-string on one line`, async ({
      expect,
    }) => {
      const result = await run(
        hook,
        postPayload(`cat <<<word; gh api -X POST ${REVIEWS} ${body()}`),
        join(fixture, 'bin-scan-fail') + delimiter + hookPath,
      )

      expect(result.stderr).toContain('board identifier')
      expect(result.code).toBe(2)
    })

    it.concurrent(`should still drop a quoted post inside a heredoc after a here-string on ${tree.label}`, async ({
      expect,
    }) => {
      const result = await run(
        hook,
        postPayload(
          `cat <<< word\ncat > .canon/tmp/n.md <<'EOF'\n- ${mention}\nEOF`,
        ),
        join(fixture, 'bin-scan-fail') + delimiter + hookPath,
      )

      expect(result.stderr).toBe('')
      expect(result.code).toBe(0)
    })

    it.concurrent(`should still open a heredoc after a digit file descriptor on ${tree.label}`, async ({
      expect,
    }) => {
      const result = await run(
        hook,
        postPayload(`cat 0<<EOF\n- ${mention}\nEOF`),
        join(fixture, 'bin-scan-fail') + delimiter + hookPath,
      )

      expect(result.stderr).toBe('')
      expect(result.code).toBe(0)
    })

    it.concurrent(`should block ${tree.label} on a heredoc and a post in one call`, async ({
      expect,
    }) => {
      const result = await run(
        hook,
        postPayload(
          `cat > .canon/tmp/not-written.md <<'EOF'\nbody\nEOF\ngh api -X POST ${REVIEWS} -F body=@.canon/tmp/not-written.md`,
        ),
        scanPassPath(),
      )

      expect(result.stderr).toContain('earlier call')
      expect(result.code).toBe(2)
    })

    it.concurrent(`should hand back additionalContext on ${tree.label} when canon is absent`, async ({
      expect,
    }) => {
      const result = await run(hook, reviewPost(body()), hookPath)

      expect(result.stdout).toContain('additionalContext')
      expect(result.stdout).toContain('did not run')
      expect(result.code).toBe(0)
    })
  }
})

// Held local rather than seeded, per the canon-no-seed marker on the file
// itself, so it exists in .claude/hooks/ alone and the directory walk above
// never reaches a seed copy to test.
//
// The acting case above proves the reminder fires on an attended startup. These
// pin the two silences it promises, since a stub answering due on every call
// would otherwise pass a hook that never filtered.
describe('upstream-due.sh silences', () => {
  const hook = join(ROOT, '.claude/hooks/upstream-due.sh')
  const dueBin = (): string =>
    [join(fixture, 'bin-due'), hookPath].join(delimiter)

  it.concurrent('should stay silent in a background session', async ({
    expect,
  }) => {
    const result = await run(
      hook,
      payloadFor({ source: 'startup' }),
      dueBin(),
      undefined,
      { CLAUDE_CODE_SESSION_ATTENDED: '0' },
    )

    expect(result.stdout).toBe('')
    expect(result.code).toBe(0)
  })

  it.concurrent('should stay silent on a resume', async ({ expect }) => {
    const result = await run(
      hook,
      payloadFor({ source: 'resume' }),
      dueBin(),
      undefined,
      { CLAUDE_CODE_SESSION_ATTENDED: undefined },
    )

    expect(result.stdout).toBe('')
    expect(result.code).toBe(0)
  })
})

// The acting case proves a write into the folder is denied. These are the
// boundaries around it: the folder's shape is what separates a memory write
// from any other path holding a `memory` segment, and the `Bash` arm reads a
// command unexpanded where the file tools carry an absolute path. The hook
// exists only in `.claude/hooks/`, so this runs against that path alone.
describe('memory-guard.sh boundaries', () => {
  const hook = join(ROOT, '.claude/hooks/memory-guard.sh')
  const home = '/home/x/.claude/projects/-home-x-repo'

  // Every real payload carries the session transcript, which sits under the
  // same projects folder the guard watches, so a case built without it never
  // exercises the payload the hook receives.
  const transcript_path = `${home}/0f2c.jsonl`

  const fileTool = (tool: string, file: string): string =>
    payloadFor({
      tool_input: { file_path: file },
      tool_name: tool,
      transcript_path,
    })
  const shell = (command: string): string =>
    payloadFor({
      tool_input: { command },
      tool_name: 'Bash',
      transcript_path,
    })

  const denied: ReadonlyArray<readonly [string, string]> = [
    ['a Write to a memory note', fileTool('Write', `${home}/memory/note.md`)],
    [
      'a Write to the memory index',
      fileTool('Write', `${home}/memory/MEMORY.md`),
    ],
    ['an Edit', fileTool('Edit', `${home}/memory/note.md`)],
    ['a MultiEdit', fileTool('MultiEdit', `${home}/memory/note.md`)],
    [
      'a tilde path in Bash',
      shell('echo x > ~/.claude/projects/-a/memory/n.md'),
    ],
    [
      'a $HOME path in Bash',
      shell('echo x > $HOME/.claude/projects/-a/memory/n.md'),
    ],
    ['an absolute path in Bash', shell(`echo x > ${home}/memory/n.md`)],
    [
      'a multi-line Bash command',
      shell(`ls\ncp a ${home}/memory/n.md\necho done`),
    ],
    [
      'a CLAUDE_CONFIG_DIR path in Bash',
      shell('echo x > "$CLAUDE_CONFIG_DIR/projects/-a/memory/n.md"'),
    ],
    ['a quoted target without whitespace', shell(`cp a "${home}/memory/n.md"`)],
    ['a tee target', shell(`echo x | tee ${home}/memory/n.md`)],
    [
      'a write after a heredoc terminator',
      shell(`cat > a.md <<'EOF'\nnote\nEOF\ncp a.md ${home}/memory/n.md`),
    ],
    [
      'a write by the command that opened a heredoc',
      shell(`cat > ${home}/memory/n.md <<'EOF'\nnote\nEOF`),
    ],
    [
      'a write after a separator outside quotes',
      shell(`echo 'a; b'; cp x ${home}/memory/n.md`),
    ],
    [
      'a redirect after a heredoc body naming CLAUDE_CONFIG_DIR',
      shell(
        `cat <<EOF\n$CLAUDE_CONFIG_DIR/projects/-a/memory/n.md\nEOF\necho x > $CLAUDE_CONFIG_DIR/projects/-a/memory/n.md`,
      ),
    ],
    ['a here-string naming the folder', shell(`cat <<< ${home}/memory/n.md`)],
    ['a read of the folder through grep', shell(`grep -rn x ${home}/memory`)],
    [
      'a write after a here-string whose word starts with a letter',
      shell(`cat <<< x\ncp a ${home}/memory/n.md`),
    ],
    [
      'a write after a here-string with no space',
      shell(`cat <<<x\ncp a ${home}/memory/n.md`),
    ],
    [
      'a write after an arithmetic shift',
      shell(`echo $((1<<2))\ncp a ${home}/memory/n.md`),
    ],
    [
      'a write after a let shift',
      shell(`let x=1<<2\ncp a ${home}/memory/n.md`),
    ],
    ['a write inside bash -c', shell(`bash -c 'cp a ${home}/memory/n.md'`)],
    [
      'a write inside sudo bash -c',
      shell(`sudo bash -c 'cp a ${home}/memory/n.md'`),
    ],
    [
      'a write inside timeout sh -c',
      shell(`timeout 5 sh -c 'cp a ${home}/memory/n.md'`),
    ],
    [
      'a write inside xargs sh -c',
      shell(`ls | xargs -n1 sh -c 'cp a ${home}/memory/n.md'`),
    ],
    [
      'a write in a python heredoc behind an assignment',
      shell(
        `X=1 python3 - <<'EOF'\nopen('${home}/memory/n.md', 'w').write('x')\nEOF`,
      ),
    ],
    [
      'a write in the body of a bash heredoc',
      shell(`bash <<EOF\ncp a ${home}/memory/n.md\nEOF`),
    ],
    [
      'a write in the body of a python heredoc',
      shell(
        `python3 - <<'EOF'\nopen('${home}/memory/n.md', 'w').write('x')\nEOF`,
      ),
    ],
  ]

  const silent: ReadonlyArray<readonly [string, string]> = [
    ['a session transcript', fileTool('Write', `${home}/session.jsonl`)],
    ['a source folder named memory', fileTool('Write', '/r/src/memory/x.ts')],
    [
      'a canon records folder named memory',
      fileTool('Write', '/r/.canon/memory/a.md'),
    ],
    [
      'a folder only prefixed memory',
      fileTool('Write', `${home}/memory-old/a.md`),
    ],
    ['a read of the folder', fileTool('Read', `${home}/memory/note.md`)],
    ['a command mentioning memory alone', shell('grep -rn memory src/')],
    ['a command naming projects alone', shell('ls ~/.claude/projects')],
    [
      'a heredoc body quoting the folder',
      shell(
        `cat > .canon/tmp/t.md <<'EOF'\nThe guard denies ${home}/memory/n.md\nEOF`,
      ),
    ],
    [
      'a heredoc with a dash and an unquoted terminator',
      shell(`cat > a.md <<-EOF\n\t${home}/memory/n.md\n\tEOF`),
    ],
    [
      'two heredocs on one line',
      shell(
        `cat <<A <<B > a.md\n${home}/memory/n.md\nA\n${home}/memory/m.md\nB`,
      ),
    ],
    [
      'a quoted prose mention',
      shell(`grep -rn "see ${home}/memory/ for notes" docs`),
    ],
    ['a trailing comment', shell(`ls src # not ${home}/memory`)],
    [
      'a commit message naming the folder',
      shell(`git commit -m "guard ${home}/memory writes"`),
    ],
    [
      'a gh api body field naming the folder',
      shell(`gh api x -f body='denied: ${home}/memory/n.md'`),
    ],
    ['a separator inside quotes', shell(`echo 'a; cp x ${home}/memory/n.md'`)],
    [
      'a commit message behind an assignment and a wrapper',
      shell(`env X=1 git commit -m "see ${home}/memory notes"`),
    ],
    [
      'prose after an interpreter command has ended',
      shell(`bash -c 'ls'; git commit -m "see ${home}/memory notes"`),
    ],
    [
      'a CLAUDE_CONFIG_DIR path in a heredoc body',
      shell(`cat <<EOF\n$CLAUDE_CONFIG_DIR/projects/-a/memory/n.md\nEOF`),
    ],
    [
      'a multi-line command with the folder only in a heredoc',
      shell(`ls\ncat > a.md <<'EOF'\n${home}/memory/n.md\nEOF\necho done`),
    ],
  ]

  for (const [label, payload] of denied) {
    it.concurrent(`should deny ${label}`, async ({ expect }) => {
      const result = await run(hook, payload)

      expect(result.stderr).toContain('Auto memory is off')
      expect(result.stdout).toBe('')
      expect(result.code).toBe(2)
    })
  }

  for (const [label, payload] of silent) {
    it.concurrent(`should stay silent on ${label}`, async ({ expect }) => {
      const result = await run(hook, payload)

      expect(result.stderr).toBe('')
      expect(result.stdout).toBe('')
      expect(result.code).toBe(0)
    })
  }

  it.concurrent('should dismiss a command mentioning memory without spawning jq', async ({
    expect,
  }) => {
    const result = await run(
      hook,
      shell('grep -rn memory src/'),
      join(fixture, 'bin-jq-trap'),
    )

    expect(result.stderr).toBe('')
    expect(result.code).toBe(0)
  })

  it.concurrent('should still reach a verdict when the transcript path precedes the command', async ({
    expect,
  }) => {
    const result = await run(hook, shell(`cp a ${home}/memory/n.md`))

    expect(result.stderr).toContain('Auto memory is off')
    expect(result.code).toBe(2)
  })

  it.concurrent('should deny a write under the directory CLAUDE_CONFIG_DIR names', async ({
    expect,
  }) => {
    const result = await run(
      hook,
      fileTool('Write', '/opt/cfg/projects/-a/memory/n.md'),
      undefined,
      undefined,
      { CLAUDE_CONFIG_DIR: '/opt/cfg' },
    )

    expect(result.stderr).toContain('Auto memory is off')
    expect(result.code).toBe(2)
  })
})

// The guard decides on three readings at once: whether the command writes a
// plan path, whether that path names a file yet, and whether the transcript
// carries an invocation no earlier new plan spent. Each project below is its
// own root holding one existing plan, so a marker one case writes never
// licenses or blocks another.
describe('plan-guard.sh firing conditions', () => {
  // The line shapes the guard reads an invocation from, pinned here because the
  // transcript format is Claude Code's rather than canon's.
  const SKILL_CALL = JSON.stringify({
    message: {
      content: [
        {
          input: { skill: 'canon:plan-feature' },
          name: 'Skill',
          type: 'tool_use',
        },
      ],
    },
    type: 'assistant',
  })
  const SLASH_COMMAND = JSON.stringify({
    message: { content: '<command-name>/canon:plan-feature</command-name>' },
    type: 'user',
  })

  let count = 0
  const planProject = (
    transcript = '',
  ): { root: string; transcript: string } => {
    count++
    const root = join(fixture, `plan-guard-project-${count}`)
    mkdirSync(join(root, '.canon/plans'), { recursive: true })
    writeFileSync(join(root, '.canon/plans/feature-old.md'), '# Old\n')
    const transcriptPath = join(root, 'transcript.jsonl')
    writeFileSync(transcriptPath, transcript)
    return { root, transcript: transcriptPath }
  }

  const shellIn = (
    project: { root: string; transcript: string },
    command: string,
  ): string =>
    payloadFor({
      cwd: project.root,
      session_id: 'plan-guard-session',
      tool_input: { command },
      tool_name: 'Bash',
      transcript_path: project.transcript,
    })

  const heredoc = (path: string): string => `cat > ${path} <<'EOF'\n# Plan\nEOF`

  for (const tree of TREES) {
    const hook = join(tree.dir, 'plan-guard.sh')

    describe(tree.label, () => {
      it.each([
        ['a heredoc', heredoc('.canon/plans/feature-new.md')],
        ['a tee', 'echo x | tee -a .canon/plans/feature-new.md'],
        ['a cp', 'cp /tmp/draft.md .canon/plans/feature-new.md'],
        [
          'a heredoc onto a main-root variable',
          heredoc('"$root/.canon/plans/feature-new.md"'),
        ],
      ])(
        'should block a new plan written by %s with no invocation',
        async (_, command) => {
          const project = planProject()

          const result = await run(hook, shellIn(project, command))

          expect(result.stderr).toContain('.canon/plans/feature-new.md')
          expect(result.stderr).toContain('Invoke the canon:plan-feature skill')
          expect(result.code).toBe(2)
        },
      )

      it('should block a Write creating a new plan with no invocation', async () => {
        const project = planProject()

        const result = await run(
          hook,
          payloadFor({
            cwd: project.root,
            session_id: 'plan-guard-session',
            tool_input: {
              file_path: join(project.root, '.canon/plans/feature-new.md'),
            },
            tool_name: 'Write',
            transcript_path: project.transcript,
          }),
        )

        expect(result.code).toBe(2)
      })

      it('should block a second new plan on one invocation', async () => {
        const project = planProject(`${SKILL_CALL}\n`)
        await run(hook, shellIn(project, heredoc('.canon/plans/feature-a.md')))

        const result = await run(
          hook,
          shellIn(project, heredoc('.canon/plans/feature-b.md')),
        )

        expect(result.stderr).toContain('spent on an earlier new plan')
        expect(result.code).toBe(2)
      })

      it('should pass the second new plan once a second invocation follows', async () => {
        const project = planProject(`${SKILL_CALL}\n`)
        await run(hook, shellIn(project, heredoc('.canon/plans/feature-a.md')))
        writeFileSync(project.transcript, `${SKILL_CALL}\n${SKILL_CALL}\n`)

        const result = await run(
          hook,
          shellIn(project, heredoc('.canon/plans/feature-b.md')),
        )

        expect(result.code).toBe(0)
      })

      it.each([
        ['a Skill tool call', SKILL_CALL],
        ['a typed slash command', SLASH_COMMAND],
      ])('should pass a new plan after %s', async (_, line) => {
        const project = planProject(`${line}\n`)

        const result = await run(
          hook,
          shellIn(project, heredoc('.canon/plans/feature-new.md')),
        )

        expect(result.stderr).toBe('')
        expect(result.code).toBe(0)
      })

      it.each([
        [
          'a heredoc overwrite of an existing plan',
          heredoc('.canon/plans/feature-old.md'),
        ],
        ['a read of an existing plan', 'cat .canon/plans/feature-old.md'],
        [
          'an archive move',
          'mv .canon/plans/feature-old.md .canon/plans/archive/feature-old.md',
        ],
        [
          'a write under the archive',
          heredoc('.canon/plans/archive/feature-new.md'),
        ],
        [
          'a verb naming a new plan',
          'canon tasks plan-link .canon/plans/feature-new.md',
        ],
        [
          'a heredoc body quoting a plan path',
          "cat > notes.md <<'EOF'\nsee > .canon/plans/feature-new.md\nEOF",
        ],
        [
          'a redirect inside a quoted argument',
          'git commit -m "write > .canon/plans/feature-new.md"',
        ],
      ])('should pass %s with no invocation', async (_, command) => {
        const project = planProject()

        const result = await run(hook, shellIn(project, command))

        expect(result.stderr).toBe('')
        expect(result.code).toBe(0)
      })

      it('should pass an Edit of an existing plan with no invocation', async () => {
        const project = planProject()

        const result = await run(
          hook,
          payloadFor({
            cwd: project.root,
            session_id: 'plan-guard-session',
            tool_input: {
              file_path: join(project.root, '.canon/plans/feature-old.md'),
            },
            tool_name: 'Edit',
            transcript_path: project.transcript,
          }),
        )

        expect(result.code).toBe(0)
      })

      it.each([
        ['no session id', { session_id: undefined }],
        ['no transcript path', { transcript_path: undefined }],
        ['an unreadable transcript', { transcript_path: '/nowhere/t.jsonl' }],
      ])('should fail open on %s', async (_, override) => {
        const project = planProject()
        const fields = {
          ...(JSON.parse(
            shellIn(project, heredoc('.canon/plans/feature-new.md')),
          ) as Record<string, unknown>),
          ...override,
        }

        const result = await run(hook, payloadFor(fields))

        expect(result.code).toBe(0)
      })

      it('should dismiss a command naming no plan path without spawning jq', async () => {
        const project = planProject()

        const result = await run(
          hook,
          shellIn(project, 'echo x > notes.md'),
          join(fixture, 'bin-jq-trap'),
        )

        expect(result.stderr).toBe('')
        expect(result.code).toBe(0)
      })
    })
  }
})

// Each trigger reaches the session by a different channel, so the cases
// deciding whether the hook is safe are the ones the acting case above cannot
// reach: an automatic compaction has to instruct the summarizer without ever
// blocking, and a manual one has to stop asking after the first refusal.
// Blocking every `/compact` would trap the session that answered and the
// session that declined alike, and blocking an automatic one stops a compaction
// nobody is told about.
describe('.claude/hooks/precompact-handoff.sh', () => {
  const hook = join(ROOT, '.claude/hooks/precompact-handoff.sh')

  const payload = (fields: Record<string, unknown>): string =>
    JSON.stringify({ hook_event_name: 'PreCompact', ...fields })

  it.concurrent('should instruct the summarizer rather than block an automatic compaction', async ({
    expect,
  }) => {
    const result = await run(
      hook,
      payload({ session_id: 'precompact-auto', trigger: 'auto' }),
    )

    expect(result.stdout).toContain('Preserve the reasoning')
    expect(result.stderr).toBe('')
    expect(result.code).toBe(0)
  })

  it.concurrent('should instruct on every automatic compaction rather than once', async ({
    expect,
  }) => {
    // A precompute pass fires this hook with a payload identical to the real
    // compaction's and drops its own record when refused, so it re-arms and
    // fires again. Anything counted per session is drained by firings the
    // session never sees, which is why the automatic path counts nothing.
    const once = payload({ session_id: 'precompact-arms', trigger: 'auto' })

    const first = await run(hook, once)
    const second = await run(hook, once)

    expect(second.stdout).toBe(first.stdout)
    expect(second.code).toBe(0)
  })

  it.concurrent('should block a compaction whose payload names no trigger', async ({
    expect,
  }) => {
    // An absent trigger is the payload the hook cannot answer with silence,
    // so it takes the manual path and asks.
    const result = await run(hook, payload({ session_id: 'precompact-bare' }))

    expect(result.stderr).toContain('Run the canon:session-compact skill')
    expect(result.code).toBe(2)
  })

  it.concurrent('should block a manual compaction once and let the next one through', async ({
    expect,
  }) => {
    const once = payload({
      session_id: 'precompact-repeat',
      trigger: 'manual',
    })

    const first = await run(hook, once)
    const second = await run(hook, once)

    expect(first.stderr).toContain('Run the canon:session-compact skill')
    expect(first.code).toBe(2)
    expect(second.stderr).toBe('')
    expect(second.code).toBe(0)
  })

  it.concurrent('should keep the blocking reason off stdout', async ({
    expect,
  }) => {
    // Exit 2 makes stderr the blocking reason, and stdout on this event is
    // merged into the summarizer's instructions. Writing there would address
    // the summary of a compaction that is not going to happen, while the
    // block itself stayed unexplained.
    const result = await run(
      hook,
      payload({ session_id: 'precompact-out', trigger: 'manual' }),
    )

    expect(result.stdout).toBe('')
    expect(result.code).toBe(2)
  })

  it.concurrent('should carry on rather than block when the marker cannot be written', async ({
    expect,
  }) => {
    // The marker is what ends the block, so blocking without recording it
    // would refuse every compaction the session takes. A project root the
    // hook cannot write to is the case that reaches that, and it has to fail
    // open: one unasked handoff costs less than a session that cannot compact.
    const result = await run(
      hook,
      payload({ session_id: 'precompact-readonly' }),
      undefined,
      readOnlyRoot,
    )

    expect(result.stdout).toBe('')
    expect(result.code).toBe(0)
  })
})

// The cloud VM loads no plugin, so the hook stages the checkout's own skills
// and CLI where a project session reads them. Locally it must write nothing,
// since the same settings file runs it on every session start here.
describe('.claude/hooks/cloud-setup.sh', () => {
  const hook = join(ROOT, '.claude/hooks/cloud-setup.sh')
  const made: string[] = []

  afterAll(() => {
    for (const dir of made) rmSync(dir, { force: true, recursive: true })
  })
  const git = (cwd: string, ...args: string[]): string =>
    execFileSync(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args],
      { cwd, encoding: 'utf8' },
    )

  const makeCheckout = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'cloud-setup-'))
    made.push(dir)
    for (const [path, body] of [
      ['claude/skills/demo/SKILL.md', '# Demo\n'],
      ['claude/skills/demo/references/notes.md', 'notes\n'],
      ['.claude/skills/internal-demo/SKILL.md', '# Internal\n'],
    ] as const) {
      mkdirSync(join(dir, path, '..'), { recursive: true })
      writeFileSync(join(dir, path), body)
    }
    git(dir, 'init', '-q')
    git(dir, 'add', '.')
    git(dir, 'commit', '-q', '-m', 'init')
    return dir
  }

  // A stub runner that records each call, so the install is observable without
  // a network and the failure branch is reachable on demand.
  const makeBun = (
    exitCode: number,
    base: string = process.env.PATH ?? '',
  ): { log: string; path: string } => {
    const bin = mkdtempSync(join(tmpdir(), 'cloud-setup-bin-'))
    made.push(bin)
    const log = join(bin, 'calls.log')
    writeFileSync(
      join(bin, 'bun'),
      `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> '${log}'\nexit ${exitCode}\n`,
    )
    chmodSync(join(bin, 'bun'), 0o755)
    return { log, path: [bin, base].join(delimiter) }
  }

  const status = (dir: string): string => git(dir, 'status', '--porcelain')

  it.concurrent('should write nothing outside a cloud VM', async ({
    expect,
  }) => {
    const dir = makeCheckout()
    const bun = makeBun(0)

    const result = await run(hook, '{}', bun.path, dir, {
      CLAUDE_CODE_REMOTE: undefined,
    })

    expect(result.code).toBe(0)
    expect(result.stdout).toBe('')
    expect(existsSync(join(dir, '.claude/skills/demo'))).toBe(false)
    expect(existsSync(bun.log)).toBe(false)
    expect(status(dir)).toBe('')
  })

  it.concurrent('should stage the skills and the CLI on a cloud VM', async ({
    expect,
  }) => {
    const dir = makeCheckout()
    const bun = makeBun(0)

    const result = await run(hook, '{}', bun.path, dir, {
      CLAUDE_CODE_REMOTE: 'true',
    })

    expect(result.code).toBe(0)
    expect(
      readFileSync(
        join(dir, '.claude/skills/demo/references/notes.md'),
        'utf8',
      ),
    ).toBe('notes\n')
    expect(existsSync(join(dir, '.claude/standards'))).toBe(false)
    expect(readFileSync(bun.log, 'utf8')).toBe('install\nlink\n')
    expect(status(dir)).toBe('')
  })

  it.concurrent('should add each exclude line once when run twice', async ({
    expect,
  }) => {
    const dir = makeCheckout()
    const bun = makeBun(0)
    const env = { CLAUDE_CODE_REMOTE: 'true' }

    await run(hook, '{}', bun.path, dir, env)
    const second = await run(hook, '{}', bun.path, dir, env)

    const exclude = readFileSync(join(dir, '.git/info/exclude'), 'utf8')
      .split('\n')
      .filter((line) => line.startsWith('/.claude/'))
    expect(second.code).toBe(0)
    expect(exclude).toEqual(['/.claude/skills/demo/'])
    expect(status(dir)).toBe('')
  })

  it.concurrent('should say the CLI is missing when the install fails', async ({
    expect,
  }) => {
    const dir = makeCheckout()
    const bun = makeBun(1)

    const result = await run(hook, '{}', bun.path, dir, {
      CLAUDE_CODE_REMOTE: 'true',
    })

    expect(result.code).toBe(0)
    expect(result.stdout).toContain('canon is not installed')
    expect(existsSync(join(dir, '.claude/skills/demo/SKILL.md'))).toBe(true)
  })

  // A link can succeed into a bin folder the session's PATH never reads, which
  // leaves every skill calling a verb that is not there and nothing saying so.
  it.concurrent('should say canon is off the PATH when the link succeeds but nothing resolves it', async ({
    expect,
  }) => {
    const dir = makeCheckout()
    const bun = makeBun(0, hookPath)

    const result = await run(hook, '{}', bun.path, dir, {
      CLAUDE_CODE_REMOTE: 'true',
    })

    expect(result.code).toBe(0)
    expect(result.stdout).toContain('canon is not on PATH')
  })
})
