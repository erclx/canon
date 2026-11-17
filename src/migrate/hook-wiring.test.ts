import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  hooksShapeError,
  planHookWiring,
  readSeededHooks,
} from '@/migrate/hook-wiring'
import { applySettingsEdits } from '@/migrate/settings-edit'

const TOOLKIT_ROOT = join(import.meta.dirname, '../..')

const command = (script: string): string =>
  `"$CLAUDE_PROJECT_DIR"/.claude/hooks/${script}`
const hook = (script: string) => ({ type: 'command', command: command(script) })
const holding =
  (...scripts: string[]) =>
  (script: string): boolean =>
    scripts.includes(script)

let seeded: Record<string, unknown>

beforeAll(async () => {
  seeded = await readSeededHooks(TOOLKIT_ROOT)
})

/** Applies the plan the way the migrate write does, returning the hooks. */
function wired(hooks: unknown, holds: (script: string) => boolean): unknown {
  const plan = planHookWiring(hooks, seeded, holds)
  const edits = plan.events.flatMap((event) => event.edits)
  const source = JSON.stringify(hooks === undefined ? {} : { hooks }, null, 2)
  return JSON.parse(applySettingsEdits(source, edits, '  ')).hooks
}

describe('planHookWiring', () => {
  it('should append the seeded Stop entries after the project own hook', () => {
    const hooks = { Stop: [{ hooks: [hook('silent-turn.sh')] }] }

    const next = wired(
      hooks,
      holding('silent-turn.sh', 'reply-links.sh', 'session-name.sh'),
    )

    expect(next).toEqual({
      Stop: [
        {
          hooks: [
            hook('silent-turn.sh'),
            hook('reply-links.sh'),
            hook('session-name.sh'),
          ],
        },
      ],
    })
  })

  it('should report each lacking script sorted by event then script', () => {
    const plan = planHookWiring(
      { Stop: [{ hooks: [hook('silent-turn.sh')] }] },
      seeded,
      holding('session-name.sh', 'reply-links.sh', 'pr-create-log.sh'),
    )

    expect(plan.unwired).toEqual([
      { event: 'PostToolUse', script: 'pr-create-log.sh', tools: ['Bash'] },
      { event: 'Stop', script: 'reply-links.sh', tools: [] },
      { event: 'Stop', script: 'session-name.sh', tools: [] },
    ])
  })

  it('should not wire again a hook wired by hand under a covering matcher', () => {
    const byHand = {
      type: 'command',
      command: 'bash .claude/hooks/plan-guard.sh',
    }
    const hooks = { PreToolUse: [{ matcher: '.*', hooks: [byHand] }] }

    const plan = planHookWiring(hooks, seeded, holding('plan-guard.sh'))

    expect(plan.unwired).toEqual([])
    expect(plan.events.flatMap((event) => event.edits)).toEqual([])
  })

  it('should give a partly covering matcher a new group naming only the lacking tool', () => {
    const hooks = {
      PostToolUse: [
        { matcher: 'Edit|Write', hooks: [hook('standards-audit.sh')] },
      ],
    }

    const next = wired(hooks, holding('standards-audit.sh'))

    expect(next).toEqual({
      PostToolUse: [
        { matcher: 'Edit|Write', hooks: [hook('standards-audit.sh')] },
        { matcher: 'MultiEdit', hooks: [hook('standards-audit.sh')] },
      ],
    })
  })

  it('should neither wire nor report a seeded hook whose script is absent', () => {
    const plan = planHookWiring({}, seeded, holding())

    expect(plan.unwired).toEqual([])
    expect(plan.events.flatMap((event) => event.edits)).toEqual([])
  })

  it('should plan no change for a file holding every seeded entry', () => {
    const plan = planHookWiring(seeded, seeded, () => true)

    expect(plan.unwired).toEqual([])
    expect(plan.events.flatMap((event) => event.edits)).toEqual([])
  })

  it('should wire every held script into a file holding no hooks, in seed order', () => {
    expect(wired(undefined, () => true)).toEqual(seeded)
  })

  it('should not read an exact name as covering a longer tool name', () => {
    const hooks = {
      PreToolUse: [{ matcher: 'Writ', hooks: [hook('plan-guard.sh')] }],
    }

    const plan = planHookWiring(hooks, seeded, holding('plan-guard.sh'))

    expect(plan.unwired).toEqual([
      {
        event: 'PreToolUse',
        script: 'plan-guard.sh',
        tools: ['Write', 'Edit'],
      },
      { event: 'PreToolUse', script: 'plan-guard.sh', tools: ['Bash'] },
    ])
  })
})

describe('hooksShapeError', () => {
  it('should name a seeded event that is not a list', () => {
    expect(hooksShapeError({ Stop: {} }, seeded)).toBe(
      'hooks.Stop is not a list',
    )
  })

  it('should name a hooks value that is not an object', () => {
    expect(hooksShapeError([], seeded)).toBe('hooks is not an object')
  })
})
