import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  FPS,
  LOG_VERSION,
  type LogEvent,
  type TakeLog,
  VIEWPORT,
} from '@/take/log'
import { findStalls, parseFreezes, stallWindows } from '@/take/stall'

function logOf(route: TakeLog['route'], events: readonly LogEvent[]): TakeLog {
  return {
    version: LOG_VERSION,
    viewport: VIEWPORT,
    fps: FPS,
    route,
    frames: 180,
    events,
  }
}

function typed(t: number, ms: number): LogEvent {
  return {
    t,
    kind: 'type',
    at: { x: 700, y: 400 },
    box: { x: 400, y: 300, width: 200, height: 40 },
    chars: 12,
    ms,
  }
}

describe('parseFreezes', () => {
  it('should read a closed hold in ms from the window start', () => {
    const output = [
      'frame:59   pts:15104   pts_time:0.983333',
      'lavfi.freezedetect.freeze_start=0.483333',
      'frame:90   pts:23040   pts_time:1.5',
      'lavfi.freezedetect.freeze_duration=1.01667',
      'lavfi.freezedetect.freeze_end=1.5',
    ].join('\n')

    expect(parseFreezes(output, 2000)).toEqual([{ start: 483.333, end: 1500 }])
  })

  it('should run a hold still open at the window end to the end', () => {
    const output = [
      'frame:59   pts:15104   pts_time:0.983333',
      'lavfi.freezedetect.freeze_start=0.483333',
    ].join('\n')

    expect(parseFreezes(output, 1000)).toEqual([{ start: 483.333, end: 1000 }])
  })

  it('should read no hold from output carrying none', () => {
    expect(parseFreezes('frame:0 pts:0 pts_time:0\n', 1000)).toEqual([])
  })
})

describe('stallWindows', () => {
  it('should skip a stepped beat that types, whose clock cannot stall', () => {
    expect(stallWindows(logOf('step', [typed(600, 1200)]))).toEqual([])
  })

  it('should take each typing burst on a screencast beat', () => {
    expect(stallWindows(logOf('screencast', [typed(600, 1200)]))).toEqual([
      { start: 600, end: 1800 },
    ])
  })
})

describe('findStalls on a stepped beat', () => {
  it('should resolve no breach without reading the clip', async () => {
    const log = logOf('step', [typed(600, 1200)])

    await expect(
      findStalls('/nonexistent-canon-take/clip.mp4', log),
    ).resolves.toEqual([])
  })
})

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0

/**
 * A flat page with a box moving across it for 3 s, held still from 1 s to 2 s,
 * since a busy test pattern carries more encoder noise than a page does.
 */
function heldClip(out: string): void {
  spawnSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    'color=c=white:s=320x240:r=60:d=3',
    '-f',
    'lavfi',
    '-i',
    'color=c=black:s=20x20:r=60:d=3',
    '-filter_complex',
    "[0][1]overlay=x='t*90':y=100,loop=loop=60:size=1:start=60,trim=duration=3",
    '-c:v',
    'libx264',
    '-crf',
    '16',
    '-pix_fmt',
    'yuv420p',
    out,
  ])
}

describe.skipIf(!hasFfmpeg)('findStalls on a screencast clip', () => {
  let dir = ''
  let clip = ''

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'canon-stall-'))
    clip = join(dir, 'clip.mp4')
    heldClip(clip)
  })

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('should fail typing across the held second as stall', async () => {
    const log = logOf('screencast', [typed(500, 2000)])

    const breaches = await findStalls(clip, log)

    expect(breaches.map((found) => found.rule)).toEqual(['stall'])
    expect(breaches[0]?.t).toBeGreaterThanOrEqual(950)
    expect(breaches[0]?.t).toBeLessThanOrEqual(1050)
    expect(breaches[0]?.measured).toBeGreaterThan(900)
  })

  it('should pass typing while the page moves, leaving out the held setup before it', async () => {
    const log = logOf('screencast', [typed(2050, 900)])

    await expect(findStalls(clip, log)).resolves.toEqual([])
  })
})
