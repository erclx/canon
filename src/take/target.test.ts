import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Browser, Page } from 'playwright-core'
import { boxExpression, coverExpression } from '@/take/perform'
import { findShell } from '@/take/shell'

/**
 * Evaluates the page-side target lookup on a real page, since shadow roots and
 * boxes exist only where a browser lays the page out. Every element a case
 * aims at is placed absolutely, so the box it should resolve to is a literal.
 *
 * The suite needs chrome-headless-shell. CI installs none, so it skips there
 * rather than failing, which means a green pipeline is not evidence this ran.
 */

function shellPath(): string | null {
  try {
    return findShell()
  } catch {
    return null
  }
}

const shell = shellPath()

const AT = (left: number, top: number): string =>
  `position:absolute;left:${left}px;top:${top}px;width:100px;height:40px;margin:0;padding:0;border:0`

describe.skipIf(!shell)('boxExpression on a rendered page', () => {
  let browser: Browser
  let page: Page

  beforeAll(async () => {
    const { chromium } = await import('playwright-core')
    browser = await chromium.launch({ executablePath: shell ?? undefined })
    page = await browser.newPage()
  }, 120_000)

  afterAll(async () => {
    await browser.close()
  })

  async function resolve(html: string, target: string): Promise<unknown> {
    await page.setContent(html)
    return page.evaluate(boxExpression(target))
  }

  describe('inside an open shadow root', () => {
    const banner = `<div id="host"></div><script>
      document.getElementById('host').attachShadow({ mode: 'open' }).innerHTML =
        '<button id="reject" style="${AT(10, 20)}">Reject all</button>'
    </script>`

    it('should resolve a text target', async () => {
      const box = await resolve(banner, 'text=Reject all')

      expect(box).toEqual({ x: 10, y: 20, width: 100, height: 40 })
    })

    it('should resolve a selector target', async () => {
      const box = await resolve(banner, '#reject')

      expect(box).toEqual({ x: 10, y: 20, width: 100, height: 40 })
    })

    it('should resolve a selector nested two shadow roots deep', async () => {
      const html = `<div id="outer"></div><script>
        const outer = document.getElementById('outer').attachShadow({ mode: 'open' })
        outer.innerHTML = '<div id="inner"></div>'
        outer.getElementById('inner').attachShadow({ mode: 'open' }).innerHTML =
          '<button id="deep" style="${AT(30, 50)}">Deep</button>'
      </script>`

      const box = await resolve(html, '#deep')

      expect(box).toEqual({ x: 30, y: 50, width: 100, height: 40 })
    })

    it('should pick the inner sized match over its matching ancestor', async () => {
      const html = `<div id="host"></div><script>
        document.getElementById('host').attachShadow({ mode: 'open' }).innerHTML =
          '<div style="${AT(0, 0)};width:400px;height:200px"><span style="${AT(40, 60)}">Accept</span></div>'
      </script>`

      const box = await resolve(html, 'text=Accept')

      expect(box).toEqual({ x: 40, y: 60, width: 100, height: 40 })
    })

    it('should read containment through the boundary to a light-DOM ancestor', async () => {
      const html = `<div style="${AT(0, 0)};width:400px;height:200px"><x-label id="host" style="${AT(0, 0)};display:block;width:300px;height:150px">Accept</x-label></div><script>
        document.getElementById('host').attachShadow({ mode: 'open' }).innerHTML =
          '<span style="${AT(70, 90)}">Accept</span>'
      </script>`

      const box = await resolve(html, 'text=Accept')

      expect(box).toEqual({ x: 70, y: 90, width: 100, height: 40 })
    })

    it('should keep resolving a slotted host to the host', async () => {
      const html = `<x-button id="host" style="${AT(15, 25)};display:block">Reject all</x-button><script>
        document.getElementById('host').attachShadow({ mode: 'open' }).innerHTML =
          '<button><slot></slot></button>'
      </script>`

      const box = await resolve(html, 'text=Reject all')

      expect(box).toEqual({ x: 15, y: 25, width: 100, height: 40 })
    })
  })

  describe('a document-tree match', () => {
    const both = `<button id="go" style="${AT(200, 300)}">Go</button><div id="host"></div><script>
      document.getElementById('host').attachShadow({ mode: 'open' }).innerHTML =
        '<button id="go" style="${AT(10, 20)}">Go</button>'
    </script>`

    it('should win over a shadow-root match of the same selector', async () => {
      const box = await resolve(both, '#go')

      expect(box).toEqual({ x: 200, y: 300, width: 100, height: 40 })
    })

    it('should win over a shadow-root match of the same text', async () => {
      const box = await resolve(both, 'text=Go')

      expect(box).toEqual({ x: 200, y: 300, width: 100, height: 40 })
    })
  })

  describe('out of reach', () => {
    it('should refuse a selector spanning a shadow boundary', async () => {
      const html = `<x-banner id="host"></x-banner><script>
        document.getElementById('host').attachShadow({ mode: 'open' }).innerHTML =
          '<button style="${AT(10, 20)}">Reject all</button>'
      </script>`

      const box = await resolve(html, 'x-banner button')

      expect(box).toBeNull()
    })

    it('should refuse a text target inside a closed shadow root', async () => {
      const html = `<div id="host"></div><script>
        document.getElementById('host').attachShadow({ mode: 'closed' }).innerHTML =
          '<button id="reject" style="${AT(10, 20)}">Reject all</button>'
      </script>`

      const box = await resolve(html, 'text=Reject all')

      expect(box).toBeNull()
    })

    it('should refuse a selector target inside a closed shadow root', async () => {
      const html = `<div id="host"></div><script>
        document.getElementById('host').attachShadow({ mode: 'closed' }).innerHTML =
          '<button id="reject" style="${AT(10, 20)}">Reject all</button>'
      </script>`

      const box = await resolve(html, '#reject')

      expect(box).toBeNull()
    })

    it('should refuse a target inside a data URL iframe', async () => {
      const frame = encodeURIComponent(
        `<button id="reject" style="${AT(10, 20)}">Reject all</button>`,
      )
      const html = `<iframe src="data:text/html,${frame}" style="${AT(0, 0)};width:400px;height:200px"></iframe>`

      const box = await resolve(html, '#reject')

      expect(box).toBeNull()
    })
  })
})

describe.skipIf(!shell)('coverExpression on a rendered page', () => {
  let browser: Browser
  let page: Page

  beforeAll(async () => {
    const { chromium } = await import('playwright-core')
    browser = await chromium.launch({ executablePath: shell ?? undefined })
    page = await browser.newPage()
  }, 120_000)

  afterAll(async () => {
    await browser.close()
  })

  /** The center of a box `AT(10, 20)` places, where every press below aims. */
  const CENTER = { x: 60, y: 40 }

  async function cover(html: string, target: string): Promise<unknown> {
    await page.setContent(html)
    return page.evaluate(coverExpression(target, CENTER))
  }

  it('should name a sibling drawn over the target by its tag and first class', async () => {
    const html = `<button id="save" style="${AT(10, 20)}">Save</button><div class="hit-layer wide" style="${AT(0, 0)};width:400px;height:200px"></div>`

    expect(await cover(html, '#save')).toBe('div.hit-layer')
  })

  it('should name a cover by its id over its class', async () => {
    const html = `<button id="save" style="${AT(10, 20)}">Save</button><div id="scrim" class="modal" style="${AT(0, 0)};width:400px;height:200px"></div>`

    expect(await cover(html, '#save')).toBe('div#scrim')
  })

  it('should clear a press landing on a child of the target', async () => {
    const html = `<button id="save" style="${AT(10, 20)}"><span style="display:block;width:100%;height:100%">Save</span></button>`

    expect(await cover(html, '#save')).toBeNull()
  })

  it('should clear a press landing on an element the target sits inside', async () => {
    const html = `<div id="row" style="${AT(0, 0)};width:400px;height:200px"><span id="label" style="${AT(10, 20)};pointer-events:none">Row</span></div>`

    expect(await cover(html, '#label')).toBeNull()
  })

  it('should clear a layer that lets the pointer pass', async () => {
    const html = `<button id="save" style="${AT(10, 20)}">Save</button><div class="glass" style="${AT(0, 0)};width:400px;height:200px;pointer-events:none"></div>`

    expect(await cover(html, '#save')).toBeNull()
  })

  it('should clear a text target whose button takes the press', async () => {
    const html = `<button style="${AT(10, 20)}"><span style="pointer-events:none">Save</span></button>`

    expect(await cover(html, 'text=Save')).toBeNull()
  })

  it('should clear a press on a host landing inside its shadow root', async () => {
    const html = `<x-button id="host" style="${AT(10, 20)};display:block"></x-button><script>
      document.getElementById('host').attachShadow({ mode: 'open' }).innerHTML =
        '<button style="display:block;width:100px;height:40px">Save</button>'
    </script>`

    expect(await cover(html, '#host')).toBeNull()
  })

  it('should clear a slotted target the press lands on', async () => {
    const html = `<x-card id="host" style="${AT(0, 0)};display:block;width:400px;height:200px"><button id="save" style="${AT(10, 20)}">Save</button></x-card><script>
      document.getElementById('host').attachShadow({ mode: 'open' }).innerHTML =
        '<div><slot></slot></div>'
    </script>`

    expect(await cover(html, '#save')).toBeNull()
  })

  it('should name a cover drawn inside a shadow root over a light target', async () => {
    const html = `<button id="save" style="${AT(10, 20)}">Save</button><x-banner id="host"></x-banner><script>
      document.getElementById('host').attachShadow({ mode: 'open' }).innerHTML =
        '<div class="consent" style="position:fixed;left:0;top:0;width:400px;height:200px"></div>'
    </script>`

    expect(await cover(html, '#save')).toBe('div.consent')
  })

  it('should name a bare tag for a cover carrying no id or class', async () => {
    const html = `<button id="save" style="${AT(10, 20)}">Save</button><section style="${AT(0, 0)};width:400px;height:200px"></section>`

    expect(await cover(html, '#save')).toBe('section')
  })
})
