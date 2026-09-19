import { describe, expect, it } from 'vitest'
import type { Beat, Draft } from '@/demo/beats'
import {
  compilePlan,
  deriveSteps,
  MAX_POINTER_STEPS,
  MIN_POINTER_STEPS,
  parsePlan,
  unresolved,
} from '@/demo/compile'

function beat(index: number, overrides: Partial<Beat> = {}): Beat {
  return {
    index,
    name: `Beat ${index}`,
    onScreen: '',
    action: 'click',
    watchFor: '',
    emphasis: '',
    caption: '',
    ...overrides,
  }
}

function draft(beats: Beat[], title = 'Inline edit launch'): Draft {
  return { title, beats }
}

const OPTIONS = { slug: 'inline-edit-launch', outDir: 'demos' }

describe('compilePlan', () => {
  it('should name the output after the slug in the chosen directory', () => {
    const plan = compilePlan(draft([beat(1)]), OPTIONS)

    expect(plan.output).toEqual({
      video: 'demos/inline-edit-launch.webm',
      still: 'demos/inline-edit-launch.png',
    })
  })

  it('should seed the timing the beats never carried', () => {
    const plan = compilePlan(draft([beat(1)]), OPTIONS)

    expect(plan.pointer).toEqual({ travelMs: 400, typeDelayMs: 110 })
  })

  it('should compile a navigate verb into a navigate step', () => {
    const plan = compilePlan(draft([beat(1, { action: 'navigate' })]), OPTIONS)

    expect(plan.steps[0]).toMatchObject({ kind: 'navigate', beat: 1 })
  })

  it('should compile a typing verb into a fill step', () => {
    const plan = compilePlan(draft([beat(1, { action: 'type' })]), OPTIONS)

    expect(plan.steps[0]).toMatchObject({ kind: 'fill' })
  })

  it('should read a verb inside a longer action phrase', () => {
    const plan = compilePlan(
      draft([beat(1, { action: 'Click the submit button' })]),
      OPTIONS,
    )

    expect(plan.steps[0]).toMatchObject({ kind: 'click' })
  })

  it('should compile an unmapped verb into a hold that names the verb', () => {
    const plan = compilePlan(draft([beat(1, { action: 'marvel' })]), OPTIONS)

    expect(plan.steps[0]).toMatchObject({
      kind: 'hold',
      note: 'no step maps to the verb "marvel", so this beat only waits',
    })
  })

  it('should seed an empty target a person has to fill', () => {
    const plan = compilePlan(draft([beat(1, { action: 'click' })]), OPTIONS)

    expect(plan.steps[0]).toMatchObject({ target: '' })
  })

  it('should carry the caption across so a later pass can render it', () => {
    const plan = compilePlan(
      draft([beat(1, { caption: 'Nothing on the board yet' })]),
      OPTIONS,
    )

    expect(plan.steps[0]?.caption).toBe('Nothing on the board yet')
  })

  it('should take the still on the beat the draft names as the hero', () => {
    const plan = compilePlan(
      draft([beat(1), beat(2, { name: 'Hero moment' }), beat(3)]),
      OPTIONS,
    )

    expect(plan.steps.map((step) => step.still)).toEqual([false, true, false])
  })

  it('should fall back to the last beat when no beat is named as the hero', () => {
    const plan = compilePlan(draft([beat(1), beat(2)]), OPTIONS)

    expect(plan.steps.map((step) => step.still)).toEqual([false, true])
  })

  it('should hold longer on the final beat so the end state stays on screen', () => {
    const plan = compilePlan(draft([beat(1), beat(2)]), OPTIONS)

    expect(plan.steps.map((step) => step.holdMs)).toEqual([600, 1200])
  })
})

describe('unresolved', () => {
  it('should name a plan with no url as needing one', () => {
    const plan = compilePlan(draft([beat(1, { action: 'wait' })]), OPTIONS)

    expect(unresolved(plan)).toContain('url')
  })

  it('should name each step whose target is still empty', () => {
    const plan = compilePlan(
      draft([beat(1, { action: 'click' }), beat(2, { action: 'wait' })]),
      OPTIONS,
    )

    expect(unresolved(plan)).toContain('steps[0].target')
  })

  it('should not ask for a target on a step that does not point at anything', () => {
    const plan = compilePlan(draft([beat(1, { action: 'wait' })]), OPTIONS)

    expect(unresolved(plan)).not.toContain('steps[0].target')
  })

  it('should report nothing outstanding once the url and targets are filled', () => {
    const plan = compilePlan(draft([beat(1, { action: 'click' })]), OPTIONS)
    const filled = {
      ...plan,
      url: 'http://localhost:3000',
      steps: [{ ...plan.steps[0], target: '#submit' }],
    }

    expect(unresolved(filled as typeof plan)).toEqual([])
  })
})

describe('parsePlan', () => {
  it('should read back a plan this module compiled', () => {
    const plan = compilePlan(draft([beat(1, { action: 'click' })]), OPTIONS)

    const parsed = parsePlan(JSON.stringify(plan))

    expect(parsed).toEqual({ status: 'parsed', plan })
  })

  it('should refuse text that is not json', () => {
    const parsed = parsePlan('{ not json')

    expect(parsed.status).toBe('failed')
  })

  it('should refuse a plan carrying no steps array', () => {
    const parsed = parsePlan('{"slug":"x","url":"http://x","steps":{}}')

    expect(parsed).toMatchObject({
      status: 'failed',
      reason: 'steps is not an array',
    })
  })

  it('should refuse a plan whose steps array is empty', () => {
    const parsed = parsePlan('{"slug":"x","url":"http://x","steps":[]}')

    expect(parsed).toMatchObject({ status: 'failed', reason: 'steps is empty' })
  })

  it('should name the step and the field when a kind is not one it can drive', () => {
    const parsed = parsePlan(
      '{"slug":"x","url":"http://x","steps":[{"kind":"marvel"}]}',
    )

    expect(parsed).toMatchObject({
      status: 'failed',
      reason: 'steps[0].kind is "marvel", which is not a step this can drive',
    })
  })

  it('should restore the seeded timing a hand-edited plan dropped', () => {
    const parsed = parsePlan(
      '{"slug":"x","url":"http://x","steps":[{"kind":"click","target":"#a"}]}',
    )

    expect(parsed).toMatchObject({
      status: 'parsed',
      plan: { pointer: { travelMs: 400, typeDelayMs: 110 } },
    })
  })

  it('should read a color scheme the plan sets', () => {
    const parsed = parsePlan(
      '{"slug":"x","url":"http://x","colorScheme":"dark","steps":[{"kind":"hold"}]}',
    )

    expect(parsed).toMatchObject({
      status: 'parsed',
      plan: { colorScheme: 'dark' },
    })
  })

  it('should leave the color scheme unset when the plan carries none', () => {
    const parsed = parsePlan(
      '{"slug":"x","url":"http://x","steps":[{"kind":"hold"}]}',
    )

    expect(parsed.status === 'parsed' && 'colorScheme' in parsed.plan).toBe(
      false,
    )
  })

  it('should refuse a color scheme other than light or dark', () => {
    const parsed = parsePlan(
      '{"slug":"x","url":"http://x","colorScheme":"sepia","steps":[{"kind":"hold"}]}',
    )

    expect(parsed).toMatchObject({
      status: 'failed',
      reason: 'colorScheme is "sepia", which is not light or dark',
    })
  })

  it('should keep a hand-tuned timing rather than overwriting it with the default', () => {
    const parsed = parsePlan(
      '{"slug":"x","url":"http://x","pointer":{"travelMs":900,"typeDelayMs":40},"steps":[{"kind":"hold"}]}',
    )

    expect(parsed).toMatchObject({
      status: 'parsed',
      plan: { pointer: { travelMs: 900, typeDelayMs: 40 } },
    })
  })
})

describe('deriveSteps', () => {
  it('should divide the travel time by the measured round trip', () => {
    expect(deriveSteps(400, 10)).toBe(40)
  })

  it('should floor a slow round trip at the minimum rather than teleport', () => {
    expect(deriveSteps(400, 1000)).toBe(MIN_POINTER_STEPS)
  })

  it('should cap a near-zero round trip rather than let the count run away', () => {
    expect(deriveSteps(400, 0.001)).toBe(MAX_POINTER_STEPS)
  })

  it('should cap a round trip of zero the same way, treating it as unmeasurable', () => {
    expect(deriveSteps(400, 0)).toBe(MAX_POINTER_STEPS)
  })

  it('should derive fewer steps on a loaded machine than an idle one for the same travel time', () => {
    const idle = deriveSteps(400, 8)
    const loaded = deriveSteps(400, 20)

    expect(loaded).toBeLessThan(idle)
  })
})
