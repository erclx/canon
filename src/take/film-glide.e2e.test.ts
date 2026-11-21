import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { FRAME_MS, available, bandLuma, html } from '@/take/fixtures/film-suite'
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

/**
 * Half the 400 by 240 `.card` in `busy.html`, in CSS pixels, which a move to
 * the card centers on. A change to the card's size changes this too.
 */
const CARD_HALF = { width: 200, height: 120 }

describe.skipIf(!available())('a screencast glide over 200 ms frames', () => {
  let server: { url: string; stop: () => void }
  let out: string

  beforeAll(() => {
    const served = Bun.serve({ port: 0, fetch: () => html(BUSY_PAGE) })
    server = {
      url: `http://127.0.0.1:${served.port}/`,
      stop: () => served.stop(true),
    }
    out = mkdtempSync(join(tmpdir(), 'canon-take-glide-e2e-'))
  })

  afterAll(() => {
    server.stop()
    rmSync(out, { recursive: true, force: true })
  })

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
    // The card turns from #ddd to #f60 once the pointer lands, shown at the frame its luma drops below 170.
    const card = bandLuma(join(out, beat.clip), '200:100:100:100')
    const landedMs = card.findIndex((value) => value < 170) * FRAME_MS
    // The hover fires on the first point sent inside the card, ahead of the move's end.
    const entered = move.points?.find(
      (point) =>
        Math.abs(point.x - move.to.x) <= CARD_HALF.width &&
        Math.abs(point.y - move.to.y) <= CARD_HALF.height,
    )
    if (!entered) throw new Error('no sent point landed inside the card')

    // Within a second of its plan, and landing in the clip within two slow frames of that point.
    expect(Math.abs(move.ms - glideMs)).toBeLessThan(1000)
    expect(landedMs).toBeGreaterThan(0)
    expect(landedMs).toBeGreaterThanOrEqual(entered.t)
    expect(landedMs).toBeLessThanOrEqual(entered.t + 2 * 200)
  }, 180_000)
})
