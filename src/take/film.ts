import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { isBrowserMissing, isServerUnreachable } from '@/browser/engine'
import { cameraTrack } from '@/take/camera'
import { FfmpegMissing, requireFfmpeg } from '@/take/encode'
import {
  FPS,
  LOG_VERSION,
  type LogEvent,
  type TakeLog,
  VIEWPORT,
} from '@/take/log'
import { TargetMissing } from '@/take/perform'
import type { Beat, Route, TakePlan } from '@/take/plan'
import { filmScreencast } from '@/take/screencast'
import { ShellMissing, findShell } from '@/take/shell'
import { StepperStalled, filmStepped } from '@/take/stepper'

/**
 * Films every beat of a plan into its own folder and writes the record the
 * edit reads. Each beat opens the page fresh, so a beat starts from the state
 * its setup reaches rather than wherever the last one left the page.
 */

export const TAKE_VERSION = 1

export type TakeRefusal =
  | 'ffmpeg-missing'
  | 'browser-missing'
  | 'server-unreachable'
  | 'target-missing'
  | 'take-failed'

export interface FilmedBeat {
  readonly name: string
  /** The beat's folder, relative to the take's. */
  readonly dir: string
  readonly requested: Route
  readonly route: Route
  /** Why a `step` beat was filmed by screencast instead, when it was. */
  readonly fallback?: string
  readonly frames: number
  readonly seconds: number
  readonly clip: string
  readonly log: string
  readonly camera: string
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
    }

export interface TakeRequest {
  readonly url: string
  readonly plan: TakePlan
  readonly out: string
  readonly env?: NodeJS.ProcessEnv
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

  // Probes the origin rather than the address, since an address can carry a
  // single-use ticket that a probe would spend before the browser opens it.
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
      beats.push(await filmBeat(request.url, beat, out, dir, executable))
    } catch (error) {
      return failed(classify(error), error, beat.name)
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
): Promise<FilmedBeat> {
  const clip = join(dir, 'clip.mp4')
  const target = join(out, clip)

  let route: Route = beat.route
  let fallback: string | undefined
  let filmed: { frames: number; events: readonly LogEvent[] }
  if (beat.route === 'step') {
    try {
      filmed = await filmStepped({ executable, url, beat, clip: target })
    } catch (error) {
      if (!(error instanceof StepperStalled)) throw error
      route = 'screencast'
      fallback = error.message
      filmed = await filmScreencast({ url, beat, clip: target })
    }
  } else {
    filmed = await filmScreencast({ url, beat, clip: target })
  }

  const log: TakeLog = {
    version: LOG_VERSION,
    viewport: VIEWPORT,
    fps: FPS,
    route,
    frames: filmed.frames,
    events: filmed.events,
  }
  const logPath = join(dir, 'log.json')
  writeFileSync(join(out, logPath), `${JSON.stringify(log, null, 2)}\n`)
  // One line, since it carries a row per frame and nobody reads it by eye.
  const cameraPath = join(dir, 'camera.json')
  writeFileSync(join(out, cameraPath), `${JSON.stringify(cameraTrack(log))}\n`)

  return {
    name: beat.name,
    dir,
    requested: beat.route,
    route,
    ...(fallback ? { fallback } : {}),
    frames: filmed.frames,
    seconds: Number((filmed.frames / FPS).toFixed(2)),
    clip,
    log: logPath,
    camera: cameraPath,
  }
}

function classify(error: unknown): TakeRefusal {
  if (error instanceof TargetMissing) return 'target-missing'
  if (error instanceof ShellMissing || isBrowserMissing(error)) {
    return 'browser-missing'
  }
  if (isServerUnreachable(error)) return 'server-unreachable'
  return 'take-failed'
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
