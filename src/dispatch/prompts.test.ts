import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  type AddInput,
  addPrompt,
  type ClaimReader,
  listPrompts,
  promptsPath,
  removePrompts,
} from '@/dispatch/prompts'

let ROOT: string

const CONTROLLER = 'ac740c2e-f2f8-4056-86f0-f1711b41c410'

async function writeTask(
  stem: string,
  title: string,
  plan?: string,
): Promise<void> {
  const label = stem.split('-')[0]
  const lines = [`# ${label}: ${title}`, '']
  if (plan !== undefined) lines.push(`Plan: [${plan}](../plans/${plan}.md)`, '')
  await writeFile(
    join(ROOT, '.canon', 'tasks', `${stem}.md`),
    lines.join('\n'),
    'utf8',
  )
}

async function writePlan(slug: string, files: string[]): Promise<void> {
  const body = [
    `# Feature: ${slug}`,
    '',
    '## Files to touch',
    '',
    ...files.map((file) => `- \`${file}\`: changed`),
    '',
  ].join('\n')
  await writeFile(
    join(ROOT, '.canon', 'plans', `feature-${slug}.md`),
    body,
    'utf8',
  )
}

const buildInput = (overrides: Partial<AddInput> = {}): AddInput => ({
  task: 'v1.1-alpha',
  role: 'worker',
  model: 'opus',
  effort: 'high',
  controller: CONTROLLER,
  ...overrides,
})

let CLAIMED: Set<string>
let UNREADABLE: Set<string>

const readClaim: ClaimReader = async (branch) => ({
  claimed: CLAIMED.has(branch),
  readable: !UNREADABLE.has(branch),
})

const add = (input: AddInput) => addPrompt(ROOT, input, { readClaim })

const readQueueFile = (): Promise<string> => readFile(promptsPath(ROOT), 'utf8')

beforeEach(async () => {
  CLAIMED = new Set()
  UNREADABLE = new Set()
  ROOT = mkdtempSync(join(tmpdir(), 'dispatch-prompts-'))
  mkdirSync(join(ROOT, '.canon', 'plans'), { recursive: true })
  mkdirSync(join(ROOT, '.canon', 'tasks'), { recursive: true })
  await writePlan('alpha', ['src/shared.ts', 'src/a.ts'])
  await writePlan('beta', ['src/shared.ts'])
  await writePlan('gamma', ['src/c.ts'])
  await writeTask('v1.1-alpha', 'Alpha row', 'feature-alpha')
  await writeTask('v1.2-beta', 'Beta row', 'feature-beta')
  await writeTask('v1.3-gamma', 'Gamma row', 'feature-gamma')
  await writeTask('v1.4-unplanned', 'Unplanned row')
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('addPrompt', () => {
  it('should write a worker fence carrying the plan command and the controller', async () => {
    const outcome = await add(
      buildInput({ lines: ['Rebase over v1.2 when told.'] }),
    )

    expect(outcome).toMatchObject({
      ok: true,
      action: 'added',
      prompt: { branch: 'feat/alpha', plan: '.canon/plans/feature-alpha.md' },
    })
    expect(await readQueueFile()).toBe(
      [
        '# Dispatch prompts',
        '',
        '## v1.1: Alpha row',
        '',
        '### Worker',
        '',
        'Model: opus',
        'Effort: high',
        '',
        '```text',
        '/canon:auto-ship .canon/plans/feature-alpha.md',
        `Controller: ${CONTROLLER}`,
        'Rebase over v1.2 when told.',
        '```',
        '',
      ].join('\n'),
    )
  })

  it('should replace a task and role already queued rather than queue it twice', async () => {
    await add(buildInput({ effort: 'high' }))

    const outcome = await add(buildInput({ effort: 'low' }))
    const listed = await listPrompts(ROOT)

    expect(outcome).toMatchObject({ ok: true, action: 'replaced' })
    expect(listed).toMatchObject({
      ok: true,
      prompts: [{ label: 'v1.1', role: 'worker', effort: 'low' }],
    })
  })

  it('should refuse a worker row for a task that links no plan and write nothing', async () => {
    const outcome = await add(buildInput({ task: 'v1.4' }))

    expect(outcome).toMatchObject({ ok: false, reason: 'no-plan' })
    expect(await listPrompts(ROOT)).toMatchObject({ ok: true, prompts: [] })
  })

  describe('plan-first worker rows', () => {
    it('should queue a plan-first row for a task that links no plan', async () => {
      const outcome = await add(buildInput({ task: 'v1.4', planFirst: true }))

      expect(outcome).toMatchObject({
        ok: true,
        action: 'added',
        prompt: {
          role: 'worker',
          lines: [
            '/canon:auto-ship --plan-first .canon/tasks/v1.4-unplanned.md',
            `Controller: ${CONTROLLER}`,
          ],
        },
      })
    })

    it('should pass --any-size through on a plan-first row', async () => {
      const outcome = await add(
        buildInput({ task: 'v1.4', planFirst: true, anySize: true }),
      )

      expect(outcome).toMatchObject({
        ok: true,
        prompt: {
          lines: [
            '/canon:auto-ship --plan-first --any-size .canon/tasks/v1.4-unplanned.md',
            `Controller: ${CONTROLLER}`,
          ],
        },
      })
    })

    it('should refuse a plan-first row for a task that already links a plan', async () => {
      const outcome = await add(buildInput({ planFirst: true }))

      expect(outcome).toMatchObject({ ok: false, reason: 'bad-input' })
      expect(outcome).toHaveProperty(
        'message',
        expect.stringContaining('--role worker without --plan-first'),
      )
      expect(await listPrompts(ROOT)).toMatchObject({ ok: true, prompts: [] })
    })

    it.each(['planner', 'reviewer'])(
      'should refuse --plan-first on a %s row',
      async (role) => {
        const outcome = await add(
          buildInput({ task: 'v1.4', role, pr: '7', planFirst: true }),
        )

        expect(outcome).toMatchObject({ ok: false, reason: 'bad-input' })
      },
    )

    it.each(['planner', 'reviewer'])(
      'should refuse --any-size on a %s row',
      async (role) => {
        const outcome = await add(
          buildInput({ task: 'v1.4', role, pr: '7', anySize: true }),
        )

        expect(outcome).toMatchObject({ ok: false, reason: 'bad-input' })
      },
    )

    it('should refuse --any-size on a worker row without --plan-first', async () => {
      const outcome = await add(buildInput({ anySize: true }))

      expect(outcome).toMatchObject({ ok: false, reason: 'bad-input' })
    })
  })

  it('should queue a planner row for a task that links no plan', async () => {
    const outcome = await add(buildInput({ task: 'v1.4', role: 'planner' }))

    expect(outcome).toMatchObject({
      ok: true,
      prompt: {
        lines: [
          'Run /canon:role-planner, then /canon:plan-feature .canon/tasks/v1.4-unplanned.md',
          `Controller: ${CONTROLLER}`,
        ],
      },
    })
  })

  it('should refuse a reviewer row with no pull request number', async () => {
    const outcome = await add(buildInput({ role: 'reviewer' }))

    expect(outcome).toMatchObject({ ok: false, reason: 'bad-input' })
  })

  it('should carry the pull request number on a reviewer row', async () => {
    const outcome = await add(buildInput({ role: 'reviewer', pr: '3230' }))

    expect(outcome).toMatchObject({
      ok: true,
      prompt: {
        pr: 3230,
        lines: [
          'Run /canon:role-reviewer, then /canon:review-pr 3230',
          `Controller: ${CONTROLLER}`,
        ],
      },
    })
  })

  it('should refuse a task no live file matches', async () => {
    const outcome = await add(buildInput({ task: 'v9.9' }))

    expect(outcome).toMatchObject({ ok: false, reason: 'no-task' })
  })

  it('should refuse a controller that is not a full sessionId', async () => {
    const outcome = await add(buildInput({ controller: 'ac740c2e' }))

    expect(outcome).toMatchObject({ ok: false, reason: 'bad-input' })
  })

  it('should refuse a prompts file a hand edit broke rather than overwrite it', async () => {
    mkdirSync(join(ROOT, '.canon', 'dispatch'), { recursive: true })
    await writeFile(promptsPath(ROOT), '# Dispatch prompts\n\nstray\n', 'utf8')

    const outcome = await add(buildInput())

    expect(outcome).toMatchObject({ ok: false, reason: 'malformed' })
    expect(await readQueueFile()).toBe('# Dispatch prompts\n\nstray\n')
  })

  describe('merge order', () => {
    it('should keep the order while two queued plans share a file', async () => {
      await add(buildInput())

      const outcome = await add(
        buildInput({ task: 'v1.2', mergeOrder: 'v1.1 first, then v1.2.' }),
      )

      expect(outcome).toMatchObject({
        ok: true,
        mergeOrder: 'v1.1 first, then v1.2.',
        mergeOrderDropped: false,
      })
      expect(await readQueueFile()).toContain(
        'Merge order: v1.1 first, then v1.2.',
      )
    })

    it('should drop the order when no two queued plans share a file', async () => {
      await add(buildInput())

      const outcome = await add(
        buildInput({ task: 'v1.3', mergeOrder: 'v1.1 first, then v1.3.' }),
      )

      expect(outcome).toMatchObject({
        ok: true,
        mergeOrder: null,
        mergeOrderDropped: true,
      })
      expect(await readQueueFile()).not.toContain('Merge order')
    })
  })
})

describe('claimed branches', () => {
  it('should refuse a worker row whose branch is already claimed and write nothing', async () => {
    CLAIMED.add('feat/alpha')

    const outcome = await add(buildInput())

    expect(outcome).toMatchObject({ ok: false, reason: 'claimed' })
    expect(await listPrompts(ROOT)).toMatchObject({ ok: true, prompts: [] })
  })

  it('should drop a queued worker row once its branch is claimed and name it', async () => {
    await add(buildInput())
    CLAIMED.add('feat/alpha')

    const outcome = await add(buildInput({ task: 'v1.3' }))

    expect(outcome).toMatchObject({
      ok: true,
      dropped: [{ label: 'v1.1', role: 'worker', branch: 'feat/alpha' }],
    })
    expect(await listPrompts(ROOT)).toMatchObject({
      prompts: [{ label: 'v1.3', role: 'worker' }],
    })
  })

  it('should keep a queued row whose claim could not be read and report it unread', async () => {
    await add(buildInput())
    UNREADABLE.add('feat/alpha')

    const outcome = await add(buildInput({ task: 'v1.3' }))

    expect(outcome).toMatchObject({
      ok: true,
      dropped: [],
      claimUnread: ['feat/alpha'],
    })
    expect(await listPrompts(ROOT)).toMatchObject({
      prompts: [{ label: 'v1.1' }, { label: 'v1.3' }],
    })
  })

  it('should queue a worker row whose own claim could not be read and report it unread', async () => {
    UNREADABLE.add('feat/alpha')

    const outcome = await add(buildInput())

    expect(outcome).toMatchObject({
      ok: true,
      action: 'added',
      claimUnread: ['feat/alpha'],
    })
  })

  it('should queue a reviewer row for a task whose worker branch is claimed', async () => {
    CLAIMED.add('feat/alpha')

    const outcome = await add(buildInput({ role: 'reviewer', pr: '7' }))

    expect(outcome).toMatchObject({ ok: true, action: 'added' })
  })
})

describe('removePrompts', () => {
  it('should answer ok with nothing removed for a row not queued', async () => {
    const outcome = await removePrompts(ROOT, 'v1.1')

    expect(outcome).toMatchObject({ ok: true, removed: [] })
  })

  it('should remove one role and leave the task’s other role queued', async () => {
    await add(buildInput())
    await add(buildInput({ role: 'reviewer', pr: '7' }))

    const outcome = await removePrompts(ROOT, 'v1.1-alpha', 'worker')

    expect(outcome).toMatchObject({
      ok: true,
      removed: [{ label: 'v1.1', role: 'worker' }],
    })
    expect(await listPrompts(ROOT)).toMatchObject({
      prompts: [{ label: 'v1.1', role: 'reviewer', pr: 7 }],
    })
  })

  it('should drop the merge order once the rows sharing a file are gone', async () => {
    await add(buildInput())
    await add(
      buildInput({ task: 'v1.2', mergeOrder: 'v1.1 first, then v1.2.' }),
    )

    const outcome = await removePrompts(ROOT, 'v1.2')

    expect(outcome).toMatchObject({ mergeOrder: null, mergeOrderDropped: true })
  })

  it('should leave an emptied queue reading no prompts waiting with no lead line', async () => {
    await add(buildInput())

    await removePrompts(ROOT, 'v1.1')

    expect(await readQueueFile()).toBe(
      '# Dispatch prompts\n\nNo prompts waiting.\n',
    )
  })
})

describe('listPrompts', () => {
  it('should read a missing file as an empty queue', async () => {
    const outcome = await listPrompts(ROOT)

    expect(outcome).toEqual({
      ok: true,
      path: '.canon/dispatch/prompts.md',
      mergeOrder: null,
      prompts: [],
    })
  })

  it('should group two roles of one task under one heading', async () => {
    await add(buildInput({ role: 'planner' }))
    await add(buildInput({ task: 'v1.3' }))
    await add(buildInput({ role: 'reviewer', pr: '9' }))

    const text = await readQueueFile()

    expect(text.match(/^## v1\.1: Alpha row$/gm)).toHaveLength(1)
    expect(await listPrompts(ROOT)).toMatchObject({
      prompts: [
        { label: 'v1.1', role: 'planner' },
        { label: 'v1.1', role: 'reviewer' },
        { label: 'v1.3', role: 'worker', branch: 'feat/gamma' },
      ],
    })
  })
})
