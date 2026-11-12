import { spawn } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from 'vitest'
import type { CameraTrack } from '@/take/camera'
import {
  LOADED_STALL_MS,
  available,
  bandLuma,
  html,
  probe,
} from '@/take/fixtures/film-suite'
import type { TakeLog } from '@/take/log'
import { readTakePlan } from '@/take/plan'
import { take } from '@/take/film'

const PAGE = readFileSync(
  new URL('./fixtures/fade.html', import.meta.url),
  'utf8',
)

const FETCH_PAGE = readFileSync(
  new URL('./fixtures/fetch.html', import.meta.url),
  'utf8',
)

/** The same page with a hidden copy of the button's text ahead of it. */
const HIDDEN_PAGE = PAGE.replace(
  '<body>',
  '<body>\n    <div hidden><span>Go</span></div>',
)

/**
 * A single-use link, the way an app trades a ticket for a session: the first
 * open serves a button whose press busies the page past the stall limit, and
 * every later open serves the spent page with no button.
 */
function ticketPage(fresh: boolean): string {
  if (!fresh) return '<!doctype html><body><p>This link has expired.</p></body>'
  return readFileSync(
    new URL('./fixtures/ticket.html', import.meta.url),
    'utf8',
  )
}

/** Longer than the stall limit, so a stepper waiting on it falls back. */
const SLOW_MS = LOADED_STALL_MS + 1000

const ONE_BEAT = JSON.stringify({
  beats: [
    {
      name: 'light the band',
      steps: [
        { kind: 'click', target: '#go' },
        { kind: 'wait', ms: 1200 },
      ],
    },
  ],
})

describe.skipIf(!available())('a frame-stepped take of a served page', () => {
  let server: { url: string; stop: () => void }
  let out: string
  // Counts each open of the single-use address, the way an app redeems a
  // ticket in its access link.
  let onceHits = 0
  let ticketOpens = 0

  beforeAll(() => {
    const served = Bun.serve({
      port: 0,
      fetch: async (request) => {
        const { pathname } = new URL(request.url)
        if (pathname === '/fetch') return html(FETCH_PAGE)
        if (pathname === '/hidden') return html(HIDDEN_PAGE)
        if (pathname === '/slow') {
          await Bun.sleep(SLOW_MS)
          return new Response('ok')
        }
        if (pathname === '/once') onceHits += 1
        if (pathname === '/ticket') {
          ticketOpens += 1
          return html(ticketPage(ticketOpens === 1))
        }
        return html(PAGE)
      },
    })
    server = {
      url: `http://127.0.0.1:${served.port}/`,
      stop: () => served.stop(true),
    }
    out = mkdtempSync(join(tmpdir(), 'canon-take-e2e-'))
  })

  afterAll(() => {
    server.stop()
    rmSync(out, { recursive: true, force: true })
  })

  it('should film 4K at 60 fps with one frame of page time per frame', async () => {
    const read = readTakePlan(ONE_BEAT)
    if (read.kind !== 'read') throw new Error(read.detail)

    const result = await take({
      url: server.url,
      plan: read.plan,
      out,
      stallMs: LOADED_STALL_MS,
    })

    // Ahead of the route, so a fall back prints the frame that stalled.
    expect(result).not.toHaveProperty('beats.0.fallback')
    expect(result).toMatchObject({
      status: 'filmed',
      beats: [{ name: 'light the band', route: 'step' }],
    })
    if (result.status !== 'filmed') return
    const [beat] = result.beats
    if (!beat) return
    const clip = join(out, beat.clip)

    expect(probe(clip)).toEqual({ width: 3840, height: 2160, rate: '60/1' })

    // A one-second linear fade spans 60 frames when every frame advanced one
    // sixtieth of a second, and each of them is brighter than the last. A
    // stepper running on wall time would spread or bunch them.
    const luma = bandLuma(clip)
    expect(luma).toHaveLength(beat.frames)
    const ramp = luma.filter((value) => value > 17 && value < 234)
    // The distinct values tell a fade that never started, one value held for
    // every frame, apart from one that jumped past its middle.
    const seen = `the clip's distinct band luma: ${[...new Set(luma)].join(' ')}`
    expect(ramp.length, seen).toBeGreaterThanOrEqual(57)
    expect(ramp.length, seen).toBeLessThanOrEqual(60)
    const rises = ramp.slice(1).map((value, i) => value - (ramp[i] ?? 0))
    expect(Math.min(...rises)).toBeGreaterThan(0)

    // The still is the clip's closing frame, so the band has finished its
    // fade to white in both.
    const still = join(out, beat.still)
    expect(probe(still)).toMatchObject({ width: 3840, height: 2160 })
    const [stillLuma = 0] = bandLuma(still)
    expect(stillLuma).toBeGreaterThan(230)
    expect(Math.abs(stillLuma - (luma.at(-1) ?? 0))).toBeLessThanOrEqual(3)

    const log = JSON.parse(readFileSync(join(out, beat.log), 'utf8')) as TakeLog
    expect(log.frames).toBe(beat.frames)
    expect(log.events.filter((event) => event.kind === 'click')).toEqual([
      expect.objectContaining({
        at: { x: 200, y: 130 },
        box: { x: 100, y: 100, width: 200, height: 60 },
      }),
    ])

    const camera = JSON.parse(
      readFileSync(join(out, beat.camera), 'utf8'),
    ) as CameraTrack
    expect(camera.frames).toHaveLength(beat.frames)
  }, 180_000)

  it('should film a stepped beat at the viewport size when asked for device scale 1', async () => {
    const read = readTakePlan(ONE_BEAT)
    if (read.kind !== 'read') throw new Error(read.detail)

    const result = await take({
      url: server.url,
      plan: read.plan,
      out,
      stallMs: LOADED_STALL_MS,
      deviceScale: 1,
    })

    expect(result).not.toHaveProperty('beats.0.fallback')
    expect(result).toMatchObject({
      status: 'filmed',
      beats: [{ route: 'step' }],
    })
    if (result.status !== 'filmed') return
    const [beat] = result.beats
    if (!beat) return
    expect(probe(join(out, beat.clip))).toEqual({
      width: 1920,
      height: 1080,
      rate: '60/1',
    })
    const still = join(out, beat.still)
    expect(probe(still)).toMatchObject({ width: 1920, height: 1080 })
    // The band's CSS crop lands on the same element at this scale, so the
    // still reads white where the scale-2 case reads it.
    const [stillLuma = 0] = bandLuma(still)
    expect(stillLuma).toBeGreaterThan(230)
    const log = JSON.parse(readFileSync(join(out, beat.log), 'utf8')) as TakeLog
    expect(log.clip).toEqual({ width: 1920, height: 1080 })
  }, 180_000)

  it('should film a screencast beat at the viewport size and the same rate', async () => {
    const read = readTakePlan(
      JSON.stringify({
        beats: [
          {
            name: 'cast',
            route: 'screencast',
            steps: [
              { kind: 'click', target: '#go' },
              { kind: 'wait', ms: 1200 },
            ],
          },
        ],
      }),
    )
    if (read.kind !== 'read') throw new Error(read.detail)

    const result = await take({ url: server.url, plan: read.plan, out })

    expect(result).toMatchObject({
      status: 'filmed',
      beats: [{ name: 'cast', requested: 'screencast', route: 'screencast' }],
    })
    if (result.status !== 'filmed') return
    const [beat] = result.beats
    if (!beat) return
    expect(probe(join(out, beat.clip))).toEqual({
      width: 1920,
      height: 1080,
      rate: '60/1',
    })
    const still = join(out, beat.still)
    expect(probe(still)).toMatchObject({ width: 1920, height: 1080 })

    // The band opens black and ends white, so a still read off the wrong end
    // of the clip fails both checks. The crop is the stepped one at half size.
    const luma = bandLuma(join(out, beat.clip))
    const [stillLuma = 0] = bandLuma(still)
    expect(stillLuma).toBeGreaterThan(230)
    expect(Math.abs(stillLuma - (luma.at(-1) ?? 0))).toBeLessThanOrEqual(3)
  }, 180_000)

  it('should clear the spool a killed take left beside the clip', async () => {
    const read = readTakePlan(
      JSON.stringify({
        beats: [
          {
            name: 'cast',
            route: 'screencast',
            steps: [{ kind: 'wait', ms: 200 }],
          },
        ],
      }),
    )
    if (read.kind !== 'read') throw new Error(read.detail)
    const own = mkdtempSync(join(tmpdir(), 'canon-take-spool-e2e-'))
    const stale = join(own, '01-cast/spool/0.jpg')
    mkdirSync(dirname(stale), { recursive: true })
    writeFileSync(stale, 'left by a killed take')

    try {
      const result = await take({ url: server.url, plan: read.plan, out: own })

      expect(result).toMatchObject({ status: 'filmed' })
      expect(existsSync(dirname(stale))).toBe(false)
    } finally {
      rmSync(own, { recursive: true, force: true })
    }
  }, 180_000)

  it('should remove the spool when the take is interrupted', async () => {
    const own = mkdtempSync(join(tmpdir(), 'canon-take-spool-e2e-'))
    const plan = join(own, 'plan.json')
    writeFileSync(
      plan,
      JSON.stringify({
        beats: [
          {
            name: 'cast',
            route: 'screencast',
            steps: [{ kind: 'wait', ms: 60_000 }],
          },
        ],
      }),
    )
    const spool = join(own, 'takes/01-cast/spool')
    const cli = fileURLToPath(new URL('../cli.ts', import.meta.url))
    const running = spawn(
      'bun',
      [cli, 'take', server.url, plan, '--out', join(own, 'takes')],
      { stdio: 'ignore' },
    )
    const exited = new Promise((done) => running.once('close', done))

    try {
      await vi.waitFor(() => expect(readdirSync(spool)).not.toHaveLength(0), {
        timeout: 60_000,
        interval: 100,
      })
      running.kill('SIGINT')
      await exited

      expect(existsSync(spool)).toBe(false)
    } finally {
      running.kill('SIGKILL')
      rmSync(own, { recursive: true, force: true })
    }
  }, 180_000)

  it('should exit on its refusal when the beat folder refuses the spool', async () => {
    const own = mkdtempSync(join(tmpdir(), 'canon-take-spool-e2e-'))
    const plan = join(own, 'plan.json')
    writeFileSync(
      plan,
      JSON.stringify({
        beats: [
          {
            name: 'cast',
            route: 'screencast',
            steps: [{ kind: 'wait', ms: 200 }],
          },
        ],
      }),
    )
    const beat = join(own, 'takes/01-cast')
    mkdirSync(beat, { recursive: true })
    chmodSync(beat, 0o555)
    const cli = fileURLToPath(new URL('../cli.ts', import.meta.url))
    const running = spawn(
      'bun',
      [cli, 'take', server.url, plan, '--out', join(own, 'takes')],
      { stdio: 'ignore' },
    )
    // Registered here rather than in a `finally`, which a process that never
    // exits would hold past the timeout.
    onTestFinished(() => {
      running.kill('SIGKILL')
      chmodSync(beat, 0o755)
      rmSync(own, { recursive: true, force: true })
    })

    const code = await new Promise((done) => running.once('close', done))

    expect(code).toBe(1)
  }, 30_000)

  it('should refuse a target the page does not carry rather than film a guess', async () => {
    const read = readTakePlan(
      JSON.stringify({
        beats: [
          { name: 'miss', steps: [{ kind: 'click', target: '#absent' }] },
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
      reason: 'target-missing',
      beat: 'miss',
    })
    expect(result).not.toHaveProperty('fallback')
    if (result.status !== 'failed' || !result.still) {
      throw new Error('the refusal carried no still')
    }
    expect(probe(join(out, result.still))).toMatchObject({
      width: 3840,
      height: 2160,
    })
  }, 180_000)

  it('should say a refused beat fell back first, with a still of the spent page', async () => {
    const read = readTakePlan(
      JSON.stringify({
        beats: [
          {
            name: 'spent',
            steps: [
              { kind: 'click', target: '#open' },
              { kind: 'wait', ms: 200 },
            ],
          },
        ],
      }),
    )
    if (read.kind !== 'read') throw new Error(read.detail)
    ticketOpens = 0

    const result = await take({
      url: new URL('/ticket', server.url).href,
      plan: read.plan,
      out,
      deviceScale: 1,
    })

    expect(result).toMatchObject({
      status: 'failed',
      reason: 'target-missing',
      beat: 'spent',
      fallback: expect.stringContaining('under frame stepping'),
      still: '01-spent/still.jpg',
    })
    expect(ticketOpens).toBe(2)
    expect(existsSync(join(out, '01-spent/still.jpg'))).toBe(true)
  }, 180_000)

  it('should click the visible text match behind a hidden duplicate', async () => {
    const read = readTakePlan(
      JSON.stringify({
        beats: [
          {
            name: 'hidden',
            route: 'screencast',
            steps: [{ kind: 'click', target: 'text=Go' }],
          },
        ],
      }),
    )
    if (read.kind !== 'read') throw new Error(read.detail)

    const result = await take({
      url: new URL('/hidden', server.url).href,
      plan: read.plan,
      out,
    })

    expect(result).toMatchObject({ status: 'filmed' })
    if (result.status !== 'filmed') return
    const [beat] = result.beats
    if (!beat) return
    const log = JSON.parse(readFileSync(join(out, beat.log), 'utf8')) as TakeLog
    expect(log.events.filter((event) => event.kind === 'click')).toEqual([
      expect.objectContaining({
        box: { x: 100, y: 100, width: 200, height: 60 },
      }),
    ])
  }, 180_000)

  it('should keep stepping while a fetch the page started is in flight', async () => {
    const read = readTakePlan(
      JSON.stringify({
        beats: [
          {
            name: 'load',
            steps: [
              { kind: 'click', target: '#go' },
              { kind: 'wait', ms: 600 },
            ],
          },
        ],
      }),
    )
    if (read.kind !== 'read') throw new Error(read.detail)

    const result = await take({
      url: new URL('/fetch', server.url).href,
      plan: read.plan,
      out,
      stallMs: LOADED_STALL_MS,
      deviceScale: 1,
    })

    expect(result).not.toHaveProperty('beats.0.fallback')
    expect(result).toMatchObject({
      status: 'filmed',
      beats: [{ name: 'load', route: 'step' }],
    })
  }, 180_000)

  it('should open the address once, so a single-use link reaches the page unspent', async () => {
    const read = readTakePlan(
      JSON.stringify({
        beats: [{ name: 'open', steps: [{ kind: 'wait', ms: 100 }] }],
      }),
    )
    if (read.kind !== 'read') throw new Error(read.detail)
    onceHits = 0

    await take({
      url: new URL('/once', server.url).href,
      plan: read.plan,
      out,
      stallMs: LOADED_STALL_MS,
      deviceScale: 1,
    })

    expect(onceHits).toBe(1)
  }, 180_000)
})
