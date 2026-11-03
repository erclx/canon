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
 * The stylesheet is the point of `#authored`. Its two labels are 60 units apart
 * in the markup and the CSS renders them at 24px, which is the shape a
 * generated page takes when `figure svg text` is restyled after the coordinates
 * were picked against a narrower face. Nothing computed from the markup can see
 * that overlap, which is why every reading here is taken in the browser after
 * `document.fonts.ready`.
 *
 * The suite needs a browser binary. CI installs none, so it skips there rather
 * than failing, which means a green pipeline is not evidence this passed.
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
      // The first version of the occlusion probe counted a shape as occluding
      // only when it carried a fill, which filtered out every line before the
      // comparison ran. Sampling the stroke is the only reading that sees it.
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
      // An SVG text rect is the full font box rather than the ink, so adjacent
      // lines overlap by a pixel or two. The vertical inset and the threshold
      // together are what keep that out of the report.
      expect(
        geometry.filter((finding) =>
          finding.selector.startsWith('svg#touching'),
        ),
      ).toHaveLength(0)
    })

    it('should report a stroke crossing a label inside a transformed group', () => {
      // `getPointAtLength` answers in the shape's own user space, and a
      // generated diagram nests almost everything under a translated `g`.
      // Sampling against the root's matrix drops that translation and puts
      // every point somewhere the label is not, reporting the page clean.
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
      // Every rect either probe compares is trimmed top and bottom and left alone
      // left and right, and a record that did not say so would leave a reader
      // unable to tell a real overrun from a trimmed one.
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
