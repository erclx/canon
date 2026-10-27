import { describe, expect, it } from 'vitest'
import { FPS, LOG_VERSION, VIEWPORT, readTakeLog } from '@/take/log'

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
