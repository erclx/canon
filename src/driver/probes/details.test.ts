import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Browser } from 'playwright-core'
import { probeDetails } from '@/driver/probes/details'

/**
 * Pins both halves of the closed-menu lesson against one fixture: shut, the
 * element measures only its summary, and open, the panel hangs off a phone-width
 * edge. It skips without a browser binary, so green is no evidence it passed.
 */

const PHONE = { width: 390, height: 800 }

/**
 * A narrow trigger and a panel landing 35px past the right edge only once open.
 * The offset hangs off `details[open]`, since this Chromium gives a closed
 * `<details>` a full layout box and a merely hidden panel would still measure.
 */
const PAGE = readFileSync(
  new URL('./fixtures/details.html', import.meta.url),
  'utf8',
)

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

describe.skipIf(!hasBrowser)('probeDetails against a rendered menu', () => {
  let browser: Browser

  beforeAll(async () => {
    const { chromium } = await import('playwright-core')
    browser = await chromium.launch()
  }, 120_000)

  afterAll(async () => {
    await browser.close()
  })

  it('should report the panel that only leaves the viewport once open', async () => {
    const page = await browser.newPage({ viewport: PHONE })
    await page.setContent(PAGE)

    const findings = await probeDetails(page)
    await page.close()

    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ probe: 'details' })
    expect(findings[0]?.detail).toContain('35px outside the viewport')
    expect(findings[0]?.detail).toContain('details#menu')
  }, 120_000)

  it('should carry the shut box as context rather than as a judgment', async () => {
    const page = await browser.newPage({ viewport: PHONE })
    await page.setContent(PAGE)

    const findings = await probeDetails(page)
    await page.close()

    // The shut reading is in the record so a reader sees it was taken, named as measuring nothing.
    expect(findings[0]?.measured).toContain('shut')
    expect(findings[0]?.measured).toContain('measures nothing')
  }, 120_000)

  it('should find what a probe reading only the shut state cannot see', async () => {
    const page = await browser.newPage({ viewport: PHONE })
    await page.setContent(PAGE)

    const shut = await page.evaluate(() => {
      const rect = (
        document.querySelector('.panel') as Element
      ).getBoundingClientRect().right
      return Math.round(rect - document.documentElement.clientWidth)
    })
    const findings = await probeDetails(page)
    await page.close()

    // Shut, the panel reads clean, and the defect is over the edge only while open.
    expect(shut).toBeLessThan(0)
    expect(findings).toHaveLength(1)
  }, 120_000)

  it('should leave the menu shut, since a later step asked for no open one', async () => {
    const page = await browser.newPage({ viewport: PHONE })
    await page.setContent(PAGE)

    await probeDetails(page)
    const open = await page.evaluate(
      () => document.querySelector('details')?.open,
    )
    await page.close()

    expect(open).toBe(false)
  }, 120_000)
})
