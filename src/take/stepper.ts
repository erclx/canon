import { openFrameEncoder } from '@/take/encode'
import { FULLSCREEN_SCRIPT } from '@/take/fullscreen'
import { describeKey, modifierBits } from '@/take/keys'
import { FPS, type LogEvent, startOf } from '@/take/log'
import {
  type KeyInput,
  type PointerInput,
  type Stage,
  TargetRefused,
  performSteps,
} from '@/take/perform'
import { NetworkTally, withHeld } from '@/take/network'
import type { Beat, Viewport } from '@/take/plan'
import { type ShellPage, openShell } from '@/take/shell'

/**
 * Films a beat by frame stepping on a virtual 60 fps clock, so every transition
 * and timer moves exactly one frame between screenshots, each at the device
 * scale times the viewport. Each ordering below, broken, deadlocks or freezes
 * a take: send an input, step a frame, then await it. Continue Chromium's
 * monotonic clock, or CSS animations stay at frame one. Begin no frame before
 * the load event. Keep ticks at or ahead of the page clock once virtual time
 * pauses, or transitions start in the future. Begin a frame only once the last
 * settles, and fall the beat back on a stall rather than hang.
 */

const FRAME_MS = 1000 / FPS

/** Budgets of 17, 17, and 16 ms average one 60 fps frame exactly. */
const BUDGETS = [17, 17, 16] as const

/** A frame slower than this means the page will not step, so the beat falls back. */
export const STALL_MS = 2000

/** The still the edit can cut on, before the beat's first action and after its last. */
export const HOLD_MS = 600

const LOAD_CAP_MS = 15_000
const SETTLE_MS = 2500

/** How long a refusal waits on the frame it shows, since the page may be wedged. */
const STILL_CAP_MS = 2000

/**
 * Where a stalled frame was begun: the settle after load, the beat's setup, or
 * the recorded frames.
 */
export type StallPhase = 'settle' | 'setup' | 'recording'

/** A frame that took longer than `STALL_MS`, so the beat is filmed another way. */
export class StepperStalled extends Error {
  constructor(
    readonly frame: number,
    stallMs: number,
    readonly phase: StallPhase,
  ) {
    super(
      `frame ${frame} took over ${stallMs / 1000} s in ${phase} under frame stepping`,
    )
  }
}

/**
 * The device scale a stalled beat tries stepping again at, or nothing when it
 * should go to the screencast. Only a stall in recording retries, since a page
 * that will not settle or set up will not step at any size, and only from
 * scale 2, since a retry at the scale that stalled stalls again.
 */
export function retryScale(
  phase: StallPhase,
  deviceScale: 1 | 2,
): 1 | undefined {
  return phase === 'recording' && deviceScale === 2 ? 1 : undefined
}

export interface SteppedTake {
  readonly frames: number
  readonly events: readonly LogEvent[]
  /** The last frame encoded, as the JPEG the shell returned. */
  readonly still: Buffer
  /** What the beat's network list caught, absent when it names none. */
  readonly network?: NetworkTally
}

export interface SteppedRequest {
  readonly executable: string
  readonly url: string
  readonly beat: Beat
  readonly clip: string
  /** The window the page opens at, in CSS pixels. */
  readonly viewport: Viewport
  /** How long one frame may take before the beat falls back, `STALL_MS` by default. */
  readonly stallMs?: number
  /** The multiple of the viewport each frame films at, 2 by default. */
  readonly deviceScale?: 1 | 2
}

export async function filmStepped(
  request: SteppedRequest,
): Promise<SteppedTake> {
  const { viewport } = request
  const start = startOf(viewport)
  const page = await openShell(request.executable, viewport, {
    scrollbars: request.beat.scrollbars,
    deviceScale: request.deviceScale,
  })
  const encoder = openFrameEncoder(request.clip, FPS)
  const stallMs = request.stallMs ?? STALL_MS
  let still: (() => Promise<Buffer | undefined>) | undefined
  const network = request.beat.network
    ? new NetworkTally(request.beat.network)
    : undefined
  try {
    if (network) await intercept(page, network)
    const loadTicks = await load(page, request.url).catch((error: unknown) => {
      throw network ? withHeld(error, network) : error
    })
    let ticks = loadTicks
    let outstanding: Promise<unknown> = Promise.resolve()
    const beginFrame = (screenshot: boolean) => {
      const reply = outstanding.then(() =>
        page.send<{ screenshotData?: string }>(
          'HeadlessExperimental.beginFrame',
          {
            frameTimeTicks: (ticks += FRAME_MS),
            interval: FRAME_MS,
            ...(screenshot
              ? { screenshot: { format: 'jpeg', quality: 95 } }
              : {}),
          },
        ),
      )
      outstanding = reply.catch(() => {})
      return reply
    }
    still = () => frameStill(beginFrame)
    await pump(beginFrame, SETTLE_MS, stallMs, 'settle')

    const live = liveStage(page, viewport, beginFrame, stallMs)
    await performSteps(live, request.beat.setup, { pointer: start })
    if (request.beat.setup.length > 0) await live.hold(1000)
    await live.pointer({ type: 'move', ...start })

    await page.send('Emulation.setVirtualTimePolicy', { policy: 'pause' })
    ticks = alignTicks({ ticks, loadTicks, ...(await readPageClock(page)) })

    const events: LogEvent[] = []
    let frames = 0
    let budget = 0
    let last: Buffer | undefined
    const expired: (() => void)[] = []
    page.on('Emulation.virtualTimeBudgetExpired', () => expired.shift()?.())

    const frame = async (): Promise<void> => {
      const advanced = new Promise<void>((done) => expired.push(done))
      // A plain advance, since pausing on pending fetches held the clock past
      // the stall limit, and a refused advance never expires its budget.
      page
        .send('Emulation.setVirtualTimePolicy', {
          policy: 'advance',
          budget: BUDGETS[budget++ % BUDGETS.length],
        })
        .catch(() => {})
      const reply = await withinStall(
        advanced.then(() => beginFrame(true)),
        frames,
        stallMs,
        'recording',
      )
      const data = reply.screenshotData
        ? Buffer.from(reply.screenshotData, 'base64')
        : last
      if (!data) throw new Error('the first frame carried no screenshot')
      last = data
      await encoder.write(data)
      frames += 1
    }

    const recording: Stage = {
      viewport,
      now: () => frames * FRAME_MS,
      hold: async (ms) => {
        for (let i = 0; i < Math.round(ms / FRAME_MS); i += 1) await frame()
      },
      pointer: (input) =>
        stepThen(
          page.send('Input.dispatchMouseEvent', mouseEvent(input)),
          frame,
        ),
      key: (text) => stepThen(page.send('Input.insertText', { text }), frame),
      press: (input) =>
        stepThen(page.send('Input.dispatchKeyEvent', keyEvent(input)), frame),
      evaluate: (expression) => page.evaluate(expression),
    }

    await recording.hold(HOLD_MS)
    await performSteps(recording, request.beat.steps, {
      pointer: start,
      log: events,
    })
    await recording.hold(HOLD_MS)

    await encoder.close()
    if (!last) throw new Error('the take encoded no frame')
    return { frames, events, still: last, ...(network ? { network } : {}) }
  } catch (error) {
    encoder.abort()
    if (error instanceof TargetRefused && still) error.still = await still()
    throw error
  } finally {
    page.close()
  }
}

/**
 * Begins one frame with a screenshot for a refusal to show, through the same
 * begin-frame call every kept frame uses, since a separate capture call can
 * wait on a frame that never begins. Best effort, so a page that answers with
 * nothing leaves the refusal standing without a still.
 */
async function frameStill(
  beginFrame: (screenshot: boolean) => Promise<{ screenshotData?: string }>,
): Promise<Buffer | undefined> {
  const reply = await withinCap(
    beginFrame(true).catch(() => undefined),
    STILL_CAP_MS,
  )
  return reply?.screenshotData
    ? Buffer.from(reply.screenshotData, 'base64')
    : undefined
}

/**
 * Pauses every request the page makes and answers each by the beat's list:
 * failed on `abort`, left paused for the shell's life on `hold`, and sent on
 * otherwise. Enabled before navigation, so a request made on load or in
 * setup is caught.
 */
async function intercept(
  page: ShellPage,
  network: NetworkTally,
): Promise<void> {
  page.on('Fetch.requestPaused', (params) => {
    const { requestId, request } = params as {
      requestId: string
      request: { url: string }
    }
    const action = network.actionFor(request.url)
    if (action === 'hold') return
    page
      .send(
        action === 'abort' ? 'Fetch.failRequest' : 'Fetch.continueRequest',
        action === 'abort'
          ? { requestId, errorReason: 'Failed' }
          : { requestId },
      )
      .catch(() => {})
  })
  await page.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] })
}

/**
 * Navigates and resolves with Chromium's monotonic clock in milliseconds, read
 * off the load event's own timestamp. The runtime's clock cannot stand in for
 * it: Node's `hrtime` shares the base on Linux, Bun's counts from its own
 * start, and a frame stamped on the wrong base freezes every animation.
 */
async function load(page: ShellPage, url: string): Promise<number> {
  await page.send('Page.addScriptToEvaluateOnNewDocument', {
    source: FULLSCREEN_SCRIPT,
  })
  const loaded = new Promise<number>((done) =>
    page.on('Page.loadEventFired', ({ timestamp }) => {
      if (typeof timestamp === 'number') done(timestamp * 1000)
    }),
  )
  const navigated = await page.send<{ errorText?: string }>('Page.navigate', {
    url,
  })
  if (navigated.errorText) {
    throw new Error(`${navigated.errorText} at ${url}`)
  }
  const timestamp = await withinCap(loaded, LOAD_CAP_MS)
  if (typeof timestamp !== 'number') {
    throw new Error(
      `${url} fired no load event within ${LOAD_CAP_MS / 1000} s, so no frame clock could be read`,
    )
  }
  return timestamp
}

export interface TickAlignment {
  readonly ticks: number
  /** The load event's monotonic time, which seeded the ticks. */
  readonly loadTicks: number
  /** The page's `performance.now()`, read after the pause. */
  readonly pageNow?: number
  /** The navigation entry's `loadEventStart`, the load event in the page's base. */
  readonly loadEventStart?: number
}

/**
 * The ticks the first recorded frame builds on, being the page clock carried
 * into the monotonic base plus one frame of margin, or the current ticks when
 * they already lead it or the page gave no usable timing. Never moves the
 * ticks backward.
 */
export function alignTicks(alignment: TickAlignment): number {
  const { ticks, loadTicks, pageNow, loadEventStart } = alignment
  if (
    pageNow === undefined ||
    loadEventStart === undefined ||
    !Number.isFinite(pageNow) ||
    !Number.isFinite(loadEventStart) ||
    loadEventStart <= 0
  ) {
    return ticks
  }
  return Math.max(ticks, loadTicks + (pageNow - loadEventStart) + FRAME_MS)
}

/**
 * Reads the page's clock beside the load event in the same base, since
 * `performance.now()` restarts at navigation and only `loadEventStart` pairs
 * it exactly with the load event's monotonic stamp. A read that fails or
 * returns no entry yields nothing, and the ticks stand.
 */
async function readPageClock(
  page: ShellPage,
): Promise<Pick<TickAlignment, 'pageNow' | 'loadEventStart'>> {
  const reading = await page
    .evaluate<unknown>(
      "[performance.now(), performance.getEntriesByType('navigation')[0]?.loadEventStart]",
    )
    .catch(() => undefined)
  if (!Array.isArray(reading)) return {}
  const [pageNow, loadEventStart] = reading
  return typeof pageNow === 'number' && typeof loadEventStart === 'number'
    ? { pageNow, loadEventStart }
    : {}
}

/**
 * Begins frames in real time so loading, fonts, and layout settle. Each frame
 * is awaited, so a slow page stretches the settle rather than overlapping it.
 */
async function pump(
  beginFrame: (screenshot: boolean) => Promise<unknown>,
  ms: number,
  stallMs: number,
  phase: StallPhase,
): Promise<void> {
  const end = Date.now() + ms
  while (Date.now() < end) {
    await withinStall(
      beginFrame(false).catch(() => {}),
      0,
      stallMs,
      phase,
    )
    await sleep(12)
  }
}

/**
 * The stage setup runs on, before virtual time is paused. Its frames are begun
 * without screenshots, since nothing before the first held frame is kept.
 */
function liveStage(
  page: ShellPage,
  viewport: Viewport,
  beginFrame: (screenshot: boolean) => Promise<unknown>,
  stallMs: number,
): Stage {
  const started = Date.now()
  return {
    viewport,
    now: () => Date.now() - started,
    hold: (ms) => pump(beginFrame, ms, stallMs, 'setup'),
    pointer: (input) => {
      const sent = page.send('Input.dispatchMouseEvent', mouseEvent(input))
      return withinStall(
        Promise.all([beginFrame(false), sent]),
        0,
        stallMs,
        'setup',
      ).then(() => {})
    },
    key: (text) => {
      const sent = page.send('Input.insertText', { text })
      return withinStall(
        Promise.all([beginFrame(false), sent]),
        0,
        stallMs,
        'setup',
      ).then(() => {})
    },
    press: (input) => {
      const sent = page.send('Input.dispatchKeyEvent', keyEvent(input))
      return withinStall(
        Promise.all([beginFrame(false), sent]),
        0,
        stallMs,
        'setup',
      ).then(() => {})
    },
    evaluate: (expression) => page.evaluate(expression),
  }
}

/**
 * A pointer input as CDP takes it. `buttons` carries the held button through a
 * drag's moves, or the page reads them as a hover, and is the bit field the
 * page reads, 1 for the left button and 2 for the right. `modifiers` carries
 * the held keys as a bit field beside the key events that pressed them.
 */
function mouseEvent(input: PointerInput): Record<string, unknown> {
  const at = { x: input.x, y: input.y }
  if (input.type === 'wheel') {
    return { type: 'mouseWheel', ...at, deltaX: 0, deltaY: input.dy }
  }
  const modifiers = modifierBits(input.modifiers ?? [])
  switch (input.type) {
    case 'move':
      return input.held
        ? { type: 'mouseMoved', ...at, button: 'left', buttons: 1, modifiers }
        : { type: 'mouseMoved', ...at, button: 'none', buttons: 0, modifiers }
    case 'down':
    case 'up': {
      const right = input.button === 'right'
      return {
        type: input.type === 'down' ? 'mousePressed' : 'mouseReleased',
        ...at,
        button: right ? 'right' : 'left',
        buttons: input.type === 'down' ? (right ? 2 : 1) : 0,
        clickCount: input.clickCount,
        modifiers,
      }
    }
  }
}

/**
 * A key input as CDP takes it. A key that types sends `keyDown` with its text
 * only when no modifier but Shift is held, as Chromium's own keyboard does, so
 * `Control+K` in a focused field inserts no K.
 */
function keyEvent(input: KeyInput): Record<string, unknown> {
  const descriptor = describeKey(input.key, {
    shift: input.modifiers.includes('Shift'),
  })
  if (!descriptor) throw new Error(`no key descriptor for ${input.key}`)
  const event = {
    key: descriptor.key,
    code: descriptor.code,
    windowsVirtualKeyCode: descriptor.keyCode,
    nativeVirtualKeyCode: descriptor.keyCode,
    location: descriptor.location,
    modifiers: modifierBits(input.modifiers),
  }
  if (input.type === 'up') return { type: 'keyUp', ...event }
  const types =
    descriptor.text !== undefined &&
    input.modifiers.every((modifier) => modifier === 'Shift')
  return types
    ? {
        type: 'keyDown',
        ...event,
        text: descriptor.text,
        unmodifiedText: descriptor.text,
      }
    : { type: 'rawKeyDown', ...event }
}

/**
 * Steps a frame, then awaits the input sent ahead of it. When the step fails,
 * the input is left settling against a shell about to close, so its rejection
 * is handled here rather than surfacing as an unhandled one.
 */
async function stepThen(
  sent: Promise<unknown>,
  step: () => Promise<void>,
): Promise<void> {
  try {
    await step()
  } catch (error) {
    sent.catch(() => {})
    throw error
  }
  await sent
}

async function withinStall<T>(
  work: Promise<T>,
  frame: number,
  stallMs: number,
  phase: StallPhase,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const stalled = new Promise<never>((_, fail) => {
    timer = setTimeout(
      () => fail(new StepperStalled(frame, stallMs, phase)),
      stallMs,
    )
  })
  // A stall leaves the work pending until the shell closes and rejects it.
  work.catch(() => {})
  try {
    return await Promise.race([work, stalled])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Races `work` against a cap and resolves empty when the cap wins. The timer
 * is cleared once the race settles, since a pending one keeps the process alive
 * for the whole cap after filming ends.
 */
export async function withinCap<T>(
  work: Promise<T>,
  ms: number,
): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const capped = new Promise<undefined>((done) => {
    timer = setTimeout(() => done(undefined), ms)
  })
  try {
    return await Promise.race([work, capped])
  } finally {
    clearTimeout(timer)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms))
}
