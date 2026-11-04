import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Browser, Page } from 'playwright-core'
import { probeFocus } from '@/driver/probes/focus'

/**
 * Pins the two false-finding classes this probe was built against.
 *
 * The first is the `.focus()`-versus-Tab divergence, and the control below is
 * the reader that produced 27 false findings against a page whose rings were
 * all present. It only diverges once the page has taken a pointer interaction,
 * which is why the control clicks first: on a page nobody has touched, Chromium
 * matches `:focus-visible` for a scripted focus and the cheap reader looks
 * correct. A driver clicks by definition, so every state it measures after its
 * first `click` step is the state where the cheap reader breaks.
 *
 * The second is an outline sub-property moving underneath an outline that
 * resolves to `none`, which is a computed difference that paints nothing.
 * `#quiet` in the fixture is that shape rather than an invented one: it clears
 * `outline` for itself while the broader rule still sets `outline-offset`.
 *
 * The suite needs a browser binary. CI installs none, so it skips there rather
 * than failing, which means a green pipeline is not evidence this passed.
 */

/** One ring written the way a stylesheet writes one, and one control with none. */
const PAGE = readFileSync(
  new URL('./fixtures/focus.html', import.meta.url),
  'utf8',
)

/**
 * The implementation this probe replaced: focus each element and compare its
 * computed outline, with nothing putting the page in keyboard modality first.
 */
async function readWithoutTab(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const unstyled: string[] = []
    for (const element of Array.from(document.querySelectorAll('button'))) {
      const rest = getComputedStyle(element).outlineStyle
      element.focus()
      if (getComputedStyle(element).outlineStyle === rest) {
        unstyled.push(element.id)
      }
      element.blur()
    }
    return unstyled
  })
}

async function browserAvailable(): Promise<boolean> {
  const { chromium } = await import('playwright-core')
  try {
    const browser = await chromium.launch()
    await browser.close()
    return true
  } catch {
    return false
  }
}

const hasBrowser = await browserAvailable()

describe.skipIf(!hasBrowser)('probeFocus against a rendered page', () => {
  let browser: Browser

  beforeAll(async () => {
    const { chromium } = await import('playwright-core')
    browser = await chromium.launch()
  }, 120_000)

  afterAll(async () => {
    await browser.close()
  })

  it('should report only the element that shows nothing under focus', async () => {
    const page = await browser.newPage()
    await page.setContent(PAGE)

    const findings = await probeFocus(page)
    await page.close()

    // `#pinned` is positioned `fixed`, so its `offsetParent` is null while it
    // is plainly on screen. A visibility test keyed on that property skips it
    // and never reports the ring it does not draw.
    expect(findings.map((finding) => finding.selector)).toEqual([
      'button#quiet',
      'button#pinned',
    ])
    expect(findings[0]).toMatchObject({ probe: 'focus' })
  }, 120_000)

  it('should differ from a reader that focuses without entering keyboard modality', async () => {
    const page = await browser.newPage()
    await page.setContent(PAGE)
    // The click is the point. Chromium matches `:focus-visible` for a scripted
    // focus on a page nobody has touched, so the cheap reader is only wrong
    // once a pointer has set the modality, which every driver step does.
    await page.locator('#ring').click()

    const naive = await readWithoutTab(page)

    // A page of its own for the probe, since the modality one press installs
    // belongs to the page and would carry back into the control above.
    const fresh = await browser.newPage()
    await fresh.setContent(PAGE)
    await fresh.locator('#ring').click()
    const findings = await probeFocus(fresh)

    await page.close()
    await fresh.close()

    // The ring is present and correctly written, and the cheaper reader calls
    // it unstyled anyway. That is the whole of the 27-finding class.
    expect(naive).toContain('ring')
    expect(findings.map((finding) => finding.selector)).toEqual([
      'button#quiet',
      'button#pinned',
    ])
  }, 120_000)
})
