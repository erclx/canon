import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Browser, Page } from 'playwright-core'
import { probeFocus } from '@/driver/probes/focus'

/**
 * Pins the two false-finding classes this probe was built against: `.focus()`
 * diverging from Tab once a pointer interaction has happened, and an outline
 * sub-property moving under an outline resolving to `none`. It skips without a browser binary.
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

    // `#pinned` is `fixed`, so its `offsetParent` is null on screen and a test keyed on it would skip its missing ring.
    expect(findings.map((finding) => finding.selector)).toEqual([
      'button#quiet',
      'button#pinned',
    ])
    expect(findings[0]).toMatchObject({ probe: 'focus' })
  }, 120_000)

  it('should differ from a reader that focuses without entering keyboard modality', async () => {
    const page = await browser.newPage()
    await page.setContent(PAGE)
    // The click is the point, since the cheap reader is only wrong once a pointer has set the modality.
    await page.locator('#ring').click()

    const naive = await readWithoutTab(page)

    // A page of its own, since the modality one press installs would carry back into the control above.
    const fresh = await browser.newPage()
    await fresh.setContent(PAGE)
    await fresh.locator('#ring').click()
    const findings = await probeFocus(fresh)

    await page.close()
    await fresh.close()

    // The ring is present and correctly written, and the cheaper reader calls it unstyled anyway.
    expect(naive).toContain('ring')
    expect(findings.map((finding) => finding.selector)).toEqual([
      'button#quiet',
      'button#pinned',
    ])
  }, 120_000)
})
