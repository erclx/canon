import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  lagTranscript,
  payloadFor,
  ROOT,
  run,
  TREES,
  useFixture,
} from './fixture'

const ctx = useFixture()

// The guard decides on whether the command writes a plan path, whether that path names a file yet, and whether
// the transcript carries an unspent invocation. Every synced project inherits the seed copy, so a fix
// landing in one tree alone would leave each of them blocking on the bug.
it('should keep the two plan-guard.sh copies byte-identical', () => {
  const [local, seed] = TREES.map((tree) =>
    readFileSync(join(tree.dir, 'plan-guard.sh'), 'utf8'),
  )

  expect(seed).toBe(local)
})

describe.each(TREES)('plan-guard.sh firing conditions in $label', (tree) => {
  // The line shapes the guard reads an invocation from, pinned because the transcript format is Claude Code's.
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
  // A tool call naming no plan skill reads as today's format with no invocation, not an unread one.
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

    expect(result.stderr).toContain('at transcript line 2')
    expect(result.stderr).toContain('spent on .canon/plans/feature-a.md')
    expect(result.code).toBe(2)
  })

  describe('refusal message', () => {
    it('should name no invocation line for a write sent before any invocation', async () => {
      const project = planProject()

      const result = await run(
        hook,
        shellIn(project, heredoc('.canon/plans/feature-new.md')),
      )

      expect(result.stderr).toContain('has not invoked canon:plan-feature')
      expect(result.stderr).not.toContain('transcript line')
      expect(result.code).toBe(2)
    })

    it('should say a session writing several plans invokes the skill once per plan', async () => {
      const project = planProject(`${SKILL_CALL}\n`)
      await run(hook, shellIn(project, heredoc('.canon/plans/feature-a.md')))

      const result = await run(
        hook,
        shellIn(project, heredoc('.canon/plans/feature-b.md')),
      )

      expect(result.stderr).toContain('once per new plan')
    })
  })

  // The suspected cause of a wrong refusal is a transcript not yet holding a fresh invocation.
  describe('retry before a refusal', () => {
    it('should pass a write whose invocation lands during the retry', async () => {
      const project = planProject()
      const lag = lagTranscript(project.transcript, SKILL_CALL)

      const result = await run(
        hook,
        shellIn(project, heredoc('.canon/plans/feature-a.md')),
        lag.path,
      )

      expect(result.stderr).toBe('')
      expect(result.code).toBe(0)
      expect(readFileSync(lag.waits, 'utf8')).toBe('1\n')
    })

    it('should spend an invocation the retry found on this plan', async () => {
      const project = planProject()
      const lag = lagTranscript(project.transcript, SKILL_CALL)
      await run(
        hook,
        shellIn(project, heredoc('.canon/plans/feature-a.md')),
        lag.path,
      )

      const result = await run(
        hook,
        shellIn(project, heredoc('.canon/plans/feature-b.md')),
      )

      expect(result.stderr).toContain('spent on .canon/plans/feature-a.md')
      expect(result.code).toBe(2)
    })

    it('should still refuse when the retry finds no invocation', async () => {
      const project = planProject()
      const lag = lagTranscript(project.transcript, OTHER_CALL)

      const result = await run(
        hook,
        shellIn(project, heredoc('.canon/plans/feature-a.md')),
        lag.path,
      )

      expect(result.stderr).toContain('has not invoked canon:plan-feature')
      expect(result.code).toBe(2)
      expect(readFileSync(lag.waits, 'utf8')).toBe('1\n')
    })

    it.each([
      ['a first read that passes', `${SKILL_CALL}\n`, {}],
      ['an unreadable transcript', '', { transcript_path: '/nowhere/t.jsonl' }],
    ])('should not wait on %s', async (_, transcript, override) => {
      const project = planProject(transcript)
      const lag = lagTranscript(project.transcript, SKILL_CALL)
      const fields = {
        ...(JSON.parse(
          shellIn(project, heredoc('.canon/plans/feature-a.md')),
        ) as Record<string, unknown>),
        ...override,
      }

      const result = await run(hook, payloadFor(fields), lag.path)

      expect(result.code).toBe(0)
      expect(existsSync(lag.waits)).toBe(false)
    })
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

  // A PreToolUse pass is not a landed write, so a retry reaches the guard twice for one plan.
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

  // The owner is read off the decision log, so a test seeds the log line a planner's licensed write leaves.
  const OWNER_AT = '2026-11-23T10:00:20Z'
  const ownedBy = (
    project: { root: string },
    owner = 'planner_a',
    plan = 'feature-old.md',
  ): void => {
    const dir = join(project.root, '.canon/tmp/hooks/plan-guard')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, 'decisions.log'),
      `${OWNER_AT} pass ${owner} ${plan} latest=2 spent=0 spent_plan=- lines=2\n`,
    )
  }
  const readCall = (path: string, timestamp?: string): string =>
    JSON.stringify({
      message: {
        content: [
          { input: { file_path: path }, name: 'Read', type: 'tool_use' },
        ],
      },
      ...(timestamp === undefined ? {} : { timestamp }),
      type: 'assistant',
    })
  const oldPlan = (project: { root: string }): string =>
    join(project.root, '.canon/plans/feature-old.md')

  describe("another session's plan", () => {
    it('should refuse an unread heredoc onto a plan another session licensed', async () => {
      const project = planProject()
      ownedBy(project)

      const result = await run(
        hook,
        shellIn(project, heredoc('.canon/plans/feature-old.md')),
      )

      expect(result.stderr).toContain('planner_a')
      expect(result.stderr).toContain(OWNER_AT)
      expect(result.stderr).toContain('Read the plan')
      expect(result.code).toBe(2)
    })

    it.each([
      ['at the owner time', '2026-11-23T10:00:20.000Z'],
      ['after the owner time', '2026-11-23T10:05:00.512Z'],
    ])('should pass once this session read the plan %s', async (_, stamp) => {
      const project = planProject()
      writeFileSync(
        project.transcript,
        `${OTHER_CALL}\n${readCall(oldPlan(project), stamp)}\n`,
      )
      ownedBy(project)

      const result = await run(
        hook,
        shellIn(project, heredoc('.canon/plans/feature-old.md')),
      )

      expect(result.stderr).toBe('')
      expect(result.code).toBe(0)
    })

    it.each([
      ['before the owner time', '2026-11-23T10:00:00.000Z'],
      ['with no timestamp', undefined],
    ])('should refuse a read stamped %s', async (_, stamp) => {
      const project = planProject()
      writeFileSync(
        project.transcript,
        `${OTHER_CALL}\n${readCall(oldPlan(project), stamp)}\n`,
      )
      ownedBy(project)

      const result = await run(
        hook,
        shellIn(project, heredoc('.canon/plans/feature-old.md')),
      )

      expect(result.code).toBe(2)
    })

    it('should refuse when the read names a different plan', async () => {
      const project = planProject()
      writeFileSync(
        project.transcript,
        `${OTHER_CALL}\n${readCall(join(project.root, '.canon/plans/feature-x.md'), '2026-11-23T11:00:00.000Z')}\n`,
      )
      ownedBy(project)

      const result = await run(
        hook,
        shellIn(project, heredoc('.canon/plans/feature-old.md')),
      )

      expect(result.code).toBe(2)
    })

    it('should pass the owner rewriting its own plan with no read', async () => {
      const project = planProject()
      ownedBy(project, 'plan_guard_session')

      const result = await run(
        hook,
        shellIn(project, heredoc('.canon/plans/feature-old.md')),
      )

      expect(result.code).toBe(0)
    })

    it('should judge ownership by the last pass line naming the plan', async () => {
      const project = planProject()
      ownedBy(project)
      const log = join(
        project.root,
        '.canon/tmp/hooks/plan-guard/decisions.log',
      )
      writeFileSync(
        log,
        `${readFileSync(log, 'utf8')}2026-11-23T10:01:00Z pass plan_guard_session feature-old.md latest=4 spent=2 spent_plan=- lines=4\n2026-11-23T10:02:00Z amend planner_a feature-old.md owner=plan_guard_session owned_at=2026-11-23T10:01:00Z\n`,
      )

      const result = await run(
        hook,
        shellIn(project, heredoc('.canon/plans/feature-old.md')),
      )

      expect(result.code).toBe(0)
    })

    it('should pass an existing plan no pass line names', async () => {
      const project = planProject()
      ownedBy(project, 'planner_a', 'feature-other.md')

      const result = await run(
        hook,
        shellIn(project, heredoc('.canon/plans/feature-old.md')),
      )

      expect(result.code).toBe(0)
    })

    it('should pass the main-root cp onto a plan this session licensed', async () => {
      const project = planProject()
      ownedBy(project, 'plan_guard_session')

      const result = await run(
        hook,
        shellIn(
          project,
          'cp /wt/.canon/plans/feature-old.md .canon/plans/feature-old.md',
        ),
      )

      expect(result.code).toBe(0)
    })

    it('should pass an owned plan when no line parses as a tool call', async () => {
      const project = planProject()
      writeFileSync(project.transcript, '')
      ownedBy(project)

      const result = await run(
        hook,
        shellIn(project, heredoc('.canon/plans/feature-old.md')),
      )

      expect(result.code).toBe(0)
    })

    it.each([
      ['no session id', { session_id: undefined }],
      ['no transcript path', { transcript_path: undefined }],
      ['an unreadable transcript', { transcript_path: '/nowhere/t.jsonl' }],
      ['an unreadable decision log', {}],
    ])('should fail open on %s', async (label, override) => {
      const project = planProject()
      ownedBy(project)
      if (label === 'an unreadable decision log') {
        const log = join(
          project.root,
          '.canon/tmp/hooks/plan-guard/decisions.log',
        )
        rmSync(log)
        mkdirSync(log)
      }
      const fields = {
        ...(JSON.parse(
          shellIn(project, heredoc('.canon/plans/feature-old.md')),
        ) as Record<string, unknown>),
        ...override,
      }

      const result = await run(hook, payloadFor(fields))

      expect(result.code).toBe(0)
    })
  })

  describe('transcript format', () => {
    // The Skill call the guard reads, moved under a key Claude Code might rename it to.
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

    it('should log the invocation, spent marker, and line count a pass was judged on', async () => {
      const project = planProject(`${SKILL_CALL}\n`)

      await run(hook, shellIn(project, heredoc('.canon/plans/feature-a.md')))

      expect(logLines(project.root)[0]).toMatch(
        / feature-a\.md latest=2 spent=0 spent_plan=- lines=2$/,
      )
    })

    it('should log both reads of a refusal that retried', async () => {
      const project = planProject(`${SKILL_CALL}\n`)
      await run(hook, shellIn(project, heredoc('.canon/plans/feature-a.md')))

      await run(hook, shellIn(project, heredoc('.canon/plans/feature-b.md')))

      expect(logLines(project.root)[1]).toMatch(
        / block \S+ feature-b\.md latest=2 spent=2 spent_plan=feature-a\.md lines=2 retry_latest=2 retry_lines=2$/,
      )
    })

    it('should log the retry read that found a late invocation', async () => {
      const project = planProject()
      const lag = lagTranscript(project.transcript, SKILL_CALL)

      await run(
        hook,
        shellIn(project, heredoc('.canon/plans/feature-a.md')),
        lag.path,
      )

      expect(logLines(project.root)[0]).toMatch(
        / pass \S+ feature-a\.md latest=- spent=0 spent_plan=- lines=1 retry_latest=2 retry_lines=2$/,
      )
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

    it('should log block-owned with the owner and its time', async () => {
      const project = planProject()
      ownedBy(project)

      await run(hook, shellIn(project, heredoc('.canon/plans/feature-old.md')))

      expect(logLines(project.root)[1]).toMatch(
        new RegExp(
          ` block-owned plan_guard_session feature-old\\.md owner=planner_a owned_at=${OWNER_AT} read_at=-$`,
        ),
      )
    })

    it('should log amend with the owner for a read plan', async () => {
      const project = planProject()
      writeFileSync(
        project.transcript,
        `${OTHER_CALL}\n${readCall(oldPlan(project), '2026-11-23T10:01:00.000Z')}\n`,
      )
      ownedBy(project)

      await run(hook, shellIn(project, heredoc('.canon/plans/feature-old.md')))

      expect(logLines(project.root)[1]).toMatch(
        new RegExp(
          ` amend plan_guard_session feature-old\\.md owner=planner_a owned_at=${OWNER_AT} read_at=2026-11-23T10:01:00$`,
        ),
      )
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

// Each trigger reaches the session by a different channel. An automatic compaction must instruct the
// summarizer without ever blocking, and a manual one must stop asking after the first refusal,
// since blocking either would trap the session.
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
    // A precompute pass fires with the real payload and re-arms when refused, so the automatic path counts none.
    const once = payload({ session_id: 'precompact-arms', trigger: 'auto' })

    const first = await run(hook, once)
    const second = await run(hook, once)

    expect(second.stdout).toBe(first.stdout)
    expect(second.code).toBe(0)
  })

  it.concurrent('should block a compaction whose payload names no trigger', async ({
    expect,
  }) => {
    // An absent trigger is the payload the hook cannot answer with silence, so it asks.
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
    // Exit 2 makes stderr the blocking reason, and stdout would join the summarizer's instructions.
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
    // Blocking without the marker would refuse every compaction, so an unwritable root fails open.
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
