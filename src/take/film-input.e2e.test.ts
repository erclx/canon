import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { LOADED_STALL_MS, available, html } from '@/take/fixtures/film-suite'
import type { TakeLog } from '@/take/log'
import { readTakePlan } from '@/take/plan'
import { take } from '@/take/film'

const INPUT_PAGE = readFileSync(
  new URL('./fixtures/input.html', import.meta.url),
  'utf8',
)

/** What `input.html` posted, in the order the page saw it. */
interface Report {
  readonly seq: number
  readonly type: string
  readonly [field: string]: unknown
}

const DRAG = { kind: 'drag', from: '#handle', to: '#lane' }
const DBLCLICK = { kind: 'dblclick', target: '#frame' }
const SHIFT_CLICK = { kind: 'click', target: '#layer', modifiers: ['Shift'] }
const PALETTE = { kind: 'key', keys: 'Control+K' }

/** One beat per kind on the stepper, the key beat pressing in setup too. */
const STEPPED_INPUTS = JSON.stringify({
  beats: [
    { name: 'drag', steps: [DRAG] },
    { name: 'dblclick', steps: [DBLCLICK] },
    { name: 'shift click', steps: [SHIFT_CLICK] },
    {
      name: 'palette',
      setup: [
        { kind: 'click', target: '#field' },
        { kind: 'key', keys: 'Escape' },
      ],
      steps: [PALETTE],
    },
  ],
})

/** All four kinds in one screencast beat. */
const CAST_INPUTS = JSON.stringify({
  beats: [
    {
      name: 'all inputs',
      route: 'screencast',
      steps: [
        DRAG,
        DBLCLICK,
        SHIFT_CLICK,
        { kind: 'click', target: '#field' },
        PALETTE,
      ],
    },
  ],
})

describe.skipIf(!available())('input steps on both routes', () => {
  let server: { url: string; stop: () => void }
  let out: string
  let sink: Report[] = []
  const reports: Record<'step' | 'screencast', Report[]> = {
    step: [],
    screencast: [],
  }
  let stepped: Awaited<ReturnType<typeof take>> | undefined

  async function film(plan: string): Promise<Report[]> {
    const read = readTakePlan(plan)
    if (read.kind !== 'read') throw new Error(read.detail)
    sink = []
    const result = await take({
      url: new URL('/input', server.url).href,
      plan: read.plan,
      out,
      stallMs: LOADED_STALL_MS,
      deviceScale: 1,
    })
    if (result.status !== 'filmed') throw new Error(result.message)
    stepped ??= result
    return [...sink].sort((a, b) => a.seq - b.seq)
  }

  beforeAll(async () => {
    const served = Bun.serve({
      port: 0,
      fetch: async (request) => {
        if (new URL(request.url).pathname === '/report') {
          sink.push((await request.json()) as Report)
          return new Response('ok')
        }
        return html(INPUT_PAGE)
      },
    })
    server = {
      url: `http://127.0.0.1:${served.port}/`,
      stop: () => served.stop(true),
    }
    out = mkdtempSync(join(tmpdir(), 'canon-take-input-e2e-'))
    reports.step = await film(STEPPED_INPUTS)
    reports.screencast = await film(CAST_INPUTS)
  }, 360_000)

  afterAll(() => {
    server.stop()
    rmSync(out, { recursive: true, force: true })
  })

  it('should film every input beat by frame stepping without falling back', () => {
    expect(stepped).toMatchObject({ status: 'filmed' })
    expect(stepped).not.toHaveProperty('beats.0.fallback')
    expect(stepped).not.toHaveProperty('beats.1.fallback')
    expect(stepped).not.toHaveProperty('beats.2.fallback')
    expect(stepped).not.toHaveProperty('beats.3.fallback')
  })

  it('should log one drag on the stepped drag beat', () => {
    if (stepped?.status !== 'filmed') throw new Error('no stepped take')
    const [beat] = stepped.beats
    if (!beat) throw new Error('no drag beat')
    const log = JSON.parse(readFileSync(join(out, beat.log), 'utf8')) as TakeLog

    expect(log.events.filter((event) => event.kind === 'drag')).toHaveLength(1)
  })

  it('should run a key in setup on the live stage', () => {
    expect(reports.step).toContainEqual(
      expect.objectContaining({ type: 'keydown', key: 'Escape' }),
    )
  })

  describe.each(['step', 'screencast'] as const)('on the %s route', (route) => {
    it('should drop the handle on the lane with every move held', () => {
      expect(reports[route].filter((r) => r.type === 'drop')).toEqual([
        expect.objectContaining({ onTarget: true, hover: 0 }),
      ])
      const [drop] = reports[route].filter((r) => r.type === 'drop')
      expect(drop?.held).toBeGreaterThan(1)
    })

    it('should fire one dblclick', () => {
      expect(reports[route].filter((r) => r.type === 'dblclick')).toHaveLength(
        1,
      )
    })

    it('should press and click the layer with Shift held', () => {
      expect(
        reports[route].filter((r) =>
          ['pointerdown', 'pointerup', 'click'].includes(r.type),
        ),
      ).toEqual([
        expect.objectContaining({ type: 'pointerdown', shiftKey: true }),
        expect.objectContaining({ type: 'pointerup', shiftKey: true }),
        expect.objectContaining({ type: 'click', shiftKey: true }),
      ])
    })

    it('should release Shift after the click lands', () => {
      const click = reports[route].find((r) => r.type === 'click')
      const shiftUp = reports[route].find(
        (r) => r.type === 'keyup' && r.key === 'Shift',
      )

      expect(shiftUp?.seq).toBeGreaterThan(click?.seq ?? Infinity)
    })

    it('should press Control+K into a focused field without typing a K', () => {
      expect(reports[route]).toContainEqual(
        expect.objectContaining({ type: 'keydown', key: 'K', ctrlKey: true }),
      )
      expect(
        reports[route].filter((r) => r.type === 'keyup' && r.key === 'Control'),
      ).toEqual([expect.objectContaining({ value: '' })])
    })
  })
})
