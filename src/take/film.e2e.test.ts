import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { CameraTrack } from '@/take/camera'
import type { TakeLog } from '@/take/log'
import { readTakePlan } from '@/take/plan'
import { findShell } from '@/take/shell'
import { take } from '@/take/film'

/**
 * Films one frame-stepped take of a static page and reads the clip back,
 * because the property the stepper exists for, one frame of page time per
 * frame of clip, is visible only in the pixels it wrote.
 *
 * The suite needs chrome-headless-shell and FFmpeg. CI installs neither, so it
 * skips there rather than failing, which means a green pipeline is not
 * evidence this passed. Run it locally.
 */

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
  return `<!doctype html><body style="margin:0">
    <button id="open" style="position:absolute;left:100px;top:100px;width:200px;height:60px">Open</button>
    <script>
      document.getElementById('open').addEventListener('click', () => {
        const start = Date.now()
        while (Date.now() - start < 4000) {}
      })
    </script>
  </body>`
}

/**
 * The stall limit the stepped takes run under, four times the product's, since
 * a 4K frame on a loaded suite can pass 2 s on a page that steps fine.
 */
const LOADED_STALL_MS = 8000

/** Longer than the stall limit, so a stepper waiting on it falls back. */
const SLOW_MS = LOADED_STALL_MS + 1000

function html(body: string): Response {
  return new Response(body, { headers: { 'content-type': 'text/html' } })
}

function available(): boolean {
  try {
    findShell()
  } catch {
    return false
  }
  return spawnSync('ffmpeg', ['-version']).status === 0
}

function probe(clip: string): { width: number; height: number; rate: string } {
  const out = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height,r_frame_rate',
      '-of',
      'json',
      clip,
    ],
    { encoding: 'utf8' },
  ).stdout
  const [stream] = (
    JSON.parse(out) as {
      streams: { width: number; height: number; r_frame_rate: string }[]
    }
  ).streams
  if (!stream) throw new Error(`no video stream in ${clip}`)
  return {
    width: stream.width,
    height: stream.height,
    rate: stream.r_frame_rate,
  }
}

/**
 * The band's stored luma in each frame, TV range, 16 for black and 235 for
 * white. Read raw rather than converted to gray, since that conversion
 * stretches the range and clips the first and last steps of the fade.
 */
function bandLuma(media: string, crop = '16:16:200:1000'): number[] {
  const raw = spawnSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-i',
      media,
      '-vf',
      `crop=${crop},scale=2:2:flags=area`,
      '-pix_fmt',
      'yuv420p',
      '-f',
      'rawvideo',
      '-',
    ],
    { maxBuffer: 64 * 1024 * 1024 },
  ).stdout
  // Each 2x2 frame is four luma bytes, then one byte each of the two chroma planes.
  return [...raw].filter((_, index) => index % 6 === 0)
}

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
    expect(ramp.length).toBeGreaterThanOrEqual(57)
    expect(ramp.length).toBeLessThanOrEqual(60)
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
    const luma = bandLuma(join(out, beat.clip), '8:8:100:500')
    const [stillLuma = 0] = bandLuma(still, '8:8:100:500')
    expect(stillLuma).toBeGreaterThan(230)
    expect(Math.abs(stillLuma - (luma.at(-1) ?? 0))).toBeLessThanOrEqual(3)
  }, 180_000)

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
    })

    expect(onceHits).toBe(1)
  }, 180_000)
})

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
