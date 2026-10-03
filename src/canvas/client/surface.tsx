/** @jsxImportSource preact */
import type { JSX, RefObject } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import type { Frame } from '@/canvas/content'
import {
  currentPage,
  fitView,
  frameKey,
  frameTheme,
  frameVersions,
  panBy,
  type Theme,
  toggleFrameTheme,
  view,
  zoomAt,
} from '@/canvas/client/state'

/** One wheel notch or one button press. */
const ZOOM_STEP = 1.2

export interface SurfaceProps {
  readonly viewportRef: RefObject<HTMLDivElement | null>
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
}: {
  readonly page: string
  readonly frame: Frame
}): JSX.Element {
  const key = frameKey(page, frame)
  const version = frameVersions.value.get(key) ?? 0
  const value = frameTheme(key)
  const iframe = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    applyFrameTheme(iframe.current, value)
  }, [value])

  const next = value === 'dark' ? 'light' : 'dark'
  return (
    <figure
      class="frame"
      data-frame={frame.name}
      style={{
        left: `${frame.x}px`,
        top: `${frame.y}px`,
        width: `${frame.width}px`,
      }}
    >
      <figcaption class="frame-label">
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
      <iframe
        ref={iframe}
        title={frame.name}
        src={frameSrc(page, frame, version)}
        width={frame.width}
        height={frame.height}
        style={{ height: `${frame.height}px` }}
        onLoad={() => applyFrameTheme(iframe.current, frameTheme(key))}
      />
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

  const handleWheel = (event: WheelEvent) => {
    event.preventDefault()
    if (event.ctrlKey || event.metaKey) {
      const rect = viewportRef.current?.getBoundingClientRect()
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
      zoomAt(
        factor,
        event.clientX - (rect?.left ?? 0),
        event.clientY - (rect?.top ?? 0),
      )
      return
    }
    panBy(-event.deltaX, -event.deltaY)
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
            <FrameView key={frame.name} page={page.name} frame={frame} />
          ))}
        </div>
      </div>
      <Toolbar viewportRef={viewportRef} />
    </main>
  )
}
