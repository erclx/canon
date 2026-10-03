// @vitest-environment happy-dom
/** @jsxImportSource preact */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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

interface SentRequest {
  readonly url: string
  readonly body: unknown
}

let sent: SentRequest[] = []
const realFetch = globalThis.fetch

/** Stands in for the server's write routes, which no server answers here. */
function recordWrites(): void {
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    sent.push({
      url: String(url),
      body: JSON.parse(String(init?.body ?? 'null')),
    })
    return new Response('{"ok":true}', {
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch
}

/** Refuses every write and answers the reread with the pages given. */
function failWrites(pages: Page[]): void {
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) =>
    init?.method === 'POST'
      ? new Response('{"ok":false,"reason":"no-frame","detail":"gone"}', {
          status: 404,
          headers: { 'content-type': 'application/json' },
        })
      : new Response(JSON.stringify(record(pages)), {
          headers: { 'content-type': 'application/json' },
        })) as typeof fetch
}

beforeEach(() => {
  resetState()
  sent = []
  recordWrites()
  mount = document.createElement('div')
  document.body.append(mount)
})

afterEach(() => {
  act(() => render(null, mount))
  mount.remove()
  globalThis.fetch = realFetch
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

function figureFor(name: string): HTMLElement {
  const element = mount.querySelector<HTMLElement>(
    `figure[data-frame="${name}"]`,
  )
  if (!element) throw new Error(`no frame named ${name}`)
  return element
}

function shieldFor(name: string): HTMLElement {
  const element = figureFor(name).querySelector<HTMLElement>('.frame-shield')
  if (!element) throw new Error(`no shield on ${name}`)
  return element
}

function pointer(
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  target: HTMLElement,
  x: number,
  y: number,
): void {
  act(() => {
    target.dispatchEvent(
      new PointerEvent(type, { bubbles: true, clientX: x, clientY: y }),
    )
  })
}

function press(target: HTMLElement, key: string): void {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  })
}

function sentTo(path: string): unknown[] {
  return sent.filter((request) => request.url === path).map((r) => r.body)
}

describe('selection', () => {
  it('should outline a frame the operator presses and record it', () => {
    renderApp([page('drafts', [frame('hero'), frame('phone')])])

    pointer('pointerdown', shieldFor('hero'), 10, 10)
    pointer('pointerup', shieldFor('hero'), 10, 10)

    expect(figureFor('hero').dataset.selected).toBe('true')
    expect(figureFor('phone').dataset.selected).toBeUndefined()
    expect(sentTo('/api/selection')).toEqual([
      { page: 'drafts', frame: 'hero' },
    ])
  })

  it('should select on the surface the frame picked in the list', () => {
    renderApp([page('drafts', [frame('hero'), frame('phone')])])

    act(() => buttonNamed('phone1440').click())

    expect(figureFor('phone').dataset.selected).toBe('true')
    expect(sentTo('/api/selection')).toEqual([
      { page: 'drafts', frame: 'phone' },
    ])
  })

  it('should mark in the list the frame picked on the surface', () => {
    renderApp([page('drafts', [frame('hero'), frame('phone')])])

    pointer('pointerdown', shieldFor('phone'), 10, 10)
    pointer('pointerup', shieldFor('phone'), 10, 10)

    expect(buttonNamed('phone1440').getAttribute('aria-current')).toBe('true')
    expect(buttonNamed('hero1440').getAttribute('aria-current')).toBeNull()
  })

  it('should outline the frame a reread says is selected', () => {
    act(() => {
      applyRecord({
        ...record([page('drafts', [frame('hero')])]),
        selection: { page: 'drafts', frame: 'hero' },
      })
      render(<App />, mount)
    })

    expect(figureFor('hero').dataset.selected).toBe('true')
  })

  it('should outline nothing when the reread names no frame', () => {
    renderApp([page('drafts', [frame('hero')])])
    pointer('pointerdown', shieldFor('hero'), 10, 10)
    pointer('pointerup', shieldFor('hero'), 10, 10)

    act(() => applyRecord(record([page('drafts', [frame('hero')])])))

    expect(figureFor('hero').dataset.selected).toBeUndefined()
  })
})

describe('drag', () => {
  it('should follow the pointer in surface units and write the new position on release', () => {
    renderApp([page('drafts', [frame('hero', { x: 40, y: 60 })])])
    const shield = shieldFor('hero')

    pointer('pointerdown', shield, 100, 100)
    pointer('pointermove', shield, 150, 130)
    expect(figureFor('hero').style.left).toBe('140px')
    expect(figureFor('hero').style.top).toBe('120px')
    pointer('pointerup', shield, 150, 130)

    expect(sentTo('/api/frames/move')).toEqual([
      { page: 'drafts', frame: 'hero', x: 140, y: 120 },
    ])
  })

  it('should write nothing for a press that never moved', () => {
    renderApp([page('drafts', [frame('hero')])])
    const shield = shieldFor('hero')

    pointer('pointerdown', shield, 100, 100)
    pointer('pointerup', shield, 100, 100)

    expect(sentTo('/api/frames/move')).toEqual([])
  })

  it('should not pan the surface while a frame is dragged', () => {
    renderApp([page('drafts', [frame('hero')])])
    const before = view.value
    const shield = shieldFor('hero')

    pointer('pointerdown', shield, 100, 100)
    pointer('pointermove', shield, 180, 160)
    pointer('pointerup', shield, 180, 160)

    expect(view.value).toEqual(before)
  })

  it('should move the selected frame with the arrow keys', () => {
    renderApp([page('drafts', [frame('hero', { x: 40, y: 60 })])])
    pointer('pointerdown', shieldFor('hero'), 10, 10)
    pointer('pointerup', shieldFor('hero'), 10, 10)

    press(figureFor('hero'), 'ArrowRight')
    press(figureFor('hero'), 'ArrowDown')

    expect(sentTo('/api/frames/move')).toEqual([
      { page: 'drafts', frame: 'hero', x: 50, y: 60 },
      { page: 'drafts', frame: 'hero', x: 50, y: 70 },
    ])
  })

  it('should select with Enter from the keyboard', () => {
    renderApp([page('drafts', [frame('hero')])])

    press(figureFor('hero'), 'Enter')

    expect(figureFor('hero').dataset.selected).toBe('true')
  })

  it('should tell the operator when the position could not be written', async () => {
    const pages = [page('drafts', [frame('hero', { x: 0, y: 0 })])]
    renderApp(pages)
    failWrites(pages)
    const shield = shieldFor('hero')

    pointer('pointerdown', shield, 100, 100)
    pointer('pointermove', shield, 150, 130)
    await act(async () => {
      shield.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          clientX: 150,
          clientY: 130,
        }),
      )
    })

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(
      mount.querySelector('[aria-label="Details"] [role="alert"]')?.textContent,
    ).toContain('Could not save')
    expect(figureFor('hero').style.left).toBe('0px')
  })
})

describe('Inspector', () => {
  it('should show the selected frame name, position, and size', () => {
    renderApp([
      page('drafts', [
        frame('hero', { x: 40, y: 60, width: 390, height: 844 }),
      ]),
    ])

    pointer('pointerdown', shieldFor('hero'), 10, 10)
    pointer('pointerup', shieldFor('hero'), 10, 10)

    const text = mount.querySelector('[aria-label="Frame"]')?.textContent
    expect(text).toContain('hero')
    expect(text).toMatch(/x\s*40/)
    expect(text).toMatch(/y\s*60/)
    expect(text).toMatch(/width\s*390/)
    expect(text).toMatch(/height\s*844/)
  })

  it('should show the new position while the frame is dragged', () => {
    renderApp([page('drafts', [frame('hero', { x: 0, y: 0 })])])
    const shield = shieldFor('hero')

    pointer('pointerdown', shield, 100, 100)
    pointer('pointermove', shield, 150, 100)

    expect(mount.querySelector('[aria-label="Frame"]')?.textContent).toMatch(
      /x\s*100/,
    )
  })

  it('should say how to select a frame when none is', () => {
    renderApp([page('drafts', [frame('hero')])])

    expect(mount.querySelector('[aria-label="Frame"]')?.textContent).toContain(
      'Select a frame',
    )
  })

  it('should offer no editable field in this slice', () => {
    renderApp([page('drafts', [frame('hero')])])
    pointer('pointerdown', shieldFor('hero'), 10, 10)
    pointer('pointerup', shieldFor('hero'), 10, 10)

    expect(
      mount.querySelector(
        '[aria-label="Frame"] input, [aria-label="Frame"] textarea',
      ),
    ).toBeNull()
  })
})

describe('index.html', () => {
  it('should declare an inline icon so the browser never requests /favicon.ico', () => {
    const html = readFileSync(
      join(import.meta.dirname, '..', 'index.html'),
      'utf8',
    )

    const doc = new DOMParser().parseFromString(html, 'text/html')

    expect(doc.querySelector('link[rel="icon"]')?.getAttribute('href')).toMatch(
      /^data:/,
    )
  })
})
