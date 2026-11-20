import { describe, expect, it } from 'vitest'
import {
  FPS,
  LOG_VERSION,
  type LogEvent,
  START,
  type SentPoint,
  VIEWPORT,
  clipMismatch,
  clipSize,
  cursorAt,
  readTakeLog,
  startOf,
} from '@/take/log'

/**
 * Covers reading a log back off disk, which `canon take camera` does on a
 * file a person may have pointed at by mistake, such as the plan.
 */

function logSource(extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: LOG_VERSION,
    viewport: VIEWPORT,
    fps: FPS,
    route: 'step',
    frames: 120,
    events: [],
    ...extra,
  })
}

describe('readTakeLog', () => {
  it('should read a log a take wrote', () => {
    const read = readTakeLog(logSource())

    expect(read).toMatchObject({
      kind: 'read',
      log: { route: 'step', frames: 120, events: [] },
    })
  })

  it('should read an older log carrying no clip', () => {
    const read = readTakeLog(logSource({ route: 'screencast' }))

    expect(read).toMatchObject({ kind: 'read', log: { route: 'screencast' } })
    expect(read).not.toHaveProperty('log.clip')
  })

  it('should refuse text that is not JSON', () => {
    expect(readTakeLog('{ not json')).toMatchObject({ kind: 'refused' })
  })

  it('should refuse a take plan read as a log', () => {
    const read = readTakeLog(JSON.stringify({ beats: [] }))

    expect(read).toMatchObject({
      kind: 'refused',
      detail: expect.stringContaining('frames'),
    })
  })
})

describe('cursorAt', () => {
  const FROM = { x: 100, y: 100 }
  const TO = { x: 400, y: 100 }

  function sentMove(points: readonly SentPoint[]): LogEvent {
    return { t: 1000, kind: 'move', from: FROM, to: TO, ms: 300, points }
  }

  it('should draw a point the page was sent at the time it was sent', () => {
    const move = sentMove([
      { t: 1000, x: 130, y: 100 },
      { t: 1100, x: 250, y: 100 },
      { t: 1200, x: 400, y: 100 },
    ])

    expect(cursorAt([move], 1100)).toEqual({ x: 250, y: 100 })
  })

  it('should hold the last sent point until the next one is sent', () => {
    const move = sentMove([
      { t: 1000, x: 130, y: 100 },
      { t: 1100, x: 250, y: 100 },
      { t: 1200, x: 400, y: 100 },
    ])

    expect(cursorAt([move], 1100)).toEqual({ x: 250, y: 100 })
    expect(cursorAt([move], 1150)).toEqual({ x: 250, y: 100 })
  })

  it('should hold the last sent point once the glide has ended', () => {
    const move = sentMove([
      { t: 1000, x: 130, y: 100 },
      { t: 1200, x: 400, y: 100 },
    ])

    expect(cursorAt([move], 5000)).toEqual({ x: 400, y: 100 })
  })

  it('should draw a point stamped a rounding error past the frame it was sent in', () => {
    // A stage clock summing frame lengths lands past a reader's frame time.
    const move = sentMove([
      { t: 1000, x: 130, y: 100 },
      { t: 1733.3333333333335, x: 250, y: 100 },
    ])

    expect(cursorAt([move], 1733.333333333333)).toEqual({ x: 250, y: 100 })
  })

  it('should hold a point a slow page skipped frames after', () => {
    const move = sentMove([
      { t: 1000, x: 160, y: 100 },
      { t: 1250, x: 400, y: 100 },
    ])

    expect(cursorAt([move], 1125)).toEqual({ x: 160, y: 100 })
  })

  it('should read the eased path off a move an older log wrote with no points', () => {
    const move: LogEvent = {
      t: 1000,
      kind: 'move',
      from: FROM,
      to: TO,
      ms: 300,
    }

    expect(cursorAt([move], 1000)).toEqual(FROM)
    expect(cursorAt([move], 1150)).toEqual({ x: 250, y: 100 })
    expect(cursorAt([move], 1300)).toEqual(TO)
  })

  it('should rest at the start point before the first move', () => {
    const move = sentMove([{ t: 1000, x: 130, y: 100 }])

    expect(cursorAt([move], 500)).toEqual(START)
  })

  it("should rest at a smaller window's center when given its start", () => {
    const move = sentMove([{ t: 1000, x: 130, y: 100 }])

    expect(cursorAt([move], 500, startOf({ width: 800, height: 600 }))).toEqual(
      { x: 400, y: 300 },
    )
  })
})

describe('startOf', () => {
  it('should place the default window start at 960, 540', () => {
    expect(startOf({ width: 1920, height: 1080 })).toEqual({ x: 960, y: 540 })
  })

  it("should place a smaller window's start at its own center", () => {
    expect(startOf({ width: 800, height: 600 })).toEqual({ x: 400, y: 300 })
  })
})

describe('clipSize', () => {
  const NARROW = { width: 800, height: 600 }

  it('should film a stepped window at twice its size by default', () => {
    expect(clipSize('step', NARROW)).toEqual({ width: 1600, height: 1200 })
  })

  it('should film a stepped window at its size at device scale 1', () => {
    expect(clipSize('step', NARROW, 1)).toEqual({ width: 800, height: 600 })
  })

  it('should film a screencast at the window whatever the scale', () => {
    expect(clipSize('screencast', NARROW, 2)).toEqual({
      width: 800,
      height: 600,
    })
  })

  it('should keep the default window at the sizes filmed before', () => {
    expect(clipSize('step', VIEWPORT)).toEqual({ width: 3840, height: 2160 })
    expect(clipSize('screencast', VIEWPORT)).toEqual({
      width: 1920,
      height: 1080,
    })
  })
})

describe('clipMismatch', () => {
  it('should report nothing when the clip matches its route', () => {
    expect(
      clipMismatch(
        { width: 3840, height: 2160 },
        { width: 3840, height: 2160 },
      ),
    ).toBeUndefined()
  })

  it('should name both sizes when the clip came out smaller', () => {
    expect(
      clipMismatch({ width: 1920, height: 1080 }, { width: 800, height: 600 }),
    ).toBe('the clip measured 800x600, not the 1920x1080 its route films at')
  })

  it('should report a clip larger on one side only', () => {
    expect(
      clipMismatch(
        { width: 1920, height: 1080 },
        { width: 1920, height: 1200 },
      ),
    ).toContain('1920x1200')
  })
})
