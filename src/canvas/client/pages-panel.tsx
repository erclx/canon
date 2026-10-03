/** @jsxImportSource preact */
import type { JSX } from 'preact'
import type { Frame } from '@/canvas/content'
import {
  currentPage,
  isLoaded,
  loadError,
  pages,
  selectedPage,
  theme,
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
      {page.frames.map((frame) => (
        <li key={frame.name}>
          <button
            type="button"
            class="row"
            title={frame.name}
            onClick={() => onFocusFrame(frame)}
          >
            <span class="row-label">{frame.name}</span>
            <span class="row-meta">{frame.width}</span>
          </button>
        </li>
      ))}
    </ul>
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
      ) : (
        <>
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
