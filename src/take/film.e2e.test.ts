import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { CameraTrack } from '@/take/camera'
import type { TakeLog } from '@/take/log'
import { readTakePlan } from '@/take/plan'
import { findShell } from '@/take/shell'
import { take } from '@/take/film'

/**
 * Films one frame-stepped take of a static page and reads the clip back,
 * because the property the stepper exists for, one frame of page time per
 * frame of clip, is visible only in the pixels it wrote.
 *
 * The suite needs chrome-headless-shell and FFmpeg. CI installs neither, so it
 * skips there rather than failing, which means a green pipeline is not
 * evidence this passed. Run it locally.
 */

const PAGE = readFileSync(
  new URL('./fixtures/fade.html', import.meta.url),
  'utf8',
)

function available(): boolean {
  try {
    findShell()
  } catch {
    return false
  }
  return spawnSync('ffmpeg', ['-version']).status === 0
}

function probe(clip: string): { width: number; height: number; rate: string } {
  const out = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height,r_frame_rate',
      '-of',
      'json',
      clip,
    ],
    { encoding: 'utf8' },
  ).stdout
  const [stream] = (
    JSON.parse(out) as {
      streams: { width: number; height: number; r_frame_rate: string }[]
    }
  ).streams
  if (!stream) throw new Error(`no video stream in ${clip}`)
  return {
    width: stream.width,
    height: stream.height,
    rate: stream.r_frame_rate,
  }
}

/**
 * The band's stored luma in each frame, TV range, 16 for black and 235 for
 * white. Read raw rather than converted to gray, since that conversion
 * stretches the range and clips the first and last steps of the fade.
 */
function bandLuma(clip: string): number[] {
  const raw = spawnSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-i',
      clip,
      '-vf',
      'crop=16:16:200:1000,scale=2:2:flags=area',
      '-pix_fmt',
      'yuv420p',
      '-f',
      'rawvideo',
      '-',
    ],
    { maxBuffer: 64 * 1024 * 1024 },
  ).stdout
  // Each 2x2 frame is four luma bytes, then one byte each of the two chroma planes.
  return [...raw].filter((_, index) => index % 6 === 0)
}

const ONE_BEAT = JSON.stringify({
  beats: [
    {
      name: 'light the band',
      steps: [
        { kind: 'click', target: '#go' },
        { kind: 'wait', ms: 1200 },
      ],
    },
  ],
})

describe.skipIf(!available())('a frame-stepped take of a served page', () => {
  let server: { url: string; stop: () => void }
  let out: string

  beforeAll(() => {
    const served = Bun.serve({
      port: 0,
      fetch: () =>
        new Response(PAGE, { headers: { 'content-type': 'text/html' } }),
    })
    server = {
      url: `http://127.0.0.1:${served.port}/`,
      stop: () => served.stop(true),
    }
    out = mkdtempSync(join(tmpdir(), 'canon-take-e2e-'))
  })

  afterAll(() => {
    server.stop()
    rmSync(out, { recursive: true, force: true })
  })

  it('should film 4K at 60 fps with one frame of page time per frame', async () => {
    const read = readTakePlan(ONE_BEAT)
    if (read.kind !== 'read') throw new Error(read.detail)

    const result = await take({ url: server.url, plan: read.plan, out })

    expect(result).toMatchObject({
      status: 'filmed',
      beats: [{ name: 'light the band', route: 'step' }],
    })
    if (result.status !== 'filmed') return
    const [beat] = result.beats
    if (!beat) return
    const clip = join(out, beat.clip)

    expect(probe(clip)).toEqual({ width: 3840, height: 2160, rate: '60/1' })

    // A one-second linear fade spans 60 frames when every frame advanced one
    // sixtieth of a second, and each of them is brighter than the last. A
    // stepper running on wall time would spread or bunch them.
    const luma = bandLuma(clip)
    expect(luma).toHaveLength(beat.frames)
    const ramp = luma.filter((value) => value > 17 && value < 234)
    expect(ramp.length).toBeGreaterThanOrEqual(57)
    expect(ramp.length).toBeLessThanOrEqual(60)
    const rises = ramp.slice(1).map((value, i) => value - (ramp[i] ?? 0))
    expect(Math.min(...rises)).toBeGreaterThan(0)

    const log = JSON.parse(readFileSync(join(out, beat.log), 'utf8')) as TakeLog
    expect(log.frames).toBe(beat.frames)
    expect(log.events.filter((event) => event.kind === 'click')).toEqual([
      expect.objectContaining({
        at: { x: 200, y: 130 },
        box: { x: 100, y: 100, width: 200, height: 60 },
      }),
    ])

    const camera = JSON.parse(
      readFileSync(join(out, beat.camera), 'utf8'),
    ) as CameraTrack
    expect(camera.frames).toHaveLength(beat.frames)
  }, 180_000)

  it('should film a screencast beat at the viewport size and the same rate', async () => {
    const read = readTakePlan(
      JSON.stringify({
        beats: [
          {
            name: 'cast',
            route: 'screencast',
            steps: [{ kind: 'click', target: '#go' }],
          },
        ],
      }),
    )
    if (read.kind !== 'read') throw new Error(read.detail)

    const result = await take({ url: server.url, plan: read.plan, out })

    expect(result).toMatchObject({
      status: 'filmed',
      beats: [{ name: 'cast', requested: 'screencast', route: 'screencast' }],
    })
    if (result.status !== 'filmed') return
    const [beat] = result.beats
    if (!beat) return
    expect(probe(join(out, beat.clip))).toEqual({
      width: 1920,
      height: 1080,
      rate: '60/1',
    })
  }, 180_000)

  it('should refuse a target the page does not carry rather than film a guess', async () => {
    const read = readTakePlan(
      JSON.stringify({
        beats: [
          { name: 'miss', steps: [{ kind: 'click', target: '#absent' }] },
        ],
      }),
    )
    if (read.kind !== 'read') throw new Error(read.detail)

    const result = await take({ url: server.url, plan: read.plan, out })

    expect(result).toMatchObject({
      status: 'failed',
      reason: 'target-missing',
      beat: 'miss',
    })
  }, 180_000)
})
