import {
  type Box,
  type LogEvent,
  type Point,
  type TakeLog,
  cursorAt,
} from '@/take/log'
import {
  type SpringState,
  createSpringState,
  stepSpring,
} from '@/take/zoom/spring'
import {
  CHAINED_ZOOM_PAN_GAP_MS,
  CONNECTED_ZOOM_PAN_DURATION_MS,
  computeRegionStrength,
  easeConnectedPan,
  lerp,
} from '@/take/zoom/region-utils'

/**
 * Turns a take's log into one camera per frame, preset O4 from groundwork
 * track `193-ui-record`: OpenScreen's timing aimed at each click, a fixed
 * depth, a focus that holds still until a click leaves the inner part of the
 * view, and a dead zone that keeps the cursor in frame. HyperFrames renders the
 * track as it stands, so it carries no curve a renderer would have to agree on.
 */

export const CAMERA_VERSION = 1

/** The depth every click zooms to, unless its target already fills the view. */
const DEPTH = 1.8

/** How much of the zoomed view a target may fill, which caps the depth for a big one. */
const FILL = 0.8

/** A click whose depth comes out under this zooms nowhere, being nearly the whole page. */
const MIN_ZOOM = 1.05

/** How long a zoom holds past its last click or keystroke. */
const HOLD_MS = 300

/** A click inside this share of the current view keeps the focus where it is. */
const STICKY = 0.7

/** The cursor stays inside this share of the zoomed view. */
const SAFE = 0.75

/**
 * The cursor never passes this share of the rendered view. The dead zone above
 * aims the camera, and the spring chasing it lags a long fast reach by more
 * than the dead zone's margin, so the rendered view is pushed along with the
 * cursor at this edge rather than letting it leave the frame.
 */
const EDGE = 0.9

/** How long the click ring the edit draws takes to expand. */
const RING_MS = 450

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

/** A click, or a typing burst read as a click on its field held to the last key. */
interface Aim {
  readonly t: number
  readonly until: number
  readonly at: Point
  readonly depth: number
}

interface Window {
  start: number
  end: number
  readonly aims: Aim[]
}

export function cameraTrack(log: TakeLog): CameraTrack {
  const { width, height } = log.viewport
  const depthFor = (box: Box): number =>
    Math.min(
      DEPTH,
      (width * FILL) / Math.max(box.width, 1),
      (height * FILL) / Math.max(box.height, 1),
    )

  const aims: Aim[] = log.events
    .flatMap((event): Aim[] => {
      if (event.kind === 'click') {
        return [
          {
            t: event.t,
            until: event.t,
            at: event.at,
            depth: depthFor(event.box),
          },
        ]
      }
      if (event.kind === 'type') {
        const box = event.box
        return [
          {
            t: event.t,
            until: event.t + event.ms,
            at: { x: box.x + box.width / 2, y: box.y + box.height / 2 },
            depth: depthFor(box),
          },
        ]
      }
      return []
    })
    .filter((aim) => aim.depth >= MIN_ZOOM)
    .sort((a, b) => a.t - b.t)

  const scrolls = log.events.filter((event) => event.kind === 'scroll')
  // Read off every click rather than off the aims, which drop a click too large
  // to zoom and add a typing burst that is no press.
  const clicks = log.events.filter((event) => event.kind === 'click')
  const windows = zoomWindows(aims, scrolls)

  const targetAt = (ms: number) => {
    let best = { strength: 0, scale: 1, x: width / 2, y: height / 2 }
    for (const window of windows) {
      const strength = computeRegionStrength(
        { startMs: window.aims[0]?.t ?? window.start, endMs: window.end },
        ms,
      )
      if (strength <= best.strength) continue

      const focus = focusAt(window.aims, ms, width, height)
      const half = {
        x: width / (2 * focus.depth),
        y: height / (2 * focus.depth),
      }
      const cursor = cursorAt(log.events, ms)
      const x = clamp(
        focus.x,
        cursor.x - half.x * SAFE,
        cursor.x + half.x * SAFE,
      )
      const y = clamp(
        focus.y,
        cursor.y - half.y * SAFE,
        cursor.y + half.y * SAFE,
      )

      best = {
        strength,
        scale: lerp(1, focus.depth, strength),
        x: lerp(width / 2, x, strength),
        y: lerp(height / 2, y, strength),
      }
    }
    return best
  }

  const frameMs = 1000 / log.fps
  const springs: Record<'scale' | 'x' | 'y', SpringState> = {
    scale: createSpringState(1),
    x: createSpringState(width / 2),
    y: createSpringState(height / 2),
  }

  const frames: CameraFrame[] = []
  for (let index = 0; index < log.frames; index += 1) {
    const ms = index * frameMs
    const target = targetAt(ms)
    const scale = Math.max(1, stepSpring(springs.scale, target.scale, frameMs))
    const half = { x: width / (2 * scale), y: height / (2 * scale) }
    const cursor = cursorAt(log.events, ms)
    // Written back so the spring carries on from where the view was pushed.
    springs.x.value = clamp(
      stepSpring(springs.x, target.x, frameMs),
      cursor.x - half.x * EDGE,
      cursor.x + half.x * EDGE,
    )
    springs.y.value = clamp(
      stepSpring(springs.y, target.y, frameMs),
      cursor.y - half.y * EDGE,
      cursor.y + half.y * EDGE,
    )

    const ring = clicks.find(
      (click) => ms >= click.t && ms - click.t <= RING_MS,
    )
    frames.push({
      ms: round(ms, 2),
      scale: round(scale, 4),
      x: round(clamp(springs.x.value, half.x, width - half.x) - half.x, 2),
      y: round(clamp(springs.y.value, half.y, height - half.y) - half.y, 2),
      cursor: roundPoint(cursor),
      ring: ring ? round((ms - ring.t) / RING_MS, 3) : null,
    })
  }

  return {
    version: CAMERA_VERSION,
    viewport: log.viewport,
    fps: log.fps,
    frames,
  }
}

/**
 * Groups aims into zooms. One holds from its first aim to the last plus the
 * hold, a scroll ends it since the content moves under the camera, and the next
 * aim joins it while the gap stays under OpenScreen's chained-pan gap.
 */
function zoomWindows(
  aims: readonly Aim[],
  scrolls: readonly LogEvent[],
): Window[] {
  const windows: Window[] = []
  for (const aim of aims) {
    let end = aim.until + HOLD_MS
    const cut = scrolls.find((scroll) => scroll.t > aim.t && scroll.t < end)
    if (cut) end = cut.t

    const last = windows.at(-1)
    const scrolledBetween =
      last !== undefined &&
      scrolls.some((scroll) => scroll.t >= last.end && scroll.t <= aim.t)
    if (
      last &&
      !scrolledBetween &&
      aim.t - last.end < CHAINED_ZOOM_PAN_GAP_MS
    ) {
      last.end = end
      last.aims.push(aim)
    } else {
      windows.push({ start: aim.t, end, aims: [aim] })
    }
  }
  return windows
}

/**
 * Where a zoom aims at `ms`. The focus stays on a stop until an aim leaves the
 * inner `STICKY` share of the view around it, which becomes the next stop, and
 * it pans to each stop on OpenScreen's connected-pan curve, arriving as the
 * click lands.
 */
function focusAt(
  aims: readonly Aim[],
  ms: number,
  width: number,
  height: number,
): Point & { depth: number } {
  const [first, ...rest] = aims
  if (!first) return { x: width / 2, y: height / 2, depth: 1 }

  const stops = [first]
  for (const aim of rest) {
    const stop = stops.at(-1) ?? first
    const inside =
      Math.abs(aim.at.x - stop.at.x) < (width / (2 * stop.depth)) * STICKY &&
      Math.abs(aim.at.y - stop.at.y) < (height / (2 * stop.depth)) * STICKY
    if (!inside) stops.push(aim)
  }

  let focus = { x: first.at.x, y: first.at.y, depth: first.depth }
  for (let i = 1; i < stops.length; i += 1) {
    const from = stops[i - 1] ?? first
    const to = stops[i] ?? first
    const panStart = to.t - CONNECTED_ZOOM_PAN_DURATION_MS
    if (ms >= to.t) {
      focus = { x: to.at.x, y: to.at.y, depth: to.depth }
    } else if (ms > panStart) {
      const k = easeConnectedPan(
        (ms - panStart) / CONNECTED_ZOOM_PAN_DURATION_MS,
      )
      focus = {
        x: lerp(from.at.x, to.at.x, k),
        y: lerp(from.at.y, to.at.y, k),
        depth: lerp(from.depth, to.depth, k),
      }
    }
  }
  return focus
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
