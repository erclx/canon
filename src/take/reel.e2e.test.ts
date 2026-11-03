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
import { RING_RADIUS } from '@/take/pointer'
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

const INPUT_PAGE = readFileSync(
  new URL('./fixtures/input.html', import.meta.url),
  'utf8',
)

describe.skipIf(!available())('a reel of a drag', () => {
  let server: { url: string; stop: () => void }
  let out: string
  let beats: readonly FilmedBeat[] = []

  beforeAll(async () => {
    const served = Bun.serve({
      port: 0,
      fetch: () =>
        new Response(INPUT_PAGE, { headers: { 'content-type': 'text/html' } }),
    })
    server = {
      url: `http://127.0.0.1:${served.port}/`,
      stop: () => served.stop(true),
    }
    out = mkdtempSync(join(tmpdir(), 'canon-reel-drag-e2e-'))

    const read = readTakePlan(
      JSON.stringify({
        beats: [
          {
            name: 'drag',
            steps: [{ kind: 'drag', from: '#handle', to: '#lane' }],
          },
        ],
      }),
    )
    if (read.kind !== 'read') throw new Error(read.detail)
    const result = await take({ url: server.url, plan: read.plan, out })
    if (result.status !== 'filmed') throw new Error(result.message)
    beats = result.beats
  }, 240_000)

  afterAll(() => {
    server.stop()
    rmSync(out, { recursive: true, force: true })
  })

  it('should draw the held ring around the pointer through the drag', async () => {
    const [beat] = beats
    if (!beat) throw new Error('no drag beat')
    const camera = JSON.parse(
      readFileSync(join(out, beat.camera), 'utf8'),
    ) as CameraTrack
    // The held ring is 0.7 of its full size, so its stroke centers about 12
    // reel pixels from the tip. Left of the tip, the arrow never covers it.
    const radius = RING_RADIUS * 0.7 - 0.7

    const held: boolean[] = []
    for await (const frame of reelFrames(out, beats)) {
      const at = camera.frames[frame.index * REEL_EVERY]
      if (at?.ring !== 0.3) continue
      // Less half a pixel, since the ring's coverage is read at pixel centers.
      const [r = 0, , b = 0] = pixel(
        frame,
        at.cursor.x / 2 - radius - 0.5,
        at.cursor.y / 2 - 0.5,
      )
      held.push(b > r + 40)
    }

    expect(held.length).toBeGreaterThan(5)
    expect(held.every(Boolean)).toBe(true)
  }, 120_000)
})

/**
 * The last frame of an animated WebP as RGBA, composited from its frames. The
 * FFmpeg this runs against decodes no animation, so each frame's bitstream is
 * wrapped as a still, decoded alone, and placed on the canvas the way a
 * player would: a transparent pixel under blending keeps what was there.
 */
function lastFrame(file: string): {
  data: Uint8Array
  width: number
  height: number
} {
  const bytes = readFileSync(file)
  let width = 0
  let height = 0
  let canvas = new Uint8Array(0)
  let disposed: { x: number; y: number; w: number; h: number } | undefined
  for (let at = 12; at + 8 <= bytes.length;) {
    const kind = bytes.toString('ascii', at, at + 4)
    const size = bytes.readUInt32LE(at + 4)
    const body = at + 8
    at = body + size + (size % 2)
    if (kind === 'VP8X') {
      width = bytes.readUIntLE(body + 4, 3) + 1
      height = bytes.readUIntLE(body + 7, 3) + 1
      canvas = new Uint8Array(width * height * 4)
    }
    if (kind !== 'ANMF') continue

    const x = bytes.readUIntLE(body, 3) * 2
    const y = bytes.readUIntLE(body + 3, 3) * 2
    const w = bytes.readUIntLE(body + 6, 3) + 1
    const h = bytes.readUIntLE(body + 9, 3) + 1
    const flags = bytes.readUInt8(body + 15)
    const payload = bytes.subarray(body + 16, body + size)

    const vp8x = Buffer.alloc(18)
    vp8x.write('VP8X', 0, 'ascii')
    vp8x.writeUInt32LE(10, 4)
    vp8x.writeUInt8(0x10, 8)
    vp8x.writeUIntLE(w - 1, 12, 3)
    vp8x.writeUIntLE(h - 1, 15, 3)
    const riff = Buffer.alloc(12)
    riff.write('RIFF', 0, 'ascii')
    riff.writeUInt32LE(4 + vp8x.length + payload.length, 4)
    riff.write('WEBP', 8, 'ascii')
    const still = spawnSync(
      'ffmpeg',
      [
        '-loglevel',
        'error',
        '-i',
        '-',
        '-f',
        'rawvideo',
        '-pix_fmt',
        'rgba',
        '-',
      ],
      { input: Buffer.concat([riff, vp8x, payload]), maxBuffer: 1 << 28 },
    )
    if (still.status !== 0) throw new Error(`ffmpeg: ${still.stderr}`)
    const sub = still.stdout

    if (disposed) clear(canvas, width, disposed)
    for (let row = 0; row < h; row += 1) {
      for (let col = 0; col < w; col += 1) {
        const from = (row * w + col) * 4
        const to = ((y + row) * width + x + col) * 4
        const alpha = (sub[from + 3] ?? 0) / 255
        const blended = (flags & 2) === 0 && alpha < 1
        for (let c = 0; c < 4; c += 1) {
          const s = sub[from + c] ?? 0
          canvas[to + c] = blended
            ? Math.round(s * alpha + (canvas[to + c] ?? 0) * (1 - alpha))
            : s
        }
      }
    }
    disposed = (flags & 1) === 1 ? { x, y, w, h } : undefined
  }
  return { data: canvas, width, height }
}

function clear(
  canvas: Uint8Array,
  width: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  for (let row = 0; row < rect.h; row += 1) {
    const from = ((rect.y + row) * width + rect.x) * 4
    canvas.fill(0, from, from + rect.w * 4)
  }
}

const POPOVER_PAGE = readFileSync(
  new URL('./fixtures/popover.html', import.meta.url),
  'utf8',
)

/** The page ground, #ecebee, and the popover's box in reel pixels. */
const GROUND = [236, 235, 238]
const BOX = { left: 385, top: 385, width: 100, height: 30 }

describe.skipIf(!available())('a reel of a popover that fades out', () => {
  let server: { url: string; stop: () => void }
  let out: string
  let beats: readonly FilmedBeat[] = []

  beforeAll(async () => {
    const served = Bun.serve({
      port: 0,
      fetch: () =>
        new Response(POPOVER_PAGE, {
          headers: { 'content-type': 'text/html' },
        }),
    })
    server = {
      url: `http://127.0.0.1:${served.port}/`,
      stop: () => served.stop(true),
    }
    out = mkdtempSync(join(tmpdir(), 'canon-reel-popover-e2e-'))

    const read = readTakePlan(
      JSON.stringify({
        beats: [
          {
            name: 'open then close',
            steps: [
              { kind: 'click', target: '#tool' },
              { kind: 'wait', ms: 400 },
              { kind: 'click', target: '#tool' },
              { kind: 'wait', ms: 800 },
            ],
          },
        ],
      }),
    )
    if (read.kind !== 'read') throw new Error(read.detail)
    const result = await take({ url: server.url, plan: read.plan, out })
    if (result.status !== 'filmed') throw new Error(result.message)
    beats = result.beats
  }, 240_000)

  afterAll(() => {
    server.stop()
    rmSync(out, { recursive: true, force: true })
  })

  /** The most any channel in the popover's box strays from the ground. */
  function ghost(file: string): number {
    const frame = lastFrame(file)
    let worst = 0
    for (let y = BOX.top; y < BOX.top + BOX.height; y += 1) {
      for (let x = BOX.left; x < BOX.left + BOX.width; x += 1) {
        const at = (y * frame.width + x) * 4
        for (const [c, ground] of GROUND.entries()) {
          worst = Math.max(worst, Math.abs((frame.data[at + c] ?? 0) - ground))
        }
      }
    }
    return worst
  }

  it('should leave no trace of the popover once it has faded out', async () => {
    const file = join(out, 'lossless.webp')

    const reel = await renderReel(out, beats, file)

    expect(reel.lossless).toBe(true)
    expect(ghost(file)).toBeLessThanOrEqual(2)
  }, 120_000)

  it('should encode again lossy and say so past the cap', async () => {
    const file = join(out, 'capped.webp')
    const lossless = await renderReel(out, beats, join(out, 'whole.webp'))

    const reel = await renderReel(out, beats, file, lossless.bytes - 1)

    expect(reel.lossless).toBe(false)
    expect(reel.bytes).toBeLessThan(lossless.bytes)
    expect(readWebp(file).ms).toBe((reel.frames * 1000) / REEL_FPS)
  }, 240_000)
})
