import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Browser, Page } from 'playwright-core'
import {
  probeDiagramGeometry,
  probeDiagramStrokes,
} from '@/driver/probes/diagram'

/**
 * One diagram per lesson, each in an `svg` of its own so a pairwise comparison
 * cannot reach across two cases and report a collision the fixture never posed.
 *
 * The stylesheet is the point of `#authored`. Its two labels sit apart in the
 * markup and the CSS renders them larger, the shape a page restyled after its
 * coordinates were picked takes, so every reading is taken in the browser after
 * `document.fonts.ready`. The suite needs a browser binary and CI installs
 * none, so a green pipeline is no evidence this passed.
 */

const PAGE = readFileSync(
  new URL('./fixtures/diagram.html', import.meta.url),

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

describe.skipIf(!hasBrowser)(
  'probeDiagramGeometry and probeDiagramStrokes',
  () => {
    let browser: Browser
    let page: Page
    let geometry: Awaited<ReturnType<typeof probeDiagramGeometry>>
    let strokes: Awaited<ReturnType<typeof probeDiagramStrokes>>

    beforeAll(async () => {
      const { chromium } = await import('playwright-core')
      browser = await chromium.launch()
      page = await browser.newPage({ viewport: { width: 900, height: 800 } })
      await page.setContent(PAGE)
      geometry = await probeDiagramGeometry(page)
      strokes = await probeDiagramStrokes(page)
    }, 120_000)

    afterAll(async () => {
      await browser.close()
    })

    it('should report a connector stroked through a label', () => {
      const found = strokes.filter((finding) =>
        finding.selector.startsWith('svg#connector'),
      )

      expect(found).toHaveLength(1)
      expect(found[0]?.detail).toContain('line stroke')
    })

    it('should be invisible to the probe that compares filled boxes', () => {
      // A fill-only occlusion test filters out every line before the comparison, so
      // sampling the stroke is the only reading that sees it.
      expect(
        geometry.filter((finding) =>
          finding.selector.startsWith('svg#connector'),
        ),
      ).toHaveLength(0)
    })

    it('should report a fill-none panel border crossing a label', () => {
      const found = strokes.filter((finding) =>
        finding.selector.startsWith('svg#border'),
      )

      expect(found).toHaveLength(1)
      expect(found[0]?.detail).toContain('rect stroke')
    })

    it('should report two labels that only overlap once the page renders', () => {
      const found = geometry.filter(
        (finding) =>
          finding.selector.startsWith('svg#authored') &&
          finding.detail.startsWith('collides'),
      )

      expect(found).toHaveLength(1)
      // Authored 60 units apart and rendered overlapping, which is the whole
      // reason the reading is taken here rather than off the coordinates.
      expect(found[0]?.measured).toMatch(/^2\dx\d+px of overlap/)
    })

    it('should leave two properly spaced lines alone where their boxes touch', () => {
      // An SVG text rect is the font box rather than the ink, so adjacent lines touch,
      // and the vertical inset with the threshold keeps that out.
      expect(
        geometry.filter((finding) =>
          finding.selector.startsWith('svg#touching'),
        ),
      ).toHaveLength(0)
    })

    it('should report a stroke crossing a label inside a transformed group', () => {
      // `getPointAtLength` answers in the shape's user space, so sampling against the
      // root's matrix drops a `g` translation and reads the page clean.
      const found = strokes.filter((finding) =>
        finding.selector.startsWith('svg#grouped'),
      )

      expect(found).toHaveLength(1)
      expect(found[0]?.detail).toContain('line stroke')
    })

    it('should report a label painted outside its own frame', () => {
      const found = geometry.filter((finding) =>
        finding.selector.startsWith('svg#outside'),
      )

      expect(found).toHaveLength(1)
      expect(found[0]?.detail).toContain('outside its own frame')
    })

    it('should name the vertical inset on every reading it was applied to', () => {
      // Every compared rect is trimmed top and bottom only, and the record says so,
      // so a reader can tell a real overrun from a trimmed one.
      const readings = [...geometry, ...strokes]

      expect(readings.length).toBeGreaterThan(0)
      expect(
        readings.every((finding) =>
          finding.measured.includes('vertical inset'),
        ),
      ).toBe(true)
    })
  },
)
