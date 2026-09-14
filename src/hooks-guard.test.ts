import { spawn } from 'node:child_process'
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
import { afterAll, beforeAll, describe, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..')

// Both trees carry the same guard and nothing else compares them, so a fix
// landing in one and not the other passes every other stage in the gate.
const TREES = [
  { dir: join(ROOT, '.claude/hooks'), label: '.claude/hooks' },
  {
    dir: join(ROOT, 'tooling/claude/seeds/.claude/hooks'),
    label: 'tooling/claude/seeds/.claude/hooks',
  },
]

// The one hook that reads no payload, and so carries no guard to assert on.
const UNGUARDED = 'bare-flag-repair.sh'

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
  readonly elapsed: number
  readonly stderr: string
  readonly stdout: string
}

let fixture: string
let hookPath: string
let readOnlyRoot: string
let acting: Record<string, ActingCase>

// `canon indexes regen` succeeds on the index hooks where the CLI is installed
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
    const started = performance.now()
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
      resolve({ code, elapsed: performance.now() - started, stderr, stdout })
    })

    if (payload !== undefined) child.stdin.end(payload)
  })

const payloadFor = (fields: Record<string, unknown>): string =>
  JSON.stringify(fields)

beforeAll(() => {
  fixture = mkdtempSync(join(tmpdir(), 'hooks-guard-'))
  hookPath = pathWithoutCanon()

  const project = join(fixture, 'project')
  for (const dir of [
    join(project, 'canon/context/development'),
    join(project, '.claude/memory'),
    join(project, '.claude/tasks'),
    join(project, '.claude/worktrees/demo'),
    join(project, 'indexed'),
    join(project, 'src'),
    join(fixture, 'bin'),
    join(fixture, 'bin-no-runner'),
    join(fixture, 'bin-empty-set'),
    join(fixture, 'bin-no-record'),
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
    `#!/usr/bin/env bash\nprintf '%s\\n' '{"entries":[],"bans":{"emptySets":["words"]}}'\n`,
  )
  chmodSync(narrowed, 0o755)

  // A verb that declined to measure writes no record at all, which is what it
  // does outside a git repository. Reading the findings alone reports that as a
  // clean file, so the stub writes nothing and the hooks answer emptiness.
  const silent = join(fixture, 'bin-no-record/canon')
  writeFileSync(silent, '#!/usr/bin/env bash\nexit 1\n')
  chmodSync(silent, 0o755)

  // An empty file is enough, since the hook tests for the path and the stub
  // runner never reads it. Without it the project root takes the fallback and
  // the branch the hook prefers is exercised by nothing.
  writeFileSync(join(project, 'src/cli.ts'), '')

  writeFileSync(
    join(project, 'doc.md'),
    '# Doc\n\nA line with an em dash — in it.\n',
  )
  writeFileSync(join(project, 'indexed/index.md'), '# Index\n')
  writeFileSync(
    join(project, 'canon/context/development/index.md'),
    'Dev commands.\n',
  )
  writeFileSync(join(project, '.claude/tasks/sample.md'), 'no frontmatter\n')
  writeFileSync(join(project, '.claude/memory/sample.md'), 'no frontmatter\n')
  writeFileSync(join(project, '.claude/worktrees/demo/note.md'), 'note\n')

  // One payload per hook that reaches the branch doing the work, paired with a
  // string only that branch emits. A payload the read mangled produces the
  // quiet fall-through instead, so these are what make the guard's fidelity
  // observable rather than assumed.
  acting = {
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
    'memory-index.sh': {
      expect: '.claude/memory/index.md',
      payload: () =>
        payloadFor({
          tool_input: { file_path: join(project, '.claude/memory/sample.md') },
          tool_name: 'Write',
        }),
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
      expect: 'Run the canon:session-map skill',
      payload: (nonce) =>
        payloadFor({
          hook_event_name: 'PreCompact',
          session_id: nonce,
        }),
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
    'tasks-index.sh': {
      expect: '.claude/tasks/index.md',
      payload: () =>
        payloadFor({
          tool_input: { file_path: join(project, '.claude/tasks/sample.md') },
          tool_name: 'Write',
        }),
    },
    'unattended-agent-guard.sh': {
      code: 2,
      env: { CLAUDE_CODE_SESSION_ATTENDED: '0' },
      expect: 'may not call the Agent tool',
      payload: (nonce) =>
        payloadFor({
          session_id: nonce,
          tool_input: { subagent_type: 'general-purpose' },
          tool_name: 'Agent',
        }),
      stream: 'stderr',
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
    (name) => name.endsWith('.sh') && name !== UNGUARDED,
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
          expect(result.elapsed).toBeLessThan(3000)
        },
      )

      it.concurrent(
        `should leave ${name} silent on a payload it ignores`,
        async ({ expect }) => {
          const result = await run(hook, INERT_PAYLOAD)

          expect(result.stderr).toBe('')
          expect(result.stdout).toBe('')
          expect(result.code).toBe(0)
        },
      )

      // A hook added without an acting case fails here rather than passing on
      // the refusal test alone, which is what keeps the directory walk honest.
      it.concurrent(
        `should carry ${name} through to its verdict on an acting payload`,
        async ({ expect }) => {
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
        },
      )
    }
  })
}

// The archive sits inside the folder it archives, and the path guard is a shell
// pattern whose wildcard crosses a separator, so `*/.claude/tasks/*.md` reaches
// an archived task as readily as a live one. A regen fired on the archive
// rebuilds the live index off a folder the archive was taken out of.
//
// Silence alone would also be the reading if the hook stopped working, and the
// acting case above is what separates the two: it proves a live task still
// carries through to a verdict on the same tree.
describe('tasks-index.sh archive exclusion', () => {
  for (const tree of TREES) {
    const hook = join(tree.dir, 'tasks-index.sh')

    it.concurrent(
      `should leave ${tree.label} silent on an archived task`,
      async ({ expect }) => {
        const result = await run(
          hook,
          payloadFor({
            tool_input: {
              file_path: join(
                fixture,
                'project/.claude/tasks/archive/v01.0-shipped.md',
              ),
            },
            tool_name: 'Write',
          }),
        )

        expect(result.stdout).toBe('')
        expect(result.stderr).toBe('')
        expect(result.code).toBe(0)
      },
    )
  }
})

// CLAUDE_PROJECT_DIR is the session's own worktree rather than the main root,
// so a naive read would log a pull request opened from a linked worktree into
// a folder that dies with the worktree, losing exactly the row the log exists
// to keep. The hook strips the worktree segment back to the main root before
// writing, the way tasks-index.sh and memory-index.sh already derive theirs.
describe('pr-create-log.sh root resolution', () => {
  const hook = join(ROOT, '.claude/hooks/pr-create-log.sh')

  it.concurrent(
    'should log under the main root rather than a linked worktree',
    async ({ expect }) => {
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
      expect(
        existsSync(join(worktreeRoot, '.claude/.tmp/pr-create-log/log.md')),
      ).toBe(false)
      expect(
        readFileSync(
          join(project, '.claude/.tmp/pr-create-log/log.md'),
          'utf8',
        ),
      ).toContain('pr=https://github.com/example/repo/pull/99')
    },
  )
})

// A bare basename match reads as covering both when two written paths share
// one, since a single mention of the shared name would otherwise clear the
// pair. The acting case above never exercises this, since its fixture writes
// one path.
describe('silent-turn.sh basename collision', () => {
  for (const tree of TREES) {
    const hook = join(tree.dir, 'silent-turn.sh')

    it.concurrent(
      `should block on ${tree.label} when two written paths share a basename and neither full path is named`,
      async ({ expect }) => {
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
      },
    )
  }
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

  it.concurrent(
    'should prefer the checkout CLI when the root carries src/cli.ts',
    async ({ expect }) => {
      const result = await run(hook, payload(), withStubs())

      expect(result.stdout).toContain('via-bun')
      expect(result.code).toBe(0)
    },
  )

  it.concurrent(
    'should fall back to the installed binary when the root carries no src/cli.ts',
    async ({ expect }) => {
      const root = join(fixture, 'no-source')

      const result = await run(hook, payload(), withStubs(), root)

      expect(result.stdout).toContain('via-canon')
      expect(result.code).toBe(0)
    },
  )

  it.concurrent(
    'should report that nothing ran when the machine carries neither runner',
    async ({ expect }) => {
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
    },
  )

  it.concurrent(
    'should name a ban set the verb shipped empty',
    async ({ expect }) => {
      // `no-source` carries no `src/cli.ts`, which is what sends the hook past
      // the checkout branch to the stubbed binary.
      const path = [join(fixture, 'bin-empty-set'), hookPath].join(delimiter)

      const result = await run(
        hook,
        payload(),
        path,
        join(fixture, 'no-source'),
      )

      expect(result.stdout).toContain('words')
      expect(result.stdout).toContain('narrowed set')
      expect(result.code).toBe(0)
    },
  )

  it.concurrent(
    'should report a run that returned no record at all',
    async ({ expect }) => {
      const path = [join(fixture, 'bin-no-record'), hookPath].join(delimiter)

      const result = await run(
        hook,
        payload(),
        path,
        join(fixture, 'no-source'),
      )

      expect(result.stdout).toContain('nothing checked')
      expect(result.stdout).toContain('no record')
      expect(result.code).toBe(0)
    },
  )
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

  it.concurrent(
    'should read its findings out of the installed binary',
    async ({ expect }) => {
      // The seed resolves no checkout source, so the `canon` stub is the only
      // branch it can take and `via-canon` is what proves it took one rather
      // than reaching a verdict some other way.
      const path = [join(fixture, 'bin'), hookPath].join(delimiter)

      const result = await run(hook, payload(), path)

      expect(result.stdout).toContain('via-canon')
      expect(result.code).toBe(0)
    },
  )

  it.concurrent(
    'should report that nothing ran when the machine carries no binary',
    async ({ expect }) => {
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
    },
  )

  it.concurrent(
    'should name a ban set the verb shipped empty',
    async ({ expect }) => {
      const path = [join(fixture, 'bin-empty-set'), hookPath].join(delimiter)

      const result = await run(hook, payload(), path)

      expect(result.stdout).toContain('shipped ban set is empty')
      expect(result.stdout).toContain('words')
      expect(result.code).toBe(0)
    },
  )

  it.concurrent(
    'should report a run that returned no record at all',
    async ({ expect }) => {
      const path = [join(fixture, 'bin-no-record'), hookPath].join(delimiter)

      const result = await run(hook, payload(), path)

      expect(result.stdout).toContain('nothing checked')
      expect(result.stdout).toContain('no record')
      expect(result.code).toBe(0)
    },
  )
})

// Held local rather than seeded, per the canon-no-seed marker on the file
// itself, so it exists in .claude/hooks/ alone and the directory walk above
// never reaches a seed copy to test.
//
// The acting case proves the denial fires on the one value the hook can back.
// Everything else, unset included, is a session this reading cannot classify,
// and classifying it wrong in either direction is worse than saying nothing:
// blocking it traps a session the reading never measured, and reporting a
// pass claims a verdict the hook has no basis for.
describe('unattended-agent-guard.sh classification boundary', () => {
  const hook = join(ROOT, '.claude/hooks/unattended-agent-guard.sh')

  const payload = (): string =>
    payloadFor({ tool_input: {}, tool_name: 'Agent' })

  it.concurrent(
    'should let an Agent call through when CLAUDE_CODE_SESSION_ATTENDED is unset',
    async ({ expect }) => {
      const result = await run(hook, payload(), undefined, undefined, {
        CLAUDE_CODE_SESSION_ATTENDED: undefined,
      })

      expect(result.stdout).toBe('')
      expect(result.stderr).toBe('')
      expect(result.code).toBe(0)
    },
  )

  it.concurrent(
    'should let an Agent call through when CLAUDE_CODE_SESSION_ATTENDED holds a value other than 0',
    async ({ expect }) => {
      const result = await run(hook, payload(), undefined, undefined, {
        CLAUDE_CODE_SESSION_ATTENDED: '1',
      })

      expect(result.stdout).toBe('')
      expect(result.stderr).toBe('')
      expect(result.code).toBe(0)
    },
  )

  it.concurrent(
    'should deny a Task call the same as an Agent call when unattended',
    async ({ expect }) => {
      const result = await run(
        hook,
        payloadFor({ tool_input: {}, tool_name: 'Task' }),
        undefined,
        undefined,
        { CLAUDE_CODE_SESSION_ATTENDED: '0' },
      )

      expect(result.stderr).toContain('may not call the Agent tool')
      expect(result.code).toBe(2)
    },
  )
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

  it.concurrent(
    'should instruct the summarizer rather than block an automatic compaction',
    async ({ expect }) => {
      const result = await run(
        hook,
        payload({ session_id: 'precompact-auto', trigger: 'auto' }),
      )

      expect(result.stdout).toContain('Preserve the reasoning')
      expect(result.stderr).toBe('')
      expect(result.code).toBe(0)
    },
  )

  it.concurrent(
    'should instruct on every automatic compaction rather than once',
    async ({ expect }) => {
      // A precompute pass fires this hook with a payload identical to the real
      // compaction's and drops its own record when refused, so it re-arms and
      // fires again. Anything counted per session is drained by firings the
      // session never sees, which is why the automatic path counts nothing.
      const once = payload({ session_id: 'precompact-arms', trigger: 'auto' })

      const first = await run(hook, once)
      const second = await run(hook, once)

      expect(second.stdout).toBe(first.stdout)
      expect(second.code).toBe(0)
    },
  )

  it.concurrent(
    'should block a compaction whose payload names no trigger',
    async ({ expect }) => {
      // An absent trigger is the payload the hook cannot answer with silence,
      // so it takes the manual path and asks.
      const result = await run(hook, payload({ session_id: 'precompact-bare' }))

      expect(result.stderr).toContain('Run the canon:session-map skill')
      expect(result.code).toBe(2)
    },
  )

  it.concurrent(
    'should block a manual compaction once and let the next one through',
    async ({ expect }) => {
      const once = payload({
        session_id: 'precompact-repeat',
        trigger: 'manual',
      })

      const first = await run(hook, once)
      const second = await run(hook, once)

      expect(first.stderr).toContain('Run the canon:session-map skill')
      expect(first.code).toBe(2)
      expect(second.stderr).toBe('')
      expect(second.code).toBe(0)
    },
  )

  it.concurrent(
    'should keep the blocking reason off stdout',
    async ({ expect }) => {
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
    },
  )

  it.concurrent(
    'should carry on rather than block when the marker cannot be written',
    async ({ expect }) => {
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
    },
  )
})
