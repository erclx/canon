// @vitest-environment happy-dom
/** @jsxImportSource preact */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Window } from 'happy-dom'
import { render } from 'preact'
import { act } from 'preact/test-utils'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { documentElements } from '@/canvas/address'
import { App } from '@/canvas/client/app'
import { isRawValue } from '@/canvas/client/inspector'
import { releasePicker } from '@/canvas/client/inspector/color-picker'
import {
  applyChange,
  applyRecord,
  editedHashes,
  editingFrames,
  type PagesRecord,
  resetState,
  savedEdit,
  selection,
  theme,
  view,
} from '@/canvas/client/state'
import type { Frame, Page } from '@/canvas/content'

let mount: HTMLDivElement

/** The windows `loadFrame` takes a document from, closed after each case. */
const frameHosts: Window[] = []

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
  releasePicker()
  sent = []
  recordWrites()
  mount = document.createElement('div')
  document.body.append(mount)
})

afterEach(() => {
  act(() => render(null, mount))
  mount.remove()
  for (const host of frameHosts.splice(0)) void host.happyDOM.close()
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
  it('should scale element outlines against the zoom so they keep their screen weight', () => {
    renderApp([page('drafts', [frame('hero')])])

    act(() => {
      view.value = { x: 0, y: 0, zoom: 0.25 }
    })

    const plane = mount.querySelector<HTMLElement>('.plane')
    expect(plane?.style.getPropertyValue('--outline-scale')).toBe('4')
  })

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

/** The frame's handle: pressing it selects the frame and dragging moves it. */
function labelFor(name: string): HTMLElement {
  const element = figureFor(name).querySelector<HTMLElement>('figcaption')
  if (!element) throw new Error(`no label on ${name}`)
  return element
}

/**
 * Stands in for the server serving a frame: writes the frame's markup into its
 * document and fires the load the shell waits on.
 */
function loadFrame(name: string, body: string): Document {
  const iframe = iframeFor(name)
  /*
   * Page loading is off, so the frame has no document until one is given. A
   * separate window stands in for the frame's own, which computed style reads
   * through.
   */
  const host = new Window()
  frameHosts.push(host)
  const doc = host.document as unknown as Document
  doc.body.innerHTML = body
  Object.defineProperty(iframe, 'contentDocument', {
    configurable: true,
    get: () => doc,
  })
  act(() => {
    iframe.dispatchEvent(new Event('load'))
  })
  return doc
}

function indexIn(doc: Document, selector: string): number {
  const target = doc.querySelector(selector)
  return target ? [...doc.querySelectorAll('*')].indexOf(target) : -1
}

function clickIn(doc: Document, selector: string): void {
  const target = doc.querySelector(selector)
  if (!target) throw new Error(`no ${selector} in the frame`)
  act(() => {
    target.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    )
  })
}

function layersFor(name: string): HTMLElement | null {
  return mount.querySelector<HTMLElement>(`[aria-label="Layers of ${name}"]`)
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

    pointer('pointerdown', labelFor('hero'), 10, 10)
    pointer('pointerup', labelFor('hero'), 10, 10)

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

    pointer('pointerdown', labelFor('phone'), 10, 10)
    pointer('pointerup', labelFor('phone'), 10, 10)

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
    pointer('pointerdown', labelFor('hero'), 10, 10)
    pointer('pointerup', labelFor('hero'), 10, 10)

    act(() => applyRecord(record([page('drafts', [frame('hero')])])))

    expect(figureFor('hero').dataset.selected).toBeUndefined()
  })
})

describe('editing badge', () => {
  function marked(
    frames: Frame[],
    editing: PagesRecord['editing'],
  ): PagesRecord {
    return { ...record([page('drafts', frames)]), editing }
  }

  /** A mark expiring `ttlMs` from now, which a negative value puts past. */
  function mark(frameName: string, by: string, ttlMs = 60_000) {
    return {
      page: 'drafts',
      frame: frameName,
      by,
      until: new Date(Date.now() + ttlMs).toISOString(),
    }
  }

  /* Only the expiry cases fake the clock, since a timer drops the mark. */
  function fakeClock(): void {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  }

  function badgeText(name: string): string {
    return figureFor(name).querySelector('.frame-editing')?.textContent ?? ''
  }

  function renderMarked(body: PagesRecord): void {
    act(() => {
      applyRecord(body)
      render(<App />, mount)
    })
  }

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should name the session editing on the marked frame alone', () => {
    renderMarked(
      marked([frame('hero'), frame('phone')], [mark('hero', 'worker-a')]),
    )

    expect(badgeText('hero')).toBe('worker-a editing')
    expect(figureFor('hero').dataset.editing).toBe('true')
    expect(badgeText('phone')).toBe('')
    expect(figureFor('phone').dataset.editing).toBeUndefined()
  })

  it('should name each session on the frame it marked', () => {
    renderMarked(
      marked(
        [frame('hero'), frame('phone')],
        [mark('hero', 'worker-a'), mark('phone', 'worker-b')],
      ),
    )

    expect(badgeText('hero')).toBe('worker-a editing')
    expect(badgeText('phone')).toBe('worker-b editing')
  })

  it('should announce the mark from a live region', () => {
    renderMarked(marked([frame('hero')], [mark('hero', 'worker-a')]))

    const badge = figureFor('hero').querySelector('.frame-editing')
    expect(badge?.getAttribute('aria-live')).toBe('polite')
  })

  it('should clear the badge when a reread carries no mark', async () => {
    const frames = [frame('hero')]
    renderMarked(marked(frames, [mark('hero', 'worker-a')]))

    await act(async () => {
      await applyChange(
        { page: 'drafts', file: 'layout.json' },
        fetchReturning(marked(frames, [])),
      )
    })

    expect(badgeText('hero')).toBe('')
    expect(figureFor('hero').dataset.editing).toBeUndefined()
  })

  it('should clear the badge at its expiry with no reread', () => {
    fakeClock()
    renderMarked(marked([frame('hero')], [mark('hero', 'worker-a', 30_000)]))

    act(() => {
      vi.advanceTimersByTime(30_000)
    })

    expect(badgeText('hero')).toBe('')
  })

  it('should keep a later mark when an earlier one expires', () => {
    fakeClock()
    renderMarked(
      marked(
        [frame('hero'), frame('phone')],
        [mark('hero', 'worker-a', 30_000), mark('phone', 'worker-b', 90_000)],
      ),
    )

    act(() => {
      vi.advanceTimersByTime(30_000)
    })

    expect(badgeText('hero')).toBe('')
    expect(badgeText('phone')).toBe('worker-b editing')
  })

  it('should not wake for a mark expiring past the longest timer delay', () => {
    fakeClock()
    renderMarked(
      marked([frame('hero')], [mark('hero', 'worker-a', 60 * 86_400_000)]),
    )
    let writes = 0
    const stop = editingFrames.subscribe(() => {
      writes += 1
    })

    act(() => {
      vi.advanceTimersByTime(1_000)
    })
    stop()

    expect(writes).toBe(1)
    expect(badgeText('hero')).toBe('worker-a editing')
  })

  it('should draw no badge for a mark already past its expiry', () => {
    renderMarked(marked([frame('hero')], [mark('hero', 'worker-a', -1_000)]))

    expect(badgeText('hero')).toBe('')
  })

  it('should keep the selection when the mark on a selected frame clears', () => {
    fakeClock()
    renderMarked({
      ...marked([frame('hero')], [mark('hero', 'worker-a', 30_000)]),
      selection: { page: 'drafts', frame: 'hero' },
    })

    act(() => {
      vi.advanceTimersByTime(30_000)
    })

    expect(figureFor('hero').dataset.selected).toBe('true')
  })
})

describe('drag', () => {
  it('should follow the pointer in surface units and write the new position on release', () => {
    renderApp([page('drafts', [frame('hero', { x: 40, y: 60 })])])
    const label = labelFor('hero')

    pointer('pointerdown', label, 100, 100)
    pointer('pointermove', label, 150, 130)
    expect(figureFor('hero').style.left).toBe('140px')
    expect(figureFor('hero').style.top).toBe('120px')
    pointer('pointerup', label, 150, 130)

    expect(sentTo('/api/frames/move')).toEqual([
      { page: 'drafts', frame: 'hero', x: 140, y: 120 },
    ])
  })

  it('should write nothing for a press that never moved', () => {
    renderApp([page('drafts', [frame('hero')])])
    const label = labelFor('hero')

    pointer('pointerdown', label, 100, 100)
    pointer('pointerup', label, 100, 100)

    expect(sentTo('/api/frames/move')).toEqual([])
  })

  it('should not pan the surface while a frame is dragged', () => {
    renderApp([page('drafts', [frame('hero')])])
    const before = view.value
    const label = labelFor('hero')

    pointer('pointerdown', label, 100, 100)
    pointer('pointermove', label, 180, 160)
    pointer('pointerup', label, 180, 160)

    expect(view.value).toEqual(before)
  })

  it('should move the selected frame with the arrow keys', () => {
    renderApp([page('drafts', [frame('hero', { x: 40, y: 60 })])])
    pointer('pointerdown', labelFor('hero'), 10, 10)
    pointer('pointerup', labelFor('hero'), 10, 10)

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
    const label = labelFor('hero')

    pointer('pointerdown', label, 100, 100)
    pointer('pointermove', label, 150, 130)
    await act(async () => {
      label.dispatchEvent(
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
  /** A read-only frame field's value, found by its accessible name. */
  function frameValue(name: string): string | null | undefined {
    return mount.querySelector(`[aria-label="Frame"] [aria-label="${name}"]`)
      ?.textContent
  }

  it('should show the selected frame name, position, and size', () => {
    renderApp([
      page('drafts', [
        frame('hero', { x: 40, y: 60, width: 390, height: 844 }),
      ]),
    ])

    pointer('pointerdown', labelFor('hero'), 10, 10)
    pointer('pointerup', labelFor('hero'), 10, 10)

    expect(mount.querySelector('[aria-label="Frame"]')?.textContent).toContain(
      'hero',
    )
    expect(
      ['x', 'y', 'width', 'height'].map((name) => frameValue(name)),
    ).toEqual(['40', '60', '390', '844'])
  })

  it('should show the new position while the frame is dragged', () => {
    renderApp([page('drafts', [frame('hero', { x: 0, y: 0 })])])
    const label = labelFor('hero')

    pointer('pointerdown', label, 100, 100)
    pointer('pointermove', label, 150, 100)

    expect(frameValue('x')).toBe('100')
  })

  it('should say how to select a frame when none is', () => {
    renderApp([page('drafts', [frame('hero')])])

    expect(mount.querySelector('[aria-label="Frame"]')?.textContent).toContain(
      'Select a frame',
    )
  })

  it('should keep the frame box read-only', () => {
    renderApp([page('drafts', [frame('hero')])])
    pointer('pointerdown', labelFor('hero'), 10, 10)
    pointer('pointerup', labelFor('hero'), 10, 10)

    expect(
      mount.querySelector(
        '[aria-label="Frame"] input, [aria-label="Frame"] textarea',
      ),
    ).toBeNull()
  })
})

const HERO_BODY =
  '<main><h1 class="title">Hero</h1><button class="cta" style="color: rgb(255, 0, 0); font-size: 20px; font-weight: 700">Start</button></main>'

/** A row flex container, which shows the Flex section's fields. */
const ROW_BODY = '<div style="display: flex"><span>a</span><span>b</span></div>'

describe('Layers', () => {
  it('should stay closed until the operator opens a frame', () => {
    renderApp([page('drafts', [frame('hero')])])
    loadFrame('hero', HERO_BODY)

    expect(layersFor('hero')).toBeNull()
  })

  it('should build the element tree of a loaded frame from its document', () => {
    renderApp([page('drafts', [frame('hero')])])
    loadFrame('hero', HERO_BODY)

    act(() => buttonNamed('Show layers of hero').click())

    const tree = layersFor('hero')
    expect(tree?.textContent).toContain('main')
    expect(tree?.textContent).toContain('h1.title')
    expect(tree?.textContent).toContain('button.cta')
    expect(tree?.querySelector('ul ul ul')).not.toBeNull()
  })

  it('should select the element picked in the tree and outline it on the surface', () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)
    act(() => buttonNamed('Show layers of hero').click())

    act(() => {
      const row = [
        ...(layersFor('hero')?.querySelectorAll('button') ?? []),
      ].find((candidate) => candidate.textContent?.startsWith('button.cta'))
      row?.click()
    })

    const count = doc.querySelectorAll('*').length
    expect(sentTo('/api/selection')).toEqual([
      {
        page: 'drafts',
        frame: 'hero',
        element: { index: indexIn(doc, 'button'), tag: 'button', count },
      },
    ])
    expect(
      figureFor('hero').querySelector('[data-selection="element"]'),
    ).not.toBeNull()
  })
})

describe('element selection', () => {
  it('should select the element clicked inside a frame and record its address', () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)

    clickIn(doc, 'h1')

    const count = doc.querySelectorAll('*').length
    expect(sentTo('/api/selection')).toEqual([
      {
        page: 'drafts',
        frame: 'hero',
        element: { index: indexIn(doc, 'h1'), tag: 'h1', count },
      },
    ])
    expect(figureFor('hero').dataset.selected).toBe('true')
  })

  it('should mark in the tree the element clicked on the surface', () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)

    clickIn(doc, 'button')

    const current = layersFor('hero')?.querySelector('[aria-current="true"]')
    expect(current?.textContent).toContain('button.cta')
  })

  it('should keep a click inside a frame from following a link', () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', '<a href="/elsewhere">Go</a>')
    const link = doc.querySelector('a')
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })

    act(() => {
      link?.dispatchEvent(click)
    })

    expect(click.defaultPrevented).toBe(true)
  })

  it('should move no frame when an element is clicked', () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)

    clickIn(doc, 'button')

    expect(sentTo('/api/frames/move')).toEqual([])
  })

  it('should return the selection to the frame when its label is pressed', () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)
    clickIn(doc, 'button')

    pointer('pointerdown', labelFor('hero'), 10, 10)
    pointer('pointerup', labelFor('hero'), 10, 10)

    expect(sentTo('/api/selection').at(-1)).toEqual({
      page: 'drafts',
      frame: 'hero',
    })
    expect(mount.querySelector('[aria-label="Element"]')).toBeNull()
  })

  it('should return the selection to the frame on Enter', () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)
    clickIn(doc, 'button')

    press(figureFor('hero'), 'Enter')

    expect(sentTo('/api/selection').at(-1)).toEqual({
      page: 'drafts',
      frame: 'hero',
    })
  })

  it('should still move the frame dragged by its label after an element is selected', () => {
    renderApp([page('drafts', [frame('hero', { x: 0, y: 0 })])])
    const doc = loadFrame('hero', HERO_BODY)
    clickIn(doc, 'button')
    const label = labelFor('hero')

    pointer('pointerdown', label, 100, 100)
    pointer('pointermove', label, 140, 100)
    pointer('pointerup', label, 140, 100)

    expect(sentTo('/api/frames/move')).toEqual([
      { page: 'drafts', frame: 'hero', x: 80, y: 0 },
    ])
  })

  it('should tell the operator when the server cannot match the element', async () => {
    const pages = [page('drafts', [frame('hero')])]
    renderApp(pages)
    const doc = loadFrame('hero', HERO_BODY)
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) =>
      init?.method === 'POST'
        ? new Response(
            '{"ok":false,"reason":"address-mismatch","detail":"counts differ"}',
            { status: 409, headers: { 'content-type': 'application/json' } },
          )
        : new Response(JSON.stringify(record(pages)), {
            headers: { 'content-type': 'application/json' },
          })) as typeof fetch

    await act(async () => {
      clickIn(doc, 'button')
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(
      mount.querySelector('[aria-label="Details"] [role="alert"]')?.textContent,
    ).toContain('count the elements of this frame differently')
  })
})

describe('element hash', () => {
  it('should send the file hash the served frame carries with the pick', () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)
    const marker = doc.createElement('style')
    marker.setAttribute('data-canvas-tokens', '')
    marker.setAttribute('data-canvas-hash', 'abc123')
    doc.head.append(marker)

    clickIn(doc, 'button')

    expect(sentTo('/api/selection')).toEqual([
      expect.objectContaining({
        element: expect.objectContaining({ tag: 'button', hash: 'abc123' }),
      }),
    ])
  })

  it('should tell the operator when the frame changed before the pick arrived', async () => {
    const pages = [page('drafts', [frame('hero')])]
    renderApp(pages)
    const doc = loadFrame('hero', HERO_BODY)
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) =>
      init?.method === 'POST'
        ? new Response(
            '{"ok":false,"reason":"stale-address","detail":"changed"}',
            { status: 409, headers: { 'content-type': 'application/json' } },
          )
        : new Response(JSON.stringify(record(pages)), {
            headers: { 'content-type': 'application/json' },
          })) as typeof fetch

    await act(async () => {
      clickIn(doc, 'button')
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(
      mount.querySelector('[aria-label="Details"] [role="alert"]')?.textContent,
    ).toContain('changed before the pick arrived')
  })
})

describe('Inspector element', () => {
  it('should show the selected element tag and its values in its fields', () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)

    clickIn(doc, 'button')

    const panel = mount.querySelector('[aria-label="Element"]')
    expect(panel?.textContent).toContain('button.cta')
    expect(fieldNamed('color').value).toBe('ff0000')
    expect(fieldNamed('color opacity').value).toBe('100')
    expect(fieldNamed('size').value).toBe('20')
    expect(fieldNamed('weight').value).toBe('700')
  })

  it('should group the element fields under titled sections', () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)

    clickIn(doc, 'button')

    expect(
      [...mount.querySelectorAll('[aria-label="Element"] section h3')].map(
        (heading) => heading.textContent,
      ),
    ).toEqual(['Layout', 'Flex', 'Appearance', 'Typography', 'Fill', 'Text'])
  })

  it('should show a computed length rounded to a whole number', () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', '<h1 style="width: 240.891px">A</h1>')

    clickIn(doc, 'h1')

    expect(fieldNamed('width').value).toBe('241')
  })

  it('should show a transparent background as no fill', () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame(
      'hero',
      '<h1 style="background-color: rgba(0, 0, 0, 0)">A</h1>',
    )

    clickIn(doc, 'h1')

    expect(fieldNamed('background').value).toBe('')
  })

  it('should keep the element position read-only', () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)

    clickIn(doc, 'h1')

    expect(
      mount.querySelector('[aria-label="Element"] [aria-label="x"]')?.tagName,
    ).toBe('OUTPUT')
  })

  it('should say the pick may have moved once the server reports it stale', () => {
    act(() => {
      applyRecord({
        ...record([page('drafts', [frame('hero')])]),
        selection: {
          page: 'drafts',
          frame: 'hero',
          element: { index: 6, tag: 'button', stale: true },
        },
      })
      render(<App />, mount)
    })
    loadFrame('hero', HERO_BODY)

    expect(
      mount.querySelector('[aria-label="Element"]')?.textContent,
    ).toContain('changed since')
    expect(
      figureFor('hero').querySelector('[data-selection="element"]'),
    ).toBeNull()
  })

  it('should mark no layer row for a stale pick', () => {
    act(() => {
      applyRecord({
        ...record([page('drafts', [frame('hero')])]),
        selection: {
          page: 'drafts',
          frame: 'hero',
          element: { index: 5, tag: 'button', stale: true },
        },
      })
      render(<App />, mount)
    })
    loadFrame('hero', HERO_BODY)
    act(() => buttonNamed('Show layers of hero').click())

    expect(layersFor('hero')?.querySelector('[aria-current="true"]')).toBeNull()
  })
})

/** The inspector row holding the field of that accessible name. */
function rowOf(name: string): Element {
  const row = fieldNamed(name).closest('.fill-row')
  if (!row) throw new Error(`no row for ${name}`)
  return row
}

describe('isRawValue', () => {
  it('should read a literal color as raw', () => {
    expect(isRawValue('rgb(0, 0, 0)')).toBe(true)
  })

  it('should not read a color mixed from a token as raw', () => {
    expect(
      isRawValue('color-mix(in srgb, var(--color-accent) 50%, white)'),
    ).toBe(false)
  })

  it('should not read currentColor in any casing as raw', () => {
    expect(isRawValue('CurrentColor')).toBe(false)
  })

  it('should not read a CSS-wide keyword as raw', () => {
    expect(isRawValue('revert-layer')).toBe(false)
  })
})

describe('Inspector raw marker', () => {
  it('should mark a color set inline as a raw value in text', () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', '<h1 style="color: rgb(0, 0, 0)">A</h1>')

    clickIn(doc, 'h1')

    const marker = rowOf('color').querySelector('.raw')
    expect(marker?.textContent).toBe('raw')
    expect(marker?.getAttribute('title')).toContain('theme')
  })

  it('should mark a background set inline as a raw value', () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', '<h1 style="background-color: #fff">A</h1>')

    clickIn(doc, 'h1')

    expect(rowOf('background').textContent).toContain('raw')
  })

  it('should not mark a color set inline to a token', () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame(
      'hero',
      '<h1 style="color: var(--color-accent)">A</h1>',
    )

    clickIn(doc, 'h1')

    expect(rowOf('color').querySelector('.raw')).toBeNull()
  })

  it('should not mark a color set inline to inherit', () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', '<h1 style="color: inherit">A</h1>')

    clickIn(doc, 'h1')

    expect(rowOf('color').querySelector('.raw')).toBeNull()
  })

  it('should not mark a background set inline to currentColor', () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame(
      'hero',
      '<h1 style="background-color: currentColor">A</h1>',
    )

    clickIn(doc, 'h1')

    expect(rowOf('background').querySelector('.raw')).toBeNull()
  })

  it('should not mark a color the element only inherits', () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)

    clickIn(doc, 'h1')

    expect(rowOf('color').querySelector('.raw')).toBeNull()
  })
})

/** An inspector field by its accessible name. */
function fieldNamed(name: string): HTMLInputElement {
  const field = mount.querySelector<HTMLInputElement>(
    `[aria-label="Element"] [aria-label="${name}"]`,
  )
  if (!field) throw new Error(`no field named ${name}`)
  return field
}

/** What the server stamps on a served frame, which the shell sends back. */
function stampHash(doc: Document, hash: string): void {
  const marker = doc.createElement('style')
  marker.setAttribute('data-canvas-tokens', '')
  marker.setAttribute('data-canvas-hash', hash)
  doc.head.append(marker)
}

async function commit(
  field: HTMLInputElement | HTMLSelectElement,
  value: string,
) {
  await act(async () => {
    field.value = value
    field.dispatchEvent(new Event('change', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

const TOKENS: PagesRecord['tokens'] = {
  source: 'installed',
  files: ['.claude/design/base.css'],
  groups: [
    {
      kind: 'color',
      tokens: [
        { name: '--color-text', value: '#111' },
        { name: '--color-accent', value: '#c76b5f' },
      ],
    },
    { kind: 'spacing', tokens: [{ name: '--space-sm', value: '0.5rem' }] },
    {
      kind: 'font-family',
      tokens: [
        { name: '--type-body-family', value: 'Inter, sans-serif' },
        { name: '--type-code-family', value: 'monospace' },
      ],
    },
    {
      kind: 'font-size',
      tokens: [{ name: '--type-heading-size', value: '2rem' }],
    },
  ],
}

function renderWithTokens(pages: Page[]): void {
  act(() => {
    applyRecord({ ...record(pages), tokens: TOKENS })
    render(<App />, mount)
  })
}

describe('Inspector edit', () => {
  it('should post the changed field as one property of the selected element', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')

    await commit(fieldNamed('color'), 'blue')

    expect(sentTo('/api/frames/edit')).toEqual([
      {
        page: 'drafts',
        frame: 'hero',
        element: {
          index: documentElements(doc).findIndex(
            (element) => element.tagName === 'H1',
          ),
          tag: 'h1',
          count: documentElements(doc).length,
          hash: 'abc123',
        },
        property: 'color',
        value: 'blue',
      },
    ])
  })

  it('should show the values of the frame picked from when two frames share an index', () => {
    renderApp([page('drafts', [frame('hero'), frame('alt', { x: 1600 })])])
    const hero = loadFrame('hero', '<h1 style="color: red">A</h1>')
    const alt = loadFrame('alt', '<h1 style="color: blue">B</h1>')
    clickIn(hero, 'h1')

    clickIn(alt, 'h1')

    expect(fieldNamed('color').value).toBe('blue')
  })

  it('should post nothing for a field committed unchanged', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)
    stampHash(doc, 'abc123')
    clickIn(doc, 'button')

    await commit(fieldNamed('size'), '20')

    expect(sentTo('/api/frames/edit')).toEqual([])
  })

  it('should post nothing for a rounded length committed unchanged', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', '<h1 style="width: 240.891px">A</h1>')
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')

    await commit(fieldNamed('width'), '241')

    expect(sentTo('/api/frames/edit')).toEqual([])
  })

  it('should write a bare number typed into a length as pixels', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')

    await commit(fieldNamed('width'), '300')

    expect(sentTo('/api/frames/edit')).toEqual([
      expect.objectContaining({ property: 'width', value: '300px' }),
    ])
  })

  it('should write width 100% when Fill is picked from the size menu', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')

    await commit(fieldNamed('width mode'), 'Fill')

    expect(sentTo('/api/frames/edit')).toEqual([
      expect.objectContaining({ property: 'width', value: '100%' }),
    ])
  })

  it('should show an inline fit-content height as Fit', () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', '<h1 style="height: fit-content">A</h1>')

    clickIn(doc, 'h1')

    expect(fieldNamed('height').value).toBe('Fit')
  })

  it('should edit padding on a block element from the Layout section', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')

    await commit(fieldNamed('padding'), '12')

    expect(sentTo('/api/frames/edit')).toEqual([
      expect.objectContaining({ property: 'padding', value: '12px' }),
    ])
  })

  it('should post a family token picked from the family menu as var()', async () => {
    renderWithTokens([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')

    await commit(fieldNamed('family tokens'), '--type-body-family')

    expect(sentTo('/api/frames/edit')).toEqual([
      expect.objectContaining({
        property: 'font-family',
        value: 'var(--type-body-family)',
      }),
    ])
  })

  it('should post a size token picked from the size menu as var()', async () => {
    renderWithTokens([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')

    await commit(fieldNamed('size tokens'), '--type-heading-size')

    expect(sentTo('/api/frames/edit')).toEqual([
      expect.objectContaining({
        property: 'font-size',
        value: 'var(--type-heading-size)',
      }),
    ])
  })

  it('should mark a family set inline as a literal as raw', () => {
    renderWithTokens([page('drafts', [frame('hero')])])
    const doc = loadFrame(
      'hero',
      '<h1 style="font-family: &quot;Geist Variable&quot;, serif">A</h1>',
    )

    clickIn(doc, 'h1')

    expect(fieldNamed('family').value).toBe('Geist Variable')
    expect(
      fieldNamed('family').closest('.glyph-field')?.querySelector('.raw'),
    ).toBeTruthy()
  })

  it('should show a family token by its name with no raw marker', () => {
    renderWithTokens([page('drafts', [frame('hero')])])
    const doc = loadFrame(
      'hero',
      '<h1 style="font-family: var(--type-body-family)">A</h1>',
    )

    clickIn(doc, 'h1')

    expect(fieldNamed('family').value).toBe('--type-body-family')
    expect(
      fieldNamed('family').closest('.glyph-field')?.querySelector('.raw'),
    ).toBeNull()
  })

  it('should post a pasted family declaration as its value alone', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')

    await commit(fieldNamed('family'), 'font-family: Inter, sans-serif;')

    expect(sentTo('/api/frames/edit')).toEqual([
      expect.objectContaining({
        property: 'font-family',
        value: 'Inter, sans-serif',
      }),
    ])
  })

  it('should post nothing for a quoted family committed as shown', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame(
      'hero',
      '<h1 style="font-family: &quot;Geist Variable&quot;, Geist, sans-serif">A</h1>',
    )
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')

    await commit(fieldNamed('family'), 'Geist Variable')

    expect(sentTo('/api/frames/edit')).toEqual([])
  })

  it('should post a weight picked from the weight menu', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)
    stampHash(doc, 'abc123')
    clickIn(doc, 'button')

    await commit(fieldNamed('weight'), '300')

    expect(sentTo('/api/frames/edit')).toEqual([
      expect.objectContaining({ property: 'font-weight', value: '300' }),
    ])
  })

  it('should show a unitless line height and post nothing when it is unchanged', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', '<h1 style="line-height: 1.5">A</h1>')
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')

    expect(fieldNamed('line height').value).toBe('1.5')
    await commit(fieldNamed('line height'), '1.5')

    expect(sentTo('/api/frames/edit')).toEqual([])
  })

  it('should show a normal line height as Auto', () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', '<h1 style="line-height: normal">A</h1>')

    clickIn(doc, 'h1')

    expect(fieldNamed('line height').value).toBe('Auto')
  })

  it('should write a bare letter spacing as pixels', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')

    await commit(fieldNamed('letter spacing'), '-0.5')

    expect(sentTo('/api/frames/edit')).toEqual([
      expect.objectContaining({ property: 'letter-spacing', value: '-0.5px' }),
    ])
  })

  it('should post text-align center from the alignment group', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')

    await act(async () => {
      buttonNamed('Align center').click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(sentTo('/api/frames/edit')).toEqual([
      expect.objectContaining({ property: 'text-align', value: 'center' }),
    ])
  })

  it('should press the alignment the element holds and post nothing for it', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', '<h1 style="text-align: right">A</h1>')
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')

    await act(async () => {
      buttonNamed('Align right').click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(buttonNamed('Align right').getAttribute('aria-pressed')).toBe('true')
    expect(sentTo('/api/frames/edit')).toEqual([])
  })

  it('should show the Flex header alone with an add button on a block', () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)

    clickIn(doc, 'h1')

    expect(buttonNamed('Add flex layout')).toBeTruthy()
    expect(
      mount.querySelector('[aria-label="Element"] [aria-label="gap"]'),
    ).toBeNull()
  })

  it('should make the element a flex container from the add button', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')

    await act(async () => {
      buttonNamed('Add flex layout').click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(sentTo('/api/frames/edit')).toEqual([
      expect.objectContaining({ property: 'display', value: 'flex' }),
    ])
  })

  it('should offer no add button on a grid container', () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', '<div style="display: grid">A</div>')

    clickIn(doc, 'div')

    expect(
      mount.querySelector(
        '[aria-label="Element"] [aria-label="Add flex layout"]',
      ),
    ).toBeNull()
  })

  /** A cell of the alignment grid by its accessible name. */
  function cellNamed(name: string): HTMLButtonElement {
    const cell = mount.querySelector<HTMLButtonElement>(
      `[aria-label="Element"] [role="radiogroup"] [aria-label="${name}"]`,
    )
    if (!cell) throw new Error(`no alignment cell ${name}`)
    return cell
  }

  it('should align a row to the top right from its grid cell', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', ROW_BODY)
    stampHash(doc, 'abc123')
    clickIn(doc, 'div')

    await act(async () => {
      cellNamed('top right').click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(sentTo('/api/frames/edit')).toEqual([
      expect.objectContaining({
        property: 'justify-content',
        value: 'flex-end',
      }),
      expect.objectContaining({ property: 'align-items', value: 'flex-start' }),
    ])
  })

  it('should send the second alignment edit on the hash the first answered across a reload', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', ROW_BODY)
    stampHash(doc, 'abc123')
    clickIn(doc, 'div')
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
      sent.push({ url: String(url), body: JSON.parse(String(init?.body)) })
      return new Response('{"ok":true,"hash":"def456"}', {
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch
    /* A frame reload landing after the first edit clears the stored hash. */
    const stopReloads = editedHashes.subscribe((hashes) => {
      if (hashes.size > 0) editedHashes.value = new Map()
    })

    await act(async () => {
      cellNamed('top right').click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    stopReloads()

    expect(sentTo('/api/frames/edit').at(-1)).toMatchObject({
      property: 'align-items',
      element: { hash: 'def456' },
    })
  })

  it('should swap the axes for a column when aligning top right', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame(
      'hero',
      '<div style="display: flex; flex-direction: column"><span>a</span></div>',
    )
    stampHash(doc, 'abc123')
    clickIn(doc, 'div')

    await act(async () => {
      cellNamed('top right').click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(sentTo('/api/frames/edit')).toEqual([
      expect.objectContaining({
        property: 'justify-content',
        value: 'flex-start',
      }),
      expect.objectContaining({ property: 'align-items', value: 'flex-end' }),
    ])
  })

  it('should mark the cell the container is aligned to', () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame(
      'hero',
      '<div style="display: flex; justify-content: center; align-items: flex-end"><span>a</span></div>',
    )

    clickIn(doc, 'div')

    expect(cellNamed('bottom center').getAttribute('aria-checked')).toBe('true')
  })

  it('should mark the top left cell on a container left at its defaults', () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame(
      'hero',
      '<div style="display: flex; justify-content: normal; align-items: normal"><span>a</span></div>',
    )

    clickIn(doc, 'div')

    expect(cellNamed('top left').getAttribute('aria-checked')).toBe('true')
  })

  it('should pin a container left at its defaults from the cell it shows checked', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame(
      'hero',
      '<div style="display: flex; justify-content: normal; align-items: normal"><span>a</span></div>',
    )
    stampHash(doc, 'abc123')
    clickIn(doc, 'div')

    await act(async () => {
      cellNamed('top left').click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(sentTo('/api/frames/edit')).toEqual([
      expect.objectContaining({
        property: 'justify-content',
        value: 'flex-start',
      }),
      expect.objectContaining({
        property: 'align-items',
        value: 'flex-start',
      }),
    ])
  })

  it('should post nothing for a click on a cell the container states', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame(
      'hero',
      '<div style="display: flex; justify-content: center; align-items: flex-end"><span>a</span></div>',
    )
    stampHash(doc, 'abc123')
    clickIn(doc, 'div')

    await act(async () => {
      cellNamed('bottom center').click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(sentTo('/api/frames/edit')).toEqual([])
  })

  it('should move focus between cells with the arrow keys', () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', ROW_BODY)
    clickIn(doc, 'div')
    act(() => cellNamed('top left').focus())

    press(cellNamed('top left'), 'ArrowRight')

    expect(document.activeElement).toBe(cellNamed('top center'))
  })

  it('should wrap a flex container from the wrap toggle', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', ROW_BODY)
    stampHash(doc, 'abc123')
    clickIn(doc, 'div')

    await act(async () => {
      buttonNamed('Wrap').click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(sentTo('/api/frames/edit')).toEqual([
      expect.objectContaining({ property: 'flex-wrap', value: 'wrap' }),
    ])
  })

  it('should write 50 percent opacity as 0.5', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')

    await commit(fieldNamed('opacity'), '50')

    expect(sentTo('/api/frames/edit')).toEqual([
      expect.objectContaining({ property: 'opacity', value: '0.5' }),
    ])
  })

  it('should post nothing for an opacity percent past 100', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')

    await commit(fieldNamed('opacity'), '150')

    expect(sentTo('/api/frames/edit')).toEqual([])
  })

  it('should write one radius for every corner', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')

    await commit(fieldNamed('radius'), '12')

    expect(sentTo('/api/frames/edit')).toEqual([
      expect.objectContaining({ property: 'border-radius', value: '12px' }),
    ])
  })

  it('should write only the corner changed once the radius is per corner', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')
    act(() => buttonNamed('Per-corner radius').click())

    await commit(fieldNamed('top left radius'), '4')

    expect(sentTo('/api/frames/edit')).toEqual([
      expect.objectContaining({
        property: 'border-top-left-radius',
        value: '4px',
      }),
    ])
  })

  it('should give opacity its own row so the corners form two rows of two', () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)
    clickIn(doc, 'h1')

    act(() => buttonNamed('Per-corner radius').click())

    expect(
      fieldNamed('opacity')
        .closest('.glyph-field')
        ?.classList.contains('is-wide'),
    ).toBe(true)
  })

  it('should write a typed number over a Fill width as pixels', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', '<h1 style="width: 100%">A</h1>')
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')

    await commit(fieldNamed('width'), '320')

    expect(sentTo('/api/frames/edit')).toEqual([
      expect.objectContaining({ property: 'width', value: '320px' }),
    ])
  })

  it('should open per corner on an element whose corners differ', () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame(
      'hero',
      '<h1 style="border-top-left-radius: 8px; border-top-right-radius: 0px; border-bottom-right-radius: 0px; border-bottom-left-radius: 0px">A</h1>',
    )

    clickIn(doc, 'h1')

    expect(fieldNamed('top left radius').value).toBe('8')
  })

  /** Opens the color picker of the field of that name and returns it. */
  function openPicker(name: string): HTMLElement {
    const swatch = mount.querySelector<HTMLButtonElement>(
      `[aria-label="Element"] [aria-label="${name} picker"]`,
    )
    if (!swatch) throw new Error(`no swatch on ${name}`)
    act(() => swatch.click())
    const picker = mount.querySelector<HTMLElement>(
      `[aria-label="Element"] [role="dialog"][aria-label="${name} color"]`,
    )
    if (!picker) throw new Error(`no picker on ${name}`)
    return picker
  }

  /** The picker already open on the field of that name. */
  function openedPicker(name: string): HTMLElement {
    const picker = mount.querySelector<HTMLElement>(
      `[aria-label="Element"] [role="dialog"][aria-label="${name} color"]`,
    )
    if (!picker) throw new Error(`no open picker on ${name}`)
    return picker
  }

  /** Opens the token list of the field of that name and returns it. */
  function openTokens(name: string): HTMLElement {
    act(() => buttonNamed(`${name} tokens`).click())
    const popover = mount.querySelector<HTMLElement>(
      `[aria-label="Element"] [role="dialog"][aria-label="${name} token list"]`,
    )
    if (!popover) throw new Error(`no token list on ${name}`)
    return popover
  }

  function optionNamed(picker: HTMLElement, name: string): HTMLElement {
    const option = [
      ...picker.querySelectorAll<HTMLElement>('[role="option"]'),
    ].find((candidate) => candidate.textContent?.includes(name))
    if (!option) throw new Error(`no option ${name}`)
    return option
  }

  function controlIn<T extends HTMLElement = HTMLInputElement>(
    picker: HTMLElement,
    name: string,
  ): T {
    const control = picker.querySelector<T>(`[aria-label="${name}"]`)
    if (!control) throw new Error(`no control ${name} in the picker`)
    return control
  }

  async function settle(run: () => void) {
    await act(async () => {
      run()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }

  function key(target: HTMLElement, name: string, shiftKey = false) {
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key: name, shiftKey, bubbles: true }),
    )
  }

  /** Moves a range the way a drag does: input while it moves, change on release. */
  async function slide(range: HTMLInputElement, value: string) {
    await settle(() => {
      range.value = value
      range.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await settle(() => {
      range.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }

  function heading(doc: Document): HTMLElement {
    const element = doc.querySelector<HTMLElement>('h1')
    if (!element) throw new Error('no heading')
    return element
  }

  function areaOf(picker: HTMLElement): HTMLElement {
    return controlIn<HTMLElement>(picker, 'saturation and brightness')
  }

  it('should open a picker with no token options from the swatch', () => {
    renderWithTokens([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)
    clickIn(doc, 'h1')

    const picker = openPicker('background')

    expect(picker.querySelectorAll('[role="option"]')).toHaveLength(0)
    expect(areaOf(picker).getAttribute('role')).toBe('slider')
  })

  it('should list the color tokens from the tokens icon', () => {
    renderWithTokens([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)
    clickIn(doc, 'h1')

    const popover = openTokens('background')

    const names = [...popover.querySelectorAll('[role="option"]')].map(
      (node) => node.textContent,
    )
    expect(names).toEqual(['--color-text', '--color-accent'])
  })

  it('should write the token picked as var()', async () => {
    renderWithTokens([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')
    const popover = openTokens('background')

    await settle(() => optionNamed(popover, '--color-accent').click())

    expect(sentTo('/api/frames/edit')).toEqual([
      expect.objectContaining({
        property: 'background-color',
        value: 'var(--color-accent)',
      }),
    ])
  })

  it('should write the hex an HSL row converts to', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame(
      'hero',
      '<h1 style="background-color: #ff8000">A</h1>',
    )
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')
    const picker = openPicker('background')

    await commit(controlIn(picker, 'HSL lightness'), '25')

    expect(sentTo('/api/frames/edit')).toEqual([
      expect.objectContaining({ value: '#804000' }),
    ])
  })

  it('should show the clamped color an out-of-gamut LCH row wrote', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame(
      'hero',
      '<h1 style="background-color: #808080">A</h1>',
    )
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')
    const picker = openPicker('background')
    controlIn(picker, 'LCH lightness').value = '50'
    controlIn(picker, 'LCH chroma').value = '150'

    await commit(controlIn(picker, 'LCH hue'), '30')

    const [written] = sentTo('/api/frames/edit') as { value: string }[]
    const shown = ['red', 'green', 'blue']
      .map((name) =>
        Number(controlIn(openedPicker('background'), name).value)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
    expect(`#${shown}`).toBe(written?.value)
  })

  it('should preview a keyboard step on the area and post nothing', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame(
      'hero',
      '<h1 style="background-color: #ff8000">A</h1>',
    )
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')
    const area = areaOf(openPicker('background'))

    await settle(() => key(area, 'ArrowDown', true))

    expect(heading(doc).style.getPropertyValue('background-color')).not.toBe(
      '#ff8000',
    )
    expect(sentTo('/api/frames/edit')).toEqual([])
  })

  it('should post the area value once on Enter', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame(
      'hero',
      '<h1 style="background-color: #ff8000">A</h1>',
    )
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')
    const area = areaOf(openPicker('background'))

    await settle(() => key(area, 'ArrowDown', true))
    await settle(() => key(area, 'ArrowDown', true))
    await settle(() => key(area, 'Enter'))

    expect(sentTo('/api/frames/edit')).toEqual([
      expect.objectContaining({ value: '#cc6600' }),
    ])
  })

  it('should reopen the picker on the hue it held after the write reloads the frame', async () => {
    const pages = [page('drafts', [frame('hero')])]
    renderApp(pages)
    const doc = loadFrame(
      'hero',
      '<h1 style="background-color: #808080">A</h1>',
    )
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')
    const picker = openPicker('background')
    await slide(controlIn(picker, 'hue'), '200')
    await settle(() => key(areaOf(picker), 'ArrowRight', true))
    await settle(() => key(areaOf(picker), 'Enter'))

    await act(async () => {
      await applyChange(
        { page: 'drafts', file: 'hero.html' },
        /* The server's record carries the pick, so the reload keeps it. */
        fetchReturning({
          ...record(pages),
          selection: selection.value ?? null,
        }),
      )
    })
    stampHash(
      loadFrame('hero', '<h1 style="background-color: #737c80">A</h1>'),
      'def456',
    )

    expect(controlIn(openedPicker('background'), 'hue').value).toBe('200')
  })

  it('should restore the open value on Escape and post nothing', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame(
      'hero',
      '<h1 style="background-color: #ff8000">A</h1>',
    )
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')
    const area = areaOf(openPicker('background'))
    await settle(() => key(area, 'ArrowDown', true))

    await settle(() => key(area, 'Escape'))

    expect(heading(doc).style.getPropertyValue('background-color')).toBe(
      '#ff8000',
    )
    expect(sentTo('/api/frames/edit')).toEqual([])
  })

  it('should drop the preview on Escape where no inline value stood', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', '<h1>A</h1>')
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')
    const area = areaOf(openPicker('background'))
    await settle(() => key(area, 'ArrowDown', true))

    await settle(() => key(area, 'Escape'))

    expect(heading(doc).style.getPropertyValue('background-color')).toBe('')
    expect(sentTo('/api/frames/edit')).toEqual([])
  })

  it('should restore the open value from Previous and post nothing', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame(
      'hero',
      '<h1 style="background-color: #ff8000">A</h1>',
    )
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')
    const picker = openPicker('background')
    await settle(() => key(areaOf(picker), 'ArrowDown', true))

    await settle(() =>
      controlIn<HTMLButtonElement>(picker, 'previous color').click(),
    )

    expect(heading(doc).style.getPropertyValue('background-color')).toBe(
      '#ff8000',
    )
    expect(sentTo('/api/frames/edit')).toEqual([])
  })

  it('should keep a token through the alpha slider as color-mix()', async () => {
    renderWithTokens([page('drafts', [frame('hero')])])
    const doc = loadFrame(
      'hero',
      '<h1 style="background-color: var(--color-accent)">A</h1>',
    )
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')
    const picker = openPicker('background')

    await slide(controlIn(picker, 'alpha'), '40')

    expect(sentTo('/api/frames/edit')).toEqual([
      expect.objectContaining({
        value: 'color-mix(in srgb, var(--color-accent) 40%, transparent)',
      }),
    ])
  })

  it('should write a hex when the hue moves on a token', async () => {
    renderWithTokens([page('drafts', [frame('hero')])])
    const doc = loadFrame(
      'hero',
      '<h1 style="background-color: var(--color-accent)">A</h1>',
    )
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')
    const picker = openPicker('background')

    await slide(controlIn(picker, 'hue'), '200')

    expect(sentTo('/api/frames/edit')).toEqual([
      expect.objectContaining({
        value: expect.stringMatching(/^#[0-9a-f]{6}$/),
      }),
    ])
  })

  it('should hold the picker while an edit is in flight', async () => {
    let release = () => {}
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
      sent.push({
        url: String(url),
        body: JSON.parse(String(init?.body ?? 'null')),
      })
      await new Promise<void>((resolve) => {
        release = resolve
      })
      return new Response('{"ok":true}', {
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame(
      'hero',
      '<h1 style="background-color: #ff8000">A</h1>',
    )
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')
    const picker = openPicker('background')
    await slide(controlIn(picker, 'hue'), '200')

    await slide(controlIn(openedPicker('background'), 'hue'), '220')
    await settle(() =>
      key(areaOf(openedPicker('background')), 'ArrowDown', true),
    )
    await settle(() => key(areaOf(openedPicker('background')), 'Enter'))
    await commit(controlIn(openedPicker('background'), 'red'), '10')

    expect(sentTo('/api/frames/edit')).toHaveLength(1)
    await settle(() => release())
  })

  it('should leave a range drag running when the area loses focus to it', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame(
      'hero',
      '<h1 style="background-color: #ff8000">A</h1>',
    )
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')
    const picker = openPicker('background')
    const alpha = controlIn(picker, 'alpha')

    await settle(() => {
      alpha.value = '98'
      alpha.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await settle(() => areaOf(picker).dispatchEvent(new FocusEvent('blur')))
    const midDrag = sentTo('/api/frames/edit').length
    await slide(controlIn(openedPicker('background'), 'alpha'), '40')

    expect([midDrag, sentTo('/api/frames/edit')]).toEqual([
      0,
      [expect.objectContaining({ value: '#ff800066' })],
    ])
  })

  it('should clamp an RGB row to the channel range it writes', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame(
      'hero',
      '<h1 style="background-color: #000000">A</h1>',
    )
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')
    const picker = openPicker('background')

    await commit(controlIn(picker, 'red'), '300')

    expect(sentTo('/api/frames/edit')).toEqual([
      expect.objectContaining({ value: '#ff0000' }),
    ])
    expect(controlIn(openedPicker('background'), 'red').value).toBe('255')
  })

  it('should hold the hue on a grey and post nothing for it', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame(
      'hero',
      '<h1 style="background-color: #808080">A</h1>',
    )
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')
    const picker = openPicker('background')

    await slide(controlIn(picker, 'hue'), '200')

    expect(controlIn(openedPicker('background'), 'hue').value).toBe('200')
    expect(sentTo('/api/frames/edit')).toEqual([])
  })

  it('should write a token below full opacity as color-mix()', async () => {
    renderWithTokens([page('drafts', [frame('hero')])])
    const doc = loadFrame(
      'hero',
      '<h1 style="background-color: var(--color-accent)">A</h1>',
    )
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')

    await commit(fieldNamed('background opacity'), '60')

    expect(sentTo('/api/frames/edit')).toEqual([
      expect.objectContaining({
        property: 'background-color',
        value: 'color-mix(in srgb, var(--color-accent) 60%, transparent)',
      }),
    ])
  })

  it('should write a hex at half opacity as eight digits', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame(
      'hero',
      '<h1 style="background-color: #ff8800">A</h1>',
    )
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')

    await commit(fieldNamed('background opacity'), '50')

    expect(sentTo('/api/frames/edit')).toEqual([
      expect.objectContaining({
        property: 'background-color',
        value: '#ff880080',
      }),
    ])
  })

  it('should normalize a hex typed with a hash and three digits', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')

    await commit(fieldNamed('background'), '#F80')

    expect(sentTo('/api/frames/edit')).toEqual([
      expect.objectContaining({ value: '#ff8800' }),
    ])
  })

  it('should post nothing for an opacity above 100', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame(
      'hero',
      '<h1 style="background-color: #ff8800">A</h1>',
    )
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')

    await commit(fieldNamed('background opacity'), '120')

    expect(sentTo('/api/frames/edit')).toEqual([])
  })

  it('should post nothing for an opacity below 0', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame(
      'hero',
      '<h1 style="background-color: #ff8800">A</h1>',
    )
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')

    await commit(fieldNamed('background opacity'), '-5')

    expect(sentTo('/api/frames/edit')).toEqual([])
  })

  it('should show a token value by its name with no raw marker', () => {
    renderWithTokens([page('drafts', [frame('hero')])])
    const doc = loadFrame(
      'hero',
      '<h1 style="background-color: var(--color-accent)">A</h1>',
    )

    clickIn(doc, 'h1')

    expect(fieldNamed('background').value).toBe('--color-accent')
    expect(
      fieldNamed('background').closest('.color-field')?.textContent,
    ).not.toContain('raw')
  })

  it('should show an inline value the picker cannot read as written with opacity off', () => {
    renderWithTokens([page('drafts', [frame('hero')])])
    const doc = loadFrame(
      'hero',
      '<h1 style="background-color: var(--color-accent, #fff)">A</h1>',
    )

    clickIn(doc, 'h1')

    expect(fieldNamed('background').value).toBe('var(--color-accent, #fff)')
    expect(fieldNamed('background opacity').disabled).toBe(true)
  })

  it('should read a transparent background as no fill and post nothing on open and close', () => {
    renderWithTokens([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', '<h1>A</h1>')
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')

    const picker = openPicker('background')
    act(() => {
      picker.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      )
    })

    expect(fieldNamed('background').value).toBe('')
    expect(fieldNamed('background opacity').value).toBe('')
    expect(sentTo('/api/frames/edit')).toEqual([])
  })

  it('should close on Escape and return focus to the swatch', () => {
    renderWithTokens([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)
    clickIn(doc, 'h1')
    const picker = openPicker('background')

    act(() => {
      picker.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      )
    })

    expect(
      mount.querySelector('[aria-label="Element"] [role="dialog"]'),
    ).toBeNull()
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'background picker',
    )
  })

  it('should pick the token the arrows reach on Enter', async () => {
    renderWithTokens([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')
    const list =
      openTokens('background').querySelector<HTMLElement>('[role="listbox"]')
    if (!list) throw new Error('no token list')
    const press = (key: string) =>
      list.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))

    await act(async () => {
      press('ArrowDown')
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await act(async () => {
      press('Enter')
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(sentTo('/api/frames/edit')).toEqual([
      expect.objectContaining({ value: 'var(--color-accent)' }),
    ])
  })

  describe('eyedropper', () => {
    const host = window as unknown as Record<string, unknown>

    afterEach(() => {
      delete host.EyeDropper
    })

    it('should offer no eyedropper where the browser has none', () => {
      renderApp([page('drafts', [frame('hero')])])
      const doc = loadFrame('hero', HERO_BODY)

      clickIn(doc, 'h1')

      expect(
        mount.querySelector('[aria-label="background eyedropper"]'),
      ).toBeNull()
    })

    it('should write the hex the eyedropper resolves at the row opacity', async () => {
      host.EyeDropper = class {
        async open() {
          return { sRGBHex: '#336699' }
        }
      }
      renderApp([page('drafts', [frame('hero')])])
      const doc = loadFrame(
        'hero',
        '<h1 style="background-color: #ff880080">A</h1>',
      )
      stampHash(doc, 'abc123')
      clickIn(doc, 'h1')

      await act(async () => {
        buttonNamed('background eyedropper').click()
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      expect(sentTo('/api/frames/edit')).toEqual([
        expect.objectContaining({
          property: 'background-color',
          value: '#33669980',
        }),
      ])
    })
  })

  it('should edit text on an element holding text alone', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')

    await commit(fieldNamed('text'), 'Launch')

    expect(sentTo('/api/frames/edit')).toEqual([
      expect.objectContaining({ property: 'text', value: 'Launch' }),
    ])
  })

  it('should show the text of an element holding others read-only', () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)
    clickIn(doc, 'main')

    expect(
      mount.querySelector('[aria-label="Element"] [aria-label="text"]'),
    ).toBeNull()
    expect(
      mount.querySelector('[aria-label="Element"]')?.textContent,
    ).toContain('HeroStart')
  })

  it('should send the hash the last edit answered with the next edit', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
      sent.push({ url: String(url), body: JSON.parse(String(init?.body)) })
      return new Response('{"ok":true,"hash":"def456"}', {
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    await commit(fieldNamed('color'), 'blue')
    await commit(fieldNamed('size'), '40px')

    expect(sentTo('/api/frames/edit').at(-1)).toMatchObject({
      element: { hash: 'def456' },
    })
  })

  /** The glyph drawn inside the field of that name, which a scrub drags. */
  function glyphOf(name: string): HTMLElement {
    const glyph = fieldNamed(name)
      .closest('.glyph-field')
      ?.querySelector<HTMLElement>('.glyph')
    if (!glyph) throw new Error(`no glyph on ${name}`)
    return glyph
  }

  async function drag(
    type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
    target: HTMLElement,
    x: number,
  ) {
    await act(async () => {
      target.dispatchEvent(
        new PointerEvent(type, { bubbles: true, clientX: x, pointerId: 1 }),
      )
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }

  it('should preview a scrubbed length in the frame and post it once on release', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', '<h1 style="width: 100px">A</h1>')
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')
    const glyph = glyphOf('width')

    await drag('pointerdown', glyph, 10)
    await drag('pointermove', glyph, 12)
    await drag('pointermove', glyph, 15)
    const preview = doc.querySelector<HTMLElement>('h1')?.style.width
    await drag('pointerup', glyph, 15)

    expect(preview).toBe('105px')
    expect(sentTo('/api/frames/edit')).toEqual([
      expect.objectContaining({ property: 'width', value: '105px' }),
    ])
  })

  it('should post nothing and restore the frame when a scrub is cancelled', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', '<h1 style="width: 100px">A</h1>')
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')
    const glyph = glyphOf('width')

    await drag('pointerdown', glyph, 10)
    await drag('pointermove', glyph, 40)
    await drag('pointercancel', glyph, 40)

    expect(sentTo('/api/frames/edit')).toEqual([])
    expect(doc.querySelector<HTMLElement>('h1')?.style.width).toBe('100px')
    expect(fieldNamed('width').value).toBe('100')
  })

  it('should restore the value from before the press when the panel rerenders mid-scrub', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', '<h1 style="width: 100px">A</h1>')
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')
    const glyph = glyphOf('width')
    await drag('pointerdown', glyph, 10)
    await drag('pointermove', glyph, 40)

    act(() => {
      savedEdit.value = { key: 'elsewhere', index: 0, property: 'color' }
    })
    await drag('pointercancel', glyph, 40)

    expect(doc.querySelector<HTMLElement>('h1')?.style.width).toBe('100px')
  })

  it('should hold a scrubbed length at zero when dragged past it', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', '<h1 style="width: 10px">A</h1>')
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')
    const glyph = glyphOf('width')

    await drag('pointerdown', glyph, 100)
    await drag('pointermove', glyph, 70)
    await drag('pointerup', glyph, 70)

    expect(sentTo('/api/frames/edit')).toEqual([
      expect.objectContaining({ property: 'width', value: '0px' }),
    ])
  })

  it('should not offer a scrub on a field holding no number', () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', ROW_BODY)

    clickIn(doc, 'div')

    expect(glyphOf('direction').classList.contains('is-scrub')).toBe(false)
  })

  it('should scrub an empty gap from its placeholder', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', ROW_BODY)
    stampHash(doc, 'abc123')
    clickIn(doc, 'div')
    const glyph = glyphOf('gap')

    await drag('pointerdown', glyph, 10)
    await drag('pointermove', glyph, 14)
    await drag('pointerup', glyph, 14)

    expect(sentTo('/api/frames/edit')).toEqual([
      expect.objectContaining({ property: 'gap', value: '4px' }),
    ])
  })

  it('should say the edit was refused and reload the frame when the file moved', async () => {
    const pages = [page('drafts', [frame('hero')])]
    renderApp(pages)
    const doc = loadFrame('hero', HERO_BODY)
    stampHash(doc, 'abc123')
    clickIn(doc, 'h1')
    const before = iframeFor('hero').getAttribute('src')
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) =>
      init?.method === 'POST'
        ? new Response(
            '{"ok":false,"reason":"stale-address","detail":"changed"}',
            { status: 409, headers: { 'content-type': 'application/json' } },
          )
        : new Response(JSON.stringify(record(pages)), {
            headers: { 'content-type': 'application/json' },
          })) as typeof fetch

    await commit(fieldNamed('color'), 'blue')

    expect(
      [...mount.querySelectorAll('[aria-label="Details"] [role="alert"]')].map(
        (alert) => alert.textContent,
      ),
    ).toContainEqual(
      expect.stringContaining('changed before this edit arrived'),
    )
    expect(iframeFor('hero').getAttribute('src')).not.toBe(before)
  })
})

describe('ThemePanel', () => {
  it('should list the tokens by group on the Theme tab', () => {
    renderWithTokens([page('drafts', [frame('hero')])])

    act(() => buttonNamed('Theme').click())

    const panel = mount.querySelector('[aria-label="Theme"]')
    expect(panel?.textContent).toContain('Color')
    expect(panel?.textContent).toContain('--color-accent')
    expect(panel?.textContent).toContain('#c76b5f')
    expect(panel?.textContent).toContain('Spacing')
    expect(panel?.querySelector('input, select, textarea')).toBeNull()
  })

  it('should say no tokens resolve when the sheet defines none', () => {
    renderApp([page('drafts', [frame('hero')])])

    act(() => buttonNamed('Theme').click())

    expect(mount.querySelector('[aria-label="Theme"]')?.textContent).toContain(
      'No tokens resolve',
    )
  })

  it('should return to the pages from the Pages tab', () => {
    renderApp([page('drafts', [frame('hero')])])
    act(() => buttonNamed('Theme').click())

    act(() => buttonNamed('Pages').click())

    expect(mount.querySelector('[aria-label="Pages"]')).not.toBeNull()
  })
})

describe('selection handles', () => {
  function overlayIn(name: string): HTMLElement | null {
    return figureFor(name).querySelector<HTMLElement>('.selection')
  }

  function handleOf(name: string, corner: string): HTMLElement {
    const handle = overlayIn(name)?.querySelector<HTMLElement>(
      `[data-handle="${corner}"]`,
    )
    if (!handle) throw new Error(`no ${corner} handle on ${name}`)
    return handle
  }

  /** Stands in for layout, which the test document never runs. */
  function placeElement(
    doc: Document,
    selector: string,
    rect: { x: number; y: number; width: number; height: number },
  ): void {
    const target = doc.querySelector(selector)
    if (!target) throw new Error(`no ${selector} in the frame`)
    Object.defineProperty(target, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        ...rect,
        left: rect.x,
        top: rect.y,
        right: rect.x + rect.width,
        bottom: rect.y + rect.height,
      }),
    })
  }

  async function dragHandle(
    target: HTMLElement,
    from: { x: number; y: number },
    to: { x: number; y: number },
  ) {
    await act(async () => {
      const at = (type: string, point: { x: number; y: number }) =>
        target.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            clientX: point.x,
            clientY: point.y,
            pointerId: 1,
          }),
        )
      at('pointerdown', from)
      at('pointermove', to)
      at('pointerup', to)
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }

  function selectLabel(name: string): void {
    pointer('pointerdown', labelFor(name), 10, 10)
    pointer('pointerup', labelFor(name), 10, 10)
  }

  function answerEditsWith(hashes: string[]): void {
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
      sent.push({ url: String(url), body: JSON.parse(String(init?.body)) })
      return new Response(
        JSON.stringify({ ok: true, hash: hashes.shift() ?? 'last' }),
        { headers: { 'content-type': 'application/json' } },
      )
    }) as typeof fetch
  }

  it('should draw no handles while nothing is selected', () => {
    renderApp([page('drafts', [frame('hero')])])

    expect(overlayIn('hero')).toBeNull()
  })

  it('should draw four handles and no size chip on a selected frame', () => {
    renderApp([page('drafts', [frame('hero')])])

    selectLabel('hero')

    expect(overlayIn('hero')?.dataset.selection).toBe('frame')
    expect(overlayIn('hero')?.querySelectorAll('[data-handle]')).toHaveLength(4)
    expect(overlayIn('hero')?.querySelector('.selection-chip')).toBeNull()
  })

  it('should draw four handles and the size chip on a selected element', () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', HERO_BODY)
    placeElement(doc, 'h1', { x: 10, y: 20, width: 199.6, height: 50.2 })

    clickIn(doc, 'h1')

    const overlay = overlayIn('hero')
    expect(overlay?.dataset.selection).toBe('element')
    expect(overlay?.querySelectorAll('[data-handle]')).toHaveLength(4)
    expect(overlay?.querySelector('.selection-chip')?.textContent).toBe(
      '200 × 50',
    )
    expect(figureFor('hero').querySelectorAll('.selection')).toHaveLength(1)
  })

  it('should resize a frame by the drag in surface units at half zoom', async () => {
    renderApp([page('drafts', [frame('hero', { x: 40, y: 60 })])])
    act(() => {
      view.value = { x: 0, y: 0, zoom: 0.5 }
    })
    selectLabel('hero')

    await dragHandle(
      handleOf('hero', 'se'),
      { x: 100, y: 100 },
      { x: 200, y: 150 },
    )

    expect(sentTo('/api/frames/resize')).toEqual([
      {
        page: 'drafts',
        frame: 'hero',
        x: 40,
        y: 60,
        width: 1640,
        height: 1000,
      },
    ])
    expect(figureFor('hero').style.width).toBe('1640px')
  })

  it('should move a frame with its top left handle and keep the far corner', async () => {
    renderApp([page('drafts', [frame('hero', { x: 40, y: 60 })])])
    act(() => {
      view.value = { x: 0, y: 0, zoom: 0.5 }
    })
    selectLabel('hero')

    await dragHandle(
      handleOf('hero', 'nw'),
      { x: 100, y: 100 },
      { x: 50, y: 80 },
    )

    expect(sentTo('/api/frames/resize')).toEqual([
      {
        page: 'drafts',
        frame: 'hero',
        x: -60,
        y: 20,
        width: 1540,
        height: 940,
      },
    ])
  })

  it('should write nothing for a handle pressed and never moved', async () => {
    renderApp([page('drafts', [frame('hero')])])
    selectLabel('hero')

    await dragHandle(
      handleOf('hero', 'se'),
      { x: 100, y: 100 },
      { x: 101, y: 101 },
    )

    expect(sentTo('/api/frames/resize')).toEqual([])
  })

  it('should resize the selected frame with Ctrl and an arrow key', () => {
    renderApp([page('drafts', [frame('hero', { x: 40, y: 60 })])])
    selectLabel('hero')

    act(() => {
      figureFor('hero').dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          ctrlKey: true,
          bubbles: true,
        }),
      )
    })

    expect(sentTo('/api/frames/resize')).toEqual([
      { page: 'drafts', frame: 'hero', x: 40, y: 60, width: 1450, height: 900 },
    ])
    expect(sentTo('/api/frames/move')).toEqual([])
  })

  it('should write an element resize as a width edit then a height edit on the hash the first answered', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame(
      'hero',
      '<h1 style="width: 200px; height: 50px">Hero</h1>',
    )
    stampHash(doc, 'abc123')
    placeElement(doc, 'h1', { x: 10, y: 20, width: 200, height: 50 })
    clickIn(doc, 'h1')
    act(() => {
      view.value = { ...view.value, zoom: 0.5 }
    })
    answerEditsWith(['def456', 'ghi789'])

    await dragHandle(
      handleOf('hero', 'se'),
      { x: 100, y: 100 },
      { x: 150, y: 110 },
    )

    expect(sentTo('/api/frames/edit')).toEqual([
      expect.objectContaining({
        property: 'width',
        value: '300px',
        element: expect.objectContaining({ hash: 'abc123' }),
      }),
      expect.objectContaining({
        property: 'height',
        value: '70px',
        element: expect.objectContaining({ hash: 'def456' }),
      }),
    ])
  })

  it('should drop the preview when a handle drag comes back to where it started', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', '<h1>Hero</h1>')
    stampHash(doc, 'abc123')
    placeElement(doc, 'h1', { x: 10, y: 20, width: 200, height: 50 })
    clickIn(doc, 'h1')
    act(() => {
      view.value = { ...view.value, zoom: 1 }
    })
    const handle = handleOf('hero', 'se')

    await act(async () => {
      const at = (type: string, x: number) =>
        handle.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            clientX: x,
            clientY: 100,
            pointerId: 1,
          }),
        )
      at('pointerdown', 100)
      at('pointermove', 140)
      at('pointermove', 100)
      at('pointerup', 100)
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    const style = doc.querySelector<HTMLElement>('h1')?.style
    expect(sentTo('/api/frames/edit')).toEqual([])
    expect(style?.width).toBe('')
    expect(style?.height).toBe('')
  })

  it('should keep an element overlay on the element while a top left handle drags', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', '<h1 style="width: 200px">Hero</h1>')
    stampHash(doc, 'abc123')
    const target = doc.querySelector<HTMLElement>('h1')
    if (!target) throw new Error('no h1 in the frame')
    /* The element grows from its own top left, so its box tracks the style. */
    Object.defineProperty(target, 'getBoundingClientRect', {
      configurable: true,
      value: () => {
        const width = Number.parseFloat(target.style.width) || 200
        return { x: 10, y: 20, left: 10, top: 20, width, height: 50 }
      },
    })
    clickIn(doc, 'h1')
    act(() => {
      view.value = { ...view.value, zoom: 1 }
    })
    const handle = handleOf('hero', 'nw')

    await act(async () => {
      handle.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          clientX: 100,
          clientY: 100,
          pointerId: 1,
        }),
      )
      handle.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          clientX: 60,
          clientY: 100,
          pointerId: 1,
        }),
      )
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    const overlay = figureFor('hero').querySelector<HTMLElement>(
      '.selection[data-selection="element"]',
    )
    expect(overlay?.style.left).toBe('10px')
    expect(overlay?.style.width).toBe('240px')
    expect(overlay?.querySelector('.selection-chip')?.textContent).toBe(
      '240 × 50',
    )
  })

  it('should send one edit for an element dragged along one axis', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame(
      'hero',
      '<h1 style="width: 200px; height: 50px">Hero</h1>',
    )
    stampHash(doc, 'abc123')
    placeElement(doc, 'h1', { x: 10, y: 20, width: 200, height: 50 })
    clickIn(doc, 'h1')
    act(() => {
      view.value = { ...view.value, zoom: 1 }
    })

    await dragHandle(
      handleOf('hero', 'se'),
      { x: 100, y: 100 },
      { x: 140, y: 100 },
    )

    expect(sentTo('/api/frames/edit')).toEqual([
      expect.objectContaining({ property: 'width', value: '240px' }),
    ])
  })

  async function cancelDrag(
    target: HTMLElement,
    from: { x: number; y: number },
    to: { x: number; y: number },
  ) {
    await act(async () => {
      const at = (type: string, point: { x: number; y: number }) =>
        target.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            clientX: point.x,
            clientY: point.y,
            pointerId: 1,
          }),
        )
      at('pointerdown', from)
      at('pointermove', to)
      at('pointercancel', to)
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }

  it('should put a frame back at its box when a handle drag is cancelled', async () => {
    renderApp([page('drafts', [frame('hero', { x: 40, y: 60 })])])
    selectLabel('hero')

    await cancelDrag(
      handleOf('hero', 'nw'),
      { x: 100, y: 100 },
      { x: 20, y: 30 },
    )

    expect(sentTo('/api/frames/resize')).toEqual([])
    expect(figureFor('hero').style.left).toBe('40px')
    expect(figureFor('hero').style.width).toBe('1440px')
  })

  it('should restore the element inline size when a handle drag is cancelled', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame('hero', '<h1 style="width: 200px">Hero</h1>')
    stampHash(doc, 'abc123')
    placeElement(doc, 'h1', { x: 10, y: 20, width: 200, height: 50 })
    clickIn(doc, 'h1')
    act(() => {
      view.value = { ...view.value, zoom: 1 }
    })

    await cancelDrag(
      handleOf('hero', 'se'),
      { x: 100, y: 100 },
      { x: 160, y: 140 },
    )

    const style = doc.querySelector<HTMLElement>('h1')?.style
    expect(sentTo('/api/frames/edit')).toEqual([])
    expect(style?.width).toBe('200px')
    expect(style?.height).toBe('')
  })

  it('should send no height edit once the width edit is refused', async () => {
    renderApp([page('drafts', [frame('hero')])])
    const doc = loadFrame(
      'hero',
      '<h1 style="width: 200px; height: 50px">Hero</h1>',
    )
    stampHash(doc, 'abc123')
    placeElement(doc, 'h1', { x: 10, y: 20, width: 200, height: 50 })
    clickIn(doc, 'h1')
    act(() => {
      view.value = { ...view.value, zoom: 1 }
    })
    failWrites([page('drafts', [frame('hero')])])
    let edits = 0
    const refuse = globalThis.fetch
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
      if (String(url) === '/api/frames/edit') edits += 1
      return refuse(url as string, init)
    }) as typeof fetch

    await dragHandle(
      handleOf('hero', 'se'),
      { x: 100, y: 100 },
      { x: 140, y: 130 },
    )

    expect(edits).toBe(1)
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
