import { describe, expect, it } from 'vitest'
import type { CameraFrame, CameraTrack } from '@/take/camera'
import { checkBeat } from '@/take/check'
import {
  FPS,
  LOG_VERSION,
  type LogEvent,
  type Point,
  type TakeLog,
  VIEWPORT,
} from '@/take/log'

const FRAME_MS = 1000 / FPS
const FIELD = { x: 400, y: 300, width: 200, height: 40 }

function logOf(
  events: readonly LogEvent[],
  extra: Partial<TakeLog> = {},
): TakeLog {
  return {
    version: LOG_VERSION,
    viewport: VIEWPORT,
    fps: FPS,
    route: 'step',
    frames: 600,
    events,
    ...extra,
  }
}

function move(t: number, ms: number, to: Point = { x: 500, y: 320 }): LogEvent {
  return { t, kind: 'move', from: { x: 960, y: 540 }, to, ms }
}

function click(t: number): LogEvent {
  return { t, kind: 'click', at: { x: 500, y: 320 } }
}

function scroll(t: number): LogEvent {
  return { t, kind: 'scroll', at: { x: 500, y: 320 }, dx: 0, dy: 400, ms: 900 }
}

function typed(t: number, at: Point): LogEvent {
  return { t, kind: 'type', at, box: FIELD, chars: 5, ms: 450 }
}

/** A track holding scale 1 but for each ramp, eased linearly to `to` and held. */
function trackOf(
  ramps: readonly { from: number; ms: number; to: number }[],
  seconds = 10,
): CameraTrack {
  const frames: CameraFrame[] = []
  for (let index = 0; index <= (seconds * 1000) / FRAME_MS; index += 1) {
    const ms = index * FRAME_MS
    let scale = 1
    for (const ramp of ramps) {
      if (ms < ramp.from) break
      const before = scale
      const progress = Math.min(1, (ms - ramp.from) / ramp.ms)
      scale = before + (ramp.to - before) * progress
    }
    frames.push({
      ms,
      scale,
      x: 0,
      y: 0,
      cursor: { x: 0, y: 0 },
      ring: null,
    })
  }
  return { version: 1, viewport: VIEWPORT, fps: FPS, frames }
}

const STILL = trackOf([])

describe('checkBeat cursor rules', () => {
  it('should pass a glide of 583 ms, the frame clock reading of 600 ms', () => {
    const log = logOf([move(600, 583), click(1483)])

    expect(checkBeat(log, STILL)).toEqual([])
  })

  it('should fail a glide under 550 ms as glide-fast', () => {
    const log = logOf([move(600, 300), click(1200)])

    expect(checkBeat(log, STILL)).toEqual([
      { rule: 'glide-fast', t: 600, measured: 300, limit: 550 },
    ])
  })

  it('should fail a scroll wheeled the frame the cursor arrived as no-rest', () => {
    const log = logOf([move(600, 600), scroll(1200)])

    expect(checkBeat(log, STILL)).toEqual([
      { rule: 'no-rest', t: 1200, measured: 0, limit: 250 },
    ])
  })

  it('should pass a press after a 283 ms rest', () => {
    const log = logOf([move(600, 600), click(1483)])

    expect(checkBeat(log, STILL)).toEqual([])
  })

  it('should fail a glide leaving 200 ms after a press as left-early', () => {
    const log = logOf([move(600, 600), click(1500), move(1700, 600)])

    expect(checkBeat(log, STILL)).toEqual([
      { rule: 'left-early', t: 1500, measured: 200, limit: 400 },
    ])
  })

  it("should pass a fill's 300 ms step off the field and its 150 ms settle", () => {
    const log = logOf([
      move(600, 600),
      click(1500),
      move(1950, 300, { x: 610, y: 350 }),
      typed(2400, { x: 610, y: 350 }),
    ])

    expect(checkBeat(log, STILL)).toEqual([])
  })

  it('should fail typing with the cursor on the field as typed-under', () => {
    const log = logOf([
      move(600, 600),
      click(1500),
      typed(1950, { x: 500, y: 320 }),
    ])

    expect(checkBeat(log, STILL)).toEqual([
      { rule: 'typed-under', t: 1950, measured: 0, limit: 0 },
    ])
  })
})

describe('checkBeat zoom rules', () => {
  it('should pass a zoom in and out over 600 ms each', () => {
    const track = trackOf([
      { from: 600, ms: 600, to: 2 },
      { from: 3000, ms: 600, to: 1 },
    ])

    expect(checkBeat(logOf([]), track)).toEqual([])
  })

  it('should fail a zoom in over 300 ms as zoom-fast', () => {
    const track = trackOf([
      { from: 600, ms: 300, to: 2 },
      { from: 3000, ms: 600, to: 1 },
    ])

    expect(checkBeat(logOf([]), track)).toEqual([
      { rule: 'zoom-fast', t: 600, measured: 300, limit: 500 },
    ])
  })

  it('should fail zooming back in 1 s after zooming out as pump', () => {
    const track = trackOf([
      { from: 600, ms: 600, to: 2 },
      { from: 2000, ms: 600, to: 1 },
      { from: 3600, ms: 600, to: 2 },
      { from: 7000, ms: 600, to: 1 },
    ])

    expect(checkBeat(logOf([]), track)).toEqual([
      { rule: 'pump', t: 2600, measured: 1000, limit: 1500 },
    ])
  })

  it('should pass zooming back in 2 s after zooming out', () => {
    const track = trackOf([
      { from: 600, ms: 600, to: 2 },
      { from: 2000, ms: 600, to: 1 },
      { from: 4600, ms: 600, to: 2 },
      { from: 7000, ms: 600, to: 1 },
    ])

    expect(checkBeat(logOf([]), track)).toEqual([])
  })
})

describe('checkBeat on a beat no hand drives', () => {
  it('should skip the cursor rules and still check the zoom rules', () => {
    const log = logOf(
      [move(600, 300), scroll(900), typed(2000, { x: 500, y: 320 })],
      { hand: false },
    )
    const track = trackOf([{ from: 600, ms: 300, to: 2 }])

    expect(checkBeat(log, track).map((found) => found.rule)).toEqual([
      'zoom-fast',
    ])
  })
})

describe('checkBeat output order', () => {
  it('should list breaches from both rule sets in clip-time order', () => {
    const log = logOf([move(600, 600), scroll(1200), move(4000, 300)])
    const track = trackOf([{ from: 2000, ms: 300, to: 2 }])

    expect(checkBeat(log, track).map((found) => found.rule)).toEqual([
      'no-rest',
      'zoom-fast',
      'glide-fast',
    ])
  })
})
