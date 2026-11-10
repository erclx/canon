import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { captureSections } from '@/capture/render'

/**
 * Drives `captureSections` through the real engine on fixture pages, since
 * the split reads layout and the preparation reads scroll, neither of which a
 * simulated DOM renders.
 *
 * The suite needs a browser binary and skips without one, so a green pipeline
 * is not evidence this passed.
 */

async function browserAvailable(): Promise<boolean> {
  try {
    const { chromium } = await import('playwright-core')
    const browser = await chromium.launch()
    await browser.close()
    return true
  } catch {
    return false
  }
}

const hasBrowser = await browserAvailable()
const TIMEOUT_MS = 60_000
const WIDTH = 800

function pageWith(style: string, body: string, script = ''): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#fff}section,div{box-sizing:border-box}${style}</style></head><body>${body}<script>${script}</script></body></html>`
}

function band(height: number, color = '#fff'): string {
  return `<section style="height:${height}px;background:${color}"></section>`
}

/**
 * A control drawn red where the primary pointer hovers and green where it
 * cannot, so the painted color names which media query matched.
 */
const HOVER_KEYED_STYLE =
  '#menu,#tap{height:200px;display:none}@media (hover:hover){#menu{display:block;background:#f00}}@media (hover:none){#tap{display:block;background:#0f0}}'
const HOVER_KEYED_BODY = `<main><section style="height:800px"><div id="menu"></div><div id="tap"></div></section></main>`

/** How many pixels of the decoded PNG carry no paint at all. */
function transparentPixels(png: PNG): number {
  let count = 0
  for (let offset = 3; offset < png.data.length; offset += 4) {
    if (png.data[offset] === 0) count += 1
  }
  return count
}

/** Whether any pixel of the PNG is the given pure color. */
function paints(path: string, [r, g, b]: [number, number, number]): boolean {
  const png = PNG.sync.read(readFileSync(path))
  for (let offset = 0; offset < png.data.length; offset += 4) {
    if (
      png.data[offset] === r &&
      png.data[offset + 1] === g &&
      png.data[offset + 2] === b
    ) {
      return true
    }
  }
  return false
}

describe.skipIf(!hasBrowser)('captureSections', () => {
  let dir: string

  function source(name: string, html: string): string {
    const path = join(dir, `${name}.html`)
    writeFileSync(path, html)
    return path
  }

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'capture-sections-'))
  })

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it(
    'should split a tall wrapper into its children',
    async () => {
      const page = source(
        'wrapper',
        pageWith('', `<main><div>${band(800).repeat(3)}</div></main>`),
      )
      const outDir = join(dir, 'wrapper')

      const result = await captureSections(page, { outDir, width: WIDTH })

      expect(result).toMatchObject({
        status: 'captured',
        failed: [],
        sections: [
          { index: 1, top: 0, height: 800 },
          { index: 2, top: 800, height: 800 },
          { index: 3, top: 1600, height: 800 },
        ],
      })
      expect(existsSync(join(outDir, 'section-01.png'))).toBe(true)
      expect(existsSync(join(outDir, 'section-01.stamp'))).toBe(true)
    },
    TIMEOUT_MS,
  )

  it(
    'should merge a run of short bands into the block above',
    async () => {
      const page = source(
        'bands',
        pageWith('', `<main>${band(1000)}${band(150).repeat(3)}</main>`),
      )

      const result = await captureSections(page, {
        outDir: join(dir, 'bands'),
        width: WIDTH,
      })

      expect(result).toMatchObject({
        status: 'captured',
        sections: [{ index: 1, top: 0, height: 1450 }],
      })
    },
    TIMEOUT_MS,
  )

  it(
    'should leave fixed and sticky layers out of every shot',
    async () => {
      const page = source(
        'fixed',
        pageWith(
          'header{position:fixed;top:0;left:0;right:0;height:60px;background:#f00}aside{position:fixed;bottom:0;left:0;right:0;height:80px;background:#f00}nav{position:sticky;top:0;height:40px;background:#f00}',
          `<header></header><main><nav></nav>${band(800).repeat(3)}</main><aside>We use cookies</aside>`,
        ),
      )
      const outDir = join(dir, 'fixed')

      const result = await captureSections(page, { outDir, width: WIDTH })

      expect(result).toMatchObject({ status: 'captured', failed: [] })
      const shots = result.status === 'captured' ? result.sections : []
      expect(shots.length).toBeGreaterThan(0)
      expect(shots.map((shot) => paints(shot.path, [255, 0, 0]))).toEqual(
        shots.map(() => false),
      )
    },
    TIMEOUT_MS,
  )

  it(
    'should leave out a banner that mounts after the page prepared',
    async () => {
      const page = source(
        'late-banner',
        pageWith(
          '',
          `<main>${band(800).repeat(4)}</main>`,
          "setTimeout(() => { const banner = document.createElement('div'); banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;height:120px;background:#f00'; document.body.append(banner) }, 1800)",
        ),
      )
      const outDir = join(dir, 'late-banner')

      const result = await captureSections(page, { outDir, width: WIDTH })

      expect(result).toMatchObject({ status: 'captured', failed: [] })
      expect(paints(join(outDir, 'section-04.png'), [255, 0, 0])).toBe(false)
    },
    TIMEOUT_MS,
  )

  it(
    'should leave out a fixed banner in a shadow root hosted outside the body',
    async () => {
      const page = source(
        'shadow-banner',
        pageWith(
          '',
          `<main>${band(800).repeat(2)}</main>`,
          "const host = document.createElement('div'); document.documentElement.append(host); host.attachShadow({ mode: 'open' }).innerHTML = '<div style=\"position:fixed;bottom:0;left:0;right:0;height:120px;background:#f00\"></div>'",
        ),
      )
      const outDir = join(dir, 'shadow-banner')

      const result = await captureSections(page, { outDir, width: WIDTH })

      expect(result).toMatchObject({ status: 'captured', failed: [] })
      expect(paints(join(outDir, 'section-01.png'), [255, 0, 0])).toBe(false)
    },
    TIMEOUT_MS,
  )

  it(
    'should paint a reveal-on-view block in its shot',
    async () => {
      const page = source(
        'reveal',
        pageWith(
          '#reveal{background:#fff}#reveal.in{background:#0f0}',
          `<main>${band(800)}${band(800)}<section id="reveal" style="height:800px"></section></main>`,
          "new IntersectionObserver(([entry]) => entry.target.classList.toggle('in', entry.isIntersecting)).observe(document.getElementById('reveal'))",
        ),
      )
      const outDir = join(dir, 'reveal')

      const result = await captureSections(page, { outDir, width: WIDTH })

      expect(result).toMatchObject({ status: 'captured', failed: [] })
      expect(paints(join(outDir, 'section-03.png'), [0, 255, 0])).toBe(true)
    },
    TIMEOUT_MS,
  )

  it(
    'should shoot content that loads only once the reader scrolls to it',
    async () => {
      const page = source(
        'lazy',
        pageWith(
          '',
          `<main>${band(800).repeat(2)}<div id="sentinel" style="height:1px"></div></main>`,
          "const sentinel = document.getElementById('sentinel'); new IntersectionObserver(([entry], observer) => { if (!entry.isIntersecting) return; observer.disconnect(); const lazy = document.createElement('section'); lazy.style.cssText = 'height:800px;background:#00f'; sentinel.before(lazy) }).observe(sentinel)",
        ),
      )
      const outDir = join(dir, 'lazy')

      const result = await captureSections(page, { outDir, width: WIDTH })

      expect(result).toMatchObject({
        status: 'captured',
        sections: [
          { index: 1, top: 0 },
          { index: 2, top: 800 },
          { index: 3, top: 1600, height: 800 },
        ],
      })
      expect(paints(join(outDir, 'section-03.png'), [0, 0, 255])).toBe(true)
    },
    TIMEOUT_MS,
  )

  it(
    'should draw the touch variant of a hover-keyed control under touch',
    async () => {
      const page = source(
        'hover-touch',
        pageWith(HOVER_KEYED_STYLE, HOVER_KEYED_BODY),
      )
      const outDir = join(dir, 'hover-touch')

      const result = await captureSections(page, {
        outDir,
        width: 320,
        touch: true,
      })

      expect(result).toMatchObject({ status: 'captured', failed: [] })
      expect(paints(join(outDir, 'section-01.png'), [0, 255, 0])).toBe(true)
      expect(paints(join(outDir, 'section-01.png'), [255, 0, 0])).toBe(false)
    },
    TIMEOUT_MS,
  )

  it(
    'should draw the hover variant of the same control without touch',
    async () => {
      const page = source(
        'hover-default',
        pageWith(HOVER_KEYED_STYLE, HOVER_KEYED_BODY),
      )
      const outDir = join(dir, 'hover-default')

      const result = await captureSections(page, { outDir, width: 320 })

      expect(result).toMatchObject({ status: 'captured', failed: [] })
      expect(paints(join(outDir, 'section-01.png'), [255, 0, 0])).toBe(true)
      expect(paints(join(outDir, 'section-01.png'), [0, 255, 0])).toBe(false)
    },
    TIMEOUT_MS,
  )

  it(
    'should shoot a touch section taller than the viewport whole',
    async () => {
      const page = source(
        'touch-tall',
        pageWith(
          '',
          `<main><section style="height:1100px;background:#0f0"><div style="height:1000px"></div><div style="height:100px;background:#00f"></div></section></main>`,
        ),
      )
      const outDir = join(dir, 'touch-tall')

      const result = await captureSections(page, {
        outDir,
        width: 320,
        touch: true,
      })

      expect(result).toMatchObject({
        status: 'captured',
        sections: [{ index: 1, top: 0, height: 1100 }],
      })
      const png = PNG.sync.read(readFileSync(join(outDir, 'section-01.png')))
      expect([png.width, png.height]).toEqual([640, 2200])
      expect(paints(join(outDir, 'section-01.png'), [0, 0, 255])).toBe(true)
    },
    TIMEOUT_MS,
  )

  it(
    'should shoot a touch section wider than the viewport whole',
    async () => {
      const page = source(
        'touch-wide',
        pageWith(
          'main{min-width:1000px}',
          `<main><section style="height:800px;background:#0f0;display:flex;justify-content:flex-end"><div style="width:100px;background:#00f"></div></section></main>`,
        ),
      )
      const outDir = join(dir, 'touch-wide')

      const result = await captureSections(page, {
        outDir,
        width: 320,
        touch: true,
      })

      expect(result).toMatchObject({ status: 'captured', failed: [] })
      const png = PNG.sync.read(readFileSync(join(outDir, 'section-01.png')))
      expect(png.width).toBe(2000)
      expect(paints(join(outDir, 'section-01.png'), [0, 0, 255])).toBe(true)
      expect(transparentPixels(png)).toBe(0)
    },
    TIMEOUT_MS,
  )

  it(
    'should fall back to the body on a page with no main element',
    async () => {
      const page = source('no-main', pageWith('', band(800).repeat(2)))

      const result = await captureSections(page, {
        outDir: join(dir, 'no-main'),
        width: WIDTH,
      })

      expect(result).toMatchObject({
        status: 'captured',
        sections: [
          { index: 1, top: 0, height: 800 },
          { index: 2, top: 800, height: 800 },
        ],
      })
    },
    TIMEOUT_MS,
  )

  it(
    'should cut a section taller than the cap rather than fail',
    async () => {
      const page = source('tall', pageWith('', `<main>${band(3000)}</main>`))
      const outDir = join(dir, 'tall')

      const result = await captureSections(page, { outDir, width: WIDTH })

      expect(result).toMatchObject({
        status: 'captured',
        failed: [],
        sections: [{ index: 1, top: 0, height: 2400 }],
      })
      expect(
        PNG.sync.read(readFileSync(join(outDir, 'section-01.png'))).height,
      ).toBe(4800)
    },
    TIMEOUT_MS,
  )

  it(
    'should record a generic family rather than refuse the page',
    async () => {
      const page = source(
        'generic',
        pageWith(
          'p{font-family:system-ui;margin:0}',
          `<main><section style="height:800px"><p>text</p></section></main>`,
        ),
      )

      const result = await captureSections(page, {
        outDir: join(dir, 'generic'),
        width: WIDTH,
      })

      expect(result).toMatchObject({
        status: 'captured',
        sections: [{ index: 1 }],
        fonts: { generic: ['system-ui'] },
      })
    },
    TIMEOUT_MS,
  )

  it(
    'should fail with a reason when the root draws no box',
    async () => {
      const page = source(
        'boxless',
        pageWith('main{display:contents}', `<main></main>`),
      )

      const result = await captureSections(page, {
        outDir: join(dir, 'boxless'),
        root: 'main',
        width: WIDTH,
      })

      expect(result).toMatchObject({
        status: 'failed',
        reason: expect.stringContaining('drew no box'),
      })
    },
    TIMEOUT_MS,
  )

  it(
    'should fail a page whose named root matches nothing',
    async () => {
      const page = source('rootless', pageWith('', band(800)))

      const result = await captureSections(page, {
        outDir: join(dir, 'rootless'),
        root: '#absent',
        width: WIDTH,
      })

      expect(result).toMatchObject({
        status: 'failed',
        reason: expect.stringContaining('#absent'),
      })
    },
    TIMEOUT_MS,
  )
})
