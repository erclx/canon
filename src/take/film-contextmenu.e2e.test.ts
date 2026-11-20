import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { LOADED_STALL_MS, available } from '@/take/fixtures/film-suite'
import {
  type MotionReport,
  type MotionServer,
  serveFixture,
} from '@/take/fixtures/motion-server'
import { type Route, readTakePlan } from '@/take/plan'
import { take } from '@/take/film'

const PAGE = new URL('./fixtures/contextmenu.html', import.meta.url)

const PLAN = readFileSync(
  new URL('./fixtures/contextmenu.json', import.meta.url),
  'utf8',
)

describe.skipIf(!available())('a take of a context menu', () => {
  let server: MotionServer
  let out: string
  let sink: MotionReport[] = []
  const reports: Record<Route, MotionReport[]> = { step: [], screencast: [] }
  const results: Partial<Record<Route, Awaited<ReturnType<typeof take>>>> = {}

  async function film(route: Route): Promise<void> {
    const read = readTakePlan(JSON.stringify({ ...JSON.parse(PLAN), route }))
    if (read.kind !== 'read') throw new Error(read.detail)
    sink = []
    results[route] = await take({
      url: server.url,
      plan: read.plan,
      out: join(out, route),
      stallMs: LOADED_STALL_MS,
      deviceScale: 1,
    })
    reports[route] = [...sink]
  }

  beforeAll(async () => {
    server = serveFixture(PAGE, (report) => sink.push(report))
    out = mkdtempSync(join(tmpdir(), 'canon-take-contextmenu-e2e-'))
    await film('step')
    await film('screencast')
  }, 360_000)

  afterAll(() => {
    server.stop()
    rmSync(out, { recursive: true, force: true })
  })

  describe.each(['step', 'screencast'] as const)('on the %s route', (route) => {
    it('should film both beats on the route asked for', () => {
      expect(results[route]).not.toHaveProperty('message')
      expect(results[route]).not.toHaveProperty('beats.0.fallback')
      expect(results[route]).not.toHaveProperty('beats.1.fallback')
      expect(results[route]).toMatchObject({
        status: 'filmed',
        beats: [{ route }, { route }],
      })
    })

    it('should open the menu with the right button on the empty space, once per beat', () => {
      expect(reports[route].filter((r) => r.type === 'contextmenu')).toEqual([
        expect.objectContaining({ button: 2, empty: true }),
        expect.objectContaining({ button: 2, empty: true }),
      ])
    })

    it('should pick the row whose whole text matches, not the one sharing its prefix', () => {
      expect(reports[route].filter((r) => r.type === 'pick')).toEqual([
        expect.objectContaining({ label: 'New file' }),
      ])
    })
  })
})
