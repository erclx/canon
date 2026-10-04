/** @jsxImportSource preact */
import type { JSX, RefObject } from 'preact'
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import { addressOf, documentElements, elementAt } from '@/canvas/address'
import type { Frame } from '@/canvas/content'
import { type SurfaceAction, surfaceAction } from '@/canvas/client/keys'
import {
  activeTool,
  currentPage,
  draggingFrame,
  editingFrames,
  fitView,
  type FrameRef,
  frameDocuments,
  frameKey,
  frameTheme,
  frameVersions,
  historyNotice,
  hoveredElement,
  moveFrameTo,
  panBy,
  panelsHidden,
  previewMove,
  previewResize,
  redo,
  registerFrameDocument,
  resizeElement,
  resizeFrameTo,
  selectElement,
  selectFrame,
  selection,
  shownTool,
  spacePan,
  type Theme,
  toggleFrameTheme,
  togglePanels,
  undo,
  view,
  zoomAt,
} from '@/canvas/client/state'
import {
  DRAG_THRESHOLD,
  HoverOutline,
  type OverlayBox,
  SelectionOverlay,
} from '@/canvas/client/selection'
import { ToolStrip } from '@/canvas/client/tools'

/** One wheel notch or one button press. */
const ZOOM_STEP = 1.2

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

/**
 * Whether a key belongs to the element it was typed in rather than to the
 * canvas: any key in a field, and Space on a control it activates. A frame's
 * draft can hold its own fields, and their keys arrive through the forwarding.
 */
function isOwnedByTarget(event: KeyboardEvent, action: SurfaceAction): boolean {
  const target = asElement(event.target)
  if (!target) return false
  if ((target as HTMLElement).isContentEditable) return true
  if (target.closest('input, textarea, select')) return true
  return (
    action === 'pan-hold' && target.closest('button, a[href], summary') !== null
  )
}

/**
 * A press read as a second click selects a word or a whole frame even while
 * panning, so no selection may start in the shell or a frame then.
 */
function blockSelectionWhilePanning(event: Event): void {
  if (shownTool.value === 'pan') event.preventDefault()
}

/** Drops any selection in the shell and in every loaded frame document. */
function clearSelections(): void {
  document.getSelection()?.removeAllRanges()
  for (const doc of frameDocuments.value.values()) {
    doc.getSelection()?.removeAllRanges()
  }
}

/** A computed length in pixels, or the fallback for one that is not. */
function pixels(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value)
  return value.endsWith('px') && Number.isFinite(parsed) ? parsed : fallback
}

/**
 * The selected element's overlay. A handle drag previews the size as inline
 * style on the element and writes it once on release, the way the inspector's
 * scrub does. The drag measures the border box while `width` and `height` set
 * whatever box the element sizes by, so the delta is added to the computed
 * value rather than written as the box itself.
 */
function ElementSelection({
  node,
  doc,
  frameRef,
  docKey,
}: {
  readonly node: Element
  readonly doc: Document
  readonly frameRef: FrameRef
  readonly docKey: string
}): JSX.Element {
  const start = useRef<
    | {
        readonly width: number
        readonly height: number
        readonly inlineWidth: string
        readonly inlineHeight: string
      }
    | undefined
  >(undefined)
  const style = (node as HTMLElement).style

  const measure = () => {
    const rect = node.getBoundingClientRect()
    return { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
  }

  const cssSize = (box: OverlayBox, origin: OverlayBox) => {
    const from = start.current
    return {
      width: Math.round(
        (from?.width ?? origin.width) + box.width - origin.width,
      ),
      height: Math.round(
        (from?.height ?? origin.height) + box.height - origin.height,
      ),
    }
  }

  const handleStart = () => {
    const computed = doc.defaultView?.getComputedStyle(node)
    const rect = node.getBoundingClientRect()
    start.current = {
      width: pixels(computed?.width ?? '', rect.width),
      height: pixels(computed?.height ?? '', rect.height),
      inlineWidth: style.getPropertyValue('width'),
      inlineHeight: style.getPropertyValue('height'),
    }
  }

  const handlePreview = (box: OverlayBox, from: OverlayBox) => {
    const size = cssSize(box, from)
    style.setProperty('width', `${size.width}px`)
    style.setProperty('height', `${size.height}px`)
  }

  const restore = () => {
    const from = start.current
    if (!from) return
    style.setProperty('width', from.inlineWidth)
    style.setProperty('height', from.inlineHeight)
  }

  const handleCommit = (box: OverlayBox, from: OverlayBox) => {
    const size = cssSize(box, from)
    const address = addressOf(doc, node)
    const isUnchanged = box.width === from.width && box.height === from.height
    if (!address || isUnchanged) {
      restore()
      return
    }
    void resizeElement(
      frameRef,
      docKey,
      address,
      box.width === from.width ? undefined : size.width,
      box.height === from.height ? undefined : size.height,
    )
  }

  const handleCancel = restore

  return (
    <SelectionOverlay
      kind="element"
      measure={measure}
      hasChip
      isMeasuredWhileDragging
      onStart={handleStart}
      onPreview={handlePreview}
      onCommit={handleCommit}
      onCancel={handleCancel}
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
  onKey,
}: {
  readonly page: string
  readonly frame: Frame
  readonly onWheelTurn: (turn: WheelTurn) => void
  readonly onKey: (event: KeyboardEvent) => void
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
  const editing = editingFrames.value.get(key)

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
    /*
     * A click inside the frame moves focus into its window, so the surface
     * hears no key after the first pick unless the frame passes it on.
     */
    loaded.addEventListener('keydown', onKey)
    loaded.addEventListener('keyup', onKey)
    loaded.addEventListener('selectstart', blockSelectionWhilePanning)
    loaded.defaultView?.addEventListener('blur', () => {
      spacePan.value = undefined
    })
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

  /* The label means the frame itself, so it also drops a picked element. */
  const select = () => {
    if (!isSelected || selection.value?.element) void selectFrame(ref)
  }

  const handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    /* A pan drag starting on the label belongs to the surface behind it. */
    if (shownTool.value === 'pan') return
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
    if (event.key === 'Enter') {
      event.preventDefault()
      select()
      return
    }
    const step = event.shiftKey ? NUDGE_LARGE : NUDGE
    const delta = ARROWS[event.key]
    if (!delta || !isSelected) return
    event.preventDefault()
    /* The keyboard path for a handle drag: right and down grow the frame. */
    if (event.ctrlKey || event.metaKey) {
      void resizeFrameTo(ref, {
        x: frame.x,
        y: frame.y,
        width: Math.max(1, frame.width + delta.x * step),
        height: Math.max(1, frame.height + delta.y * step),
      })
      return
    }
    void moveFrameTo(ref, frame.x + delta.x * step, frame.y + delta.y * step)
  }

  /*
   * Space held pans, so it selects on release instead, and only when no drag
   * moved the view while it was down. This runs before the surface's own
   * release clears the pan.
   */
  const handleKeyUp = (event: KeyboardEvent) => {
    if (event.target !== event.currentTarget || event.key !== ' ') return
    if (spacePan.value !== 'dragged') select()
  }

  const frameBox = (): OverlayBox => ({
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
  })

  const next = value === 'dark' ? 'light' : 'dark'
  return (
    <figure
      class="frame"
      data-frame={frame.name}
      data-selected={isSelected ? 'true' : undefined}
      data-picked={picked ? 'true' : undefined}
      data-dragging={draggingFrame.value === frame.name ? 'true' : undefined}
      data-editing={editing ? 'true' : undefined}
      tabIndex={0}
      aria-label={`${frame.name}, ${frame.width} by ${frame.height}${editing ? `, ${editing.by} editing` : ''}`}
      aria-current={isSelected ? 'true' : undefined}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
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
        {/* Rendered empty while unmarked, so a mark landing is announced. */}
        <span class="frame-editing" aria-live="polite">
          {editing ? `${editing.by} editing` : ''}
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
          <HoverOutline element={hoveredNode} />
        ) : null}
        {isSelected && !picked ? (
          <SelectionOverlay
            kind="frame"
            measure={frameBox}
            offset={{ x: frame.x, y: frame.y }}
            onPreview={(box) => previewResize(ref, box)}
            onCommit={(box) => void resizeFrameTo(ref, box)}
            onCancel={(origin) => previewResize(ref, origin)}
          />
        ) : null}
        {doc && selectedNode ? (
          <ElementSelection
            node={selectedNode}
            doc={doc}
            frameRef={ref}
            docKey={key}
          />
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

/** The zoom toolbar's actions, which its keys call as well. */
function zoomCentered(
  viewport: RefObject<HTMLDivElement | null>,
  factor: number,
): void {
  const { width, height } = viewportSize(viewport)
  zoomAt(factor, width / 2, height / 2)
}

/** Fits the page clear of the tool strip floating over the viewport's left. */
function fitViewport(viewport: RefObject<HTMLDivElement | null>): void {
  const rect = viewport.current?.getBoundingClientRect()
  const strip = viewport.current?.parentElement
    ?.querySelector('.tools')
    ?.getBoundingClientRect()
  const inset = rect && strip ? Math.max(0, strip.right - rect.left) : 0
  fitView(rect?.width ?? 0, rect?.height ?? 0, undefined, inset)
}

function Toolbar({ viewportRef }: SurfaceProps): JSX.Element {
  return (
    <div class="toolbar" role="toolbar" aria-label="Zoom">
      <button
        type="button"
        class="icon-button"
        aria-label="Zoom out"
        aria-keyshortcuts="-"
        title="Zoom out (-)"
        onClick={() => zoomCentered(viewportRef, 1 / ZOOM_STEP)}
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
        aria-keyshortcuts="+"
        title="Zoom in (+)"
        onClick={() => zoomCentered(viewportRef, ZOOM_STEP)}
      >
        +
      </button>
      <button
        type="button"
        class="text-button"
        aria-keyshortcuts="Shift+1"
        title="Fit (Shift+1)"
        onClick={() => fitViewport(viewportRef)}
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
    fitViewport(viewportRef)
  }, [page?.name])

  /*
   * A panel hiding, showing, or resizing moves the viewport's left edge, so
   * the view shifts by as much the other way and the frames hold still on
   * screen. Reading the flag subscribes this component to it.
   */
  const viewportLeft = useRef<number | undefined>(undefined)
  const isHidden = panelsHidden.value
  useLayoutEffect(() => {
    const left = viewportRef.current?.getBoundingClientRect().left
    if (left === undefined) return
    const before = viewportLeft.current
    viewportLeft.current = left
    if (before !== undefined && before !== left) panBy(before - left, 0)
  }, [isHidden])

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

  /* A pan held when the window loses focus never hears its Space come up. */
  useEffect(() => {
    const endPan = () => {
      spacePan.value = undefined
    }
    window.addEventListener('blur', endPan)
    document.addEventListener('selectstart', blockSelectionWhilePanning)
    return () => {
      window.removeEventListener('blur', endPan)
      document.removeEventListener('selectstart', blockSelectionWhilePanning)
    }
  }, [])

  const runAction = (action: SurfaceAction) => {
    switch (action) {
      case 'tool-move':
        activeTool.value = 'move'
        return
      case 'tool-pan':
        activeTool.value = 'pan'
        return
      case 'zoom-in':
        zoomCentered(viewportRef, ZOOM_STEP)
        return
      case 'zoom-out':
        zoomCentered(viewportRef, 1 / ZOOM_STEP)
        return
      case 'zoom-fit':
        fitViewport(viewportRef)
        return
      case 'pan-hold':
        spacePan.value ??= 'held'
        return
      case 'pan-release':
        spacePan.value = undefined
        return
      case 'undo':
        void undo()
        return
      case 'redo':
        void redo()
        return
      case 'panels-toggle':
        togglePanels()
    }
  }

  /*
   * The surface's one key handler, which every frame document feeds too. The
   * default is prevented only for a key press it takes, so Space stops
   * scrolling a frame it pans and every other key keeps its own meaning. A
   * release always ends the pan and never claims the keyup, since a button
   * fires its Space activation there.
   */
  const handleKey = (event: KeyboardEvent) => {
    const action = surfaceAction(event)
    if (!action) return
    if (action === 'pan-release') {
      runAction(action)
      return
    }
    if (isOwnedByTarget(event, action)) return
    event.preventDefault()
    runAction(action)
  }

  const handlePointerDown = (event: PointerEvent) => {
    const target = event.target as HTMLElement | null
    if (shownTool.value !== 'pan' && target?.closest('.frame')) return
    /* A selection left over would paint over every frame the pan crosses. */
    if (shownTool.value === 'pan') clearSelections()
    drag.current = { x: event.clientX, y: event.clientY }
    viewportRef.current?.setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent) => {
    const start = drag.current
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    panBy(dx, dy)
    drag.current = { x: event.clientX, y: event.clientY }
    if (spacePan.value === 'held' && (dx !== 0 || dy !== 0)) {
      spacePan.value = 'dragged'
    }
  }

  /*
   * A press selects text by default, a word or a whole frame when it reads as
   * a second click, and neither `selectstart` nor a clear at pointer down
   * reaches that. Under a held Space, focus stays where it was so the frame
   * still hears the release. Under the Pan tool the press takes focus itself,
   * as the default would have, so a field it leaves commits and the next key
   * reaches the layer.
   */
  const handleMouseDown = (event: MouseEvent) => {
    if (shownTool.value !== 'pan') return
    event.preventDefault()
    if (!spacePan.value) {
      const surface = (event.currentTarget as HTMLElement).closest('main')
      surface?.focus({ preventScroll: true })
    }
  }

  const handlePointerUp = () => {
    if (drag.current && shownTool.value === 'pan') clearSelections()
    drag.current = undefined
  }

  const { x, y, zoom } = view.value
  return (
    <main
      class="surface"
      aria-label="Canvas"
      tabIndex={0}
      data-tool={shownTool.value}
      onKeyDown={handleKey}
      onKeyUp={handleKey}
    >
      <div
        ref={viewportRef}
        class="viewport"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onMouseDown={handleMouseDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          class="plane"
          style={{
            transform: `translate(${x}px, ${y}px) scale(${zoom})`,
            /* Lets an outline inside the plane hold its screen weight at any zoom. */
            '--outline-scale': String(1 / zoom),
          }}
        >
          {page?.frames.map((frame) => (
            <FrameView
              key={frame.name}
              page={page.name}
              frame={frame}
              onWheelTurn={handleWheelTurn}
              onKey={handleKey}
            />
          ))}
        </div>
      </div>
      <ToolStrip />
      <Toolbar viewportRef={viewportRef} />
      {historyNotice.value ? (
        <p class="history-notice" role="status">
          {historyNotice.value}
        </p>
      ) : null}
    </main>
  )
}
