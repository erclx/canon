import { computed, signal } from '@preact/signals'
import type { ElementAddress } from '@/canvas/address'
import type { Box, Frame, Page } from '@/canvas/content'
import type { TokenGroup } from '@/canvas/tokens'

/**
 * Everything the panels read. Type imports only from outside `client/`, since
 * this runs in the browser and a Node or Bun module would not bundle there.
 * `@/canvas/address` is the one exception the client imports for values, since
 * it imports nothing itself.
 */

export type Theme = 'light' | 'dark'

export interface TokenSource {
  readonly source: 'toolkit' | 'installed' | 'none'
  readonly files?: readonly string[]
  readonly notice?: string
  /** What the stylesheet defines, which the token picker and Theme tab list. */
  readonly groups?: readonly TokenGroup[]
}

export type LeftTab = 'pages' | 'theme'

/** One property change to the selected element, as the inspector posts it. */
export interface PendingEdit {
  readonly key: string
  readonly index: number
  readonly property: string
}

export interface FrameRef {
  readonly page: string
  readonly frame: string
}

export interface ElementRef {
  readonly index: number
  readonly tag: string
  /** Set by the server once the frame file changed since the pick. */
  readonly stale?: boolean
}

export interface SelectionRef extends FrameRef {
  readonly element?: ElementRef
}

/** A frame a session says it is editing, until the stamp it expires at. */
export interface EditingRef extends FrameRef {
  readonly by: string
  readonly until: string
}

export interface PagesRecord {
  readonly pages: readonly Page[]
  readonly tokens: TokenSource
  /** Absent when nothing is selected or the selected frame is gone. */
  readonly selection?: SelectionRef | null
  /** The live marks, which a server older than the mark leaves out. */
  readonly editing?: readonly EditingRef[]
}

export interface ChangeEvent {
  readonly page: string
  readonly file: string
}

export interface View {
  readonly x: number
  readonly y: number
  readonly zoom: number
}

export const MIN_ZOOM = 0.05
export const MAX_ZOOM = 4

export const pages = signal<readonly Page[]>([])
export const tokens = signal<TokenSource | undefined>(undefined)
export const isLoaded = signal(false)
export const loadError = signal<string | undefined>(undefined)
export const selectedPage = signal<string | undefined>(undefined)

/** Undefined follows the system, which `systemTheme` reports. */
export const themeChoice = signal<Theme | undefined>(undefined)
export const systemTheme = signal<Theme>('dark')
export const theme = computed<Theme>(
  () => themeChoice.value ?? systemTheme.value,
)

/** A frame's own theme where the operator switched it, else the chrome's. */
export const frameThemes = signal<ReadonlyMap<string, Theme>>(new Map())

/** Bumped per frame on a change, so only that frame's document reloads. */
export const frameVersions = signal<ReadonlyMap<string, number>>(new Map())

export const view = signal<View>({ x: 0, y: 0, zoom: 0.5 })

/**
 * The one frame, or element in it, the operator pointed at, which Claude reads
 * as "this one".
 */
export const selection = signal<SelectionRef | undefined>(undefined)

/** Each loaded frame's document by frame key, replaced on every reload. */
export const frameDocuments = signal<ReadonlyMap<string, Document>>(new Map())

/** The element under the pointer, in a frame or in the layers tree. */
export const hoveredElement = signal<
  { readonly key: string; readonly index: number } | undefined
>(undefined)

/** Each marked frame's mark by frame key, dropped at its `until`. */
export const editingFrames = signal<ReadonlyMap<string, EditingRef>>(new Map())

/** Frame keys whose layers are open in the pages panel. */
export const expandedFrames = signal<ReadonlySet<string>>(new Set())

/** Set while a frame follows the pointer, so the surface can style it. */
export const draggingFrame = signal<string | undefined>(undefined)

/** Why the last write to the canvas failed, until the next one succeeds. */
export const writeError = signal<string | undefined>(undefined)

export const leftTab = signal<LeftTab>('pages')

/** The edit in flight, which holds its field until the server answers. */
export const pendingEdit = signal<PendingEdit | undefined>(undefined)

/** The edit that last landed, for a moment after it does. */
export const savedEdit = signal<PendingEdit | undefined>(undefined)

const SAVED_MS = 2500

/** Why the last edit wrote nothing, until the next one lands. */
export const editRefusal = signal<string | undefined>(undefined)

/**
 * The hash an edit answered by frame key, until that frame reloads. A second
 * edit sent before the reload is made from the file the first one wrote, not
 * from the document still on screen.
 */
export const editedHashes = signal<ReadonlyMap<string, string>>(new Map())

export const currentPage = computed<Page | undefined>(() => {
  const all = pages.value
  return all.find((page) => page.name === selectedPage.value) ?? all[0]
})

/** The selected frame when it is on the page being shown. */
export const selectedFrame = computed<Frame | undefined>(() => {
  const page = currentPage.value
  const chosen = selection.value
  if (!page || chosen?.page !== page.name) return undefined
  return page.frames.find((frame) => frame.name === chosen.frame)
})

/** The selected element when its frame is on the page being shown. */
export const selectedElement = computed<
  { readonly frame: Frame; readonly element: ElementRef } | undefined
>(() => {
  const frame = selectedFrame.value
  const element = selection.value?.element
  return frame && element ? { frame, element } : undefined
})

export function frameKey(page: string, frame: Pick<Frame, 'file'>): string {
  return `${page}/${frame.file}`
}

export function frameTheme(key: string): Theme {
  return frameThemes.value.get(key) ?? theme.value
}

export function toggleTheme(): void {
  themeChoice.value = theme.value === 'dark' ? 'light' : 'dark'
}

export function toggleFrameTheme(key: string): void {
  const next = new Map(frameThemes.value)
  next.set(key, frameTheme(key) === 'dark' ? 'light' : 'dark')
  frameThemes.value = next
}

export function registerFrameDocument(key: string, doc: Document): void {
  const next = new Map(frameDocuments.value)
  next.set(key, doc)
  frameDocuments.value = next
  if (editedHashes.value.has(key)) {
    const hashes = new Map(editedHashes.value)
    hashes.delete(key)
    editedHashes.value = hashes
  }
}

function reloadFrame(key: string): void {
  const next = new Map(frameVersions.value)
  next.set(key, (next.get(key) ?? 0) + 1)
  frameVersions.value = next
}

export function toggleLayers(key: string): void {
  const next = new Set(expandedFrames.value)
  if (!next.delete(key)) next.add(key)
  expandedFrames.value = next
}

/*
 * An expiry writes no file and raises no change event, so nothing rereads the
 * page list when a mark lapses. One timer, set for the earliest `until`, drops
 * it instead, and every record resets it.
 */
let editingTimer: ReturnType<typeof setTimeout> | undefined

function liveMarks(
  marks: Iterable<readonly [string, EditingRef]>,
  now: number,
): ReadonlyMap<string, EditingRef> {
  return new Map([...marks].filter(([, mark]) => Date.parse(mark.until) > now))
}

function scheduleExpiry(): void {
  clearTimeout(editingTimer)
  editingTimer = undefined
  const next = Math.min(
    ...[...editingFrames.value.values()].map((mark) => Date.parse(mark.until)),
  )
  if (!Number.isFinite(next)) return
  editingTimer = setTimeout(
    () => {
      editingFrames.value = liveMarks(editingFrames.value, Date.now())
      scheduleExpiry()
    },
    Math.max(0, next - Date.now()),
  )
}

/** Keys each mark by the file of the frame it names, as the surface reads. */
function applyEditing(
  all: readonly Page[],
  marks: readonly EditingRef[],
): void {
  const keyed = marks.flatMap((mark) => {
    const frame = all
      .find((candidate) => candidate.name === mark.page)
      ?.frames.find((candidate) => candidate.name === mark.frame)
    return frame ? [[frameKey(mark.page, frame), mark] as const] : []
  })
  editingFrames.value = liveMarks(keyed, Date.now())
  scheduleExpiry()
}

export function applyRecord(record: PagesRecord): void {
  pages.value = record.pages
  tokens.value = record.tokens
  selection.value = record.selection ?? undefined
  applyEditing(record.pages, record.editing ?? [])
  loadError.value = undefined
  isLoaded.value = true
}

export async function loadPages(
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  try {
    const response = await fetchImpl('/api/pages')
    if (!response.ok) throw new Error(`status ${response.status}`)
    applyRecord((await response.json()) as PagesRecord)
  } catch (error) {
    loadError.value = `Could not read the canvas (${error instanceof Error ? error.message : 'unknown'}). Check canon canvas serve is still running.`
    isLoaded.value = true
  }
}

/**
 * Reloads the one frame whose file changed and rereads the page list, which
 * picks up an added frame or a moved box. The view is separate state, so
 * neither resets pan or zoom.
 */
export async function applyChange(
  change: ChangeEvent,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (change.file.endsWith('.html')) {
    reloadFrame(`${change.page}/${change.file}`)
  }
  await loadPages(fetchImpl)
}

/** What a refused element pick tells the operator, by the server's reason. */
const PICK_NOTICES: Readonly<Record<string, string | undefined>> = {
  'address-mismatch':
    'Could not select that element, since the browser and the file count the elements of this frame differently, as when the browser builds an element the file does not state.',
  'stale-address':
    'Could not select that element, since the frame changed before the pick arrived. Pick it again once the frame reloads.',
}

async function refusalReason(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.json()
    return typeof body === 'object' && body !== null && 'reason' in body
      ? String(body.reason)
      : undefined
  } catch {
    return undefined
  }
}

/**
 * Posts one write and reports a refusal in the panel rather than failing
 * silently. A refusal also rereads the page list, so a position the server
 * would not take does not stay on the surface.
 */
async function write(
  path: string,
  body: unknown,
  fetchImpl: typeof fetch,
): Promise<void> {
  try {
    const response = await fetchImpl(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      const reason = await refusalReason(response)
      writeError.value =
        (reason && PICK_NOTICES[reason]) ??
        `Could not save (status ${response.status}). Check canon canvas serve is still running.`
      await loadPages(fetchImpl)
      return
    }
    writeError.value = undefined
  } catch (error) {
    writeError.value = `Could not save (${error instanceof Error ? error.message : 'unknown'}). Check canon canvas serve is still running.`
    await loadPages(fetchImpl)
  }
}

/** Selects a frame here at once and records it where Claude reads it. */
export async function selectFrame(
  ref: FrameRef | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  selection.value = ref
  await write('/api/selection', ref ?? {}, fetchImpl)
}

/**
 * Selects one element of a frame, opens that frame's layers so the tree shows
 * the pick, and records it where Claude reads it. The server checks the
 * address against the file and refuses one it cannot match.
 */
export async function selectElement(
  ref: FrameRef,
  key: string,
  address: ElementAddress,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  selection.value = {
    ...ref,
    element: { index: address.index, tag: address.tag },
  }
  if (!expandedFrames.value.has(key)) toggleLayers(key)
  await write('/api/selection', { ...ref, element: address }, fetchImpl)
}

/** What a refused edit tells the operator, by the server's reason. */
const EDIT_NOTICES: Readonly<Record<string, string | undefined>> = {
  'stale-address':
    'The frame changed before this edit arrived, so nothing was saved. It reloads with the file as it stands now. Make the edit again there.',
  'address-mismatch':
    'Could not save, since the browser and the file count the elements of this frame differently.',
  'not-text-only':
    'Could not save the text, since this element holds other elements.',
}

/**
 * Posts one property change to the element the address names. A refusal
 * says why and reloads the frame, so a pending value never sits over a file
 * that moved under it. Resolves to what the write answered, or undefined when
 * nothing was written.
 */
export async function editElement(
  ref: FrameRef,
  key: string,
  address: ElementAddress,
  property: string,
  value: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ readonly hash?: string } | undefined> {
  const hash = editedHashes.value.get(key) ?? address.hash
  pendingEdit.value = { key, index: address.index, property }
  try {
    const response = await fetchImpl('/api/frames/edit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...ref,
        element: { ...address, hash },
        property,
        value,
      }),
    })
    const body: unknown = await response.json().catch(() => undefined)
    const record =
      typeof body === 'object' && body !== null
        ? (body as Record<string, unknown>)
        : {}
    if (!response.ok) {
      const reason = typeof record.reason === 'string' ? record.reason : ''
      const detail = typeof record.detail === 'string' ? record.detail : ''
      editRefusal.value =
        EDIT_NOTICES[reason] ??
        (reason === 'invalid-edit'
          ? `Could not save that value (${detail}).`
          : `Could not save (status ${response.status}). Check canon canvas serve is still running.`)
      reloadFrame(key)
      await loadPages(fetchImpl)
      return undefined
    }
    editRefusal.value = undefined
    const saved = pendingEdit.value
    savedEdit.value = saved
    setTimeout(() => {
      if (savedEdit.value === saved) savedEdit.value = undefined
    }, SAVED_MS)
    if (typeof record.hash !== 'string') return {}
    const hashes = new Map(editedHashes.value)
    hashes.set(key, record.hash)
    editedHashes.value = hashes
    return { hash: record.hash }
  } catch (error) {
    editRefusal.value = `Could not save (${error instanceof Error ? error.message : 'unknown'}). Check canon canvas serve is still running.`
    return undefined
  } finally {
    pendingEdit.value = undefined
  }
}

/**
 * Writes an element's new size as one edit per changed axis, width first. The
 * second carries the hash the first answered, so a frame reloading between the
 * two cannot leave it holding the hash of a file already rewritten. A refused
 * first edit sends no second.
 */
export async function resizeElement(
  ref: FrameRef,
  key: string,
  address: ElementAddress,
  width: number | undefined,
  height: number | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  let current = address
  if (width !== undefined) {
    const written = await editElement(
      ref,
      key,
      current,
      'width',
      `${width}px`,
      fetchImpl,
    )
    if (!written) return
    if (written.hash) current = { ...current, hash: written.hash }
  }
  if (height !== undefined) {
    await editElement(ref, key, current, 'height', `${height}px`, fetchImpl)
  }
}

/**
 * Moves a frame on the surface without writing, which a drag calls on every
 * pointer move. The next reread replaces it with what the layout holds.
 */
export function previewMove(ref: FrameRef, x: number, y: number): void {
  pages.value = pages.value.map((candidate) =>
    candidate.name === ref.page
      ? {
          ...candidate,
          frames: candidate.frames.map((frame) =>
            frame.name === ref.frame ? { ...frame, x, y, placed: true } : frame,
          ),
        }
      : candidate,
  )
}

/** Shows the move and writes it through the server's shared layout writer. */
export async function moveFrameTo(
  ref: FrameRef,
  x: number,
  y: number,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  previewMove(ref, x, y)
  await write('/api/frames/move', { ...ref, x, y }, fetchImpl)
}

/** Resizes a frame on the surface without writing, as a handle drag does. */
export function previewResize(ref: FrameRef, box: Box): void {
  pages.value = pages.value.map((candidate) =>
    candidate.name === ref.page
      ? {
          ...candidate,
          frames: candidate.frames.map((frame) =>
            frame.name === ref.frame
              ? { ...frame, ...box, placed: true }
              : frame,
          ),
        }
      : candidate,
  )
}

/** Shows the new box and writes it through the server's shared layout writer. */
export async function resizeFrameTo(
  ref: FrameRef,
  box: Box,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  previewResize(ref, box)
  await write('/api/frames/resize', { ...ref, ...box }, fetchImpl)
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

/** Zooms about a point in surface coordinates, keeping that point still. */
export function zoomAt(factor: number, originX: number, originY: number): void {
  const current = view.value
  const zoom = clampZoom(current.zoom * factor)
  const scale = zoom / current.zoom
  view.value = {
    zoom,
    x: originX - (originX - current.x) * scale,
    y: originY - (originY - current.y) * scale,
  }
}

export function panBy(dx: number, dy: number): void {
  const current = view.value
  view.value = { ...current, x: current.x + dx, y: current.y + dy }
}

/** Fits every frame on the current page into a viewport of the given size. */
export function fitView(width: number, height: number, padding = 48): void {
  const frames = currentPage.value?.frames ?? []
  if (frames.length === 0 || width <= 0 || height <= 0) {
    view.value = { x: padding, y: padding, zoom: 0.5 }
    return
  }
  const left = Math.min(...frames.map((frame) => frame.x))
  const top = Math.min(...frames.map((frame) => frame.y))
  const right = Math.max(...frames.map((frame) => frame.x + frame.width))
  const bottom = Math.max(...frames.map((frame) => frame.y + frame.height))
  const zoom = clampZoom(
    Math.min(
      (width - padding * 2) / (right - left),
      (height - padding * 2) / (bottom - top),
      1,
    ),
  )
  view.value = {
    zoom,
    x: padding - left * zoom,
    y: padding - top * zoom,
  }
}

/** Centers one frame in a viewport of the given size at the current zoom. */
export function focusFrame(frame: Frame, width: number, height: number): void {
  const { zoom } = view.value
  view.value = {
    zoom,
    x: width / 2 - (frame.x + frame.width / 2) * zoom,
    y: height / 2 - (frame.y + frame.height / 2) * zoom,
  }
}

/** Puts every signal back to its first value. Tests call it between cases. */
export function resetState(): void {
  pages.value = []
  tokens.value = undefined
  isLoaded.value = false
  loadError.value = undefined
  selectedPage.value = undefined
  themeChoice.value = undefined
  systemTheme.value = 'dark'
  frameThemes.value = new Map()
  frameVersions.value = new Map()
  view.value = { x: 0, y: 0, zoom: 0.5 }
  selection.value = undefined
  frameDocuments.value = new Map()
  hoveredElement.value = undefined
  editingFrames.value = new Map()
  clearTimeout(editingTimer)
  editingTimer = undefined
  expandedFrames.value = new Set()
  draggingFrame.value = undefined
  writeError.value = undefined
  leftTab.value = 'pages'
  pendingEdit.value = undefined
  savedEdit.value = undefined
  editRefusal.value = undefined
  editedHashes.value = new Map()
}
