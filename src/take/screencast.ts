import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
import { lastFrame, openFrameEncoder, probeFrames } from '@/take/encode'
import { frameStamp, slotFrames } from '@/take/frame-clock'
import { FPS, type LogEvent, START, VIEWPORT } from '@/take/log'
import {
  type PointerInput,
  type Stage,
  TargetRefused,
  performSteps,
} from '@/take/perform'
import type { Beat } from '@/take/plan'
import { HOLD_MS, withinCap } from '@/take/stepper'

/**
 * Films a beat in real time through Playwright's screencast, for a page frame
 * stepping cannot drive. It runs at the viewport's own 1920x1080, so it goes
 * soft under a zoom where a stepped take stays sharp, and its frames land when
 * the page paints rather than one per step.
 */

const FRAME_MS = 1000 / FPS

const SETTLE_MS = 2500

/** How long a refusal waits on the screenshot it shows. */
const STILL_CAP_MS = 2000

/**
 * How long a move waits on the page's next animation frame before it goes
 * anyway, since a page whose frames stall is the stepper's case and this route
 * must still film.
 */
const ALIGN_CAP_MS = 100

/** How long the calibration waits on the page to paint its move. */
const CALIBRATE_CAP_MS = 500

export interface ScreencastTake {
  readonly frames: number
  readonly events: readonly LogEvent[]
  /** What `events` were shifted by, absent when the page gave no frame to read. */
  readonly lag?: number
  /** The clip's closing frame as a JPEG. */
  readonly still: Buffer
}

export async function filmScreencast(request: {
  readonly url: string
  readonly beat: Beat
  readonly clip: string
}): Promise<ScreencastTake> {
  const scratch = mkdtempSync(join(tmpdir(), 'canon-take-cast-'))
  const browser = await chromium.launch()
  let still: (() => Promise<Buffer | undefined>) | undefined
  try {
    const page = await browser.newPage({ viewport: VIEWPORT })
    // Best effort, so a closed or crashed page leaves the refusal standing
    // without a still rather than replacing it.
    still = () =>
      page
        .screenshot({ type: 'jpeg', quality: 95, timeout: STILL_CAP_MS })
        .catch(() => undefined)
    await page.goto(request.url, { waitUntil: 'load' })
    await page.waitForTimeout(SETTLE_MS)

    const stageOn = (clock: () => number): Stage => ({
      now: clock,
      hold: (ms) => page.waitForTimeout(ms),
      align: () => nextFrame(page, ALIGN_CAP_MS).then(() => undefined),
      pointer: async (input) => {
        // A move waited on its frame already, so padding it would land the
        // next one a frame late.
        if (input.type === 'move') return send(page.mouse, input)
        const sent = clock()
        await send(page.mouse, input)
        const spent = clock() - sent
        if (spent < FRAME_MS) await page.waitForTimeout(FRAME_MS - spent)
      },
      key: async (text) => {
        await page.keyboard.insertText(text)
        await page.waitForTimeout(FRAME_MS)
      },
      // Playwright's mouse reads the modifiers its keyboard holds, so a press
      // here is all a modified click or drag needs on this route.
      press: async (input) => {
        if (input.type === 'down') await page.keyboard.down(input.key)
        else await page.keyboard.up(input.key)
        await page.waitForTimeout(FRAME_MS)
      },
      evaluate: (expression) => page.evaluate(expression),
    })

    const live = stageOn(() => performance.now())
    await performSteps(live, request.beat.setup, { pointer: START })
    if (request.beat.setup.length > 0) await live.hold(1000)
    const lag = await calibrate(page)

    const events: LogEvent[] = []
    const spool: SpooledFrame[] = []
    let spoolFailure: unknown
    await page.screencast.start({
      size: VIEWPORT,
      // The docs tie this to `path`, but 1.64.1 still reads it here, where it
      // doubles the frames Chromium may hold unacknowledged.
      fps: FPS,
      // Spooled rather than held, since a busy page sends about 19 MB a second.
      // The write stays synchronous, so the acknowledgement Chromium paces its
      // frames on waits for no encoder. Playwright calls this from a listener
      // nothing awaits, so a throw here would surface as an unhandled rejection.
      onFrame: ({ data, timestamp }) => {
        const stamp = frameStamp({
          presentedWall: timestamp,
          wallNow: Date.now(),
          monoNow: performance.now(),
        })
        const path = join(scratch, `${spool.length}.jpg`)
        try {
          writeFileSync(path, data)
          spool.push({ path, stamp })
        } catch (error) {
          spoolFailure ??= error
        }
      },
    })
    const started = performance.now()
    const recording = stageOn(() => performance.now() - started)
    await recording.hold(HOLD_MS)
    await performSteps(recording, request.beat.steps, {
      pointer: START,
      log: events,
    })
    await recording.hold(HOLD_MS)
    const filmedMs = recording.now()
    await page.screencast.stop()
    if (spoolFailure !== undefined) throw spoolFailure

    await encodeSpool(spool, request.clip, started, filmedMs)
    const frames = await probeFrames(request.clip)
    const closing = await lastFrame(request.clip, frames)
    if (lag === undefined) return { frames, events, still: closing }
    return {
      frames,
      events: events.map((event) => shifted(event, lag)),
      lag: Number(lag.toFixed(1)),
      still: closing,
    }
  } catch (error) {
    if (error instanceof TargetRefused && still) error.still = await still()
    throw error
  } finally {
    await browser.close()
    rmSync(scratch, { recursive: true, force: true })
  }
}

type Page = import('playwright-core').Page
type Mouse = import('playwright-core').Mouse

interface SpooledFrame {
  readonly path: string
  /** When the frame was presented, on the monotonic clock. */
  readonly stamp: number
}

/**
 * Writes the clip from the spool, one frame per slot of the stage clock, so its
 * length is the take's rather than whatever the frames span. Refuses when no
 * frame arrived, since there is nothing true to show.
 */
async function encodeSpool(
  spool: readonly SpooledFrame[],
  clip: string,
  startMs: number,
  lengthMs: number,
): Promise<void> {
  const slots = slotFrames(
    spool.map((frame) => frame.stamp),
    { startMs, lengthMs, frameMs: FRAME_MS },
  )
  if (slots.length === 0) {
    throw new Error(
      `the screencast delivered no frame in ${(lengthMs / 1000).toFixed(2)} s of filming`,
    )
  }
  const encoder = openFrameEncoder(clip, FPS)
  try {
    let shown = -1
    let jpeg = Buffer.alloc(0)
    for (const index of slots) {
      const frame = spool[index]
      if (frame && index !== shown) {
        jpeg = readFileSync(frame.path)
        shown = index
      }
      await encoder.write(jpeg)
    }
    await encoder.close()
  } catch (error) {
    encoder.abort()
    throw error
  }
}

/**
 * The page time of its next animation frame, or undefined when none comes
 * within `capMs`, as on a hidden page, or the page closed first.
 */
function nextFrame(page: Page, capMs: number): Promise<number | undefined> {
  return withinCap(
    page
      .evaluate(
        () => new Promise<number>((done) => requestAnimationFrame(done)),
      )
      .catch(() => undefined),
    capMs,
  )
}

/** Where the calibration's armed listener hands back the frame it painted in. */
const PAINTED = '__canonTakePainted'

/**
 * How long a move takes to show in the clip, measured by sending one aligned
 * move to `START` and reading the animation frame after its handler against
 * the frame it was aligned to. Both readings are page time, so no clock mapping
 * is needed. The screencast captures a frame once it is presented, one page
 * frame after that frame begins, so the lag counts one page frame past the
 * readings, read off two consecutive animation frames rather than assumed from
 * the clip's rate. That held a dragged box within 7 px on every run where the
 * readings alone left 10 to 15. Undefined when the page gives no frame to read,
 * and the pointer rests on `START` either way.
 */
async function calibrate(page: Page): Promise<number | undefined> {
  await page.mouse.move(START.x - 1, START.y)
  const interval = await withinCap(
    page
      .evaluate(
        () =>
          new Promise<number>((done) =>
            requestAnimationFrame((first) =>
              requestAnimationFrame((second) => done(second - first)),
            ),
          ),
      )
      .catch(() => undefined),
    2 * ALIGN_CAP_MS,
  )
  await page.evaluate((key) => {
    const slot = window as unknown as Record<string, unknown>
    slot[key] = new Promise<number>((done) => {
      addEventListener('pointermove', () => requestAnimationFrame(done), {
        once: true,
        capture: true,
      })
    })
  }, PAINTED)
  const aligned = await nextFrame(page, ALIGN_CAP_MS)
  await page.mouse.move(START.x, START.y)
  const painted = await withinCap(
    page
      .evaluate((key) => {
        const slot = window as unknown as Record<string, unknown>
        const armed = slot[key] as Promise<number>
        delete slot[key]
        return armed
      }, PAINTED)
      .catch(() => undefined),
    CALIBRATE_CAP_MS,
  )
  if (interval === undefined || aligned === undefined) return undefined
  if (painted === undefined) return undefined
  return Math.max(0, painted - aligned) + interval
}

/** An event moved `lag` later on the clip, with every point it sent. */
function shifted(event: LogEvent, lag: number): LogEvent {
  if (event.kind === 'move' && event.points) {
    return {
      ...event,
      t: event.t + lag,
      points: event.points.map((point) => ({ ...point, t: point.t + lag })),
    }
  }
  return { ...event, t: event.t + lag }
}

async function send(mouse: Mouse, input: PointerInput): Promise<void> {
  switch (input.type) {
    case 'move':
      return mouse.move(input.x, input.y)
    case 'down':
      return mouse.down({ clickCount: input.clickCount })
    case 'up':
      return mouse.up({ clickCount: input.clickCount })
    case 'wheel':
      return mouse.wheel(0, input.dy)
  }
}
