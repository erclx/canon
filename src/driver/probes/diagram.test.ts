import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Browser, Page } from 'playwright-core'
import {
  probeDiagramGeometry,
  probeDiagramStrokes,
} from '@/driver/probes/diagram'

/**
 * One diagram per lesson, each in its own `svg` so a pairwise comparison cannot
 * collide across cases. Readings are taken in the browser after `document.fonts.ready`,
 * since the CSS renders `#authored` labels larger. It skips without a browser binary.
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
      // A fill-only occlusion test filters out every line, so sampling the stroke is the only reading that sees it.
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
      // Authored 60 units apart and rendered overlapping, so the reading is taken in the browser.
      expect(found[0]?.measured).toMatch(/^2\dx\d+px of overlap/)
    })

    it('should leave two properly spaced lines alone where their boxes touch', () => {
      // An SVG text rect is the font box rather than the ink, so the vertical inset keeps adjacent lines apart.
      expect(
        geometry.filter((finding) =>
          finding.selector.startsWith('svg#touching'),
        ),
      ).toHaveLength(0)
    })

    it('should report a stroke crossing a label inside a transformed group', () => {
      // `getPointAtLength` answers in the shape's user space, so sampling against the root's matrix drops a `g` translation.
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
      // Every compared rect is trimmed top and bottom only, and the record says so.
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
