import { openFrameEncoder } from '@/take/encode'
import { describeKey, modifierBits } from '@/take/keys'
import { FPS, type LogEvent, START, VIEWPORT } from '@/take/log'
import {
  type KeyInput,
  type PointerInput,
  type Stage,
  TargetMissing,
  performSteps,
} from '@/take/perform'
import type { Beat } from '@/take/plan'
import { type ShellPage, openShell } from '@/take/shell'

/**
 * Films a beat by frame stepping. The page's clock is virtual and advances one
 * 60 fps frame per step, so every transition, animation, and timer moves
 * exactly one frame between screenshots however long a frame takes to render,
 * and each screenshot comes back at twice the viewport, 3840x2160.
 *
 * Three orderings hold a take together, and each one broken deadlocks or
 * freezes it rather than failing loudly:
 *
 * - An input is sent, a frame is stepped, and only then is the input awaited,
 *   since under begin-frame control an input is acknowledged by a frame
 * - Frame time continues Chromium's monotonic clock, since a frame stamped on
 *   any other base leaves every CSS animation at its first frame
 * - No frame is begun before the load event, since one sent mid-navigation can
 *   go unanswered, and each loading frame is capped so a lost one cannot hang
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
const LOADING_FRAME_CAP_MS = 250

/** How long a refusal waits on the frame it shows, since the page may be wedged. */
const STILL_CAP_MS = 2000

/** A frame that took longer than `STALL_MS`, so the beat is filmed another way. */
export class StepperStalled extends Error {
  constructor(
    readonly frame: number,
    stallMs: number,
  ) {
    super(`frame ${frame} took over ${stallMs / 1000} s under frame stepping`)
  }
}

export interface SteppedTake {
  readonly frames: number
  readonly events: readonly LogEvent[]
  /** The last frame encoded, as the JPEG the shell returned. */
  readonly still: Buffer
}

export interface SteppedRequest {
  readonly executable: string
  readonly url: string
  readonly beat: Beat
  readonly clip: string
  /** How long one frame may take before the beat falls back, `STALL_MS` by default. */
  readonly stallMs?: number
}

export async function filmStepped(
  request: SteppedRequest,
): Promise<SteppedTake> {
  const page = await openShell(request.executable, VIEWPORT)
  const encoder = openFrameEncoder(request.clip, FPS)
  const stallMs = request.stallMs ?? STALL_MS
  let still: (() => Promise<Buffer | undefined>) | undefined
  try {
    let ticks = await load(page, request.url)
    const beginFrame = (screenshot: boolean) =>
      page.send<{ screenshotData?: string }>(
        'HeadlessExperimental.beginFrame',
        {
          frameTimeTicks: (ticks += FRAME_MS),
          interval: FRAME_MS,
          ...(screenshot
            ? { screenshot: { format: 'jpeg', quality: 95 } }
            : {}),
        },
      )
    still = () => frameStill(beginFrame)
    await pump(beginFrame, SETTLE_MS)

    const live = liveStage(page, beginFrame, stallMs)
    await performSteps(live, request.beat.setup, { pointer: START })
    if (request.beat.setup.length > 0) await live.hold(1000)
    await live.pointer({ type: 'move', ...START })

    await page.send('Emulation.setVirtualTimePolicy', { policy: 'pause' })

    const events: LogEvent[] = []
    let frames = 0
    let budget = 0
    let last: Buffer | undefined
    const expired: (() => void)[] = []
    page.on('Emulation.virtualTimeBudgetExpired', () => expired.shift()?.())

    const frame = async (): Promise<void> => {
      const advanced = new Promise<void>((done) => expired.push(done))
      // Plain advance rather than pausing on pending fetches, which held the
      // clock through every page switch that loads its view, past the stall
      // limit. A refused advance never expires its budget, which the stall
      // reports.
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
      pointer: START,
      log: events,
    })
    await recording.hold(HOLD_MS)

    await encoder.close()
    if (!last) throw new Error('the take encoded no frame')
    return { frames, events, still: last }
  } catch (error) {
    encoder.abort()
    if (error instanceof TargetMissing && still) error.still = await still()
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
  const reply = await Promise.race([
    beginFrame(true).catch(() => undefined),
    sleep(STILL_CAP_MS),
  ])
  return reply?.screenshotData
    ? Buffer.from(reply.screenshotData, 'base64')
    : undefined
}

/**
 * Navigates and resolves with Chromium's monotonic clock in milliseconds, read
 * off the load event's own timestamp. The runtime's clock cannot stand in for
 * it: Node's `hrtime` shares the base on Linux, Bun's counts from its own
 * start, and a frame stamped on the wrong base freezes every animation.
 */
async function load(page: ShellPage, url: string): Promise<number> {
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
  const timestamp = await Promise.race([loaded, sleep(LOAD_CAP_MS)])
  if (typeof timestamp !== 'number') {
    throw new Error(
      `${url} fired no load event within ${LOAD_CAP_MS / 1000} s, so no frame clock could be read`,
    )
  }
  return timestamp
}

/** Begins frames in real time so loading, fonts, and layout settle. */
async function pump(
  beginFrame: (screenshot: boolean) => Promise<unknown>,
  ms: number,
): Promise<void> {
  const end = Date.now() + ms
  while (Date.now() < end) {
    await Promise.race([
      beginFrame(false).catch(() => {}),
      sleep(LOADING_FRAME_CAP_MS),
    ])
    await sleep(12)
  }
}

/**
 * The stage setup runs on, before virtual time is paused. Its frames are begun
 * without screenshots, since nothing before the first held frame is kept.
 */
function liveStage(
  page: ShellPage,
  beginFrame: (screenshot: boolean) => Promise<unknown>,
  stallMs: number,
): Stage {
  const started = Date.now()
  return {
    now: () => Date.now() - started,
    hold: (ms) => pump(beginFrame, ms),
    pointer: (input) => {
      const sent = page.send('Input.dispatchMouseEvent', mouseEvent(input))
      return withinStall(
        Promise.all([beginFrame(false), sent]),
        0,
        stallMs,
      ).then(() => {})
    },
    key: (text) => {
      const sent = page.send('Input.insertText', { text })
      return withinStall(
        Promise.all([beginFrame(false), sent]),
        0,
        stallMs,
      ).then(() => {})
    },
    press: (input) => {
      const sent = page.send('Input.dispatchKeyEvent', keyEvent(input))
      return withinStall(
        Promise.all([beginFrame(false), sent]),
        0,
        stallMs,
      ).then(() => {})
    },
    evaluate: (expression) => page.evaluate(expression),
  }
}

/**
 * A pointer input as CDP takes it. `buttons` carries the held button through a
 * drag's moves, or the page reads them as a hover, and `modifiers` carries the
 * held keys as a bit field beside the key events that pressed them.
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
    case 'up':
      return {
        type: input.type === 'down' ? 'mousePressed' : 'mouseReleased',
        ...at,
        button: 'left',
        buttons: input.type === 'down' ? 1 : 0,
        clickCount: input.clickCount,
        modifiers,
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
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const stalled = new Promise<never>((_, fail) => {
    timer = setTimeout(() => fail(new StepperStalled(frame, stallMs)), stallMs)
  })
  // A stall leaves the work pending until the shell closes and rejects it.
  work.catch(() => {})
  try {
    return await Promise.race([work, stalled])
  } finally {
    clearTimeout(timer)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms))
}
