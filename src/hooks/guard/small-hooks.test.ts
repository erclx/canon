import { execFileSync } from 'node:child_process'
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
import { describe, expect, it } from 'vitest'
import {
  BASH_DIAGNOSTIC,
  findOnPath,
  INERT_PAYLOAD,
  payloadFor,
  REFUSAL_TIMEOUT_MS,
  ROOT,
  ROSTER_SESSION,
  run,
  stopPayload,
  TREES,
  UNGUARDED,
  useFixture,
} from './fixture'

const ctx = useFixture()

for (const tree of TREES) {
  const hooks = readdirSync(tree.dir).filter(
    (name) => name.endsWith('.sh') && !UNGUARDED.has(name),
  )

  describe(tree.label, () => {
    // Concurrent, since each refusal test waits out the guard's two seconds.
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

      // A hook added without an acting case fails here, keeping the directory walk honest.
      it.concurrent(`should carry ${name} through to its verdict on an ctx.acting payload`, async ({
        expect,
      }) => {
        const expected = ctx.acting[name]
        expect(expected, `no ctx.acting case defined for ${name}`).toBeDefined()

        const result = await run(
          hook,
          expected.payload(`${tree.label}-${name}`),
          expected.path,
          undefined,
          expected.env,
        )

        expect(result[expected.stream ?? 'stdout']).toContain(expected.expect)
        expect(result.code).toBe(expected.code ?? 0)
        // A bash 3.2 runtime error keeps the verdict and exit, so only its diagnostic shows it.
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
              file_path: join(ctx.fixture, `project/.canon/tasks/${name}`),
            },
            tool_name: 'Edit',
          }),
          [join(ctx.fixture, 'bin-board'), ctx.hookPath].join(delimiter),
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
            file_path: join(ctx.fixture, 'project/.canon/tasks/priority.md'),
          },
          tool_name: 'Edit',
        }),
        [join(ctx.fixture, 'bin-board-refused'), ctx.hookPath].join(delimiter),
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
      [join(ctx.fixture, 'bin-reply-links'), ctx.hookPath].join(delimiter)
    const calls = (name: string): string => join(ctx.fixture, `${name}.calls`)
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
        ctx.fixture,
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
        [clean, ctx.hookPath].join(delimiter),
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
        [join(ctx.fixture, 'bin-no-record'), ctx.hookPath].join(delimiter),
      )

      expect(result.code).toBe(1)
      expect(result.stderr).toContain('was not checked')
    })

    it.concurrent(`should report rather than pass when jq is missing on ${tree.label}`, async ({
      expect,
    }) => {
      const bare = join(ctx.fixture, 'bin-no-jq-only-bash')
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

describe('session-name.sh firing conditions', () => {
  for (const tree of TREES) {
    const hook = join(tree.dir, 'session-name.sh')
    const path = (): string =>
      [join(ctx.fixture, 'bin-session-name'), ctx.hookPath].join(delimiter)
    const calls = (name: string): string =>
      join(ctx.fixture, `session-name-${name}.calls`)
    const callCount = (name: string): number =>
      existsSync(calls(name))
        ? readFileSync(calls(name), 'utf8').split('\n').filter(Boolean).length
        : 0
    const key = (suffix: string): string =>
      `${tree.label.replace(/\W/g, '_')}-${suffix}`
    const runWith = (payload: string, name: string) =>
      run(hook, payload, path(), undefined, {
        SESSION_NAME_CALLS: calls(name),
      })

    it.concurrent(`should flag a bare roster id with its session's name on ${tree.label}`, async ({
      expect,
    }) => {
      const result = await runWith(
        stopPayload('Launched 631880bb. It reviews next.'),
        key('bare'),
      )

      expect(result.code).toBe(2)
      expect(result.stderr).toContain('- 631880bb is Review of PR 42')
    })

    it.concurrent(`should pass a reply naming the session anywhere on ${tree.label}`, async ({
      expect,
    }) => {
      const result = await runWith(
        stopPayload(
          `## ${ROSTER_SESSION.name}\n\nStop it with \`claude rm 631880bb\`.`,
        ),
        key('named'),
      )

      expect(result.code).toBe(0)
      expect(result.stderr).toBe('')
    })

    it.concurrent(`should pass a short commit hash no live session answers to on ${tree.label}`, async ({
      expect,
    }) => {
      const result = await runWith(
        stopPayload('Merged at 5eb04ba4 on main.'),
        key('hash'),
      )

      expect(result.code).toBe(0)
      expect(result.stderr).toBe('')
      expect(callCount(key('hash'))).toBe(1)
    })

    it.concurrent(`should never read the roster for a reply with no 8-character token on ${tree.label}`, async ({
      expect,
    }) => {
      // A real payload carries the session's own id, so the reply is what decides.
      const result = await runWith(
        payloadFor({
          hook_event_name: 'Stop',
          last_assistant_message: 'Done, with commit 5eb04ba44 and PR 3144.',
          session_id: ROSTER_SESSION.sessionId,
          stop_hook_active: false,
        }),
        key('notoken'),
      )

      expect(result.code).toBe(0)
      expect(result.stderr).toBe('')
      expect(callCount(key('notoken'))).toBe(0)
    })

    it.concurrent(`should pass the continuation on ${tree.label}`, async ({
      expect,
    }) => {
      const result = await runWith(
        stopPayload('Launched 631880bb.', true),
        key('active'),
      )

      expect(result.code).toBe(0)
      expect(result.stderr).toBe('')
      expect(callCount(key('active'))).toBe(0)
    })

    it.concurrent(`should report rather than pass when no CLI resolves on ${tree.label}`, async ({
      expect,
    }) => {
      const result = await run(
        hook,
        stopPayload('Launched 631880bb.'),
        join(ctx.fixture, 'bin-no-runner'),
      )

      expect(result.code).toBe(1)
      expect(result.stderr).toContain('was not checked')
    })
  }
})

const writeOf = (relative: string): string =>
  payloadFor({
    tool_input: { file_path: join(ctx.fixture, 'project', relative) },
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

// The path guard's wildcard crosses a separator, so it reaches an archived
// task as readily as a live one, and a regen on it rebuilds the live index off
// the wrong folder. The cases above separate silence from a broken hook.
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

// CLAUDE_PROJECT_DIR is the session's own worktree, so a naive read would log
// into a folder that dies with it. The hook strips the worktree segment back
// to the main root first.
describe('pr-create-log.sh root resolution', () => {
  const hook = join(ROOT, '.claude/hooks/pr-create-log.sh')

  it.concurrent('should log under the main root rather than a linked worktree', async ({
    expect,
  }) => {
    const project = join(ctx.fixture, 'project')
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

// git-pr opens a pull request over REST, so the command carries no subcommand
// to match. Its output says which path ran, which separates an opening from a
// rewrite of one that already existed.
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
        [stubs, ctx.hookPath].join(delimiter),
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
        [stubs, ctx.hookPath].join(delimiter),
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

// A bare basename match would let one mention of a shared name clear two
// written paths. The acting case never reaches this, since it writes one path.
describe('silent-turn.sh basename collision', () => {
  for (const tree of TREES) {
    const hook = join(tree.dir, 'silent-turn.sh')

    it.concurrent(`should block on ${tree.label} when two written paths share a basename and neither full path is named`, async ({
      expect,
    }) => {
      const key = `collision-${tree.label.replace(/[^A-Za-z0-9_.-]/g, '_')}`
      const transcriptPath = join(ctx.fixture, `transcript-${key}.jsonl`)
      const promptId = `prompt-${key}`
      const first = join(ctx.fixture, `docs/${key}/index.md`)
      const second = join(ctx.fixture, `wiki/${key}/index.md`)
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

// A hook committed as 100644 prints a PreToolUse permission error on every
// call and never runs, and no test above notices because they invoke the file
// through bash. The index is the record, since a checkout can mask the mode.
describe('hook file modes', () => {
  it.each(TREES)(
    'should track every hook in $label as executable',
    ({ label }) => {
      const entries = execFileSync(
        'git',
        ['ls-files', '-s', '--', `${label}/*.sh`],
        {
          cwd: ROOT,
          encoding: 'utf8',
        },
      )
        .split('\n')
        .filter(Boolean)
      const notExecutable = entries
        .filter((line) => !line.startsWith('100755 '))
        .map((line) => line.split('\t')[1])

      expect(entries.length).toBeGreaterThan(0)
      expect(notExecutable).toEqual([])
    },
  )
})

describe('bash 3.2 compatibility', () => {
  it.each(TREES)('should use no bash-4-only construct in $label', ({ dir }) => {
    expect(findBash4Constructs(dir)).toEqual([])
  })
})

// This copy resolves two runners where the seed resolves one, and the acting
// case cannot tell which ran, so a branch could stop resolving with every test
// green. Each stub reports a `kind` naming itself. The seed is covered below.

// The acting case proves a refusal reaches stderr and exits 0. These read the
// call log the stubs write, which is what shows the root each push was handed
// and whether a project with no records history spawned anything at all.
describe('records-push.sh roots and silence', () => {
  const sessionEnd = payloadFor({ hook_event_name: 'SessionEnd' })
  const recordsPath = (): string =>
    [join(ctx.fixture, 'bin-records'), ctx.hookPath].join(delimiter)
  const callLog = (label: string): string =>
    join(ctx.fixture, `records-push-${label.replace(/\W/g, '_')}.log`)

  for (const tree of TREES) {
    const hook = join(tree.dir, 'records-push.sh')
    const runner = tree.label === '.claude/hooks' ? 'bun' : 'canon'

    it.concurrent(`should push the main root from a linked worktree on ${tree.label}`, async ({
      expect,
    }) => {
      const main = join(ctx.fixture, 'records-project')
      const log = callLog(`worktree-${tree.label}`)

      const result = await run(hook, sessionEnd, recordsPath(), undefined, {
        CLAUDE_PROJECT_DIR: join(main, '.claude/worktrees/demo'),
        RECORDS_PUSH_CALLS: log,
      })

      expect(result.code).toBe(0)
      expect(readFileSync(log, 'utf8')).toContain(
        `records push --root ${main} --json`,
      )
    })

    it.concurrent(`should run ${runner} on ${tree.label}`, async ({
      expect,
    }) => {
      const log = callLog(`runner-${tree.label}`)

      await run(hook, sessionEnd, recordsPath(), undefined, {
        CLAUDE_PROJECT_DIR: join(ctx.fixture, 'records-project'),
        RECORDS_PUSH_CALLS: log,
      })

      expect(readFileSync(log, 'utf8')).toMatch(new RegExp(`^${runner} `))
    })

    it.concurrent(`should spawn nothing without a records history on ${tree.label}`, async ({
      expect,
    }) => {
      const log = callLog(`silent-${tree.label}`)

      const result = await run(hook, sessionEnd, recordsPath(), undefined, {
        CLAUDE_PROJECT_DIR: join(ctx.fixture, 'project'),
        RECORDS_PUSH_CALLS: log,
      })

      expect(existsSync(log)).toBe(false)
      expect(result.stderr).toBe('')
      expect(result.code).toBe(0)
    })
  }
})
