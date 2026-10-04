/** @jsxImportSource preact */
import { effect } from '@preact/signals'
import type { JSX } from 'preact'
import { useLayoutEffect, useRef } from 'preact/hooks'
import { Inspector } from '@/canvas/client/inspector'
import { PagesPanel } from '@/canvas/client/pages-panel'
import {
  currentPage,
  focusFrame,
  panelsHidden,
  tokens,
} from '@/canvas/client/state'
import { Surface } from '@/canvas/client/surface'

const SOURCE_LABEL = {
  toolkit: 'This toolkit',
  installed: 'Installed design',
  none: 'None',
} as const

function TokenDetails(): JSX.Element | null {
  const value = tokens.value
  if (!value) return null
  return (
    <section aria-labelledby="tokens-heading">
      <h2 id="tokens-heading" class="section-label">
        Tokens
      </h2>
      <p class="detail">{SOURCE_LABEL[value.source]}</p>
      {value.files && value.files.length > 0 ? (
        <ul class="files">
          {value.files.map((file) => (
            <li key={file} title={file}>
              <code>{file}</code>
            </li>
          ))}
        </ul>
      ) : null}
      {value.notice ? <p class="notice">{value.notice}</p> : null}
    </section>
  )
}

function PageDetails(): JSX.Element | null {
  const page = currentPage.value
  if (!page) return null
  const unplaced = page.frames.filter((frame) => !frame.placed).length
  return (
    <section aria-labelledby="page-heading">
      <h2 id="page-heading" class="section-label">
        Page
      </h2>
      <p class="detail" title={page.name}>
        {page.name}
      </p>
      <p class="detail-meta">
        {page.frames.length} {page.frames.length === 1 ? 'frame' : 'frames'}
      </p>
      {unplaced > 0 ? (
        <p class="notice">
          {unplaced} {unplaced === 1 ? 'frame has' : 'frames have'} no box in
          layout.json and sit in a default row.
        </p>
      ) : null}
      {page.layoutIssue === 'malformed' ? (
        <p class="notice" role="alert">
          layout.json does not parse, so every frame sits in a default row. Fix
          the file to restore their places.
        </p>
      ) : null}
    </section>
  )
}

const PANELS_KEY = 'canon-canvas-panels'

interface StoredPanels {
  readonly hidden: boolean
}

/** What the last visit left, with anything unreadable read as the default. */
function readStoredPanels(): StoredPanels {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(PANELS_KEY) ?? '{}')
    const record =
      typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {}
    return { hidden: record.hidden === true }
  } catch {
    return { hidden: false }
  }
}

function storePanels(panels: StoredPanels): void {
  try {
    localStorage.setItem(PANELS_KEY, JSON.stringify(panels))
  } catch {
    /* A blocked store costs the remembered layout, nothing else. */
  }
}

/**
 * Restores the panels the last visit left and stores each change, the way the
 * theme pick is kept. The read lands before the first paint, so a hidden
 * layout never flashes open.
 */
function usePanelPreference(): void {
  useLayoutEffect(() => {
    panelsHidden.value = readStoredPanels().hidden
    return effect(() => storePanels({ hidden: panelsHidden.value }))
  }, [])
}

export function App(): JSX.Element {
  const viewportRef = useRef<HTMLDivElement>(null)
  usePanelPreference()
  return (
    <div class={panelsHidden.value ? 'shell panels-hidden' : 'shell'}>
      <PagesPanel
        onFocusFrame={(frame) => {
          const rect = viewportRef.current?.getBoundingClientRect()
          focusFrame(frame, rect?.width ?? 0, rect?.height ?? 0)
        }}
      />
      <Surface viewportRef={viewportRef} />
      <aside class="panel panel-right" aria-label="Details">
        <Inspector />
        <PageDetails />
        <TokenDetails />
      </aside>
    </div>
  )
}
