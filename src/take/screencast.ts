import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { chromium } from 'playwright-core'
import { SANDBOXED } from '@/browser/engine'
import { lastFrame, openFrameEncoder, probeFrames } from '@/take/encode'
import { frameStamp, slotFrames } from '@/take/frame-clock'
import { FULLSCREEN_SCRIPT } from '@/take/fullscreen'
import { FPS, type LogEvent, type Point, startOf } from '@/take/log'
import { NetworkTally, withHeld } from '@/take/network'
import {
  type PointerInput,
  type Stage,
  TargetRefused,
  performSteps,
} from '@/take/perform'
import type { Beat, Viewport } from '@/take/plan'
import { HOLD_MS, withinCap } from '@/take/stepper'

/**
 * Films a beat in real time through Playwright's screencast, for a page frame
 * stepping cannot drive. It films the window one to one, so it goes soft under a
 * zoom, and its frames land when the page paints rather than one per step.
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
  /** What the beat's network list caught, absent when it names none. */
  readonly network?: NetworkTally
}

export async function filmScreencast(request: {
  readonly url: string
  readonly beat: Beat
  readonly clip: string
  /** The window the page opens at, which the clip films at one to one. */
  readonly viewport: Viewport
}): Promise<ScreencastTake> {
  const { viewport } = request
  const start = startOf(viewport)
  // Ahead of the launch, so a folder that refuses leaves no browser holding the process open.
  const scratch = openSpool(request.clip)
  const browser = await chromium
    .launch({
      ...SANDBOXED,
      ...(request.beat.scrollbars
        ? { ignoreDefaultArgs: ['--hide-scrollbars'] }
        : {}),
    })
    .catch((error: unknown) => {
      scratch.remove()
      throw error
    })
  let still: (() => Promise<Buffer | undefined>) | undefined
  try {
    const page = await browser.newPage({ viewport })
    // Best effort, so a closed or crashed page leaves the refusal standing without a still.
    still = () =>
      page
        .screenshot({ type: 'jpeg', quality: 95, timeout: STILL_CAP_MS })
        .catch(() => undefined)
    await page.addInitScript({ content: FULLSCREEN_SCRIPT })
    const network = request.beat.network
      ? new NetworkTally(request.beat.network)
      : undefined
    // Every request is routed, since `network` does the matching, and a held route stays pending until close.
    if (network) {
      await page.route(
        () => true,
        (route) => {
          const action = network.actionFor(route.request().url())
          if (action === 'hold') return
          return action === 'abort' ? route.abort('failed') : route.continue()
        },
      )
    }
    await page
      .goto(request.url, { waitUntil: 'load' })
      .catch((error: unknown) => {
        throw network ? withHeld(error, network) : error
      })
    await page.waitForTimeout(SETTLE_MS)

    const stageOn = (clock: () => number): Stage => ({
      viewport,
      now: clock,
      hold: (ms) => page.waitForTimeout(ms),
      align: () => nextFrame(page, ALIGN_CAP_MS).then(() => undefined),
      pointer: async (input) => {
        // A move waited on its frame already, so padding it would land the next one a frame late.
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
      // Playwright's mouse reads the modifiers its keyboard holds, so a press is all a modified click needs.
      press: async (input) => {
        if (input.type === 'down') await page.keyboard.down(input.key)
        else await page.keyboard.up(input.key)
        await page.waitForTimeout(FRAME_MS)
      },
      evaluate: (expression) => page.evaluate(expression),
    })

    const live = stageOn(() => performance.now())
    await performSteps(live, request.beat.setup, { pointer: start })
    if (request.beat.setup.length > 0) await live.hold(1000)
    const lag = await calibrate(page, start)

    const events: LogEvent[] = []
    const spool: SpooledFrame[] = []
    let spoolFailure: unknown
    await page.screencast.start({
      size: viewport,
      // The docs tie this to `path`, but 1.64.1 still reads it here, doubling the frames Chromium may hold unacknowledged.
      fps: FPS,
      // Spooled and synchronous, so Chromium's frame pacing waits on no encoder. A throw here goes unawaited.
      onFrame: ({ data, timestamp }) => {
        const stamp = frameStamp({
          presentedWall: timestamp,
          wallNow: Date.now(),
          monoNow: performance.now(),
        })
        const path = join(scratch.folder, `${spool.length}.jpg`)
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
      pointer: start,
      log: events,
    })
    await recording.hold(HOLD_MS)
    const filmedMs = recording.now()
    await page.screencast.stop()
    if (spoolFailure !== undefined) throw spoolFailure

    await encodeSpool(spool, request.clip, started, filmedMs)
    const frames = await probeFrames(request.clip)
    const closing = await lastFrame(request.clip, frames)
    const caught = network ? { network } : {}
    if (lag === undefined) return { frames, events, still: closing, ...caught }
    return {
      frames,
      events: events.map((event) => shifted(event, lag)),
      lag: Number(lag.toFixed(1)),
      still: closing,
      ...caught,
    }
  } catch (error) {
    if (error instanceof TargetRefused && still) error.still = await still()
    throw error
  } finally {
    await browser.close()
    scratch.remove()
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
 * Opens the folder holding one take's frames beside its clip, not in a temp
 * folder nothing sweeps, since a 34 s beat on a busy page spools about 650 MB. A
 * take killed outright leaves it where its owner looks, and the next take clears it.
 */
function openSpool(clip: string): { folder: string; remove: () => void } {
  const folder = join(dirname(clip), 'spool')
  rmSync(folder, { recursive: true, force: true })
  mkdirSync(folder, { recursive: true })
  const remove = (): void => {
    process.off('exit', remove)
    process.off('SIGINT', interrupt)
    process.off('SIGTERM', interrupt)
    rmSync(folder, { recursive: true, force: true })
  }
  // A signal skips the exit event, so it removes the folder and re-raises itself with this handler gone.
  const interrupt = (signal: NodeJS.Signals): void => {
    remove()
    process.kill(process.pid, signal)
  }
  process.on('exit', remove)
  process.once('SIGINT', interrupt)
  process.once('SIGTERM', interrupt)
  return { folder, remove }
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
 * How long a move takes to show in the clip, measured by sending one aligned move
 * to the window's center and reading the animation frame after its handler. The
 * lag counts one page frame past the readings. Undefined when no frame is read.
 */
async function calibrate(
  page: Page,
  start: Point,
): Promise<number | undefined> {
  await page.mouse.move(start.x - 1, start.y)
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
  await page.mouse.move(start.x, start.y)
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
      return mouse.down(pressOf(input))
    case 'up':
      return mouse.up(pressOf(input))
    case 'wheel':
      return mouse.wheel(0, input.dy)
  }
}

function pressOf(
  input: Extract<PointerInput, { readonly type: 'down' | 'up' }>,
): { clickCount: number; button?: 'right' } {
  return input.button
    ? { clickCount: input.clickCount, button: input.button }
    : { clickCount: input.clickCount }
}
