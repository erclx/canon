/** @jsxImportSource preact */
import type { JSX } from 'preact'
import { useRef, useState } from 'preact/hooks'
import { view } from '@/canvas/client/state'

/** Screen pixels a press travels before it reads as a drag and not a click. */
export const DRAG_THRESHOLD = 3

/** The smallest box a handle drag leaves, in surface units. */
const MIN_SIZE = 1

export type Corner = 'nw' | 'ne' | 'sw' | 'se'

const CORNERS: readonly Corner[] = ['nw', 'ne', 'sw', 'se']

export interface OverlayBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * The box a corner drag leaves, with the delta already in surface units. The
 * corner opposite the one dragged stays put, so a west or north handle moves
 * the box as it resizes it.
 */
export function resizedBox(
  origin: OverlayBox,
  corner: Corner,
  dx: number,
  dy: number,
): OverlayBox {
  const isWest = corner === 'nw' || corner === 'sw'
  const isNorth = corner === 'nw' || corner === 'ne'
  const width = Math.max(MIN_SIZE, origin.width + (isWest ? -dx : dx))
  const height = Math.max(MIN_SIZE, origin.height + (isNorth ? -dy : dy))
  return {
    x: isWest ? origin.x + origin.width - width : origin.x,
    y: isNorth ? origin.y + origin.height - height : origin.y,
    width,
    height,
  }
}

export function sizeLabel(box: Pick<OverlayBox, 'width' | 'height'>): string {
  return `${Math.round(box.width)} × ${Math.round(box.height)}`
}

interface HandleGesture {
  readonly corner: Corner
  readonly startX: number
  readonly startY: number
  readonly origin: OverlayBox
  box: OverlayBox
  moved: boolean
}

export interface SelectionOverlayProps {
  readonly kind: 'frame' | 'element'
  /** Read on every render, so a box the drag previewed is what shows after. */
  readonly measure: () => OverlayBox
  /** Subtracted from the box to place the overlay inside its container. */
  readonly offset?: { readonly x: number; readonly y: number }
  readonly hasChip?: boolean
  /**
   * Draws the target's own measured box during a drag rather than the dragged
   * one. An element in normal flow grows from its own top left whichever corner
   * is dragged, so only its measured box shows where it actually sits.
   */
  readonly isMeasuredWhileDragging?: boolean
  readonly onStart?: () => void
  readonly onPreview?: (box: OverlayBox, origin: OverlayBox) => void
  readonly onCommit: (box: OverlayBox, origin: OverlayBox) => void
  readonly onCancel?: (origin: OverlayBox) => void
}

/**
 * The selected frame's or element's outline, its four corner handles, and an
 * element's size chip. Every part sizes against `--outline-scale`, so it keeps
 * one screen weight at any zoom.
 */
export function SelectionOverlay({
  kind,
  measure,
  offset = { x: 0, y: 0 },
  hasChip = false,
  isMeasuredWhileDragging = false,
  onStart,
  onPreview,
  onCommit,
  onCancel,
}: SelectionOverlayProps): JSX.Element {
  const gesture = useRef<HandleGesture | undefined>(undefined)
  const [dragged, setDragged] = useState<OverlayBox | undefined>(undefined)
  const box = dragged ?? measure()

  const handlePointerDown = (corner: Corner) => (event: PointerEvent) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const origin = measure()
    gesture.current = {
      corner,
      startX: event.clientX,
      startY: event.clientY,
      origin,
      box: origin,
      moved: false,
    }
    ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent) => {
    const current = gesture.current
    if (!current) return
    const dx = event.clientX - current.startX
    const dy = event.clientY - current.startY
    if (!current.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    if (!current.moved) onStart?.()
    current.moved = true
    /* The delta is in screen pixels and the box in surface units. */
    const { zoom } = view.value
    current.box = resizedBox(
      current.origin,
      current.corner,
      Math.round(dx / zoom),
      Math.round(dy / zoom),
    )
    onPreview?.(current.box, current.origin)
    setDragged(isMeasuredWhileDragging ? measure() : current.box)
  }

  const handlePointerUp = () => {
    const current = gesture.current
    gesture.current = undefined
    if (current?.moved) onCommit(current.box, current.origin)
    setDragged(undefined)
  }

  const handlePointerCancel = () => {
    const current = gesture.current
    gesture.current = undefined
    if (current?.moved) onCancel?.(current.origin)
    setDragged(undefined)
  }

  return (
    <div
      class="selection"
      data-selection={kind}
      data-resizing={dragged ? 'true' : undefined}
      style={{
        left: `${box.x - offset.x}px`,
        top: `${box.y - offset.y}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
      }}
    >
      {CORNERS.map((corner) => (
        <span
          key={corner}
          class="selection-handle"
          data-handle={corner}
          aria-hidden="true"
          onPointerDown={handlePointerDown(corner)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        />
      ))}
      {hasChip ? (
        <span class="selection-chip" aria-hidden="true">
          {sizeLabel(box)}
        </span>
      ) : null}
    </div>
  )
}

/** The element under the pointer, drawn without handles. */
export function HoverOutline({ element }: { readonly element: Element }) {
  const rect = element.getBoundingClientRect()
  return (
    <div
      class="element-outline"
      data-outline="hover"
      aria-hidden="true"
      style={{
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      }}
    />
  )
}
