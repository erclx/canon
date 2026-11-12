import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  FRAME_MS,
  LOADED_STALL_MS,
  available,
  bandLuma,
  html,
} from '@/take/fixtures/film-suite'
import { type TakeLog, travelMs } from '@/take/log'
import { readTakePlan } from '@/take/plan'
import { take } from '@/take/film'

const BUSY_PAGE = readFileSync(
  new URL('./fixtures/busy.html', import.meta.url),
  'utf8',
)

/** Scrolls the card into the window in setup, as a plan reaching it would. */
const TO_THE_CARDS = [
  { kind: 'click', target: '#rail' },
  { kind: 'wait', ms: 1200 },
]

describe.skipIf(!available())('a take of a page whose frames run slow', () => {
  let server: { url: string; stop: () => void }
  let out: string

  beforeAll(() => {
    const served = Bun.serve({ port: 0, fetch: () => html(BUSY_PAGE) })
    server = {
      url: `http://127.0.0.1:${served.port}/`,
      stop: () => served.stop(true),
    }
    out = mkdtempSync(join(tmpdir(), 'canon-take-busy-e2e-'))
  })

  afterAll(() => {
    server.stop()
    rmSync(out, { recursive: true, force: true })
  })

  it('should film 400 ms frames without overlapping its own frame requests', async () => {
    const read = readTakePlan(
      JSON.stringify({
        beats: [
          {
            name: 'slow',
            setup: TO_THE_CARDS,
            steps: [{ kind: 'wait', ms: 300 }],
          },
        ],
      }),
    )
    if (read.kind !== 'read') throw new Error(read.detail)

    // The clock-timed page, which refused as a pending frame before the
    // stepper waited on each one.
    const result = await take({
      url: `${server.url}?busy=400&timed=1`,
      plan: read.plan,
      out,
      stallMs: LOADED_STALL_MS,
    })

    // Ahead of the status, so a refusal prints its message.
    expect(result).not.toHaveProperty('message')
    expect(result).toMatchObject({ status: 'filmed' })
  }, 180_000)

  it('should keep frame stepping on 400 ms frames under the stall limit', async () => {
    const read = readTakePlan(
      JSON.stringify({
        beats: [
          {
            name: 'slow',
            setup: TO_THE_CARDS,
            steps: [{ kind: 'wait', ms: 300 }],
          },
        ],
      }),
    )
    if (read.kind !== 'read') throw new Error(read.detail)

    const result = await take({
      url: `${server.url}?busy=400`,
      plan: read.plan,
      out,
      stallMs: LOADED_STALL_MS,
    })

    // Ahead of the route, so a refusal prints its message and a fall back
    // prints the frame that stalled.
    expect(result).not.toHaveProperty('message')
    expect(result).not.toHaveProperty('beats.0.fallback')
    expect(result).toMatchObject({
      status: 'filmed',
      beats: [{ name: 'slow', route: 'step' }],
    })
  }, 180_000)

  it('should glide on 200 ms frames near its plan and log when it landed', async () => {
    const read = readTakePlan(
      JSON.stringify({
        beats: [
          {
            name: 'glide',
            route: 'screencast',
            setup: TO_THE_CARDS,
            steps: [
              { kind: 'move', target: '#card' },
              { kind: 'wait', ms: 2500 },
            ],
          },
        ],
      }),
    )
    if (read.kind !== 'read') throw new Error(read.detail)

    const result = await take({
      url: `${server.url}?busy=200`,
      plan: read.plan,
      out,
    })

    expect(result).not.toHaveProperty('message')
    if (result.status !== 'filmed') return
    const [beat] = result.beats
    if (!beat) return
    const log = JSON.parse(readFileSync(join(out, beat.log), 'utf8')) as TakeLog
    const move = log.events.find((event) => event.kind === 'move')
    if (move?.kind !== 'move') throw new Error('the take logged no move')
    const glideMs =
      Math.round(travelMs(move.from, move.to) / FRAME_MS) * FRAME_MS
    // The card turns from #ddd to #f60 once the pointer lands on it, which
    // the clip shows at the frame its stored luma drops below 170.
    const card = bandLuma(join(out, beat.clip), '200:100:100:100')
    const landedMs = card.findIndex((value) => value < 170) * FRAME_MS

    // Within a second of its plan, where the unpaced glide ran about 15 times
    // over, and landing in the clip within a few slow frames of the log.
    expect(Math.abs(move.ms - glideMs)).toBeLessThan(1000)
    expect(landedMs).toBeGreaterThan(0)
    expect(Math.abs(landedMs - (move.t + move.ms))).toBeLessThan(500)
  }, 180_000)

  it('should end a screencast clip at the stage clock rather than past it', async () => {
    const read = readTakePlan(
      JSON.stringify({
        beats: [
          {
            name: 'hover',
            route: 'screencast',
            setup: TO_THE_CARDS,
            steps: [
              { kind: 'move', target: '#card' },
              { kind: 'wait', ms: 2500 },
            ],
          },
        ],
      }),
    )
    if (read.kind !== 'read') throw new Error(read.detail)

    const result = await take({
      url: `${server.url}?busy=0`,
      plan: read.plan,
      out,
    })

    // The plan is the two 600 ms holds, the paced glide to the card, and the
    // 2500 ms wait, 4.43 s.
    expect(result).not.toHaveProperty('message')
    expect(result).toMatchObject({ status: 'filmed' })
    if (result.status !== 'filmed') return
    const seconds = result.beats[0]?.seconds ?? 0
    expect(Math.abs(seconds - 4.43)).toBeLessThan(0.1)
  }, 180_000)

  it('should refuse a move to a card below the window with no scroll to it', async () => {
    const read = readTakePlan(
      JSON.stringify({
        beats: [
          {
            name: 'below',
            steps: [
              { kind: 'move', target: '#card' },
              { kind: 'wait', ms: 500 },
            ],
          },
        ],
      }),
    )
    if (read.kind !== 'read') throw new Error(read.detail)

    const result = await take({
      url: server.url,
      plan: read.plan,
      out,
      stallMs: LOADED_STALL_MS,
    })

    expect(result).toMatchObject({
      status: 'failed',
      reason: 'target-offscreen',
      beat: 'below',
      still: '01-below/still.jpg',
    })
    expect(existsSync(join(out, '01-below/still.jpg'))).toBe(true)
  }, 180_000)
})
