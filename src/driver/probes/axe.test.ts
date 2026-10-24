import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Browser } from 'playwright-core'
import { AxeEngineMissing, probeAxe, readAxeEngine } from '@/driver/probes/axe'

/**
 * Pins the split the review gate rests on: a gate-list violation is marked as
 * one, a heuristic rule and an undecided result are reported and never gate,
 * and a page the engine never reached refuses rather than reading as clean.
 *
 * The suite needs a browser binary. CI installs none, so it skips there rather
 * than failing, which means a green pipeline is not evidence this passed.
 */

/** Low-contrast text, a button with no name, and no `lang`, with a title so only three fire. */
const SEEDED = `<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>Seeded</title></head>
  <body>
    <main>
      <p style="color: #bbb; background: #fff">Faint text nobody can read</p>
      <button></button>
    </main>
  </body>
</html>`

/** The review-focus case: nothing wrong but the document itself. */
const BARE = `<!doctype html>
<html>
  <head><meta charset="utf-8" /></head>
  <body><main><p>Readable text</p></main></body>
</html>`

/** A name that drops the word a sighted voice-control user would say. */
const MISMATCH = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Mismatch</title></head>
  <body><main><button aria-label="Close dialog">Dismiss</button></main></body>
</html>`

/** Text over a gradient, whose contrast axe declines to compute. */
const UNDECIDED = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Undecided</title></head>
  <body>
    <main>
      <p style="color: #777; background-image: linear-gradient(#fff, #000)">Over a gradient</p>
    </main>
  </body>
</html>`

/** A page that owns globals named the way the engine names its own. */
const COLLIDING = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" /><title>Colliding</title>
    <script>
      var axe = { run: () => 'the page' }
      var doT = 'the page'
    </script>
  </head>
  <body><main><p>Readable text</p></main></body>
</html>`

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

describe('readAxeEngine', () => {
  it('should refuse by name when the engine does not resolve', () => {
    expect(() => readAxeEngine('axe-core/not-shipped.js')).toThrow(
      AxeEngineMissing,
    )
  })
})

describe.skipIf(!hasBrowser)('probeAxe against a rendered page', () => {
  let browser: Browser

  beforeAll(async () => {
    const { chromium } = await import('playwright-core')
    browser = await chromium.launch()
  }, 120_000)

  afterAll(async () => {
    await browser.close()
  })

  it('should mark each seeded gate-list violation as gating', async () => {
    const page = await browser.newPage()
    await page.setContent(SEEDED)

    const findings = await probeAxe(page)
    await page.close()

    const gating = findings.filter((finding) => finding.gate)
    expect(gating.map((finding) => finding.rule).sort()).toEqual([
      'button-name',
      'color-contrast',
      'html-has-lang',
    ])
    expect(gating[0]).toMatchObject({ probe: 'axe', outcome: 'violation' })
  }, 120_000)

  it('should report a missing language and title on an otherwise clean page', async () => {
    const page = await browser.newPage()
    await page.setContent(BARE)

    const findings = await probeAxe(page)
    await page.close()

    expect(findings.map((finding) => [finding.rule, finding.gate])).toEqual([
      ['document-title', true],
      ['html-has-lang', true],
    ])
  }, 120_000)

  it('should report a label-in-name mismatch without gating on it', async () => {
    const page = await browser.newPage()
    await page.setContent(MISMATCH)

    const findings = await probeAxe(page)
    await page.close()

    expect(findings).toEqual([
      expect.objectContaining({
        rule: 'label-content-name-mismatch',
        outcome: 'violation',
        gate: false,
      }),
    ])
  }, 120_000)

  it('should report an undecided result apart from a violation and never gate on it', async () => {
    const page = await browser.newPage()
    await page.setContent(UNDECIDED)

    const findings = await probeAxe(page)
    await page.close()

    // `color-contrast` is on the gate list, so this is the case where a
    // probe keying the gate off the rule alone would hold the review open on
    // a result axe itself says a person has to read.
    expect(findings).toEqual([
      expect.objectContaining({
        rule: 'color-contrast',
        outcome: 'incomplete',
        gate: false,
      }),
    ])
  }, 120_000)

  it('should leave a page global named like the engine untouched', async () => {
    const page = await browser.newPage()
    await page.setContent(COLLIDING)

    const findings = await probeAxe(page)
    const after = await page.evaluate(() => {
      const scope = window as unknown as Record<string, unknown>
      const own = scope.axe as { run: () => string }
      return {
        axe: own.run(),
        doT: scope.doT,
        encode: '_encodeHTML' in scope,
      }
    })
    await page.close()

    // The engine ran rather than calling the page's `run`, which would have
    // returned a string and no results at all.
    expect(findings.map((finding) => finding.rule)).toEqual(['html-has-lang'])
    expect(after).toEqual({ axe: 'the page', doT: 'the page', encode: false })
  }, 120_000)

  it('should refuse by name when the engine source cannot be read', async () => {
    const page = await browser.newPage()
    await page.setContent(BARE)

    const run = probeAxe(page, () => readAxeEngine('axe-core/not-shipped.js'))

    await expect(run).rejects.toThrow(AxeEngineMissing)
    await page.close()
  }, 120_000)
})
