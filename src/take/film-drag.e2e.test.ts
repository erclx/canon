import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { FRAME_MS, available, html } from '@/take/fixtures/film-suite'
import { type Point, type TakeLog, VIEWPORT, cursorAt } from '@/take/log'
import { readTakePlan } from '@/take/plan'
import { take } from '@/take/film'

const PAINT_PAGE = readFileSync(
  new URL('./fixtures/drag-paint.html', import.meta.url),
  'utf8',
)

const PAINT_DRAG = JSON.stringify({
  beats: [
    {
      name: 'drag',
      route: 'screencast',
      push: false,
      steps: [
        { kind: 'drag', from: '#box', to: '#drop' },
        { kind: 'wait', ms: 400 },
      ],
    },
  ],
})

/** The rows of the clip the box travels along, in CSS pixels. */
const PAINT_BAND = { top: 280, bottom: 440 }

/**
 * The red box's center in each frame of a screencast clip, in CSS pixels, or
 * undefined where too little of it shows to place.
 */
function redCenters(clip: string): (Point | undefined)[] {
  const width = VIEWPORT.width / 2
  const height = (PAINT_BAND.bottom - PAINT_BAND.top) / 2
  const raw = spawnSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-i',
      clip,
      '-vf',
      `crop=${VIEWPORT.width}:${height * 2}:0:${PAINT_BAND.top},scale=${width}:${height}:flags=area`,
      '-pix_fmt',
      'rgb24',
      '-f',
      'rawvideo',
      '-',
    ],
    { maxBuffer: 512 * 1024 * 1024 },
  ).stdout
  const size = width * height * 3
  const centers: (Point | undefined)[] = []
  for (let start = 0; start + size <= raw.length; start += size) {
    let xs = 0
    let ys = 0
    let n = 0
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const p = start + (y * width + x) * 3
        const [r = 0, g = 255, b = 255] = raw.subarray(p, p + 3)
        if (r > 180 && g < 90 && b < 90) {
          xs += x
          ys += y
          n += 1
        }
      }
    }
    centers.push(
      n > 20
        ? { x: (xs / n) * 2, y: (ys / n) * 2 + PAINT_BAND.top }
        : undefined,
    )
  }
  return centers
}

/**
 * The mean distance from the drawn cursor to the box it drags, in CSS pixels.
 * Throws when the clip never shows the box reaching its drop, since the page
 * moves it on every run and a clip without that lost the action it filmed.
 */
function dragOffset(out: string, beat: { clip: string; log: string }): number {
  const log = JSON.parse(readFileSync(join(out, beat.log), 'utf8')) as TakeLog
  const drag = log.events.find((event) => event.kind === 'drag')
  if (!drag || drag.kind !== 'drag') throw new Error('no drag logged')
  const centers = redCenters(join(out, beat.clip))
  if (!centers.some((center) => center && center.x > drag.to.x - 100)) {
    throw new Error('the clip never shows the box reaching its drop')
  }
  const distances = centers.flatMap((center, i) => {
    const t = i * FRAME_MS
    if (!center || t < drag.t || t > drag.t + drag.ms + 200) return []
    const cursor = cursorAt(log.events, t)
    return [Math.hypot(cursor.x - center.x, cursor.y - center.y)]
  })
  return distances.reduce((sum, d) => sum + d, 0) / distances.length
}

describe.skipIf(!available())(
  'a screencast drag on a page that paints on the next frame',
  () => {
    let server: { url: string; stop: () => void }
    const offsets: number[] = []
    const lags: unknown[] = []

    beforeAll(async () => {
      const served = Bun.serve({ port: 0, fetch: () => html(PAINT_PAGE) })
      server = {
        url: `http://127.0.0.1:${served.port}/`,
        stop: () => served.stop(true),
      }
      const read = readTakePlan(PAINT_DRAG)
      if (read.kind !== 'read') throw new Error(read.detail)
      for (let run = 0; run < 2; run += 1) {
        const out = mkdtempSync(join(tmpdir(), 'canon-take-paint-e2e-'))
        try {
          const result = await take({ url: server.url, plan: read.plan, out })
          if (result.status !== 'filmed') throw new Error(result.message)
          const [beat] = result.beats
          if (!beat) throw new Error('no drag beat')
          const log = readFileSync(join(out, beat.log), 'utf8')
          lags.push((JSON.parse(log) as TakeLog).lag)
          offsets.push(dragOffset(out, beat))
        } finally {
          rmSync(out, { recursive: true, force: true })
        }
      }
    }, 300_000)

    afterAll(() => {
      server.stop()
    })

    it('should keep the drawn cursor within 10 px of the box on average', () => {
      expect(offsets).toHaveLength(2)
      for (const offset of offsets) expect(offset).toBeLessThan(10)
    })

    it('should land two identical runs within 3 px of each other', () => {
      const [first = 0, second = Infinity] = offsets
      expect(Math.abs(first - second)).toBeLessThanOrEqual(3)
    })

    it('should record the lag each take shifted its log by', () => {
      expect(lags.length).toBeGreaterThan(0)
      for (const lag of lags) {
        expect(lag).toBeGreaterThanOrEqual(FRAME_MS)
        expect(lag).toBeLessThan(10 * FRAME_MS)
      }
    })
  },
)
