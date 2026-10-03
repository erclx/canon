// @vitest-environment happy-dom
/** @jsxImportSource preact */
import { render } from 'preact'
import { act } from 'preact/test-utils'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { App } from '@/canvas/client/app'
import {
  applyChange,
  applyRecord,
  type PagesRecord,
  resetState,
  theme,
  view,
} from '@/canvas/client/state'
import type { Frame, Page } from '@/canvas/content'

let mount: HTMLDivElement

function frame(name: string, overrides: Partial<Frame> = {}): Frame {
  return {
    name,
    file: `${name}.html`,
    x: 0,
    y: 0,
    width: 1440,
    height: 900,
    placed: true,
    ...overrides,
  }
}

function page(name: string, frames: Frame[] = []): Page {
  return { name, frames }
}

function record(pages: Page[]): PagesRecord {
  return {
    pages,
    tokens: {
      source: 'none',
      notice: 'No token stylesheet, so frames render unstyled.',
    },
  }
}

/** Stands in for the server's page list, so a change reread finds it. */
function fetchReturning(body: PagesRecord): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch
}

function renderApp(pages: Page[]): void {
  act(() => {
    applyRecord(record(pages))
    render(<App />, mount)
  })
}

function buttonNamed(name: string): HTMLButtonElement {
  const button = [...mount.querySelectorAll('button')].find(
    (candidate) =>
      candidate.textContent?.trim() === name ||
      candidate.getAttribute('aria-label') === name,
  )
  if (!button) throw new Error(`no button named ${name}`)
  return button
}

function iframeFor(name: string): HTMLIFrameElement {
  const element = mount.querySelector<HTMLIFrameElement>(
    `figure[data-frame="${name}"] iframe`,
  )
  if (!element) throw new Error(`no frame named ${name}`)
  return element
}

interface HappyDomWindow {
  readonly happyDOM?: { settings: { disableIframePageLoading: boolean } }
}

beforeAll(() => {
  /* A frame's document is the server's to serve, and no server runs here. */
  const settings = (window as unknown as HappyDomWindow).happyDOM?.settings
  if (settings) settings.disableIframePageLoading = true
})

beforeEach(() => {
  resetState()
  mount = document.createElement('div')
  document.body.append(mount)
})

afterEach(() => {
  act(() => render(null, mount))
  mount.remove()
})

describe('PagesPanel', () => {
  it('should list every page with its frame count', () => {
    renderApp([page('approved', [frame('a')]), page('drafts')])

    const rows = [...mount.querySelectorAll('[aria-label="Pages"] button')].map(
      (row) => row.textContent,
    )

    expect(rows).toEqual(['approved1', 'drafts0'])
  })

  it('should tell the operator how to add a page when there are none', () => {
    renderApp([])

    expect(mount.textContent).toContain('canon canvas page add <name>')
  })

  it('should show the frames of the page the operator picks', () => {
    renderApp([page('approved', [frame('a')]), page('drafts', [frame('b')])])

    act(() => buttonNamed('drafts1').click())

    const frames = [
      ...mount.querySelectorAll('[aria-label="Frames"] .row-label'),
    ].map((row) => row.textContent)
    expect(frames).toEqual(['b'])
    expect(buttonNamed('drafts1').getAttribute('aria-current')).toBe('page')
  })

  it('should tell the operator how to add a frame to an empty page', () => {
    renderApp([page('drafts')])

    expect(mount.textContent).toContain('canon canvas frame add drafts <name>')
  })
})

describe('Surface', () => {
  it('should place each frame at its box with its name above it', () => {
    renderApp([
      page('drafts', [
        frame('hero', { x: 40, y: 60, width: 390, height: 844 }),
      ]),
    ])

    const figure = mount.querySelector<HTMLElement>('figure[data-frame="hero"]')
    expect(figure?.style.left).toBe('40px')
    expect(figure?.style.top).toBe('60px')
    expect(figure?.style.width).toBe('390px')
    expect(figure?.querySelector('figcaption')?.textContent).toContain('hero')
    expect(iframeFor('hero').getAttribute('src')).toBe(
      '/frames/drafts/hero.html',
    )
  })

  it('should zoom in from the toolbar', () => {
    renderApp([page('drafts', [frame('hero')])])
    const before = view.value.zoom

    act(() => buttonNamed('Zoom in').click())

    expect(view.value.zoom).toBeGreaterThan(before)
  })
})

describe('theme', () => {
  it('should switch the chrome theme from the toggle', () => {
    renderApp([])

    act(() => buttonNamed('Switch to light theme').click())

    expect(theme.value).toBe('light')
    expect(buttonNamed('Switch to dark theme')).toBeDefined()
  })

  it('should switch one frame without switching the chrome', () => {
    renderApp([page('drafts', [frame('a'), frame('b')])])

    act(() => buttonNamed('Show a in light theme').click())

    expect(theme.value).toBe('dark')
    expect(buttonNamed('Show a in dark theme')).toBeDefined()
    expect(buttonNamed('Show b in light theme')).toBeDefined()
  })
})

describe('applyChange', () => {
  it('should reload only the frame whose file changed', async () => {
    const pages = [page('drafts', [frame('a'), frame('b')])]
    renderApp(pages)

    await act(async () => {
      await applyChange(
        { page: 'drafts', file: 'a.html' },
        fetchReturning(record(pages)),
      )
    })

    expect(iframeFor('a').getAttribute('src')).toBe('/frames/drafts/a.html?v=1')
    expect(iframeFor('b').getAttribute('src')).toBe('/frames/drafts/b.html')
  })

  it('should keep the pan and zoom across a reload', async () => {
    const pages = [page('drafts', [frame('a')])]
    renderApp(pages)
    act(() => {
      view.value = { x: 120, y: -40, zoom: 0.8 }
    })

    await act(async () => {
      await applyChange(
        { page: 'drafts', file: 'a.html' },
        fetchReturning(record(pages)),
      )
    })

    expect(view.value).toEqual({ x: 120, y: -40, zoom: 0.8 })
  })

  it('should show a frame added while the canvas is open', async () => {
    renderApp([page('drafts', [frame('a')])])

    await act(async () => {
      await applyChange(
        { page: 'drafts', file: 'layout.json' },
        fetchReturning(record([page('drafts', [frame('a'), frame('b')])])),
      )
    })

    expect(iframeFor('b')).toBeDefined()
  })
})

describe('Details', () => {
  it('should say where tokens would come from when none resolve', () => {
    renderApp([page('drafts')])

    expect(mount.querySelector('.panel-right')?.textContent).toContain(
      'No token stylesheet',
    )
  })
})
