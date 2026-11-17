import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  LOADED_STALL_MS,
  available,
  bandLuma,
} from '@/take/fixtures/film-suite'
import { type MotionServer, serveFixture } from '@/take/fixtures/motion-server'
import { take } from '@/take/film'
import { readTakePlan } from '@/take/plan'

/**
 * Films the pending fixture with its data request held or failed, and reads
 * the state off the page colour in each beat's still: mid grey while loading,
 * white once loaded, and near black on an error.
 */

const PAGE = new URL('./fixtures/pending.html', import.meta.url)

const STEPS = [
  { kind: 'move', target: '#status' },
  { kind: 'wait', ms: 300 },
]

describe.skipIf(!available())('a take that holds or fails a request', () => {
  let server: MotionServer
  let out: string

  function plan(beats: readonly Record<string, unknown>[]) {
    const read = readTakePlan(JSON.stringify({ beats }))
    if (read.kind !== 'read') throw new Error(read.detail)
    return read.plan
  }

  function stillLuma(still: string | undefined): number {
    return bandLuma(join(out, still ?? ''))[0] ?? 0
  }

  beforeAll(() => {
    server = serveFixture(PAGE)
    out = mkdtempSync(join(tmpdir(), 'canon-take-network-e2e-'))
  })

  afterAll(() => {
    server.stop()
    rmSync(out, { recursive: true, force: true })
  })

  it.each(['step', 'screencast'] as const)(
    'should keep the placeholder on the still of a held beat on the %s route',
    async (route) => {
      const result = await take({
        url: server.url,
        plan: plan([
          {
            name: 'held',
            route,
            network: [{ match: '*/data', action: 'hold' }],
            steps: STEPS,
          },
        ]),
        out,
        stallMs: LOADED_STALL_MS,
        deviceScale: 1,
      })

      if (result.status !== 'filmed') throw new Error(result.message)
      expect(result.beats[0]).toMatchObject({
        route,
        network: [{ match: '*/data', action: 'hold', requests: 1 }],
      })
      expect(stillLuma(result.beats[0]?.still)).toBeGreaterThan(100)
      expect(stillLuma(result.beats[0]?.still)).toBeLessThan(150)
    },
    180_000,
  )

  it.each(['step', 'screencast'] as const)(
    'should show the error on the still of an aborted beat on the %s route',
    async (route) => {
      const result = await take({
        url: server.url,
        plan: plan([
          {
            name: 'failed',
            route,
            network: [{ match: '*/data', action: 'abort' }],
            steps: STEPS,
          },
        ]),
        out,
        stallMs: LOADED_STALL_MS,
        deviceScale: 1,
      })

      if (result.status !== 'filmed') throw new Error(result.message)
      expect(stillLuma(result.beats[0]?.still)).toBeLessThan(50)
    },
    180_000,
  )

  it('should film the loaded view when the beat names no network list', async () => {
    const result = await take({
      url: server.url,
      plan: plan([{ name: 'loaded', steps: STEPS }]),
      out,
      stallMs: LOADED_STALL_MS,
      deviceScale: 1,
    })

    if (result.status !== 'filmed') throw new Error(result.message)
    expect(result.beats[0]).not.toHaveProperty('network')
    expect(stillLuma(result.beats[0]?.still)).toBeGreaterThan(200)
  }, 180_000)

  it('should refuse a beat whose pattern matched no request, naming the pattern', async () => {
    const result = await take({
      url: server.url,
      plan: plan([
        {
          name: 'unmatched',
          network: [
            { match: '*/data', action: 'hold' },
            { match: '*/api/missing', action: 'abort' },
          ],
          steps: STEPS,
        },
      ]),
      out,
      stallMs: LOADED_STALL_MS,
      deviceScale: 1,
    })

    expect(result).toMatchObject({
      status: 'failed',
      reason: 'network-unmatched',
      beat: 'unmatched',
      message: expect.stringContaining('*/api/missing'),
    })
    expect(result.status === 'failed' && result.message).not.toContain('*/data')
  }, 180_000)

  it('should record the network list the fixture plan holds and fails', async () => {
    const result = await take({
      url: server.url,
      plan: plan(
        (
          JSON.parse(
            readFileSync(
              new URL('./fixtures/pending.json', import.meta.url),
              'utf8',
            ),
          ) as { beats: Record<string, unknown>[] }
        ).beats,
      ),
      out,
      stallMs: LOADED_STALL_MS,
      deviceScale: 1,
    })

    if (result.status !== 'filmed') throw new Error(result.message)
    const record = JSON.parse(readFileSync(join(out, 'take.json'), 'utf8'))
    expect(
      record.beats.map((beat: { network: unknown }) => beat.network),
    ).toEqual([
      [{ match: '*/data', action: 'hold', requests: 1 }],
      [{ match: '*/data', action: 'abort', requests: 1 }],
    ])
  }, 180_000)
})
