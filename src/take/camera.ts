import {
  type Box,
  CLIP_SIZES,
  type LogEvent,
  type Point,
  type TakeLog,
  cursorAt,
  easeInOutCubic,
} from '@/take/log'

/**
 * Turns a take's log into one camera per frame, on the motion the operator
 * settled by eye in groundwork track `210-film-craft-and-soundtrack`. A zoom in
 * rides the glide that reaches its target and lands as the cursor arrives, a
 * zoom out rides the glide that leaves it, and the view scales about the
 * target so it holds still on screen. The view pans only at a steady scale,
 * along the glide between two targets. HyperFrames renders the track as it
 * stands, so it carries no curve a renderer would have to agree on.
 */

export const CAMERA_VERSION = 1

/** The depth every click zooms to, unless its target already fills the view. */
const DEPTH = 1.8

/**
 * How far a clip with one pixel per CSS pixel zooms before it goes soft, which
 * caps a screencast's depth well under `DEPTH` and leaves the stepper's 4K
 * clip at it.
 */
const SHARP_DEPTH = 1.35

/** How much of the zoomed view a target may fill, which caps the depth for a big one. */
const FILL = 0.8

/** A click whose depth comes out under this zooms nowhere, being nearly the whole page. */
const MIN_ZOOM = 1.05

/** How long a zoom or a pan runs when no glide carries it. */
const EASE_MS = 600

/**
 * How long a zoom holds past its last aim when no glide leaves it, matching
 * the hold a take films on a press's result.
 */
const HOLD_MS = 500

/** An aim inside this share of the held view around its stop keeps the view where it is. */
const STICKY = 0.7

/** And it stays at least this share of the view clear of the view's edge. */
const MARGIN = 0.05

/** How long the click ring the edit draws takes to expand. */
const RING_MS = 450

/**
 * How far a drag's ring grows before it holds for the drag, then runs on to 1
 * from the release. A held value keeps the ring's one field, so every reader
 * drawing a growing ring draws a held press with no change.
 */
const GRAB_RING = 0.3

export interface CameraFrame {
  readonly ms: number
  /** How far the view is zoomed, 1 being the whole page. */
  readonly scale: number
  /** The view's top-left corner in CSS pixels of the page. */
  readonly x: number
  readonly y: number
  /** Where the edit draws the cursor, in CSS pixels of the page. */
  readonly cursor: Point
  /** How far a click's ring has expanded, 0 to 1, or null with none showing. */
  readonly ring: number | null
}

export interface CameraTrack {
  readonly version: typeof CAMERA_VERSION
  readonly viewport: { readonly width: number; readonly height: number }
  readonly fps: number
  readonly frames: readonly CameraFrame[]
}

/**
 * What the camera frames: a press, a typing burst, or a move's hold, from the
 * moment it starts to the moment the pointer may leave.
 */
interface Aim {
  readonly t: number
  readonly until: number
  readonly at: Point
  readonly depth: number
}

/** A stretch of clip time, eased from its start to its end. */
interface Span {
  readonly start: number
  readonly end: number
}

/**
 * One zoom: in onto its first stop, a pan at its depth to each later stop,
 * and out from its last.
 */
interface Zoom {
  readonly depth: number
  readonly into: Span
  readonly stops: readonly { readonly at: Point; readonly pan: Span }[]
  readonly out: Span
}

export interface CameraOptions {
  /**
   * How much faster the edit plays the clip, so the track is built on the
   * playback clock and a zoom settles at the speed a viewer sees. 1 by default.
   */
  readonly rate?: number
}

export function cameraTrack(
  source: TakeLog,
  options: CameraOptions = {},
): CameraTrack {
  const log = atRate(source, options.rate ?? 1)
  const { width, height } = log.viewport
  const clip = log.clip ?? CLIP_SIZES[log.route]
  const deepest = Math.min(DEPTH, (SHARP_DEPTH * clip.width) / width)
  const depthFor = (box: Box): number =>
    Math.min(
      deepest,
      (width * FILL) / Math.max(box.width, 1),
      (height * FILL) / Math.max(box.height, 1),
    )

  const aims = (log.push === false ? [] : log.events)
    .flatMap((event): Aim[] => aimsOf(event, depthFor, deepest))
    .filter((aim) => aim.depth >= MIN_ZOOM)
    .sort((a, b) => a.t - b.t)

  const end = (log.frames * 1000) / log.fps
  const zooms = zoomsOf(aims, log.events, { width, height }, end)

  // Read off every press rather than off the aims, which drop a click too large
  // to zoom and add a typing burst that is no press.
  const presses = log.events.flatMap((event) =>
    event.kind === 'click'
      ? [{ t: event.t, release: event.t }]
      : event.kind === 'drag'
        ? [{ t: event.t, release: event.t + event.ms }]
        : [],
  )
  const ringAt = (ms: number): number | null => {
    for (const press of presses) {
      if (ms < press.t) continue
      const grown = (ms - press.t) / RING_MS
      if (ms <= press.release) return Math.min(GRAB_RING, grown)
      const held = Math.min(GRAB_RING, (press.release - press.t) / RING_MS)
      const ring = held + (ms - press.release) / RING_MS
      if (ring <= 1) return ring
    }
    return null
  }

  const frameMs = 1000 / log.fps
  const frames: CameraFrame[] = []
  for (let index = 0; index < log.frames; index += 1) {
    const ms = index * frameMs
    const { scale, anchor } = viewAt(zooms, ms)
    const ring = ringAt(ms)
    frames.push({
      ms: round(ms, 2),
      scale: round(scale, 4),
      x: round(originFor(anchor.x, scale, width), 2),
      y: round(originFor(anchor.y, scale, height), 2),
      cursor: roundPoint(cursorAt(log.events, ms)),
      ring: ring === null ? null : round(ring, 3),
    })
  }

  return {
    version: CAMERA_VERSION,
    viewport: log.viewport,
    fps: log.fps,
    frames,
  }
}

/** Reads a playback rate off a flag, which has to be a positive number. */
export function readRate(value: string): number | undefined {
  const rate = Number(value)
  return Number.isFinite(rate) && rate > 0 ? rate : undefined
}

function aimsOf(
  event: LogEvent,
  depthFor: (box: Box) => number,
  deepest: number,
): Aim[] {
  switch (event.kind) {
    case 'click':
      return [
        { t: event.t, until: event.t, at: event.at, depth: depthFor(event.box) },
      ]
    case 'drag': {
      // One aim over both ends, held to the release, so a short drag stays
      // framed whole and a long one asks for a depth under MIN_ZOOM.
      const box = union(event.box, event.drop)
      return [
        {
          t: event.t,
          until: event.t + event.ms,
          at: centerOf(box),
          depth: depthFor(box),
        },
      ]
    }
    case 'type':
      return [
        {
          t: event.t,
          until: event.t + event.ms,
          at: centerOf(event.box),
          depth: depthFor(event.box),
        },
      ]
    case 'move': {
      if (event.hold === undefined) return []
      // A move logs no box, so a hold aims at the full depth.
      const arrived = event.t + event.ms
      return [
        { t: arrived, until: arrived + event.hold, at: event.to, depth: deepest },
      ]
    }
    default:
      return []
  }
}

/**
 * Groups aims into zooms and times each one off the glides around it. The next
 * aim joins a zoom while at most one glide and no scroll lies between them,
 * since that glide then both leaves one target and reaches the other, and the
 * view pans along it rather than pulling back and pushing in at once.
 */
function zoomsOf(
  aims: readonly Aim[],
  events: readonly LogEvent[],
  page: { readonly width: number; readonly height: number },
  end: number,
): Zoom[] {
  const glides = events.flatMap((event): Span[] =>
    event.kind === 'move' && event.ms > 0
      ? [{ start: event.t, end: event.t + event.ms }]
      : [],
  )
  const scrolls = events
    .filter((event) => event.kind === 'scroll')
    .map((event) => event.t)
  const glidesIn = (from: number, to: number) =>
    glides.filter((glide) => glide.start >= from && glide.end <= to)

  const groups: Aim[][] = []
  for (const aim of aims) {
    const group = groups.at(-1)
    const last = group?.at(-1)
    const joins =
      group !== undefined &&
      last !== undefined &&
      glidesIn(last.until, aim.t).length <= 1 &&
      !scrolls.some((t) => t >= last.until && t <= aim.t)
    if (joins) group.push(aim)
    else groups.push([aim])
  }

  const zooms: Zoom[] = []
  for (const group of groups) {
    const first = group[0]
    const last = group.at(-1)
    if (!first || !last) continue
    const depth = Math.min(...group.map((aim) => aim.depth))
    const floor = zooms.at(-1)?.out.end ?? 0

    const into = arriving(glides, first.t, floor) ?? {
      start: Math.max(floor, first.t - EASE_MS),
      end: first.t,
    }

    const stops = [{ at: first.at, pan: { start: into.end, end: into.end } }]
    let previous = first
    for (const aim of group.slice(1)) {
      const stop = stops.at(-1) ?? stops[0]
      if (stop && !inside(aim.at, stop.at, depth, page)) {
        stops.push({
          at: aim.at,
          pan: arriving(glides, aim.t, previous.until) ?? {
            start: Math.max(previous.until, aim.t - EASE_MS),
            end: aim.t,
          },
        })
      }
      previous = aim
    }

    const leave = glides.find((glide) => glide.start >= last.until)
    const cut = scrolls.find((t) => t >= last.until)
    const out =
      leave && (cut === undefined || leave.start <= cut)
        ? leave
        : {
            start: Math.min(cut ?? Infinity, last.until + HOLD_MS, end),
            end: Math.min(cut ?? Infinity, last.until + HOLD_MS, end) + EASE_MS,
          }

    zooms.push({ depth, into, stops, out })
  }
  return zooms
}

/** The glide ending as an aim starts, when one does after `floor`. */
function arriving(
  glides: readonly Span[],
  t: number,
  floor: number,
): Span | undefined {
  return glides.findLast(
    (glide) => glide.start >= floor && glide.end <= t + 0.5,
  )
}

/**
 * Whether a point lies near enough the stop, and far enough inside the view
 * anchored on it, that the view can stay where it is.
 */
function inside(
  point: Point,
  stop: Point,
  depth: number,
  page: { readonly width: number; readonly height: number },
): boolean {
  const near = (value: number, anchor: number, size: number) => {
    const span = size / depth
    const origin = originFor(anchor, depth, size)
    const margin = span * MARGIN
    return (
      Math.abs(value - anchor) < (span / 2) * STICKY &&
      value > origin + margin &&
      value < origin + span - margin
    )
  }
  return (
    near(point.x, stop.x, page.width) && near(point.y, stop.y, page.height)
  )
}

/**
 * The scale and the page point held still on screen at `ms`. Inside a zoom
 * the anchor is a stop while the scale changes and slides between stops only
 * while it holds, so the view never pans and scales at once.
 */
function viewAt(
  zooms: readonly Zoom[],
  ms: number,
): { scale: number; anchor: Point } {
  const rest = { scale: 1, anchor: { x: 0, y: 0 } }
  const zoom = zooms.findLast((each) => ms >= each.into.start)
  if (!zoom || ms > zoom.out.end) return rest

  const first = zoom.stops[0]
  const last = zoom.stops.at(-1)
  if (!first || !last) return rest
  const lift = zoom.depth - 1

  if (ms < zoom.into.end) {
    return {
      scale: 1 + lift * easeInOutCubic(progress(zoom.into, ms)),
      anchor: first.at,
    }
  }
  if (ms >= zoom.out.start) {
    return {
      scale: 1 + lift * (1 - easeInOutCubic(progress(zoom.out, ms))),
      anchor: last.at,
    }
  }

  let anchor = first.at
  for (const [i, stop] of zoom.stops.entries()) {
    if (i === 0 || ms < stop.pan.start) continue
    const from = zoom.stops[i - 1]?.at ?? first.at
    const k = easeInOutCubic(progress(stop.pan, ms))
    anchor = {
      x: from.x + (stop.at.x - from.x) * k,
      y: from.y + (stop.at.y - from.y) * k,
    }
  }
  return { scale: zoom.depth, anchor }
}

function progress(span: Span, ms: number): number {
  return span.end > span.start ? (ms - span.start) / (span.end - span.start) : 1
}

/**
 * The view's top-left along one axis when it is zoomed `scale` about `anchor`,
 * which leaves the anchor where it sits on the unzoomed page.
 */
function originFor(anchor: number, scale: number, size: number): number {
  const origin = anchor * (1 - 1 / scale)
  return clamp(origin, 0, size - size / scale)
}

/** The log as a clip played `rate` times faster shows it, every time divided. */
function atRate(log: TakeLog, rate: number): TakeLog {
  if (rate === 1) return log
  return {
    ...log,
    frames: Math.round(log.frames / rate),
    events: log.events.map((event): LogEvent => {
      const t = event.t / rate
      if (event.kind === 'move') {
        return {
          ...event,
          t,
          ms: event.ms / rate,
          ...(event.points
            ? {
                points: event.points.map((point) => ({
                  ...point,
                  t: point.t / rate,
                })),
              }
            : {}),
          ...(event.hold !== undefined ? { hold: event.hold / rate } : {}),
        }
      }
      return 'ms' in event
        ? { ...event, t, ms: event.ms / rate }
        : { ...event, t }
    }),
  }
}

function centerOf(box: Box): Point {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

function union(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  }
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high)
}

function round(value: number, places: number): number {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

function roundPoint(point: Point): Point {
  return { x: round(point.x, 1), y: round(point.y, 1) }
}
