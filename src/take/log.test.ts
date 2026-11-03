import { describe, expect, it } from 'vitest'
import {
  FPS,
  LOG_VERSION,
  type LogEvent,
  START,
  type SentPoint,
  VIEWPORT,
  cursorAt,
  readTakeLog,
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

  it('should interpolate between two sent points by time', () => {
    const move = sentMove([
      { t: 1000, x: 130, y: 100 },
      { t: 1100, x: 250, y: 100 },
      { t: 1200, x: 400, y: 100 },
    ])

    expect(cursorAt([move], 1150)).toEqual({ x: 325, y: 100 })
  })

  it('should hold the last sent point once the glide has ended', () => {
    const move = sentMove([
      { t: 1000, x: 130, y: 100 },
      { t: 1200, x: 400, y: 100 },
    ])

    expect(cursorAt([move], 5000)).toEqual({ x: 400, y: 100 })
  })

  it('should follow points a slow page skipped frames between', () => {
    const move = sentMove([
      { t: 1000, x: 160, y: 100 },
      { t: 1250, x: 400, y: 100 },
    ])

    expect(cursorAt([move], 1125)).toEqual({ x: 280, y: 100 })
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
})
