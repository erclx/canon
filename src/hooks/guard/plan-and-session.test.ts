import { execFileSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { payloadFor, ROOT, run, TREES, useFixture } from './fixture'

const ctx = useFixture()

// The guard decides on three readings at once: whether the command writes a
// plan path, whether that path names a file yet, and whether the transcript
// carries an invocation no earlier new plan spent. Each project below is its
// own root holding one existing plan, so a marker one case writes never
// licenses or blocks another.
// Every synced project inherits the seed copy, so a fix landing in this tree
// alone would leave each of them blocking on the bug it fixed.
it('should keep the two plan-guard.sh copies byte-identical', () => {
  const [local, seed] = TREES.map((tree) =>
    readFileSync(join(tree.dir, 'plan-guard.sh'), 'utf8'),
  )

  expect(seed).toBe(local)
})

describe.each(TREES)('plan-guard.sh firing conditions in $label', (tree) => {
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
  // A tool call naming no plan skill, so a transcript carrying it reads as
  // today's format with no invocation rather than as an unread one.
  const OTHER_CALL = JSON.stringify({
    message: {
      content: [{ input: { command: 'ls' }, name: 'Bash', type: 'tool_use' }],
    },
    type: 'assistant',
  })
  const autoShipCall = (args: string): string =>
    JSON.stringify({
      message: {
        content: [
          {
            input: { args, skill: 'canon:auto-ship' },
            name: 'Skill',
            type: 'tool_use',
          },
        ],
      },
      type: 'assistant',
    })
  const autoShipTyped = (args: string): string =>
    JSON.stringify({
      message: {
        content: `<command-name>/auto-ship</command-name>\n<command-args>${args}</command-args>`,
      },
      type: 'user',
    })

  let count = 0
  const planProject = (
    transcript = '',
  ): { root: string; transcript: string } => {
    count++
    const root = join(
      ctx.fixture,
      `plan-guard-project-${tree.label.replace(/\W/g, '-')}-${count}`,
    )
    mkdirSync(join(root, '.canon/plans'), { recursive: true })
    writeFileSync(join(root, '.canon/plans/feature-old.md'), '# Old\n')
    const transcriptPath = join(root, 'transcript.jsonl')
    writeFileSync(transcriptPath, `${OTHER_CALL}\n${transcript}`)
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

  const hook = join(tree.dir, 'plan-guard.sh')

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
    writeFileSync(
      project.transcript,
      `${OTHER_CALL}\n${SKILL_CALL}\n${SKILL_CALL}\n`,
    )

    const result = await run(
      hook,
      shellIn(project, heredoc('.canon/plans/feature-b.md')),
    )

    expect(result.code).toBe(0)
  })

  // A PreToolUse pass is not a landed write, so the retry after a refused
  // heredoc and the main-root `cp` after a worktree `Write` both reach the
  // guard a second time for one plan.
  it('should pass a second write onto the plan an invocation already licensed', async () => {
    const project = planProject(`${SKILL_CALL}\n`)
    await run(hook, shellIn(project, heredoc('.canon/plans/feature-a.md')))

    const result = await run(
      hook,
      shellIn(project, "printf '%s\\n' '# Plan' > .canon/plans/feature-a.md"),
    )

    expect(result.code).toBe(0)
  })

  it('should pass the main-root cp after a worktree Write of the same plan', async () => {
    const project = planProject(`${SKILL_CALL}\n`)
    await run(
      hook,
      payloadFor({
        cwd: project.root,
        session_id: 'plan-guard-session',
        tool_input: {
          file_path: join(ctx.fixture, 'elsewhere/.canon/plans/feature-a.md'),
        },
        tool_name: 'Write',
        transcript_path: project.transcript,
      }),
    )

    const result = await run(
      hook,
      shellIn(
        project,
        'cp /wt/.canon/plans/feature-a.md .canon/plans/feature-a.md',
      ),
    )

    expect(result.code).toBe(0)
  })

  it.each([
    ['an auto-ship Skill call', autoShipCall('.canon/plans/feature-new.md')],
    [
      'a typed auto-ship command',
      autoShipTyped(
        '.canon/plans/feature-new.md\nWrite the plan below verbatim',
      ),
    ],
  ])(
    'should pass the plan %s names with no plan-feature invocation',
    async (_, line) => {
      const project = planProject(`${line}\n`)

      const result = await run(
        hook,
        shellIn(project, heredoc('.canon/plans/feature-new.md')),
      )

      expect(result.code).toBe(0)
    },
  )

  it('should block a plan other than the one auto-ship names', async () => {
    const project = planProject(
      `${autoShipCall('.canon/plans/feature-new.md')}\n`,
    )

    const result = await run(
      hook,
      shellIn(project, heredoc('.canon/plans/feature-other.md')),
    )

    expect(result.code).toBe(2)
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

  describe('transcript format', () => {
    // The Skill call the guard reads, moved under a key Claude Code might
    // rename it to, so no line parses as a tool call in today's shape.
    const RESHAPED_CALL = JSON.stringify({
      message: {
        content: [
          {
            input: { skill: 'canon:plan-feature' },
            name: 'Skill',
            type: 'tool_call',
          },
        ],
      },
      type: 'assistant',
    })

    it('should pass a new plan when no line parses as a tool call', async () => {
      const project = planProject()
      writeFileSync(project.transcript, `${RESHAPED_CALL}\n`)

      const result = await run(
        hook,
        shellIn(project, heredoc('.canon/plans/feature-new.md')),
      )

      expect(result.stderr).toBe('')
      expect(result.code).toBe(0)
    })

    it('should still block a new plan when tool calls parse but none invokes the skill', async () => {
      const project = planProject(`${OTHER_CALL}\n`)

      const result = await run(
        hook,
        shellIn(project, heredoc('.canon/plans/feature-new.md')),
      )

      expect(result.code).toBe(2)
    })
  })

  describe('decision log', () => {
    const logLines = (root: string): string[] => {
      const log = join(root, '.canon/tmp/hooks/plan-guard/decisions.log')
      return existsSync(log)
        ? readFileSync(log, 'utf8').trimEnd().split('\n')
        : []
    }
    const LINE =
      /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ (pass|block|unread) \S+ (.+)$/

    it('should log a pass with the session key and the plan path', async () => {
      const project = planProject(`${SKILL_CALL}\n`)

      await run(hook, shellIn(project, heredoc('.canon/plans/feature-a.md')))

      const lines = logLines(project.root)
      expect(lines).toHaveLength(1)
      expect(lines[0]).toMatch(LINE)
      expect(lines[0]).toContain(' pass plan_guard_session feature-a.md')
    })

    it('should log a block with the session key and the plan path', async () => {
      const project = planProject()

      await run(hook, shellIn(project, heredoc('.canon/plans/feature-a.md')))

      const lines = logLines(project.root)
      expect(lines).toHaveLength(1)
      expect(lines[0]).toContain(' block plan_guard_session feature-a.md')
    })

    it('should log a block and then a pass for a plan resent after an invocation', async () => {
      const project = planProject()
      await run(hook, shellIn(project, heredoc('.canon/plans/feature-a.md')))
      writeFileSync(project.transcript, `${SKILL_CALL}\n`)

      await run(hook, shellIn(project, heredoc('.canon/plans/feature-a.md')))

      const verdicts = logLines(project.root).map((l) => l.split(' ')[1])
      expect(verdicts).toEqual(['block', 'pass'])
    })

    it('should log a block for a second new plan on a spent invocation', async () => {
      const project = planProject(`${SKILL_CALL}\n`)
      await run(hook, shellIn(project, heredoc('.canon/plans/feature-a.md')))

      await run(hook, shellIn(project, heredoc('.canon/plans/feature-b.md')))

      const lines = logLines(project.root)
      expect(lines).toHaveLength(2)
      expect(lines[1]).toContain(' block plan_guard_session feature-b.md')
    })

    it('should log a pass for the plan an auto-ship launch names', async () => {
      const project = planProject(
        `${autoShipCall('.canon/plans/feature-new.md')}\n`,
      )

      await run(hook, shellIn(project, heredoc('.canon/plans/feature-new.md')))

      expect(logLines(project.root)).toHaveLength(1)
      expect(logLines(project.root)[0]).toContain(' pass ')
    })

    it('should log unread for a new plan when no line parses as a tool call', async () => {
      const project = planProject()
      writeFileSync(project.transcript, '')

      await run(hook, shellIn(project, heredoc('.canon/plans/feature-a.md')))

      const lines = logLines(project.root)
      expect(lines).toHaveLength(1)
      expect(lines[0]).toMatch(LINE)
      expect(lines[0]).toContain(' unread plan_guard_session feature-a.md')
    })

    it.each([
      ['an edit of an existing plan', heredoc('.canon/plans/feature-old.md')],
      ['a read of an existing plan', 'cat .canon/plans/feature-old.md'],
      ['a command naming no plan', 'echo x > notes.md'],
    ])('should write no line for %s', async (_, command) => {
      const project = planProject()

      await run(hook, shellIn(project, command))

      expect(logLines(project.root)).toEqual([])
    })

    it.each([
      ['a pass', `${SKILL_CALL}\n`, 0],
      ['a block', '', 2],
    ])(
      'should still decide %s when the log folder cannot be created',
      async (_, transcript, code) => {
        const project = planProject(transcript)
        mkdirSync(join(project.root, '.canon'), { recursive: true })
        writeFileSync(join(project.root, '.canon/tmp'), 'not a folder')

        const result = await run(
          hook,
          shellIn(project, heredoc('.canon/plans/feature-a.md')),
        )

        expect(result.code).toBe(code)
      },
    )

    it.each([
      ['a pass', `${SKILL_CALL}\n`, 0],
      ['a block', '', 2],
    ])(
      'should decide %s with no shell error when decisions.log cannot be opened',
      async (_, transcript, code) => {
        const project = planProject(transcript)
        mkdirSync(
          join(project.root, '.canon/tmp/hooks/plan-guard/decisions.log'),
          {
            recursive: true,
          },
        )

        const result = await run(
          hook,
          shellIn(project, heredoc('.canon/plans/feature-a.md')),
        )

        expect(result.code).toBe(code)
        expect(result.stderr).not.toContain('decisions.log')
      },
    )
  })

  it('should dismiss a command naming no plan path without spawning jq', async () => {
    const project = planProject()

    const result = await run(
      hook,
      shellIn(project, 'echo x > notes.md'),
      join(ctx.fixture, 'bin-jq-trap'),
    )

    expect(result.stderr).toBe('')
    expect(result.code).toBe(0)
  })
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
      ctx.readOnlyRoot,
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
    const bun = makeBun(0, ctx.hookPath)

    const result = await run(hook, '{}', bun.path, dir, {
      CLAUDE_CODE_REMOTE: 'true',
    })

    expect(result.code).toBe(0)
    expect(result.stdout).toContain('canon is not on PATH')
  })
})
