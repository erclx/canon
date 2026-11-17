import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { LOADED_STALL_MS, available, probe } from '@/take/fixtures/film-suite'
import {
  type MotionReport,
  type MotionServer,
  serveFixture,
} from '@/take/fixtures/motion-server'
import { take } from '@/take/film'
import { type Route, readTakePlan } from '@/take/plan'

const PAGE = new URL('./fixtures/fullscreen.html', import.meta.url)
const PLAN = new URL('./fixtures/fullscreen.json', import.meta.url)

describe.skipIf(!available())('a page that asks for fullscreen', () => {
  let server: MotionServer
  let out: string
  let reports: MotionReport[] = []

  async function film(
    route: Route,
    beat: Record<string, unknown>,
    deviceScale: 1 | 2 = 1,
  ) {
    const read = readTakePlan(
      JSON.stringify({ beats: [{ name: 'present', route, ...beat }] }),
    )
    if (read.kind !== 'read') throw new Error(read.detail)
    reports = []
    return take({
      url: server.url,
      plan: read.plan,
      out,
      stallMs: LOADED_STALL_MS,
      deviceScale,
    })
  }

  beforeAll(() => {
    server = serveFixture(PAGE, (report) => reports.push(report))
    out = mkdtempSync(join(tmpdir(), 'canon-take-fullscreen-e2e-'))
  })

  afterAll(() => {
    server.stop()
    rmSync(out, { recursive: true, force: true })
  })

  it('should film a stepped beat entering fullscreen in setup at full size with no fallback', async () => {
    const read = readTakePlan(readFileSync(PLAN, 'utf8'))
    if (read.kind !== 'read') throw new Error(read.detail)
    reports = []

    const result = await take({
      url: server.url,
      plan: read.plan,
      out,
      stallMs: LOADED_STALL_MS,
    })

    if (result.status !== 'filmed') throw new Error(result.message)
    expect(result.beats[0]).toMatchObject({ route: 'step' })
    expect(result).not.toHaveProperty('beats.0.fallback')
    expect(probe(join(out, result.beats[0]?.clip ?? ''))).toMatchObject({
      width: 3840,
      height: 2160,
    })
    expect(reports).toEqual([
      expect.objectContaining({ full: true, width: 1920, height: 1080 }),
    ])
  }, 180_000)

  it('should film a screencast beat entering fullscreen in setup at the viewport', async () => {
    const result = await film('screencast', {
      setup: [{ kind: 'click', target: '#present' }],
      steps: [{ kind: 'wait', ms: 300 }],
    })

    if (result.status !== 'filmed') throw new Error(result.message)
    expect(result.beats[0]).toMatchObject({ route: 'screencast' })
    expect(probe(join(out, result.beats[0]?.clip ?? ''))).toMatchObject({
      width: 1920,
      height: 1080,
    })
    expect(reports).toEqual([
      expect.objectContaining({ full: true, width: 1920, height: 1080 }),
    ])
  }, 180_000)

  it.each(['step', 'screencast'] as const)(
    'should clear the held element and fire the event again on exit on the %s route',
    async (route) => {
      const result = await film(route, {
        setup: [{ kind: 'click', target: '#present' }],
        steps: [
          { kind: 'click', target: '#present' },
          { kind: 'wait', ms: 300 },
        ],
      })

      if (result.status !== 'filmed') throw new Error(result.message)
      expect(result.beats[0]?.route).toBe(route)
      expect(reports.map((report) => report.full)).toEqual([true, false])
    },
    180_000,
  )

  it.each(['step', 'screencast'] as const)(
    'should film the fullscreen click in steps clean on the %s route',
    async (route) => {
      const result = await film(route, {
        steps: [
          { kind: 'click', target: '#present' },
          { kind: 'wait', ms: 300 },
        ],
      })

      if (result.status !== 'filmed') throw new Error(result.message)
      expect(result.beats[0]?.route).toBe(route)
      expect(result).not.toHaveProperty('beats.0.fallback')
      expect(reports).toEqual([
        expect.objectContaining({ full: true, width: 1920, height: 1080 }),
      ])
    },
    180_000,
  )
})
