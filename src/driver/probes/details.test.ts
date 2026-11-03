import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Browser } from 'playwright-core'
import { probeDetails } from '@/driver/probes/details'

/**
 * Pins both halves of the closed-menu lesson against one fixture, because the
 * two pull opposite ways and a suite covering either alone would pass a probe
 * that fails the other.
 *
 * The menu here is the shape that produced 134 false findings: shut, the
 * element measures a summary and nothing else, so anything judged from that box
 * is judged from a number about the trigger rather than about the menu. Open,
 * it is the shape the same run missed, a panel hanging off the right edge of a
 * phone-width viewport and true only while open.
 *
 * The suite needs a browser binary. CI installs none, so it skips there rather
 * than failing, which means a green pipeline is not evidence this passed.
 */

const PHONE = { width: 390, height: 800 }

/**
 * A narrow trigger, and a panel that lands 35px past the right edge only once
 * the menu is open. The offset hangs off `details[open]` rather than off layout
 * flow, and that is deliberate: this Chromium hands a closed `<details>` a full
 * layout box for its contents, so a fixture that merely hid the panel would
 * still measure it shut and prove nothing about which state was read.
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

    // The shut reading is in the record so a reader can see it was taken, and
    // its own numbers are named as measuring nothing about the panel.
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

    // Shut, the panel is 265px inside the right edge and a probe that stopped
    // there reports the page clean. The defect is 35px over and true only while
    // open, which is the blind spot skipping the closed menu leaves open.
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
