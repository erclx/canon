import { describe, expect, it } from 'vitest'
import { readTakePlan } from '@/take/plan'

/**
 * Covers what a take plan may say before any browser launches. A refusal here
 * is cheaper than one a beat into a take, where a minute of frames is already
 * spent.
 */

function planSource(beats: unknown): string {
  return JSON.stringify({ beats })
}

function beat(steps: unknown, extra: Record<string, unknown> = {}) {
  return { name: 'open the kit', steps, ...extra }
}

describe('readTakePlan', () => {
  it('should read each beat with its steps in order', () => {
    const read = readTakePlan(
      planSource([
        beat([
          { kind: 'move', target: '#kit' },
          { kind: 'click', target: '#kit' },
          { kind: 'wait', ms: 400 },
        ]),
      ]),
    )

    expect(read).toEqual({
      kind: 'read',
      plan: {
        beats: [
          {
            name: 'open the kit',
            route: 'step',
            setup: [],
            steps: [
              { kind: 'move', target: '#kit' },
              { kind: 'click', target: '#kit' },
              { kind: 'wait', ms: 400 },
            ],
          },
        ],
      },
    })
  })

  it('should read a move to a point rather than a selector', () => {
    const read = readTakePlan(
      planSource([beat([{ kind: 'move', x: 592, y: 314 }])]),
    )

    expect(read).toMatchObject({
      kind: 'read',
      plan: { beats: [{ steps: [{ kind: 'move', x: 592, y: 314 }] }] },
    })
  })

  it('should read a fill and a scroll with what each performs', () => {
    const read = readTakePlan(
      planSource([
        beat([
          { kind: 'fill', target: '#search', text: 'color' },
          { kind: 'scroll', target: '#list', dy: 600 },
        ]),
      ]),
    )

    expect(read).toMatchObject({
      kind: 'read',
      plan: {
        beats: [
          {
            steps: [
              { kind: 'fill', target: '#search', text: 'color' },
              { kind: 'scroll', target: '#list', dy: 600 },
            ],
          },
        ],
      },
    })
  })

  it('should keep a beat asking for the screencast route', () => {
    const read = readTakePlan(
      planSource([beat([{ kind: 'wait', ms: 100 }], { route: 'screencast' })]),
    )

    expect(read).toMatchObject({
      kind: 'read',
      plan: { beats: [{ route: 'screencast' }] },
    })
  })

  it('should read the setup steps a beat runs before recording', () => {
    const read = readTakePlan(
      planSource([
        beat([{ kind: 'wait', ms: 100 }], {
          setup: [{ kind: 'click', target: 'text=Design' }],
        }),
      ]),
    )

    expect(read).toMatchObject({
      kind: 'read',
      plan: { beats: [{ setup: [{ kind: 'click', target: 'text=Design' }] }] },
    })
  })

  it('should refuse text that is not JSON', () => {
    const read = readTakePlan('{ not json')

    expect(read).toMatchObject({ kind: 'refused', reason: 'unreadable-plan' })
  })

  it('should refuse a plan naming no beat', () => {
    const read = readTakePlan(planSource([]))

    expect(read).toMatchObject({ kind: 'refused', reason: 'no-beats' })
  })

  it('should refuse a beat carrying no name', () => {
    const read = readTakePlan(
      planSource([{ steps: [{ kind: 'wait', ms: 100 }] }]),
    )

    expect(read).toMatchObject({ kind: 'refused', reason: 'bad-beat' })
  })

  it('should refuse a beat naming no step', () => {
    const read = readTakePlan(planSource([beat([])]))

    expect(read).toMatchObject({ kind: 'refused', reason: 'no-steps' })
  })

  it('should refuse a route this build does not record on', () => {
    const read = readTakePlan(
      planSource([beat([{ kind: 'wait', ms: 100 }], { route: 'obs' })]),
    )

    expect(read).toMatchObject({ kind: 'refused', reason: 'unknown-route' })
  })

  it('should refuse a click with no target', () => {
    const read = readTakePlan(planSource([beat([{ kind: 'click' }])]))

    expect(read).toMatchObject({ kind: 'refused', reason: 'bad-step' })
  })

  it('should refuse a move with neither a target nor a point', () => {
    const read = readTakePlan(planSource([beat([{ kind: 'move', x: 10 }])]))

    expect(read).toMatchObject({ kind: 'refused', reason: 'bad-step' })
  })

  it('should refuse a scroll with no distance', () => {
    const read = readTakePlan(
      planSource([beat([{ kind: 'scroll', target: '#list' }])]),
    )

    expect(read).toMatchObject({ kind: 'refused', reason: 'bad-step' })
  })

  it('should refuse a tab, which a take has no pointer to film', () => {
    const read = readTakePlan(planSource([beat([{ kind: 'tab' }])]))

    expect(read).toMatchObject({ kind: 'refused', reason: 'bad-step' })
  })

  it('should name the beat and the step a refusal came from', () => {
    const read = readTakePlan(
      planSource([
        beat([{ kind: 'wait', ms: 100 }]),
        beat(
          [
            { kind: 'wait', ms: 100 },
            { kind: 'fill', target: '#q' },
          ],
          {
            name: 'search',
          },
        ),
      ]),
    )

    expect(read).toMatchObject({
      kind: 'refused',
      reason: 'bad-step',
      detail: expect.stringContaining('search, step 2'),
    })
  })
})
