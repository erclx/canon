import type { Point } from '@/take/log'

/**
 * Draws the cursor arrow and the click ring onto one decoded frame, in the
 * shape groundwork track `193-ui-record` rendered them (canon-keep-retired):
 * a dark arrow outlined
 * in white, and a blue ring that grows from its tip and fades out. Both stay
 * one size whatever the frame shows, so the pointer reads the same in every
 * beat of a reel. Drawn in TypeScript rather than a browser, so the reel needs
 * no page and no seek, and a test can read the pixels it leaves.
 */

export interface Frame {
  /** RGBA, four bytes a pixel, row by row. */
  readonly data: Uint8Array
  readonly width: number
  readonly height: number
}

/** The arrow, relative to its tip, from the groundwork's 24 px cursor path. */
const ARROW: readonly Point[] = [
  { x: 0, y: 0 },
  { x: 0, y: 17 },
  { x: 4.5, y: 12.5 },
  { x: 7.5, y: 19 },
  { x: 10, y: 18 },
  { x: 7, y: 11.5 },
  { x: 13.5, y: 11.5 },
]

const ARROW_FILL = [17, 17, 17] as const
const ARROW_STROKE = [255, 255, 255] as const
const STROKE_HALF = 0.75

/** The ring's outer radius at full size, and its stroke at that size. */
export const RING_RADIUS = 18
const RING_STROKE = 2
const RING_COLOR = [37, 99, 235] as const
/** The ring starts at this share of its size and grows by the expansion. */
const RING_START = 0.4

/**
 * Draws the pointer with its tip at `at`, in the frame's own pixels, and the
 * ring around it when `ring` is a 0 to 1 expansion. The ring sits under the
 * arrow, and anything past the frame's edge is clipped.
 */
export function drawPointer(
  frame: Frame,
  at: Point,
  ring: number | null,
): void {
  if (ring !== null) drawRing(frame, at, ring)
  drawArrow(frame, at)
}

function drawRing(frame: Frame, at: Point, ring: number): void {
  const scale = RING_START + ring
  const stroke = RING_STROKE * scale
  const middle = RING_RADIUS * scale - stroke / 2
  const opacity = 1 - ring
  if (opacity <= 0) return

  const reach = RING_RADIUS * scale + 1
  forEachPixel(frame, at, reach, reach, reach, reach, (px, py) => {
    const distance = Math.hypot(px - at.x, py - at.y)
    const coverage = clamp01(stroke / 2 + 0.5 - Math.abs(distance - middle))
    return coverage > 0
      ? { color: RING_COLOR, alpha: coverage * opacity }
      : null
  })
}

function drawArrow(frame: Frame, at: Point): void {
  const reach = STROKE_HALF + 1
  forEachPixel(frame, at, reach, 13.5 + reach, reach, 19 + reach, (px, py) => {
    const d = signedDistance({ x: px - at.x, y: py - at.y })
    // Coverage of the outlined shape, then of the fill inside the outline,
    // each antialiased across one pixel.
    const outer = clamp01(0.5 - (d - STROKE_HALF))
    if (outer <= 0) return null
    const inner = clamp01(0.5 - (d + STROKE_HALF))
    return {
      color: ARROW_STROKE,
      alpha: outer,
      over: ARROW_FILL,
      overAlpha: inner,
    }
  })
}

interface Paint {
  readonly color: readonly [number, number, number]
  readonly alpha: number
  /** A second color laid over the first, for the fill inside the outline. */
  readonly over?: readonly [number, number, number]
  readonly overAlpha?: number
}

/**
 * Calls `paint` for each pixel center inside the box around `at`, clipped to
 * the frame, and blends whatever it returns onto that pixel.
 */
function forEachPixel(
  frame: Frame,
  at: Point,
  left: number,
  right: number,
  up: number,
  down: number,
  paint: (x: number, y: number) => Paint | null,
): void {
  const x0 = Math.max(0, Math.floor(at.x - left))
  const x1 = Math.min(frame.width - 1, Math.ceil(at.x + right))
  const y0 = Math.max(0, Math.floor(at.y - up))
  const y1 = Math.min(frame.height - 1, Math.ceil(at.y + down))
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const result = paint(x + 0.5, y + 0.5)
      if (!result) continue
      const i = (y * frame.width + x) * 4
      blend(frame.data, i, result.color, result.alpha)
      if (result.over && result.overAlpha) {
        blend(frame.data, i, result.over, result.overAlpha)
      }
    }
  }
}

function blend(
  data: Uint8Array,
  i: number,
  color: readonly [number, number, number],
  alpha: number,
): void {
  for (let c = 0; c < 3; c += 1) {
    const base = data[i + c] ?? 0
    data[i + c] = Math.round(base + ((color[c] ?? 0) - base) * alpha)
  }
}

/** Distance from `p` to the arrow's outline, negative inside it. */
function signedDistance(p: Point): number {
  let nearest = Number.POSITIVE_INFINITY
  let inside = false
  for (let i = 0, j = ARROW.length - 1; i < ARROW.length; j = i, i += 1) {
    const a = ARROW[j] ?? ARROW[0]
    const b = ARROW[i] ?? ARROW[0]
    if (!a || !b) continue
    nearest = Math.min(nearest, segmentDistance(p, a, b))
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside
    }
  }
  return inside ? -nearest : nearest
}

function segmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const k = clamp01(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy))
  return Math.hypot(p.x - (a.x + k * dx), p.y - (a.y + k * dy))
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1)
}
