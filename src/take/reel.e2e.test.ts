import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { CameraTrack } from '@/take/camera'
import { type FilmedBeat, take } from '@/take/film'
import { readTakePlan } from '@/take/plan'
import {
  REEL_EVERY,
  REEL_FPS,
  REEL_WIDTH,
  reelFrames,
  renderReel,
} from '@/take/reel'
import { findShell } from '@/take/shell'

/**
 * Films the fade fixture on both routes and joins the beats into a reel,
 * because the two properties a reviewer watches for, the pointer sitting on
 * what it pressed and both routes meeting at one size, show only in the
 * frames the reel draws.
 *
 * The suite needs chrome-headless-shell and FFmpeg with libwebp. CI installs
 * neither the shell nor FFmpeg, so it skips there rather than failing, which
 * means a green pipeline is not evidence this passed. Run it locally.
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
  const encoders = spawnSync('ffmpeg', ['-hide_banner', '-encoders'], {
    encoding: 'utf8',
  })
  return encoders.status === 0 && encoders.stdout.includes('libwebp_anim')
}

/**
 * The canvas width and the summed frame durations of an animated WebP, read
 * off its chunks, since the FFmpeg this runs against decodes no animation.
 * The encoder folds a frame identical to the last into its duration, so the
 * duration rather than the chunk count measures the frames written.
 */
function readWebp(file: string): { width: number; height: number; ms: number } {
  const bytes = readFileSync(file)
  let width = 0
  let height = 0
  let ms = 0
  for (let at = 12; at + 8 <= bytes.length;) {
    const kind = bytes.toString('ascii', at, at + 4)
    const size = bytes.readUInt32LE(at + 4)
    const body = at + 8
    if (kind === 'VP8X') {
      width = bytes.readUIntLE(body + 4, 3) + 1
      height = bytes.readUIntLE(body + 7, 3) + 1
    }
    if (kind === 'ANMF') ms += bytes.readUIntLE(body + 12, 3)
    at = body + size + (size % 2)
  }
  return { width, height, ms }
}

function pixel(
  frame: { data: Uint8Array; width: number },
  x: number,
  y: number,
): number[] {
  const i = (Math.round(y) * frame.width + Math.round(x)) * 4
  return Array.from(frame.data.subarray(i, i + 3))
}

const PLAN = JSON.stringify({
  beats: [
    {
      name: 'press',
      steps: [
        { kind: 'click', target: '#go' },
        { kind: 'wait', ms: 400 },
      ],
    },
    {
      name: 'press again',
      route: 'screencast',
      steps: [
        { kind: 'click', target: '#go' },
        { kind: 'wait', ms: 400 },
      ],
    },
  ],
})

describe.skipIf(!available())('a reel joined from a two-route take', () => {
  let server: { url: string; stop: () => void }
  let out: string
  let beats: readonly FilmedBeat[] = []

  beforeAll(async () => {
    const served = Bun.serve({
      port: 0,
      fetch: () =>
        new Response(PAGE, { headers: { 'content-type': 'text/html' } }),
    })
    server = {
      url: `http://127.0.0.1:${served.port}/`,
      stop: () => served.stop(true),
    }
    out = mkdtempSync(join(tmpdir(), 'canon-reel-e2e-'))

    const read = readTakePlan(PLAN)
    if (read.kind !== 'read') throw new Error(read.detail)
    const result = await take({ url: server.url, plan: read.plan, out })
    if (result.status !== 'filmed') throw new Error(result.message)
    beats = result.beats
  }, 240_000)

  afterAll(() => {
    server.stop()
    rmSync(out, { recursive: true, force: true })
  })

  it('should draw camera frame 3k onto reel frame k across both routes', async () => {
    const cameras = beats.map(
      (beat) =>
        JSON.parse(readFileSync(join(out, beat.camera), 'utf8')) as CameraTrack,
    )

    const seen: {
      beat: number
      index: number
      overPage: boolean
      dark: boolean
    }[] = []
    for await (const frame of reelFrames(out, beats)) {
      expect(frame.width).toBe(REEL_WIDTH)
      expect(frame.height).toBe(540)
      const camera = cameras[frame.beat]?.frames[frame.index * REEL_EVERY]
      if (!camera) throw new Error(`no camera frame for ${frame.index}`)
      // Just inside the arrow's tip, down its shaft, where the fill is solid.
      const [r, g, b] = pixel(
        frame,
        camera.cursor.x / 2 + 2,
        camera.cursor.y / 2 + 8,
      )
      seen.push({
        beat: frame.beat,
        index: frame.index,
        // Above the band, so a dark pixel there is the arrow rather than the
        // black the band starts from.
        overPage: camera.cursor.y + 30 < 300,
        dark: (r ?? 255) < 40 && (g ?? 255) < 40 && (b ?? 255) < 40,
      })
    }

    for (const [n, beat] of beats.entries()) {
      const own = seen.filter((frame) => frame.beat === n)
      expect(own).toHaveLength(Math.ceil(beat.frames / REEL_EVERY))
      expect(own.map((frame) => frame.index)).toEqual(own.map((_, i) => i))
      const overPage = own.filter((frame) => frame.overPage)
      expect(overPage.length).toBeGreaterThan(0)
      expect(overPage.every((frame) => frame.dark)).toBe(true)
    }
  }, 120_000)

  it('should encode an animated WebP at the reel width and rate', async () => {
    const file = join(out, 'reel.webp')
    const started = Date.now()

    const reel = await renderReel(out, beats, file)

    const expected = beats.reduce(
      (sum, beat) => sum + Math.ceil(beat.frames / REEL_EVERY),
      0,
    )
    expect(reel.frames).toBe(expected)
    const read = readWebp(file)
    expect(read.width).toBe(REEL_WIDTH)
    expect(read.height).toBe(540)
    expect(read.ms).toBe((expected * 1000) / REEL_FPS)
    expect(reel.bytes).toBeGreaterThan(0)
    // Printed rather than asserted, since it is the figure the plan estimated.
    console.info(`reel of ${expected} frames in ${Date.now() - started} ms`)
  }, 120_000)
})
