import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  LOADED_STALL_MS,
  available,
  bandLuma,
  html,
} from '@/take/fixtures/film-suite'
import { type Route, readTakePlan } from '@/take/plan'
import { take } from '@/take/film'

const BOARD = readFileSync(
  new URL('./fixtures/canvas-board.html', import.meta.url),
  'utf8',
)

const PLAN = readFileSync(
  new URL('./fixtures/canvas-board.json', import.meta.url),
  'utf8',
)

const EXPIRED = '<!doctype html><body><p>This link has expired.</p></body>'

describe.skipIf(!available())('a take of a canvas board', () => {
  let server: { url: string; stop: () => void }
  let out: string
  // Opens of the board's one-use link, which a second load would spend.
  let opens = 0

  beforeAll(() => {
    const served = Bun.serve({
      port: 0,
      fetch: (request) => {
        if (new URL(request.url).pathname !== '/board') return html(EXPIRED)
        opens += 1
        return html(opens === 1 ? BOARD : EXPIRED)
      },
    })
    server = {
      url: `http://127.0.0.1:${served.port}/board`,
      stop: () => served.stop(true),
    }
    out = mkdtempSync(join(tmpdir(), 'canon-take-canvas-e2e-'))
  })

  afterAll(() => {
    server.stop()
    rmSync(out, { recursive: true, force: true })
  })

  it.each(['step', 'screencast'] as const)(
    'should film the board asked for on the %s route with its link opened once',
    async (route: Route) => {
      const read = readTakePlan(JSON.stringify({ ...JSON.parse(PLAN), route }))
      if (read.kind !== 'read') throw new Error(read.detail)
      opens = 0

      const result = await take({
        url: server.url,
        plan: read.plan,
        out: join(out, route),
        stallMs: LOADED_STALL_MS,
      })

      expect(result).not.toHaveProperty('message')
      expect(result).not.toHaveProperty('beats.0.fallback')
      expect(result).toMatchObject({ status: 'filmed', beats: [{ route }] })
      expect(opens).toBe(1)
      if (result.status !== 'filmed' || !result.beats[0]) return
      // Green only once the press reached the frame and the overlay closed.
      const [margin = 0] = bandLuma(
        join(result.out, result.beats[0].still),
        '8:8:780:360',
      )
      expect(margin).toBeGreaterThan(90)
      expect(margin).toBeLessThan(140)
    },
    180_000,
  )
})
