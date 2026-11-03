import { describe, expect, it } from 'vitest'
import { type Box, FPS, type LogEvent, START } from '@/take/log'
import {
  type KeyInput,
  type PointerInput,
  type Stage,
  TargetOffscreen,
  performSteps,
} from '@/take/perform'
import type { TakeStep } from '@/take/plan'

/**
 * Covers the choreography both routes share, through a stage that records
 * each input instead of sending it. A route only translates these inputs, so
 * the order and fields here are what the page sees on either one.
 */

const FRAME_MS = 1000 / FPS

type Sent =
  | ({ readonly via: 'pointer' } & PointerInput)
  | ({ readonly via: 'press' } & KeyInput)

/**
 * A stage on a frame clock whose targets resolve to fixed boxes. A pointer
 * input takes `pointerMs` of clip time, one frame by default, and longer for a
 * slow page that answers each input only once it paints.
 */
function recordingStage(boxes: Record<string, Box>, pointerMs = FRAME_MS) {
  const sent: Sent[] = []
  let ms = 0
  const stage: Stage = {
    now: () => ms,
    hold: async (wait) => {
      ms += Math.round(wait / FRAME_MS) * FRAME_MS
    },
    pointer: async (input) => {
      sent.push({ via: 'pointer', ...input })
      ms += pointerMs
    },
    key: async () => {
      ms += FRAME_MS
    },
    press: async (input) => {
      sent.push({ via: 'press', ...input })
      ms += FRAME_MS
    },
    evaluate: async <T>(expression: string) => {
      const target = Object.keys(boxes).find((name) =>
        expression.includes(JSON.stringify(name)),
      )
      return (target ? boxes[target] : null) as T
    },
  }
  return { stage, sent }
}

async function perform(
  boxes: Record<string, Box>,
  steps: TakeStep[],
  pointerMs?: number,
) {
  const { stage, sent } = recordingStage(boxes, pointerMs)
  const log: LogEvent[] = []
  await performSteps(stage, steps, { pointer: START, log })
  return { sent, log }
}

const CARD: Box = { x: 100, y: 100, width: 40, height: 20 }
const LANE: Box = { x: 600, y: 400, width: 200, height: 100 }

describe('performSteps drag', () => {
  it('should press at the source, travel held, and release on the target', async () => {
    const { sent } = await perform({ '#card': CARD, '#lane': LANE }, [
      { kind: 'drag', from: '#card', to: '#lane' },
    ])

    const down = sent.findIndex((input) => input.type === 'down')
    const up = sent.findIndex((input) => input.type === 'up')
    expect(sent[down]).toMatchObject({ via: 'pointer', x: 120, y: 110 })
    expect(sent[up]).toMatchObject({ via: 'pointer', x: 700, y: 450 })
    expect(sent.slice(down + 1, up).length).toBeGreaterThan(1)
    expect(
      sent.slice(down + 1, up).every((input) => 'held' in input && input.held),
    ).toBe(true)
  })

  it('should glide to the source without holding the button', async () => {
    const { sent } = await perform({ '#card': CARD, '#lane': LANE }, [
      { kind: 'drag', from: '#card', to: '#lane' },
    ])

    const down = sent.findIndex((input) => input.type === 'down')
    expect(sent.slice(0, down).some((input) => 'held' in input)).toBe(false)
  })

  it('should log one drag beside the moves that carry its travel', async () => {
    const { log } = await perform({ '#card': CARD, '#lane': LANE }, [
      { kind: 'drag', from: '#card', to: '#lane' },
    ])

    expect(log.map((event) => event.kind)).toEqual(['move', 'move', 'drag'])
    expect(log[2]).toMatchObject({
      kind: 'drag',
      from: { x: 120, y: 110 },
      to: { x: 700, y: 450 },
      box: CARD,
      drop: LANE,
    })
  })

  it('should time the drag from its press to its release', async () => {
    const { log } = await perform({ '#card': CARD, '#lane': LANE }, [
      { kind: 'drag', from: '#card', to: '#lane' },
    ])

    const [glide, travel, drag] = log
    expect(drag?.t).toBeGreaterThan(glide?.t ?? Infinity)
    expect(drag?.t).toBeLessThan(travel?.t ?? -Infinity)
    expect(drag && 'ms' in drag && drag.ms).toBeGreaterThan(
      travel && 'ms' in travel ? travel.ms : Infinity,
    )
  })
})

describe('performSteps dblclick', () => {
  it('should send two press pairs, the second counting two', async () => {
    const { sent } = await perform({ '#frame': CARD }, [
      { kind: 'dblclick', target: '#frame' },
    ])

    const presses = sent.filter(
      (input) => input.type === 'down' || input.type === 'up',
    )
    expect(
      presses.map((input) => [
        input.type,
        'clickCount' in input && input.clickCount,
      ]),
    ).toEqual([
      ['down', 1],
      ['up', 1],
      ['down', 2],
      ['up', 2],
    ])
  })

  it('should log one click counting two', async () => {
    const { log } = await perform({ '#frame': CARD }, [
      { kind: 'dblclick', target: '#frame' },
    ])

    expect(log.filter((event) => event.kind === 'click')).toEqual([
      expect.objectContaining({ kind: 'click', box: CARD, count: 2 }),
    ])
  })

  it('should log a single click with no count', async () => {
    const { log } = await perform({ '#frame': CARD }, [
      { kind: 'click', target: '#frame' },
    ])

    expect(log.find((event) => event.kind === 'click')).not.toHaveProperty(
      'count',
    )
  })
})

describe('performSteps modifiers', () => {
  it('should hold the modifier from before the press to after the release', async () => {
    const { sent } = await perform({ '#layer': CARD }, [
      { kind: 'click', target: '#layer', modifiers: ['Shift'] },
    ])

    const order = sent
      .filter((input) => input.type === 'down' || input.type === 'up')
      .map((input) => `${input.via} ${input.type}`)
    expect(order).toEqual([
      'press down',
      'pointer down',
      'pointer up',
      'press up',
    ])
  })

  it('should carry the modifiers on every input of the press', async () => {
    const { sent } = await perform({ '#layer': CARD }, [
      { kind: 'click', target: '#layer', modifiers: ['Shift', 'Meta'] },
    ])

    const pointer = sent.filter(
      (input) =>
        input.via === 'pointer' &&
        (input.type === 'down' || input.type === 'up'),
    )
    expect(
      pointer.map((input) => 'modifiers' in input && input.modifiers),
    ).toEqual([
      ['Shift', 'Meta'],
      ['Shift', 'Meta'],
    ])
  })

  it('should log the modifiers on the click', async () => {
    const { log } = await perform({ '#layer': CARD }, [
      { kind: 'click', target: '#layer', modifiers: ['Meta'] },
    ])

    expect(log.find((event) => event.kind === 'click')).toMatchObject({
      modifiers: ['Meta'],
    })
  })

  it('should carry the modifiers through a drag held move', async () => {
    const { sent } = await perform({ '#card': CARD, '#lane': LANE }, [
      { kind: 'drag', from: '#card', to: '#lane', modifiers: ['Alt'] },
    ])

    const held = sent.filter((input) => 'held' in input && input.held)
    expect(
      held.every(
        (input) => 'modifiers' in input && input.modifiers?.[0] === 'Alt',
      ),
    ).toBe(true)
  })
})

describe('performSteps key', () => {
  it('should press the modifiers around the key and release them in reverse', async () => {
    const { sent } = await perform({}, [
      { kind: 'key', keys: 'Control+Shift+K' },
    ])

    expect(sent).toEqual([
      { via: 'press', type: 'down', key: 'Control', modifiers: ['Control'] },
      {
        via: 'press',
        type: 'down',
        key: 'Shift',
        modifiers: ['Control', 'Shift'],
      },
      { via: 'press', type: 'down', key: 'K', modifiers: ['Control', 'Shift'] },
      { via: 'press', type: 'up', key: 'K', modifiers: ['Control', 'Shift'] },
      { via: 'press', type: 'up', key: 'Shift', modifiers: ['Control'] },
      { via: 'press', type: 'up', key: 'Control', modifiers: [] },
    ])
  })

  it('should log the key as written with no point on the page', async () => {
    const { log } = await perform({}, [{ kind: 'key', keys: 'Escape' }])

    expect(log).toEqual([
      { t: 0, kind: 'key', keys: 'Escape', ms: 2 * FRAME_MS },
    ])
  })
})

/** The end of a logged event that runs for a length, or its time when none. */
function endOf(event: LogEvent | undefined): number {
  if (!event) return Number.NaN
  return 'ms' in event ? event.t + event.ms : event.t
}

const NOTE: Box = { x: 300, y: 600, width: 200, height: 40 }

describe('performSteps pacing around a press', () => {
  it('should rest on the target 300 ms between the glide and the press', async () => {
    const { log } = await perform({ '#card': CARD }, [
      { kind: 'click', target: '#card' },
    ])

    const [glide, press] = log
    expect(press?.kind).toBe('click')
    expect((press?.t ?? 0) - endOf(glide)).toBeCloseTo(300, 5)
  })

  it('should hold 500 ms on the result before the next glide sets off', async () => {
    const { log } = await perform({ '#card': CARD, '#lane': LANE }, [
      { kind: 'click', target: '#card' },
      { kind: 'click', target: '#lane' },
    ])

    const [, press, next] = log
    // The press itself sends a down and an up, a frame each.
    expect(next?.kind).toBe('move')
    expect((next?.t ?? 0) - (press?.t ?? 0)).toBeCloseTo(2 * FRAME_MS + 500, 5)
  })

  it('should rest and hold around a drag the way it does around a click', async () => {
    const { log } = await perform({ '#card': CARD, '#lane': LANE }, [
      { kind: 'drag', from: '#card', to: '#lane' },
      { kind: 'key', keys: 'Escape' },
    ])

    const [glide, , drag, key] = log
    expect((drag?.t ?? 0) - endOf(glide)).toBeCloseTo(300, 5)
    expect((key?.t ?? 0) - endOf(drag)).toBeCloseTo(500, 5)
  })

  it('should wait 400 ms between the field click and the first key', async () => {
    const { log } = await perform({ '#note': NOTE }, [
      { kind: 'fill', target: '#note', text: 'hi' },
    ])

    const [, press, typed] = log
    expect(typed?.kind).toBe('type')
    expect((typed?.t ?? 0) - (press?.t ?? 0)).toBeCloseTo(2 * FRAME_MS + 400, 5)
  })

  it('should hold 500 ms on the typed field once the last key lands', async () => {
    const { log } = await perform({ '#note': NOTE }, [
      { kind: 'fill', target: '#note', text: 'hi' },
      { kind: 'key', keys: 'Escape' },
    ])

    const [, , typed, key] = log
    expect((key?.t ?? 0) - endOf(typed)).toBeCloseTo(500, 5)
  })

  it('should add no pause to setup steps, which run before the clip', async () => {
    const { stage, sent } = recordingStage({ '#card': CARD })

    await performSteps(stage, [{ kind: 'click', target: '#card' }], {
      pointer: { x: 120, y: 110 },
    })

    expect(sent).toHaveLength(2)
    expect(stage.now()).toBeCloseTo(2 * FRAME_MS, 5)
  })

  it('should leave a key with no pointer press unpaced', async () => {
    const { log } = await perform({}, [
      { kind: 'key', keys: 'Escape' },
      { kind: 'key', keys: 'Escape' },
    ])

    expect(log.map((event) => event.t)).toEqual([0, 2 * FRAME_MS])
  })
})

describe('performSteps move hold', () => {
  it('should let the hold pass at the glide end and log it on the move', async () => {
    const { log } = await perform({ '#card': CARD }, [
      { kind: 'move', target: '#card', hold: 600 },
      { kind: 'key', keys: 'Escape' },
    ])

    const [glide, key] = log
    expect(glide).toMatchObject({ kind: 'move', hold: 600 })
    const end = glide && 'ms' in glide ? glide.t + glide.ms : Infinity
    expect(key?.t).toBeCloseTo(end + 600, 5)
  })

  it('should log no hold on a move that carries none', async () => {
    const { log } = await perform({ '#card': CARD }, [
      { kind: 'move', target: '#card' },
    ])

    expect(log[0]).not.toHaveProperty('hold')
  })
})

/** How long each pointer input takes on a page painting every 200 ms. */
const SLOW_MS = 200

describe('performSteps pacing', () => {
  it('should send one move per frame of the glide when each input takes a frame', async () => {
    const { sent } = await perform({ '#card': CARD }, [
      { kind: 'move', target: '#card' },
    ])

    // From the center to (120, 110) is 944 px, a 850 ms glide of 51 frames.
    expect(sent.filter((input) => input.type === 'move')).toHaveLength(51)
  })

  it('should end a glide on the target in fewer inputs when the page is slow', async () => {
    const { sent } = await perform(
      { '#card': CARD },
      [{ kind: 'move', target: '#card' }],
      SLOW_MS,
    )

    const moves = sent.filter((input) => input.type === 'move')
    expect(moves.length).toBeLessThan(10)
    expect(moves.at(-1)).toMatchObject({ x: 120, y: 110 })
  })

  it('should log a slow glide at the length it ran', async () => {
    const { sent, log } = await perform(
      { '#card': CARD },
      [{ kind: 'move', target: '#card' }],
      SLOW_MS,
    )

    const moves = sent.filter((input) => input.type === 'move')
    expect(log).toEqual([
      expect.objectContaining({
        kind: 'move',
        t: 0,
        ms: moves.length * SLOW_MS,
      }),
    ])
  })

  it('should log every point a glide sent, in the order it sent them', async () => {
    const { sent, log } = await perform({ '#card': CARD }, [
      { kind: 'move', target: '#card' },
    ])

    const moves = sent.filter((input) => input.type === 'move')
    const [glide] = log
    const points = glide?.kind === 'move' ? (glide.points ?? []) : []
    expect(points.map(({ x, y }) => ({ x, y }))).toEqual(
      moves.map(({ x, y }) => ({ x, y })),
    )
  })

  it('should stamp each point a slow page took with the time it was sent', async () => {
    const { log } = await perform(
      { '#card': CARD },
      [{ kind: 'move', target: '#card' }],
      SLOW_MS,
    )

    const [glide] = log
    const points = glide?.kind === 'move' ? (glide.points ?? []) : []
    expect(points.slice(0, 3).map((point) => point.t)).toEqual([0, 200, 400])
    expect(points.at(-1)).toMatchObject({ x: 120, y: 110 })
  })

  it('should wheel the whole scroll in fewer inputs when the page is slow', async () => {
    const { sent } = await perform(
      { '#card': CARD },
      [{ kind: 'scroll', target: '#card', dy: 600 }],
      SLOW_MS,
    )

    const wheels = sent.filter((input) => input.type === 'wheel')
    expect(wheels.length).toBeLessThan(10)
    expect(
      wheels.reduce((sum, input) => sum + ('dy' in input ? input.dy : 0), 0),
    ).toBeCloseTo(600)
  })

  it('should log a slow scroll at the length it ran', async () => {
    const { sent, log } = await perform(
      { '#card': CARD },
      [{ kind: 'scroll', target: '#card', dy: 600 }],
      SLOW_MS,
    )

    const wheels = sent.filter((input) => input.type === 'wheel')
    expect(log.find((event) => event.kind === 'scroll')).toMatchObject({
      ms: wheels.length * SLOW_MS,
    })
  })
})

/** A card below the 1080-tall window, as a page lays out one further down. */
const BELOW: Box = { x: 100, y: 3083, width: 400, height: 240 }

/** A card cut by the window's bottom edge with its center still inside. */
const STRADDLING: Box = { x: 100, y: 1000, width: 400, height: 140 }

/** A page-tall element spanning the window, its center far below it. */
const TALL: Box = { x: 0, y: -500, width: 1920, height: 5000 }

/** A card showing only its top 5 px at the window's bottom edge. */
const SLIVER: Box = { x: 100, y: 1075, width: 400, height: 240 }

function wheels(sent: readonly Sent[]) {
  return sent.filter((input) => input.type === 'wheel')
}

describe('performSteps targets outside the window', () => {
  it('should refuse a move to a target whose center is below the window', async () => {
    const run = perform({ '#card': BELOW }, [{ kind: 'move', target: '#card' }])

    await expect(run).rejects.toThrow(TargetOffscreen)
    await expect(run).rejects.toMatchObject({ target: '#card' })
  })

  it('should send no input toward a target outside the window', async () => {
    const { stage, sent } = recordingStage({ '#card': BELOW })

    await performSteps(stage, [{ kind: 'click', target: '#card' }], {
      pointer: START,
    }).catch(() => {})

    expect(sent).toEqual([])
  })

  it('should move to a target cut by the edge whose center is inside', async () => {
    const { sent } = await perform({ '#card': STRADDLING }, [
      { kind: 'move', target: '#card' },
    ])

    expect(sent.at(-1)).toMatchObject({ x: 300, y: 1070 })
  })

  it('should refuse a drag whose drop target is outside the window', async () => {
    const run = perform({ '#card': CARD, '#lane': BELOW }, [
      { kind: 'drag', from: '#card', to: '#lane' },
    ])

    await expect(run).rejects.toMatchObject({ target: '#lane' })
  })

  it('should wheel a target taller than the window at the window center', async () => {
    const { sent } = await perform({ body: TALL }, [
      { kind: 'scroll', target: 'body', dy: 700 },
    ])

    expect(wheels(sent).length).toBeGreaterThan(0)
    for (const wheel of wheels(sent)) {
      expect(wheel).toMatchObject({ x: 960, y: 540 })
    }
  })

  it('should log a tall target scroll at the point it wheeled', async () => {
    const { log } = await perform({ body: TALL }, [
      { kind: 'scroll', target: 'body', dy: 700 },
    ])

    expect(log.find((event) => event.kind === 'scroll')).toMatchObject({
      at: { x: 960, y: 540 },
    })
  })

  it('should wheel inside the part of a target the window shows', async () => {
    const { sent } = await perform({ '#card': SLIVER }, [
      { kind: 'scroll', target: '#card', dy: 300 },
    ])

    expect(wheels(sent)[0]).toMatchObject({ x: 300, y: 1077.5 })
  })

  it('should wheel at the true center of a target cut by the edge whose center is inside', async () => {
    const { sent } = await perform({ '#card': STRADDLING }, [
      { kind: 'scroll', target: '#card', dy: 300 },
    ])

    expect(wheels(sent)[0]).toMatchObject({ x: 300, y: 1070 })
  })

  it('should refuse a scroll on a target wholly outside the window', async () => {
    const run = perform({ '#card': BELOW }, [
      { kind: 'scroll', target: '#card', dy: 300 },
    ])

    await expect(run).rejects.toThrow(TargetOffscreen)
  })

  it('should send no input toward a scroll target wholly outside the window', async () => {
    const { stage, sent } = recordingStage({ '#card': BELOW })

    await performSteps(stage, [{ kind: 'scroll', target: '#card', dy: 300 }], {
      pointer: START,
    }).catch(() => {})

    expect(sent).toEqual([])
  })

  it('should refuse a move to a target taller than the window', async () => {
    const run = perform({ body: TALL }, [{ kind: 'move', target: 'body' }])

    await expect(run).rejects.toThrow(TargetOffscreen)
  })
})

describe('performSteps align', () => {
  /** A stage whose `align` lets 4 ms pass, noting the clock it ends on. */
  function aligningStage() {
    const { stage } = recordingStage({ '#card': CARD })
    const aligned: number[] = []
    let skew = 0
    const aligning: Stage = {
      ...stage,
      now: () => stage.now() + skew,
      align: async () => {
        skew += 4
        aligned.push(aligning.now())
      },
    }
    return { stage: aligning, aligned }
  }

  function gliding(log: readonly LogEvent[]) {
    return log.flatMap((event) =>
      event.kind === 'move' ? (event.points ?? []) : [],
    )
  }

  it('should stamp each glide point at the clock its alignment ends on', async () => {
    const { stage, aligned } = aligningStage()
    const log: LogEvent[] = []

    await performSteps(stage, [{ kind: 'move', target: '#card' }], {
      pointer: START,
      log,
    })

    const points = gliding(log)
    expect(points.length).toBeGreaterThan(1)
    expect(points.map((point) => point.t)).toEqual(aligned)
  })

  it('should stamp a glide one frame apart when the stage has no align', async () => {
    const { log } = await perform({ '#card': CARD }, [
      { kind: 'move', target: '#card' },
    ])

    const points = gliding(log)
    expect(points.length).toBeGreaterThan(1)
    points.forEach((point, index) => {
      expect(point.t).toBeCloseTo(index * FRAME_MS, 5)
    })
  })
})
