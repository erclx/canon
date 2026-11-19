import { describe, expect, it } from 'vitest'
import { beatViewport, parseViewport, readTakePlan } from '@/take/plan'

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

  it('should read a move carrying a hold that aims the camera at its end', () => {
    const read = readTakePlan(
      planSource([beat([{ kind: 'move', target: '#btn', hold: 800 }])]),
    )

    expect(read).toMatchObject({
      kind: 'read',
      plan: {
        beats: [{ steps: [{ kind: 'move', target: '#btn', hold: 800 }] }],
      },
    })
  })

  it('should read a move to a point carrying a hold of zero', () => {
    const read = readTakePlan(
      planSource([beat([{ kind: 'move', x: 592, y: 314, hold: 0 }])]),
    )

    expect(read).toMatchObject({
      kind: 'read',
      plan: { beats: [{ steps: [{ kind: 'move', x: 592, y: 314, hold: 0 }] }] },
    })
  })

  it.each([-1, '800', Number.POSITIVE_INFINITY, null])(
    'should refuse a move whose hold is %j',
    (hold) => {
      const read = readTakePlan(
        planSource([beat([{ kind: 'move', target: '#btn', hold }])]),
      )

      expect(read).toMatchObject({ kind: 'refused', reason: 'bad-step' })
    },
  )

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

  it('should give every beat the route the plan names', () => {
    const read = readTakePlan(
      JSON.stringify({
        route: 'screencast',
        beats: [beat([{ kind: 'wait', ms: 100 }])],
      }),
    )

    expect(read).toMatchObject({
      kind: 'read',
      plan: { beats: [{ route: 'screencast' }] },
    })
  })

  it("should keep a beat's own route over the plan's", () => {
    const read = readTakePlan(
      JSON.stringify({
        route: 'screencast',
        beats: [beat([{ kind: 'wait', ms: 100 }], { route: 'step' })],
      }),
    )

    expect(read).toMatchObject({
      kind: 'read',
      plan: { beats: [{ route: 'step' }] },
    })
  })

  it('should refuse a plan-level route this build does not record on, naming the plan', () => {
    const read = readTakePlan(
      JSON.stringify({
        route: 'obs',
        beats: [beat([{ kind: 'wait', ms: 100 }])],
      }),
    )

    expect(read).toMatchObject({
      kind: 'refused',
      reason: 'unknown-route',
      detail: expect.stringMatching(/^the plan names route obs/),
    })
  })

  it('should read a beat that turns the push off', () => {
    const read = readTakePlan(
      planSource([beat([{ kind: 'wait', ms: 100 }], { push: false })]),
    )

    expect(read).toMatchObject({
      kind: 'read',
      plan: { beats: [{ push: false }] },
    })
  })

  it('should refuse a push that is not a boolean', () => {
    const read = readTakePlan(
      planSource([beat([{ kind: 'wait', ms: 100 }], { push: 'no' })]),
    )

    expect(read).toMatchObject({ kind: 'refused', reason: 'bad-beat' })
  })

  it('should read a beat that asks for scrollbars', () => {
    const read = readTakePlan(
      planSource([beat([{ kind: 'wait', ms: 100 }], { scrollbars: true })]),
    )

    expect(read).toMatchObject({
      kind: 'read',
      plan: { beats: [{ scrollbars: true }] },
    })
  })

  it('should read scrollbars false as absent', () => {
    const read = readTakePlan(
      planSource([beat([{ kind: 'wait', ms: 100 }], { scrollbars: false })]),
    )

    expect(read).toMatchObject({ kind: 'read' })
    if (read.kind !== 'read') return
    expect(read.plan.beats[0]).not.toHaveProperty('scrollbars')
  })

  it('should refuse scrollbars that is not a boolean', () => {
    const read = readTakePlan(
      planSource([beat([{ kind: 'wait', ms: 100 }], { scrollbars: 'yes' })]),
    )

    expect(read).toMatchObject({ kind: 'refused', reason: 'bad-beat' })
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

describe('readTakePlan input steps', () => {
  function onlyStep(step: unknown) {
    const read = readTakePlan(planSource([beat([step])]))
    return read.kind === 'read' ? read.plan.beats[0]?.steps[0] : read
  }

  it('should read a drag from one target to another', () => {
    expect(onlyStep({ kind: 'drag', from: '#card', to: '#lane' })).toEqual({
      kind: 'drag',
      from: '#card',
      to: '#lane',
    })
  })

  it('should read a key combination as written', () => {
    expect(onlyStep({ kind: 'key', keys: 'Control+K' })).toEqual({
      kind: 'key',
      keys: 'Control+K',
    })
  })

  it('should read a double click on a target', () => {
    expect(onlyStep({ kind: 'dblclick', target: '#frame' })).toEqual({
      kind: 'dblclick',
      target: '#frame',
    })
  })

  it('should keep the modifiers a click holds', () => {
    expect(
      onlyStep({ kind: 'click', target: '#layer', modifiers: ['Meta'] }),
    ).toEqual({ kind: 'click', target: '#layer', modifiers: ['Meta'] })
  })

  it('should keep the modifiers a drag holds', () => {
    expect(
      onlyStep({ kind: 'drag', from: '#a', to: '#b', modifiers: ['Alt'] }),
    ).toEqual({ kind: 'drag', from: '#a', to: '#b', modifiers: ['Alt'] })
  })

  it('should leave out a modifiers list that holds nothing', () => {
    expect(
      onlyStep({ kind: 'click', target: '#layer', modifiers: [] }),
    ).toEqual({ kind: 'click', target: '#layer' })
  })

  it('should refuse a drag with no drop target', () => {
    expect(onlyStep({ kind: 'drag', from: '#card' })).toMatchObject({
      kind: 'refused',
      reason: 'bad-step',
    })
  })

  it('should read a drag from a target to a point', () => {
    expect(
      onlyStep({ kind: 'drag', from: '#card', to: { x: 4, y: 9 } }),
    ).toEqual({ kind: 'drag', from: '#card', to: { x: 4, y: 9 } })
  })

  it('should read a drag from a point to a target', () => {
    expect(
      onlyStep({ kind: 'drag', from: { x: 4, y: 9 }, to: '#lane' }),
    ).toEqual({ kind: 'drag', from: { x: 4, y: 9 }, to: '#lane' })
  })

  it('should refuse a drag end that is an object with no y', () => {
    expect(
      onlyStep({ kind: 'drag', from: { x: 4 }, to: '#lane' }),
    ).toMatchObject({ kind: 'refused', reason: 'bad-step' })
  })

  it('should read a click at a point in place of a target', () => {
    expect(onlyStep({ kind: 'click', x: 592, y: 314 })).toEqual({
      kind: 'click',
      x: 592,
      y: 314,
    })
  })

  it('should read a double click at a point with the modifiers it holds', () => {
    expect(
      onlyStep({ kind: 'dblclick', x: 10, y: 20, modifiers: ['Shift'] }),
    ).toEqual({ kind: 'dblclick', x: 10, y: 20, modifiers: ['Shift'] })
  })

  it('should refuse a click carrying both a target and a point', () => {
    expect(
      onlyStep({ kind: 'click', target: '#kit', x: 10, y: 20 }),
    ).toMatchObject({
      kind: 'refused',
      reason: 'bad-step',
      detail: expect.stringContaining('both'),
    })
  })

  it('should refuse a click with an x and no y', () => {
    expect(onlyStep({ kind: 'click', x: 10 })).toMatchObject({
      kind: 'refused',
      reason: 'bad-step',
    })
  })

  it('should refuse a point written as a target string, naming x and y', () => {
    expect(onlyStep({ kind: 'click', target: '592,314' })).toMatchObject({
      kind: 'refused',
      reason: 'bad-step',
      detail: expect.stringMatching(/"x": 592, "y": 314/),
    })
  })

  it('should refuse a point written as a move target string', () => {
    expect(onlyStep({ kind: 'move', target: '12 34' })).toMatchObject({
      kind: 'refused',
      reason: 'bad-step',
    })
  })

  it('should keep a move carrying both a target and a point on its target', () => {
    expect(onlyStep({ kind: 'move', target: '#kit', x: 1, y: 2 })).toEqual({
      kind: 'move',
      target: '#kit',
    })
  })

  it('should refuse a point written as a drag end string', () => {
    expect(
      onlyStep({ kind: 'drag', from: '#card', to: '40, 90' }),
    ).toMatchObject({ kind: 'refused', reason: 'bad-step' })
  })

  it('should refuse a key with no combination', () => {
    expect(onlyStep({ kind: 'key' })).toMatchObject({
      kind: 'refused',
      reason: 'bad-step',
    })
  })

  it('should refuse a key outside the vocabulary, naming the key', () => {
    expect(onlyStep({ kind: 'key', keys: 'Control+Hyper' })).toMatchObject({
      kind: 'refused',
      reason: 'bad-step',
      detail: expect.stringContaining('Hyper'),
    })
  })

  it('should refuse a double click with no target', () => {
    expect(onlyStep({ kind: 'dblclick' })).toMatchObject({
      kind: 'refused',
      reason: 'bad-step',
    })
  })

  it('should refuse a modifier Playwright does not name', () => {
    expect(
      onlyStep({ kind: 'click', target: '#layer', modifiers: ['Ctrl'] }),
    ).toMatchObject({ kind: 'refused', reason: 'bad-step' })
  })

  it('should refuse a modifier named twice', () => {
    expect(
      onlyStep({
        kind: 'click',
        target: '#layer',
        modifiers: ['Shift', 'Shift'],
      }),
    ).toMatchObject({ kind: 'refused', reason: 'bad-step' })
  })

  it('should refuse modifiers that are not a list', () => {
    expect(
      onlyStep({ kind: 'dblclick', target: '#layer', modifiers: 'Shift' }),
    ).toMatchObject({ kind: 'refused', reason: 'bad-step' })
  })
})

describe('readTakePlan on a beat network list', () => {
  function onlyBeat(network: unknown) {
    return readTakePlan(
      planSource([beat([{ kind: 'wait', ms: 100 }], { network })]),
    )
  }

  it('should read each entry with its pattern and action', () => {
    expect(
      onlyBeat([
        { match: '*/api/live', action: 'hold' },
        { match: 'http://127.0.0.1:*/data', action: 'abort' },
      ]),
    ).toMatchObject({
      kind: 'read',
      plan: {
        beats: [
          {
            network: [
              { match: '*/api/live', action: 'hold' },
              { match: 'http://127.0.0.1:*/data', action: 'abort' },
            ],
          },
        ],
      },
    })
  })

  it('should leave the key off a beat that names none', () => {
    const read = readTakePlan(planSource([beat([{ kind: 'wait', ms: 100 }])]))

    expect(read).toMatchObject({ kind: 'read' })
    expect(read.kind === 'read' && read.plan.beats[0]).not.toHaveProperty(
      'network',
    )
  })

  it.each([
    ['a list that is not a list', { match: '*', action: 'hold' }],
    ['an empty list', []],
    ['an entry that is not an object', ['*/data']],
    ['an entry with no pattern', [{ action: 'hold' }]],
    ['an entry with an empty pattern', [{ match: '', action: 'hold' }]],
    ['an action outside hold and abort', [{ match: '*', action: 'delay' }]],
    [
      'one pattern named twice',
      [
        { match: '*/data', action: 'hold' },
        { match: '*/data', action: 'abort' },
      ],
    ],
  ])('should refuse %s, naming the beat', (_case, network) => {
    expect(onlyBeat(network)).toMatchObject({
      kind: 'refused',
      reason: 'bad-beat',
      detail: expect.stringContaining('open the kit'),
    })
  })
})

describe('readTakePlan on a beat viewport', () => {
  function viewportPlan(viewport: unknown): string {
    return planSource([beat([{ kind: 'wait', ms: 100 }], { viewport })])
  }

  it('should read a width and a height inside the bounds', () => {
    const read = readTakePlan(viewportPlan({ width: 800, height: 600 }))

    expect(read).toMatchObject({
      kind: 'read',
      plan: { beats: [{ viewport: { width: 800, height: 600 } }] },
    })
  })

  it('should leave the key off a beat that names none', () => {
    const read = readTakePlan(planSource([beat([{ kind: 'wait', ms: 100 }])]))

    expect(read).toMatchObject({ kind: 'read' })
    expect(read.kind === 'read' && read.plan.beats[0]).not.toHaveProperty(
      'viewport',
    )
  })

  it.each([
    ['the smallest', { width: 320, height: 240 }],
    ['the default', { width: 1920, height: 1080 }],
  ])('should read %s size the bounds allow', (_label, viewport) => {
    expect(readTakePlan(viewportPlan(viewport)).kind).toBe('read')
  })

  it.each([
    ['too narrow', { width: 318, height: 600 }],
    ['too short', { width: 800, height: 238 }],
    ['wider than the default', { width: 1922, height: 600 }],
    ['taller than the default', { width: 800, height: 1082 }],
    ['an odd width', { width: 801, height: 600 }],
    ['an odd height', { width: 800, height: 601 }],
    ['a fraction', { width: 800.5, height: 600 }],
    ['a string', '800x600'],
    ['a missing height', { width: 800 }],
  ])('should refuse %s as bad-viewport', (_label, viewport) => {
    expect(readTakePlan(viewportPlan(viewport))).toMatchObject({
      kind: 'refused',
      reason: 'bad-viewport',
    })
  })

  it('should name the beat and the size it refused', () => {
    expect(
      readTakePlan(viewportPlan({ width: 2560, height: 1440 })),
    ).toMatchObject({
      detail: expect.stringMatching(/open the kit.*2560x1440/),
    })
  })
})

describe('parseViewport', () => {
  it('should read a width and a height joined by x', () => {
    expect(parseViewport('1280x720')).toEqual({
      kind: 'read',
      viewport: { width: 1280, height: 720 },
    })
  })

  it.each(['1280', '1280×720', '1280 x 720', 'x720', '-1280x720', 'wide'])(
    'should refuse %s as malformed',
    (text) => {
      expect(parseViewport(text)).toMatchObject({
        kind: 'refused',
        detail: expect.stringContaining('<width>x<height>'),
      })
    },
  )

  it.each(['2560x1440', '200x200', '1281x720'])(
    'should refuse %s, outside the bounds or odd',
    (text) => {
      expect(parseViewport(text)).toMatchObject({
        kind: 'refused',
        detail: expect.stringContaining(text),
      })
    },
  )
})

describe('beatViewport', () => {
  const plain = {
    name: 'wide',
    route: 'step',
    setup: [],
    steps: [{ kind: 'wait', ms: 100 }],
  } as const
  const narrow = { ...plain, viewport: { width: 800, height: 600 } }

  it('should take the default when neither the beat nor the take names one', () => {
    expect(beatViewport(plain)).toEqual({ width: 1920, height: 1080 })
  })

  it('should take the option for a beat that carries no key', () => {
    expect(beatViewport(plain, { width: 1280, height: 720 })).toEqual({
      width: 1280,
      height: 720,
    })
  })

  it("should take the beat's own key over the option", () => {
    expect(beatViewport(narrow, { width: 1280, height: 720 })).toEqual({
      width: 800,
      height: 600,
    })
  })
})
