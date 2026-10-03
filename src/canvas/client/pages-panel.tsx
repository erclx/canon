/** @jsxImportSource preact */
import type { JSX } from 'preact'
import { Layers } from '@/canvas/client/layers'
import { ThemePanel } from '@/canvas/client/theme-panel'
import type { Frame } from '@/canvas/content'
import {
  currentPage,
  expandedFrames,
  frameKey,
  isLoaded,
  type LeftTab,
  leftTab,
  loadError,
  pages,
  selectedFrame,
  selectedPage,
  selectFrame,
  theme,
  toggleLayers,
  toggleTheme,
} from '@/canvas/client/state'

export interface PagesPanelProps {
  /** Brings a frame into view on the surface. */
  readonly onFocusFrame: (frame: Frame) => void
}

function ThemeToggle(): JSX.Element {
  const next = theme.value === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      class="icon-button"
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      onClick={toggleTheme}
    >
      <span aria-hidden="true">{theme.value === 'dark' ? '☾' : '☀'}</span>
    </button>
  )
}

function PageList(): JSX.Element {
  if (pages.value.length === 0) {
    return (
      <p class="empty">
        No pages yet. Run <code>canon canvas page add &lt;name&gt;</code> to add
        one.
      </p>
    )
  }
  const current = currentPage.value?.name
  return (
    <ul class="list" aria-label="Pages">
      {pages.value.map((page) => (
        <li key={page.name}>
          <button
            type="button"
            class="row"
            aria-current={page.name === current ? 'page' : undefined}
            title={page.name}
            onClick={() => {
              selectedPage.value = page.name
            }}
          >
            <span class="row-label">{page.name}</span>
            <span class="row-meta">{page.frames.length}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function FrameList({ onFocusFrame }: PagesPanelProps): JSX.Element | null {
  const page = currentPage.value
  if (!page) return null
  if (page.frames.length === 0) {
    return (
      <p class="empty">
        No frames on this page. Run{' '}
        <code>canon canvas frame add {page.name} &lt;name&gt;</code> to add one.
      </p>
    )
  }
  return (
    <ul class="list" aria-label="Frames">
      {page.frames.map((frame) => {
        const key = frameKey(page.name, frame)
        const isOpen = expandedFrames.value.has(key)
        return (
          <li key={frame.name}>
            <div class="frame-row">
              <button
                type="button"
                class="disclosure"
                aria-expanded={isOpen}
                aria-label={`${isOpen ? 'Hide' : 'Show'} layers of ${frame.name}`}
                title={`${isOpen ? 'Hide' : 'Show'} layers`}
                onClick={() => toggleLayers(key)}
              >
                <span aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
              </button>
              <button
                type="button"
                class="row"
                title={frame.name}
                aria-current={
                  frame.name === selectedFrame.value?.name ? 'true' : undefined
                }
                onClick={() => {
                  onFocusFrame(frame)
                  void selectFrame({ page: page.name, frame: frame.name })
                }}
              >
                <span class="row-label">{frame.name}</span>
                <span class="row-meta">{frame.width}</span>
              </button>
            </div>
            {isOpen ? (
              <Layers
                frame={{ page: page.name, frame: frame.name }}
                frameKey={key}
              />
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

const TABS: readonly { readonly id: LeftTab; readonly label: string }[] = [
  { id: 'pages', label: 'Pages' },
  { id: 'theme', label: 'Theme' },
]

/** Two tabs, so the arrow keys move between them and wrap. */
function Tabs(): JSX.Element {
  const select = (at: number) => {
    const tab = TABS[(at + TABS.length) % TABS.length]
    if (!tab) return
    leftTab.value = tab.id
    document.getElementById(`tab-${tab.id}`)?.focus()
  }
  return (
    <div class="tabs" role="tablist" aria-label="Left panel">
      {TABS.map((tab, at) => {
        const isSelected = leftTab.value === tab.id
        return (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            type="button"
            role="tab"
            class="tab"
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => {
              leftTab.value = tab.id
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') select(at + 1)
              if (event.key === 'ArrowLeft') select(at - 1)
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export function PagesPanel(props: PagesPanelProps): JSX.Element {
  return (
    <nav class="panel panel-left" aria-label="Pages and frames">
      <header class="panel-head">
        <span class="brand">Canvas</span>
        <ThemeToggle />
      </header>
      {loadError.value ? (
        <p class="empty" role="alert">
          {loadError.value}
        </p>
      ) : !isLoaded.value ? (
        <p class="empty">Loading</p>
      ) : leftTab.value === 'theme' ? (
        <>
          <Tabs />
          <ThemePanel />
        </>
      ) : (
        <>
          <Tabs />
          <h2 class="section-label">Pages</h2>
          <PageList />
          {currentPage.value ? (
            <>
              <h2 class="section-label">Frames</h2>
              <FrameList {...props} />
            </>
          ) : null}
        </>
      )}
    </nav>
  )
}
