import { ROUTES, type Route } from '@/take/plan'

/**
 * The click log a take writes beside its clip, and the pointer path both
 * capture routes move along and the camera reads back. Every coordinate is in
 * CSS pixels of the page, and every time is in milliseconds on the clip's own
 * clock, so frame `n` sits at `n * 1000 / FPS` whatever route filmed it.
 *
 * The path lives here rather than in a capture route because the edit draws the
 * cursor from this log, so the route moving the real pointer and the reader
 * redrawing it have to agree on one curve.
 */

export const LOG_VERSION = 1

export const FPS = 60

/** The page a take films, in CSS pixels. The stepper renders it at twice this. */
export const VIEWPORT = { width: 1920, height: 1080 } as const

export interface Point {
  readonly x: number
  readonly y: number
}

export interface Box {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export type LogEvent =
  | {
      readonly t: number
      readonly kind: 'move'
      readonly from: Point
      readonly to: Point
      readonly ms: number
    }
  | {
      readonly t: number
      readonly kind: 'click'
      readonly at: Point
      readonly box: Box
    }
  | {
      readonly t: number
      readonly kind: 'type'
      readonly at: Point
      readonly box: Box
      readonly chars: number
      /** From the first key to the last, so the camera holds for the burst. */
      readonly ms: number
    }
  | {
      readonly t: number
      readonly kind: 'scroll'
      readonly at: Point
      readonly dx: number
      readonly dy: number
      readonly ms: number
    }

export interface TakeLog {
  readonly version: typeof LOG_VERSION
  readonly viewport: { readonly width: number; readonly height: number }
  readonly fps: number
  /** The route that filmed the clip, which can differ from the one asked for. */
  readonly route: Route
  /**
   * The clip's size in pixels, which sets how deep the camera may zoom before
   * the clip goes soft. A log written before this field read it off `route`.
   */
  readonly clip?: { readonly width: number; readonly height: number }
  /** False when the beat turned the camera's zoom off. */
  readonly push?: false
  readonly frames: number
  readonly events: readonly LogEvent[]
}

/** The size each route films at, the stepper at twice the viewport. */
export const CLIP_SIZES: Record<
  Route,
  { readonly width: number; readonly height: number }
> = {
  step: { width: VIEWPORT.width * 2, height: VIEWPORT.height * 2 },
  screencast: VIEWPORT,
}

export type TakeLogRead =
  | { readonly kind: 'read'; readonly log: TakeLog }
  | { readonly kind: 'refused'; readonly detail: string }

/**
 * Reads a log back off disk, checking the fields the camera builds on rather
 * than every event, since a take wrote the events and a reader only ever
 * points at the wrong file.
 */
export function readTakeLog(source: string): TakeLogRead {
  let document: unknown
  try {
    document = JSON.parse(source)
  } catch (error) {
    return {
      kind: 'refused',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
  if (typeof document !== 'object' || document === null) {
    return { kind: 'refused', detail: 'the document is not an object' }
  }
  const log = document as Partial<Record<keyof TakeLog, unknown>>
  const missing = [
    isSize(log.viewport) ? '' : 'viewport',
    isCount(log.fps) && log.fps > 0 ? '' : 'fps',
    ROUTES.includes(log.route as Route) ? '' : 'route',
    isCount(log.frames) ? '' : 'frames',
    Array.isArray(log.events) ? '' : 'events',
  ].filter(Boolean)
  if (missing.length > 0) {
    return {
      kind: 'refused',
      detail: `the document carries no valid ${missing.join(', ')}, so it is not a take's log.json`,
    }
  }
  return { kind: 'read', log: document as TakeLog }
}

function isCount(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0
}

function isSize(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const { width, height } = value as Record<string, unknown>
  return isCount(width) && isCount(height)
}

/** Where the pointer rests before a take's first move. */
export const START: Point = { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 }

/**
 * How long the pointer takes to travel, slower for longer reaches and never so
 * quick that a viewer loses it. Carried over from the groundwork takes the
 * camera presets were judged on.
 */
export function travelMs(from: Point, to: Point): number {
  return Math.min(
    1200,
    Math.max(300, Math.hypot(to.x - from.x, to.y - from.y) * 0.9),
  )
}

export function easeInOutCubic(t: number): number {
  const x = Math.max(0, Math.min(1, t))
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2
}

export function along(from: Point, to: Point, progress: number): Point {
  const k = easeInOutCubic(progress)
  return { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k }
}

/** The pointer's position at a time on the clip's clock, read off the moves. */
export function cursorAt(events: readonly LogEvent[], ms: number): Point {
  let position = START
  for (const event of events) {
    if (event.kind !== 'move') continue
    if (ms < event.t) break
    position = along(event.from, event.to, (ms - event.t) / event.ms)
  }
  return position
}
