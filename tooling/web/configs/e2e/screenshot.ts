import type { Page } from '@playwright/test'
import { chromium } from '@playwright/test'
import { mkdir } from 'fs/promises'
import path from 'path'

/** One addressable part of a route, captured beside the whole-page frame. */
interface CaptureSection {
  name: string
  selector: string
}

interface Viewport {
  readonly name: string
  readonly width: number
  readonly height: number
  /** Whether a case flagged `evidence: true` also writes its frames at this width. */
  readonly evidence: boolean
}

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

interface CaptureCase {
  section: string
  theme: string
  route: string
  /** Names of viewports this case skips, for a route that reflows rather than breaks at that width. */
  excludeViewports?: readonly string[]
  evidence?: boolean
  sections?: CaptureSection[]
  setup?: (page: Page) => Promise<void>
}

/**
 * The landing page's own beats, top to bottom. Every entry is a section a
 * reviewer reads on its own, so a diff lands on the part that moved rather
 * than on one image of the whole page.
 */
const HOME_SECTIONS: CaptureSection[] = [
  { name: 'top', selector: '#top' },
  { name: 'proof', selector: '#proof' },
  { name: 'ask', selector: '#ask' },
  { name: 'rules', selector: '#rules' },
  { name: 'skills', selector: '#skills' },
  { name: 'plan', selector: '#plan' },
  { name: 'dispatch', selector: '#dispatch' },
  { name: 'workers', selector: '#workers' },
  { name: 'gate', selector: '#gate' },
  { name: 'memory', selector: '#memory' },
  { name: 'evidence', selector: '#evidence' },
  { name: 'loop', selector: '#loop' },
  { name: 'merge', selector: '#merge' },
  { name: 'provenance', selector: '#provenance' },
  { name: 'start', selector: '#start' },
  { name: 'field', selector: '#field' },
  { name: 'close', selector: '#close' },
]

const CASES: CaptureCase[] = [
  {
    section: 'home',
    theme: 'default',
    route: '/',
    evidence: true,
    sections: HOME_SECTIONS,
  },
  {
    section: 'home',
    theme: 'dark',
    route: '/',
    sections: HOME_SECTIONS,
    setup: (page) => page.emulateMedia({ colorScheme: 'dark' }),
  },
]

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
    // Read the count before scrolling, since a selector matching nothing
    // otherwise costs the default timeout once per section. A miss is
    // reported and skipped rather than raised, because `CASES` is a template
    // a project rewrites and a target that syncs this file before editing its
    // own list would otherwise capture nothing at all. The project owning the
    // selectors is the one that tests them, which is what the section spec
    // beside its own page does.
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
  // Settle on what the scroll started rather than on a second `networkidle`,
  // which is a lifecycle event of the navigation and does not re-arm for a
  // load a scroll triggered afterwards.
  await page.waitForFunction(
    () => {
      if (document.readyState !== 'complete') return false
      for (const image of document.images) if (!image.complete) return false
      for (const frame of document.querySelectorAll('iframe')) {
        try {
          const inner = frame.contentDocument
          if (inner === null) continue
          if (inner.readyState !== 'complete') return false
          // A frame's own fonts load after its `readyState` reads complete, and
          // the swap reflows its text. The outer document's fonts never cover
          // them.
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

async function shoot(page: Page, dir: string, file: string, selector?: string) {
  await mkdir(dir, { recursive: true })
  const target = path.join(dir, file)
  if (selector === undefined) {
    await page.screenshot({ path: target, fullPage: true })
  } else {
    // Floating chrome keeps the space it already occupies, so dropping it out
    // of its own layer moves nothing and leaves every box the size it was.
    await page.locator(selector).screenshot({
      path: target,
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

  const sweepDir = path.join(OUT_DIR, captureCase.section)
  const evidenceDir = path.join('evidence', captureCase.section)
  const file = `${viewport.name}--${captureCase.theme}.png`
  const writesEvidence = captureCase.evidence && viewport.evidence

  await shoot(page, sweepDir, file)
  if (writesEvidence) await shoot(page, evidenceDir, file)

  if (sections.length > 0) await markFloatingChrome(page)

  for (const { name, selector } of sections) {
    await shoot(page, path.join(sweepDir, name), file, selector)
    if (writesEvidence) {
      await shoot(page, path.join(evidenceDir, name), file, selector)
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
