/** @jsxImportSource preact */
import type { JSX } from 'preact'
import { useRef } from 'preact/hooks'
import {
  clampPanelWidth,
  MAX_PANEL_WIDTH,
  MIN_PANEL_WIDTH,
  type PanelSide,
  panelWidths,
  setPanelWidth,
} from '@/canvas/client/state'

const KEY_STEP = 16
const SHIFT_STEP = 64

const NAMES: Readonly<Record<PanelSide, string>> = {
  left: 'Resize pages panel',
  right: 'Resize details panel',
}

/**
 * The drag handle on a panel's inner edge, a focusable separator the arrow
 * keys move as well. It sits outside the surface, so a drag on it never pans,
 * moves a frame, or reaches the undo history.
 */
export function PanelHandle({
  side,
  controls,
}: {
  readonly side: PanelSide
  readonly controls: string
}): JSX.Element {
  const drag = useRef<{ x: number; width: number } | undefined>(undefined)
  const width = panelWidths.value[side]
  /* Dragging right widens the left panel and narrows the right one. */
  const sign = side === 'left' ? 1 : -1

  const handlePointerDown = (event: PointerEvent) => {
    event.preventDefault()
    drag.current = { x: event.clientX, width }
    ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent) => {
    const start = drag.current
    if (!start) return
    setPanelWidth(
      side,
      start.width + sign * (event.clientX - start.x),
      window.innerWidth,
    )
  }

  const handlePointerUp = () => {
    drag.current = undefined
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    const step = event.shiftKey ? SHIFT_STEP : KEY_STEP
    const next: Record<string, number | undefined> = {
      ArrowRight: width + sign * step,
      ArrowLeft: width - sign * step,
      Home: MIN_PANEL_WIDTH,
      End: MAX_PANEL_WIDTH,
    }
    const wanted = next[event.key]
    if (wanted === undefined) return
    event.preventDefault()
    setPanelWidth(side, wanted, window.innerWidth)
  }

  return (
    <div
      class={`panel-handle panel-handle-${side}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={NAMES[side]}
      aria-controls={controls}
      aria-valuenow={width}
      aria-valuemin={MIN_PANEL_WIDTH}
      aria-valuemax={clampPanelWidth(side, MAX_PANEL_WIDTH, window.innerWidth)}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
    />
  )
}
