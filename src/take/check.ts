import type { CameraFrame, CameraTrack } from '@/take/camera'
import type { LogEvent, TakeLog } from '@/take/log'

/**
 * The timing rules a finished take is held to, read from its log and camera
 * track alone. Each limit sits a frame or more below the engine's own pacing,
 * since every logged time lands on a 60 fps clock and a 600 ms glide can log as
 * 583 ms. The limits are constants rather than options, so a session cannot
 * tune a take the operator would reject into a pass.
 */

export const RULES = [
  'glide-fast',
  'no-rest',
  'left-early',
  'typed-under',
  'zoom-fast',
  'pump',
  'stall',
] as const

export type Rule = (typeof RULES)[number]

/** The rules that read the drawn cursor, which a beat no hand drives skips. */
export const CURSOR_RULES: readonly Rule[] = [
  'glide-fast',
  'no-rest',
  'left-early',
  'typed-under',
]

export const LIMITS = {
  /** Shortest glide, so a short reach still reads as travel. */
  'glide-fast': 550,
  /** Rest on a target before it is pressed, wheeled, typed into, or dragged. */
  'no-rest': 250,
  /** Rest after a press before the next glide, so the ring plays out. */
  'left-early': 400,
  /** Shortest zoom change, in or out. */
  'zoom-fast': 500,
  /** Least time between zooming out and zooming back in. */
  pump: 1500,
  /** Longest hold of the clip while the beat types or drags. */
  stall: 500,
} as const

export interface Breach {
  readonly rule: Rule
  /** Clip time in ms, or track time for the zoom rules. */
  readonly t: number
  /** What was measured, in ms, or 0 for `typed-under`. */
  readonly measured: number
  /** The limit it broke, in ms, or 0 for `typed-under`. */
  readonly limit: number
}

/** The per-frame scale change below which the camera reads as holding. */
const STEADY = 0.0005

/** Every rule but `stall`, which reads pixels, over one beat in clip-time order. */
export function checkBeat(log: TakeLog, track: CameraTrack): Breach[] {
  const hand = log.hand !== false && track.hand !== false
  const breaches = [
    ...(hand ? cursorBreaches(log.events) : []),
    ...zoomBreaches(track.frames),
  ]
  return sortBreaches(breaches)
}

export function sortBreaches(breaches: readonly Breach[]): Breach[] {
  return [...breaches].sort((a, b) => a.t - b.t)
}

function cursorBreaches(source: readonly LogEvent[]): Breach[] {
  const events = [...source].sort((a, b) => a.t - b.t)
  const breaches: Breach[] = []
  events.forEach((event, index) => {
    const previous = events[index - 1]
    const next = events[index + 1]
    if (
      event.kind === 'move' &&
      event.ms > 0 &&
      event.ms < LIMITS['glide-fast'] &&
      !isStepOff(previous, next)
    ) {
      breaches.push(breach('glide-fast', event.t, event.ms))
    }
    if (
      isPress(event) &&
      previous?.kind === 'move' &&
      !isStepOff(events[index - 2], event)
    ) {
      const gap = event.t - (previous.t + previous.ms)
      if (gap < LIMITS['no-rest'])
        breaches.push(breach('no-rest', event.t, gap))
    }
    if (event.kind === 'click' && next?.kind === 'move') {
      const gap = next.t - event.t
      if (gap < LIMITS['left-early']) {
        breaches.push(breach('left-early', event.t, gap))
      }
    }
    if (event.kind === 'type' && inside(event.at, event.box)) {
      breaches.push({ rule: 'typed-under', t: event.t, measured: 0, limit: 0 })
    }
  })
  return breaches
}

/**
 * A fill's short move off the field it pressed, which the engine makes at a
 * fixed 300 ms so the typing stays in sight. It is no glide to a target, and
 * the field's rest is the dwell after the press that precedes it.
 */
function isStepOff(
  before: LogEvent | undefined,
  after: LogEvent | undefined,
): boolean {
  return before?.kind === 'click' && after?.kind === 'type'
}

function isPress(event: LogEvent): boolean {
  return (
    event.kind === 'click' ||
    event.kind === 'scroll' ||
    event.kind === 'type' ||
    event.kind === 'drag'
  )
}

function inside(
  at: { readonly x: number; readonly y: number },
  box: {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
  },
): boolean {
  return (
    at.x >= box.x &&
    at.x <= box.x + box.width &&
    at.y >= box.y &&
    at.y <= box.y + box.height
  )
}

interface Ramp {
  readonly start: number
  readonly end: number
  readonly way: 1 | -1
}

function zoomBreaches(frames: readonly CameraFrame[]): Breach[] {
  const ramps = rampsOf(frames)
  const breaches: Breach[] = []
  for (const ramp of ramps) {
    const ms = ramp.end - ramp.start
    if (ms < LIMITS['zoom-fast']) {
      breaches.push(breach('zoom-fast', ramp.start, ms))
    }
  }
  ramps.forEach((ramp, index) => {
    const next = ramps[index + 1]
    if (!next || ramp.way !== -1 || next.way !== 1) return
    const gap = next.start - ramp.end
    if (gap < LIMITS.pump) breaches.push(breach('pump', ramp.end, gap))
  })
  return breaches
}

/** Each run of frames over which the scale keeps moving one way. */
export function rampsOf(frames: readonly CameraFrame[]): Ramp[] {
  const ramps: Ramp[] = []
  let start = 0
  let way: 1 | -1 | 0 = 0
  for (let index = 1; index < frames.length; index += 1) {
    const before = frames[index - 1]
    const frame = frames[index]
    if (!before || !frame) continue
    const change = frame.scale - before.scale
    const now = change > STEADY ? 1 : change < -STEADY ? -1 : 0
    if (now === way) continue
    if (way !== 0) ramps.push({ start, end: before.ms, way })
    start = before.ms
    way = now
  }
  const last = frames.at(-1)
  if (way !== 0 && last) ramps.push({ start, end: last.ms, way })
  return ramps
}

function breach(
  rule: Exclude<Rule, 'typed-under'>,
  t: number,
  measured: number,
): Breach {
  return { rule, t, measured: Math.round(measured), limit: LIMITS[rule] }
}
