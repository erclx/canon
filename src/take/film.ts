import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  isBrowserMissing,
  isSandboxBlocked,
  isServerUnreachable,
  launchSandboxFix,
} from '@/browser/engine'
import { cameraTrack } from '@/take/camera'
import { FfmpegMissing, probeSize, requireFfmpeg } from '@/take/encode'
import {
  FPS,
  clipMismatch,
  LOG_VERSION,
  type LogEvent,
  type TakeLog,
  clipSize,
} from '@/take/log'
import {
  type NetworkMatch,
  type NetworkTally,
  NetworkUnmatched,
} from '@/take/network'
import {
  TargetCovered,
  TargetMissing,
  TargetOffscreen,
  TargetRefused,
} from '@/take/perform'
import {
  type Beat,
  type Route,
  type TakePlan,
  type Viewport,
  beatViewport,
} from '@/take/plan'
import { filmScreencast } from '@/take/screencast'
import { ShellMissing, ShellSandboxBlocked, findShell } from '@/take/shell'
import {
  type StallPhase,
  StepperStalled,
  filmStepped,
  retryScale,
} from '@/take/stepper'

/**
 * Films every beat of a plan into its own folder and writes the record the
 * edit reads. Each beat opens the page fresh, so a beat starts from the state
 * its setup reaches rather than wherever the last one left the page.
 */

export const TAKE_VERSION = 1

export type TakeRefusal =
  | 'ffmpeg-missing'
  | 'browser-missing'
  | 'sandbox-blocked'
  | 'server-unreachable'
  | 'target-missing'
  | 'target-offscreen'
  | 'target-covered'
  | 'over-cap'
  | 'clip-mismatch'
  | 'network-unmatched'
  | 'take-failed'

export interface FilmedBeat {
  readonly name: string
  /** The beat's folder, relative to the take's. */
  readonly dir: string
  readonly requested: Route
  readonly route: Route
  /** Why a `step` beat was filmed by screencast instead, when it was. */
  readonly fallback?: string
  /** Where the stepped frame that caused `fallback` was begun. */
  readonly fallbackPhase?: StallPhase
  /**
   * The device scale a stepped clip filmed at, present only when it differs
   * from the scale asked for, being a retry after a stall in recording.
   */
  readonly scale?: 1 | 2
  readonly frames: number
  readonly seconds: number
  readonly clip: string
  readonly log: string
  readonly camera: string
  /** The clip's closing frame, as a JPEG. */
  readonly still: string
  /**
   * Each network pattern with how many requests it caught, absent when the
   * beat names no list. Never an address, which can carry a ticket.
   */
  readonly network?: readonly NetworkMatch[]
}

export type TakeResult =
  | {
      readonly status: 'filmed'
      readonly out: string
      readonly beats: readonly FilmedBeat[]
      readonly durationMs: number
    }
  | {
      readonly status: 'failed'
      readonly reason: TakeRefusal
      readonly message: string
      readonly beat?: string
      /** Why the refused beat had fallen back to a screencast, when it had. */
      readonly fallback?: string
      /** Where the stepped frame that caused `fallback` was begun. */
      readonly fallbackPhase?: StallPhase
      /**
       * The device scale the refused beat was retried at after a stall in
       * recording, when it was. The retry opened the address again.
       */
      readonly scale?: 1 | 2
      /** The page as the failing step met it, relative to the take's folder. */
      readonly still?: string
      /** The command that clears a `sandbox-blocked` refusal, when one does. */
      readonly fix?: string
    }

export interface TakeRequest {
  readonly url: string
  readonly plan: TakePlan
  readonly out: string
  readonly env?: NodeJS.ProcessEnv
  /** How long one stepped frame may take before its beat falls back to a screencast. */
  readonly stallMs?: number
  /** The filmed seconds the beats may sum to, past which the take refuses. */
  readonly maxSeconds?: number
  /**
   * How many times the viewport a stepped clip films at, 2 by default. Scale 1
   * halves each side and is for a take whose reader never looks at the extra
   * pixels. A screencast beat films at the viewport either way.
   */
  readonly deviceScale?: 1 | 2
  /**
   * The window every beat carrying no `viewport` of its own films in, 1920x1080
   * by default. The caller checks it against the bounds `parseViewport` holds.
   */
  readonly viewport?: Viewport
}

const REACH_TIMEOUT_MS = 5000

export async function take(request: TakeRequest): Promise<TakeResult> {
  const started = Date.now()
  const out = resolve(request.out)

  try {
    await requireFfmpeg()
  } catch (error) {
    if (error instanceof FfmpegMissing) return failed('ffmpeg-missing', error)
    throw error
  }

  let executable = ''
  if (request.plan.beats.some((beat) => beat.route === 'step')) {
    try {
      executable = findShell(request.env)
    } catch (error) {
      if (error instanceof ShellMissing) return failed('browser-missing', error)
      throw error
    }
  }

  // Probes the origin, since a probe of the address spends a one-use ticket.
  try {
    await fetch(new URL(request.url).origin, {
      signal: AbortSignal.timeout(REACH_TIMEOUT_MS),
    })
  } catch (error) {
    return failed('server-unreachable', error)
  }

  mkdirSync(out, { recursive: true })
  const beats: FilmedBeat[] = []
  for (const [index, beat] of request.plan.beats.entries()) {
    const dir = `${String(index + 1).padStart(2, '0')}-${slug(beat.name)}`
    mkdirSync(join(out, dir), { recursive: true })
    try {
      beats.push(
        await filmBeat(
          request.url,
          beat,
          out,
          dir,
          executable,
          request.stallMs,
          request.deviceScale ?? 2,
          beatViewport(beat, request.viewport),
        ),
      )
    } catch (error) {
      const cause =
        error instanceof FellBack || error instanceof Retried
          ? error.error
          : error
      const shot = cause instanceof TargetRefused ? cause.still : undefined
      const still =
        shot ||
        cause instanceof ClipMismatch ||
        cause instanceof NetworkUnmatched
          ? join(dir, 'still.jpg')
          : undefined
      if (shot && still) writeFileSync(join(out, still), shot)
      const fix = sandboxFixFor(cause)
      return {
        ...failed(classify(cause), cause, beat.name),
        ...(error instanceof FellBack
          ? { fallback: error.fallback, fallbackPhase: error.phase }
          : {}),
        ...(error instanceof Retried ? { scale: error.scale } : {}),
        ...(still ? { still } : {}),
        ...(fix ? { fix } : {}),
      }
    }
    // Checked per beat, so a take refused on its first films nothing past it.
    const frames = beats.reduce((sum, filmed) => sum + filmed.frames, 0)
    if (request.maxSeconds !== undefined && frames > request.maxSeconds * FPS) {
      return failed(
        'over-cap',
        `the beats through ${beat.name} run ${(frames / FPS).toFixed(2)} s, past the ${request.maxSeconds} s cap`,
        beat.name,
      )
    }
  }

  writeFileSync(
    join(out, 'take.json'),
    `${JSON.stringify({ version: TAKE_VERSION, url: request.url, beats }, null, 2)}\n`,
  )
  return { status: 'filmed', out, beats, durationMs: Date.now() - started }
}

async function filmBeat(
  url: string,
  beat: Beat,
  out: string,
  dir: string,
  executable: string,
  stallMs: number | undefined,
  deviceScale: 1 | 2,
  viewport: Viewport,
): Promise<FilmedBeat> {
  const clip = join(dir, 'clip.mp4')
  const target = join(out, clip)

  const { filmed, route, fallback, scale } =
    beat.route === 'step'
      ? await filmStep(
          url,
          beat,
          target,
          executable,
          stallMs,
          deviceScale,
          viewport,
        )
      : {
          filmed: await filmScreencast({ url, beat, clip: target, viewport }),
          route: beat.route,
        }

  const expected = clipSize(route, viewport, scale ?? deviceScale)
  const measured = await probeSize(target)
  const log: TakeLog = {
    version: LOG_VERSION,
    viewport,
    fps: FPS,
    route,
    clip: measured,
    ...(beat.push === false ? { push: false as const } : {}),
    ...(filmed.lag === undefined ? {} : { lag: filmed.lag }),
    frames: filmed.frames,
    events: filmed.events,
  }
  const logPath = join(dir, 'log.json')
  writeFileSync(join(out, logPath), `${JSON.stringify(log, null, 2)}\n`)
  // One line, since it carries a row per frame and nobody reads it by eye.
  const cameraPath = join(dir, 'camera.json')
  writeFileSync(join(out, cameraPath), `${JSON.stringify(cameraTrack(log))}\n`)
  const stillPath = join(dir, 'still.jpg')
  writeFileSync(join(out, stillPath), filmed.still)

  // Thrown once the files are written, so a reader can open what was filmed.
  const mismatch = clipMismatch(expected, measured)
  const unmatched = filmed.network?.unmatched() ?? []
  const refusal = mismatch
    ? new ClipMismatch(mismatch)
    : unmatched.length > 0
      ? new NetworkUnmatched(unmatched)
      : undefined
  if (refusal) {
    if (fallback) throw new FellBack(refusal, fallback.message, fallback.phase)
    throw scale ? new Retried(refusal, scale) : refusal
  }

  return {
    name: beat.name,
    dir,
    requested: beat.route,
    route,
    ...(fallback
      ? { fallback: fallback.message, fallbackPhase: fallback.phase }
      : {}),
    ...(scale ? { scale } : {}),
    frames: filmed.frames,
    seconds: Number((filmed.frames / FPS).toFixed(2)),
    clip,
    log: logPath,
    camera: cameraPath,
    still: stillPath,
    ...(filmed.network ? { network: filmed.network.matched() } : {}),
  }
}

interface FilmedRoute {
  readonly filmed: {
    readonly frames: number
    readonly events: readonly LogEvent[]
    readonly lag?: number
    readonly still: Buffer
    readonly network?: NetworkTally
  }
  readonly route: Route
  readonly fallback?: { readonly message: string; readonly phase: StallPhase }
  /** The scale a retry filmed at, when it differs from the one asked for. */
  readonly scale?: 1 | 2
}

/**
 * Films a `step` beat stepped at the scale asked for, then once more at the
 * scale `retryScale` names after a stall in recording, then by screencast.
 * Each try opens the address again, so a refusal after one names it.
 */
async function filmStep(
  url: string,
  beat: Beat,
  clip: string,
  executable: string,
  stallMs: number | undefined,
  deviceScale: 1 | 2,
  viewport: Viewport,
): Promise<FilmedRoute> {
  const stepped = (scale: 1 | 2) =>
    filmStepped({
      executable,
      url,
      beat,
      clip,
      viewport,
      stallMs,
      deviceScale: scale,
    })
  let stall: StepperStalled
  try {
    return { filmed: await stepped(deviceScale), route: 'step' }
  } catch (error) {
    if (!(error instanceof StepperStalled)) throw error
    stall = error
  }

  const retry = retryScale(stall.phase, deviceScale)
  let message = stall.message
  if (retry) {
    try {
      return { filmed: await stepped(retry), route: 'step', scale: retry }
    } catch (error) {
      if (!(error instanceof StepperStalled)) throw new Retried(error, retry)
      stall = error
      message = `${error.message} on a retry at device scale ${retry}`
    }
  }

  const fallback = { message, phase: stall.phase }
  try {
    return {
      filmed: await filmScreencast({ url, beat, clip, viewport }),
      route: 'screencast',
      fallback,
    }
  } catch (cause) {
    throw new FellBack(cause, fallback.message, fallback.phase)
  }
}

/**
 * A beat that failed in the stepped retry after a stall in recording, carrying
 * the scale it retried at, since the retry loads the page a second time and a
 * single-use link is spent by then.
 */
class Retried extends Error {
  constructor(
    readonly error: unknown,
    readonly scale: 1 | 2,
  ) {
    super(error instanceof Error ? error.message : String(error))
  }
}

/**
 * A beat that failed in the screencast it fell back to, carrying why it fell
 * back, since the fallback loads the page a second time and a single-use link
 * is spent by then.
 */
class FellBack extends Error {
  constructor(
    readonly error: unknown,
    readonly fallback: string,
    readonly phase: StallPhase,
  ) {
    super(error instanceof Error ? error.message : String(error))
  }
}

/** A clip that measured a different size from the one its route films at. */
class ClipMismatch extends Error {}

function classify(error: unknown): TakeRefusal {
  if (error instanceof ClipMismatch) return 'clip-mismatch'
  if (error instanceof NetworkUnmatched) return 'network-unmatched'
  if (error instanceof TargetMissing) return 'target-missing'
  if (error instanceof TargetOffscreen) return 'target-offscreen'
  if (error instanceof TargetCovered) return 'target-covered'
  if (error instanceof ShellMissing || isBrowserMissing(error)) {
    return 'browser-missing'
  }
  if (error instanceof ShellSandboxBlocked || isSandboxBlocked(error)) {
    return 'sandbox-blocked'
  }
  if (isServerUnreachable(error)) return 'server-unreachable'
  return 'take-failed'
}

/**
 * The shell read the setting when it refused, and a screencast's Playwright
 * launch did not, so that route reads it here.
 */
function sandboxFixFor(error: unknown): string | undefined {
  if (error instanceof ShellSandboxBlocked) return error.fix
  return isSandboxBlocked(error) ? launchSandboxFix() : undefined
}

function failed(
  reason: TakeRefusal,
  error: unknown,
  beat?: string,
): TakeResult {
  return {
    status: 'failed',
    reason,
    message: error instanceof Error ? error.message : String(error),
    ...(beat ? { beat } : {}),
  }
}

function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'beat'
  )
}
