import { computed, signal } from '@preact/signals'
import type { Frame, Page } from '@/canvas/content'

/**
 * Everything the panels read. Type imports only from outside `client/`, since
 * this runs in the browser and a Node or Bun module would not bundle there.
 */

export type Theme = 'light' | 'dark'

export interface TokenSource {
  readonly source: 'toolkit' | 'installed' | 'none'
  readonly files?: readonly string[]
  readonly notice?: string
}

export interface PagesRecord {
  readonly pages: readonly Page[]
  readonly tokens: TokenSource
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

export const currentPage = computed<Page | undefined>(() => {
  const all = pages.value
  return all.find((page) => page.name === selectedPage.value) ?? all[0]
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

export function applyRecord(record: PagesRecord): void {
  pages.value = record.pages
  tokens.value = record.tokens
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
    const key = `${change.page}/${change.file}`
    const next = new Map(frameVersions.value)
    next.set(key, (next.get(key) ?? 0) + 1)
    frameVersions.value = next
  }
  await loadPages(fetchImpl)
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
}
