/** @jsxImportSource preact */
import type { JSX, RefObject } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { addressOf, documentElements, elementAt } from '@/canvas/address'
import type { Frame } from '@/canvas/content'
import {
  currentPage,
  draggingFrame,
  fitView,
  type FrameRef,
  frameDocuments,
  frameKey,
  frameTheme,
  frameVersions,
  hoveredElement,
  moveFrameTo,
  panBy,
  previewMove,
  registerFrameDocument,
  selectElement,
  selectFrame,
  selection,
  type Theme,
  toggleFrameTheme,
  view,
  zoomAt,
} from '@/canvas/client/state'

/** One wheel notch or one button press. */
const ZOOM_STEP = 1.2

/** Screen pixels a press travels before it reads as a drag and not a click. */
const DRAG_THRESHOLD = 3

/** Surface units one arrow press moves a frame, and one with Shift held. */
const NUDGE = 10
const NUDGE_LARGE = 50

const ARROWS: Readonly<Record<string, { x: number; y: number } | undefined>> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
}

interface Gesture {
  readonly startX: number
  readonly startY: number
  readonly originX: number
  readonly originY: number
  x: number
  y: number
  moved: boolean
}

export interface SurfaceProps {
  readonly viewportRef: RefObject<HTMLDivElement | null>
}

/** A wheel turn in shell coordinates, wherever the pointer sat. */
interface WheelTurn {
  readonly deltaX: number
  readonly deltaY: number
  readonly isZoom: boolean
  readonly clientX: number
  readonly clientY: number
}

/**
 * The frame's own document is a separate window, so an element in it fails an
 * `instanceof Element` against the shell's window. The node type is the test
 * that holds across both.
 */
function asElement(target: EventTarget | null): Element | undefined {
  const node = target as Node | null
  return node?.nodeType === 1 ? (node as Element) : undefined
}

function ElementOutline({
  element,
  kind,
}: {
  readonly element: Element
  readonly kind: 'hover' | 'selected'
}): JSX.Element {
  const rect = element.getBoundingClientRect()
  return (
    <div
      class="element-outline"
      data-outline={kind}
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

export function frameSrc(page: string, frame: Frame, version: number): string {
  const path = `/frames/${encodeURIComponent(page)}/${encodeURIComponent(frame.file)}`
  return version === 0 ? path : `${path}?v=${version}`
}

/**
 * Sets the frame document's theme the way the token stylesheet reads it. The
 * frame shares the shell's origin, so its document is reachable once loaded.
 */
function applyFrameTheme(iframe: HTMLIFrameElement | null, value: Theme): void {
  const root = iframe?.contentDocument?.documentElement
  if (!root) return
  root.dataset.theme = value
  root.style.colorScheme = value
}

function FrameView({
  page,
  frame,
  onWheelTurn,
}: {
  readonly page: string
  readonly frame: Frame
  readonly onWheelTurn: (turn: WheelTurn) => void
}): JSX.Element {
  const key = frameKey(page, frame)
  const version = frameVersions.value.get(key) ?? 0
  const value = frameTheme(key)
  const iframe = useRef<HTMLIFrameElement>(null)
  const gesture = useRef<Gesture | undefined>(undefined)
  const ref: FrameRef = { page, frame: frame.name }
  const isSelected =
    selection.value?.page === page && selection.value.frame === frame.name
  /* Bumped when the frame document scrolls, so the outlines follow it. */
  const [, setScrolled] = useState(0)
  const doc = frameDocuments.value.get(key)

  useEffect(() => {
    applyFrameTheme(iframe.current, value)
  }, [value])

  /*
   * The frame shares the shell's origin, so its document takes listeners
   * directly. A click selects the element under it and goes no further, so a
   * link or a submit button in a draft never navigates the frame away.
   */
  const handleLoad = () => {
    const element = iframe.current
    const loaded = element?.contentDocument
    applyFrameTheme(element, frameTheme(key))
    if (!element || !loaded) return
    registerFrameDocument(key, loaded)

    loaded.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      const target = asElement(event.target)
      const address = target && addressOf(loaded, target)
      if (address) void selectElement(ref, key, address)
    })
    loaded.addEventListener('submit', (event) => event.preventDefault())
    loaded.addEventListener('mouseover', (event) => {
      const target = asElement(event.target)
      const index = target ? documentElements(loaded).indexOf(target) : -1
      hoveredElement.value = index === -1 ? undefined : { key, index }
    })
    loaded.addEventListener('mouseleave', () => {
      if (hoveredElement.value?.key === key) hoveredElement.value = undefined
    })
    loaded.addEventListener('scroll', () => setScrolled((n) => n + 1))
    loaded.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault()
        const rect = element.getBoundingClientRect()
        const { zoom } = view.value
        onWheelTurn({
          deltaX: event.deltaX,
          deltaY: event.deltaY,
          isZoom: event.ctrlKey || event.metaKey,
          clientX: rect.left + event.clientX * zoom,
          clientY: rect.top + event.clientY * zoom,
        })
      },
      { passive: false },
    )
  }

  const picked =
    isSelected && doc && selection.value?.element
      ? selection.value.element
      : undefined
  const selectedNode =
    doc && picked && !picked.stale ? elementAt(doc, picked) : undefined
  const hovered = hoveredElement.value
  const hoveredNode =
    doc && hovered?.key === key
      ? documentElements(doc)[hovered.index]
      : undefined

  const select = () => {
    if (!isSelected) void selectFrame(ref)
  }

  const handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    if ((event.target as HTMLElement | null)?.closest('.frame-theme')) return
    gesture.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: frame.x,
      originY: frame.y,
      x: frame.x,
      y: frame.y,
      moved: false,
    }
    ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
    select()
  }

  const handlePointerMove = (event: PointerEvent) => {
    const current = gesture.current
    if (!current) return
    const dx = event.clientX - current.startX
    const dy = event.clientY - current.startY
    if (!current.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    const { zoom } = view.value
    current.moved = true
    current.x = Math.round(current.originX + dx / zoom)
    current.y = Math.round(current.originY + dy / zoom)
    draggingFrame.value = frame.name
    previewMove(ref, current.x, current.y)
  }

  const handlePointerUp = () => {
    const current = gesture.current
    gesture.current = undefined
    draggingFrame.value = undefined
    if (current?.moved) void moveFrameTo(ref, current.x, current.y)
  }

  const handlePointerCancel = () => {
    const current = gesture.current
    gesture.current = undefined
    draggingFrame.value = undefined
    if (current?.moved) previewMove(ref, current.originX, current.originY)
  }

  /*
   * The keyboard path for a drag, since a pointer gesture alone leaves a
   * frame unmovable without a mouse.
   */
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      select()
      return
    }
    const step = event.shiftKey ? NUDGE_LARGE : NUDGE
    const delta = ARROWS[event.key]
    if (!delta || !isSelected) return
    event.preventDefault()
    void moveFrameTo(ref, frame.x + delta.x * step, frame.y + delta.y * step)
  }

  const next = value === 'dark' ? 'light' : 'dark'
  return (
    <figure
      class="frame"
      data-frame={frame.name}
      data-selected={isSelected ? 'true' : undefined}
      data-dragging={draggingFrame.value === frame.name ? 'true' : undefined}
      tabIndex={0}
      aria-label={`${frame.name}, ${frame.width} by ${frame.height}`}
      aria-current={isSelected ? 'true' : undefined}
      onKeyDown={handleKeyDown}
      style={{
        left: `${frame.x}px`,
        top: `${frame.y}px`,
        width: `${frame.width}px`,
      }}
    >
      {/* The frame's handle, since a press inside the frame picks an element. */}
      <figcaption
        class="frame-label"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <span class="frame-name" title={frame.name}>
          {frame.name}
        </span>
        <span class="frame-size">
          {frame.width} × {frame.height}
        </span>
        <button
          type="button"
          class="frame-theme"
          aria-label={`Show ${frame.name} in ${next} theme`}
          title={`Show in ${next} theme`}
          onClick={() => toggleFrameTheme(key)}
        >
          {value === 'dark' ? 'Dark' : 'Light'}
        </button>
      </figcaption>
      <div class="frame-body">
        <iframe
          ref={iframe}
          title={frame.name}
          src={frameSrc(page, frame, version)}
          width={frame.width}
          height={frame.height}
          style={{ height: `${frame.height}px` }}
          onLoad={handleLoad}
        />
        {hoveredNode && hoveredNode !== selectedNode ? (
          <ElementOutline element={hoveredNode} kind="hover" />
        ) : null}
        {selectedNode ? (
          <ElementOutline element={selectedNode} kind="selected" />
        ) : null}
      </div>
    </figure>
  )
}

function viewportSize(viewport: RefObject<HTMLDivElement | null>): {
  width: number
  height: number
} {
  const rect = viewport.current?.getBoundingClientRect()
  return { width: rect?.width ?? 0, height: rect?.height ?? 0 }
}

function Toolbar({ viewportRef }: SurfaceProps): JSX.Element {
  const zoomCentered = (factor: number) => {
    const { width, height } = viewportSize(viewportRef)
    zoomAt(factor, width / 2, height / 2)
  }
  return (
    <div class="toolbar" role="toolbar" aria-label="Zoom">
      <button
        type="button"
        class="icon-button"
        aria-label="Zoom out"
        onClick={() => zoomCentered(1 / ZOOM_STEP)}
      >
        −
      </button>
      <output class="zoom" aria-live="polite">
        {Math.round(view.value.zoom * 100)}%
      </output>
      <button
        type="button"
        class="icon-button"
        aria-label="Zoom in"
        onClick={() => zoomCentered(ZOOM_STEP)}
      >
        +
      </button>
      <button
        type="button"
        class="text-button"
        onClick={() => {
          const { width, height } = viewportSize(viewportRef)
          fitView(width, height)
        }}
      >
        Fit
      </button>
    </div>
  )
}

export function Surface({ viewportRef }: SurfaceProps): JSX.Element {
  const page = currentPage.value
  const drag = useRef<{ x: number; y: number } | undefined>(undefined)

  /* Fits a page once when it opens, never on a reload of the same page. */
  useEffect(() => {
    const { width, height } = viewportSize(viewportRef)
    fitView(width, height)
  }, [page?.name])

  const handleWheelTurn = (turn: WheelTurn) => {
    if (turn.isZoom) {
      const rect = viewportRef.current?.getBoundingClientRect()
      const factor = turn.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
      zoomAt(
        factor,
        turn.clientX - (rect?.left ?? 0),
        turn.clientY - (rect?.top ?? 0),
      )
      return
    }
    panBy(-turn.deltaX, -turn.deltaY)
  }

  const handleWheel = (event: WheelEvent) => {
    event.preventDefault()
    handleWheelTurn({
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      isZoom: event.ctrlKey || event.metaKey,
      clientX: event.clientX,
      clientY: event.clientY,
    })
  }

  const handlePointerDown = (event: PointerEvent) => {
    const target = event.target as HTMLElement | null
    if (target?.closest('.frame, .toolbar')) return
    drag.current = { x: event.clientX, y: event.clientY }
    viewportRef.current?.setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent) => {
    const start = drag.current
    if (!start) return
    panBy(event.clientX - start.x, event.clientY - start.y)
    drag.current = { x: event.clientX, y: event.clientY }
  }

  const handlePointerUp = () => {
    drag.current = undefined
  }

  const { x, y, zoom } = view.value
  return (
    <main class="surface" aria-label="Canvas">
      <div
        ref={viewportRef}
        class="viewport"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          class="plane"
          style={{ transform: `translate(${x}px, ${y}px) scale(${zoom})` }}
        >
          {page?.frames.map((frame) => (
            <FrameView
              key={frame.name}
              page={page.name}
              frame={frame}
              onWheelTurn={handleWheelTurn}
            />
          ))}
        </div>
      </div>
      <Toolbar viewportRef={viewportRef} />
    </main>
  )
}
