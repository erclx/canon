import { describe, expect, it } from 'vitest'
import { type Box, FPS, type LogEvent, START } from '@/take/log'
import {
  type KeyInput,
  type PointerInput,
  type Stage,
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

/** A stage on a frame clock whose targets resolve to fixed boxes. */
function recordingStage(boxes: Record<string, Box>) {
  const sent: Sent[] = []
  let ms = 0
  const stage: Stage = {
    now: () => ms,
    hold: async (wait) => {
      ms += Math.round(wait / FRAME_MS) * FRAME_MS
    },
    pointer: async (input) => {
      sent.push({ via: 'pointer', ...input })
      ms += FRAME_MS
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

async function perform(boxes: Record<string, Box>, steps: TakeStep[]) {
  const { stage, sent } = recordingStage(boxes)
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
