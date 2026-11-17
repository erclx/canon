import type { Locator, Page } from '@playwright/test'
import { chromium } from '@playwright/test'
import { existsSync } from 'fs'
import { mkdir } from 'fs/promises'
import path from 'path'
import { pathToFileURL } from 'url'
import type {
  CaptureCase,
  CaptureModule,
  CaptureSection,
  Viewport,
} from './capture-types'

/**
 * The breakpoint buckets every case is crossed with, named by width. 320 is
 * the base a page has to hold without wrapping or clipping. Committing every
 * width multiplies the tracked frames by the width count, so only the base and
 * the desktop width carry `evidence`.
 */
const VIEWPORTS: readonly Viewport[] = [
  { name: '320', width: 320, height: 800, evidence: true },
  { name: '768', width: 768, height: 800, evidence: false },
  { name: '1280', width: 1280, height: 800, evidence: true },
  { name: '1536', width: 1536, height: 800, evidence: false },
]

const CASES_FILE = path.resolve('e2e/capture/cases.ts')

if (!existsSync(CASES_FILE)) {
  console.error(
    'e2e/capture/cases.ts is missing. Run canon tooling sync to seed it.',
  )
  process.exit(1)
}

const { CASES, EVIDENCE_ROOT } = (await import(
  pathToFileURL(CASES_FILE).href
)) as CaptureModule

/** One case at one viewport, which is the unit a filter selects and a context is built for. */
interface CaptureRun {
  readonly captureCase: CaptureCase
  readonly viewport: Viewport
  readonly label: string
}

const ALL_RUNS: readonly CaptureRun[] = CASES.flatMap((captureCase) =>
  VIEWPORTS.filter(
    (viewport) => !captureCase.excludeViewports?.includes(viewport.name),
  ).map((viewport) => ({
    captureCase,
    viewport,
    label: `${captureCase.section}/${viewport.name}--${captureCase.theme}`,
  })),
)

const args = process.argv.slice(2)
const checkConsoleClean = args.includes('--check-console-clean')
const requireBaseUrl = args.includes('--require-base-url')

if (requireBaseUrl && !process.env.SCREENSHOT_BASE_URL) {
  console.error('SCREENSHOT_BASE_URL is required with --require-base-url')
  process.exit(1)
}

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:4173'

let hostname: string
try {
  hostname = new URL(BASE_URL).hostname
} catch {
  console.error(`SCREENSHOT_BASE_URL is not a valid URL: ${BASE_URL}`)
  process.exit(1)
}

const OUT_DIR = path.join('screenshots', hostname)

const SCREENSHOT_FILTER = process.env.SCREENSHOT_FILTER?.trim() ?? ''

const filterTerms = SCREENSHOT_FILTER.split(',')
  .map((term) => term.trim())
  .filter(Boolean)

const RUNS =
  filterTerms.length > 0
    ? ALL_RUNS.filter((run) =>
        filterTerms.some((term) => run.label.includes(term)),
      )
    : ALL_RUNS

if (filterTerms.length > 0 && RUNS.length === 0) {
  console.error(
    `No cases matched SCREENSHOT_FILTER=${SCREENSHOT_FILTER}. Available labels:\n${ALL_RUNS.map(
      (run) => `  ${run.label}`,
    ).join('\n')}`,
  )
  process.exit(1)
}

/** Every wait on a lazy load is bounded explicitly. */
const SETTLE_TIMEOUT = 15_000

/** Marks the chrome a section frame drops, set on the page and read by the screenshot's own stylesheet. */
const FLOATING_ATTRIBUTE = 'data-capture-floating'

/**
 * Brings the page to the state a reader arrives at, before anything is shot.
 * A figure gated on an IntersectionObserver and a frame marked `loading=lazy`
 * both stay at their start state until something scrolls past them, and a full
 * page capture scrolls nothing, so each named section is scrolled into view
 * once and the page then returns to the top. Fonts, images and frames settle
 * afterwards, since the scroll is what starts the lazy loads.
 */
async function settle(
  page: Page,
  label: string,
  sections: readonly CaptureSection[],
): Promise<CaptureSection[]> {
  const present: CaptureSection[] = []
  for (const section of sections) {
    const element = page.locator(section.selector)
    // The count is read before scrolling, since a selector matching nothing costs a
    // timeout, and a seeded section a page lacks is reported and skipped.
    if ((await element.count()) === 0) {
      console.warn(
        `${label}: no element matches ${section.selector}, named as section "${section.name}". Skipped.`,
      )
      continue
    }
    present.push(section)
    await element.scrollIntoViewIfNeeded()
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  // Settles on what the scroll started, since `networkidle` belongs to the
  // navigation and does not re-arm for a load a scroll triggered.
  await page.waitForFunction(
    () => {
      if (document.readyState !== 'complete') return false
      for (const image of document.images) if (!image.complete) return false
      for (const frame of document.querySelectorAll('iframe')) {
        try {
          const inner = frame.contentDocument
          if (inner === null) continue
          if (inner.readyState !== 'complete') return false
          // A frame's own fonts load after its `readyState` completes, and the outer
          // document's fonts never cover them.
          if (inner.fonts.status !== 'loaded') return false
        } catch {
          // Cross-origin, so there is nothing here to read and nothing to
          // wait on.
        }
      }
      return true
    },
    undefined,
    { timeout: SETTLE_TIMEOUT },
  )
  return present
}

/**
 * Marks every element the page floats over its own content, which is chrome
 * such as a sticky bar or a fixed dialog. A section taller than the viewport
 * is scrolled into view to be shot, and the chrome rides that scroll into the
 * middle of the frame, painting over the part the frame exists to show. The
 * mark is an attribute rather than a style, so the rule that acts on it is
 * carried by the screenshot itself and no state is left behind to restore.
 *
 * Marking costs the whole-page frame nothing, since that one is shot before
 * this runs and carries the chrome where a reader meets it.
 */
async function markFloatingChrome(page: Page) {
  await page.evaluate((attribute) => {
    for (const node of document.querySelectorAll('body *')) {
      const { position } = getComputedStyle(node)
      if (position === 'sticky' || position === 'fixed') {
        node.setAttribute(attribute, '')
      }
    }
  }, FLOATING_ATTRIBUTE)
}

/**
 * Whether an opaque element outside the given one paints over its center. A
 * mask's bar is drawn above every layer, so one painted over a covered
 * element lands across whatever covers it, such as an open dialog.
 *
 * Only an opaque box counts, since a value under a dimmed backdrop still shows
 * through. A center outside the window reads as uncovered, since the hit test
 * answers only inside it. The hit test also skips `pointer-events: none`, so
 * the target is made hittable for the one test and restored after, or a
 * pass-through badge would read as covered by whatever lies beneath it.
 */
async function isCovered(element: Locator): Promise<boolean> {
  return element.evaluate((target: HTMLElement | SVGElement) => {
    const box = target.getBoundingClientRect()
    const x = box.left + box.width / 2
    const y = box.top + box.height / 2
    if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) {
      return false
    }
    const isOpaque = (node: Element) => {
      const style = getComputedStyle(node)
      if (style.visibility === 'hidden') return false
      const alpha = style.backgroundColor.match(/[\d.]+/g)?.[3]
      const solid =
        style.backgroundColor !== 'transparent' &&
        (alpha === undefined || Number(alpha) === 1)
      if (!solid && !(node instanceof HTMLImageElement)) return false
      for (let at: Element | null = node; at !== null; at = at.parentElement) {
        if (Number(getComputedStyle(at).opacity) < 1) return false
      }
      return true
    }
    const { pointerEvents } = target.style
    const priority = target.style.getPropertyPriority('pointer-events')
    target.style.setProperty('pointer-events', 'auto', 'important')
    try {
      for (const hit of document.elementsFromPoint(x, y)) {
        if (target === hit || target.contains(hit) || hit.contains(target)) {
          return false
        }
        if (isOpaque(hit)) return true
      }
      return false
    } finally {
      target.style.setProperty('pointer-events', pointerEvents, priority)
    }
  })
}

/**
 * Turns a case's mask selectors into the locators every frame paints over. A
 * selector matching nothing is reported and kept out rather than raised, for
 * the same reason `settle` gives for a missing section. A matched element an
 * opaque element covers is reported and kept out too, and the answer taken
 * here holds for the section frames, which flatten floating chrome.
 */
async function resolveMask(
  page: Page,
  label: string,
  selectors: readonly string[],
): Promise<Locator[]> {
  const mask: Locator[] = []
  for (const selector of selectors) {
    const element = page.locator(selector)
    const count = await element.count()
    if (count === 0) {
      console.warn(
        `${label}: no element matches ${selector}, named as a mask. Skipped.`,
      )
      continue
    }
    const matches = Array.from({ length: count }, (_, index) =>
      element.nth(index),
    )
    const covered = await Promise.all(matches.map(isCovered))
    const shown = matches.filter((_, index) => !covered[index])
    const skipped = count - shown.length
    if (skipped > 0) {
      console.warn(
        `${label}: ${skipped} of ${count} elements matching ${selector}, named as a mask, are covered by another element. Skipped.`,
      )
    }
    if (skipped === 0) mask.push(element)
    else mask.push(...shown)
  }
  return mask
}

async function shoot(
  page: Page,
  dir: string,
  file: string,
  mask: Locator[],
  selector?: string,
) {
  await mkdir(dir, { recursive: true })
  const target = path.join(dir, file)
  if (selector === undefined) {
    await page.screenshot({ path: target, fullPage: true, mask })
  } else {
    // Floating chrome keeps the space it already occupies, so dropping it out
    // of its own layer moves nothing and leaves every box the size it was.
    await page.locator(selector).screenshot({
      path: target,
      mask,
      style: `[${FLOATING_ATTRIBUTE}] { position: static !important; }`,
    })
  }
  console.log(`captured ${target}`)
}

const browser = await chromium.launch()
const consoleErrors: string[] = []
let ranCases = 0

for (const { captureCase, viewport, label } of RUNS) {
  if (captureCase.evidence && requireBaseUrl) continue

  ranCases++
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    // A page honoring the preference lands its own motion at the end state,
    // which is what a still frame has to show. Playwright reads it as a
    // context option, so it reaches no page written beside `viewport` above.
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()

  if (checkConsoleClean) {
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`${label}: ${msg.text()}`)
      }
    })
  }

  if (captureCase.setup) await captureCase.setup(page)

  await page.goto(`${BASE_URL}${captureCase.route}`)
  await page.waitForLoadState('networkidle')

  const sections = await settle(page, label, captureCase.sections ?? [])
  const mask = await resolveMask(page, label, captureCase.mask ?? [])

  const sweepDir = path.join(OUT_DIR, captureCase.section)
  const evidenceDir = path.join(EVIDENCE_ROOT, captureCase.section)
  const file = `${viewport.name}--${captureCase.theme}.png`
  const writesEvidence = captureCase.evidence && viewport.evidence

  await shoot(page, sweepDir, file, mask)
  if (writesEvidence) await shoot(page, evidenceDir, file, mask)

  if (sections.length > 0) await markFloatingChrome(page)

  for (const { name, selector } of sections) {
    await shoot(page, path.join(sweepDir, name), file, mask, selector)
    if (writesEvidence) {
      await shoot(page, path.join(evidenceDir, name), file, mask, selector)
    }
  }

  await context.close()
}

await browser.close()

if (requireBaseUrl && ranCases === 0) {
  console.error(
    'every CASES entry is flagged evidence: true, so --require-base-url skipped all of them and checked nothing',
  )
  process.exit(1)
}

if (checkConsoleClean && consoleErrors.length > 0) {
  console.error('console errors detected:')
  for (const error of consoleErrors) console.error(`  ${error}`)
  process.exit(1)
}
