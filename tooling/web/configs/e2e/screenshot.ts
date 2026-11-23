import type { Locator, Page } from '@playwright/test'
import { chromium } from '@playwright/test'
import { existsSync, readdirSync } from 'fs'
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
 * The three `evidence` widths are the narrow end of the phone, tablet, and
 * desktop classes the board draws at. 1536 sweeps alone, so a range past 1280 is still looked at.
 */
const VIEWPORTS: readonly Viewport[] = [
  { name: '390', width: 390, height: 800, evidence: true },
  { name: '768', width: 768, height: 800, evidence: true },
  { name: '1280', width: 1280, height: 800, evidence: true },
  { name: '1536', width: 1536, height: 800, evidence: false },
]

/**
 * The WCAG Reflow floor. Every case is loaded here and fails the run on a
 * sideways scroll or a clipped control, and no frame is written, since nothing
 * fails on a picture. A case defers it by naming `320` in `excludeViewports`.
 */
const REFLOW_FLOOR = { name: '320', width: 320, height: 800 } as const

const CASES_FILE = 'e2e/capture/cases.ts'
const CASES_DIR = 'e2e/capture/cases'

/** The evidence root a project holding the folder alone writes under, the seed's own value. */
const DEFAULT_EVIDENCE_ROOT = 'e2e/evidence'

/**
 * The single file first, then each per-feature file in name order, so parallel
 * branches each add a file rather than all appending to one.
 */
const caseFiles: string[] = [
  ...(existsSync(CASES_FILE) ? [CASES_FILE] : []),
  ...(existsSync(CASES_DIR)
    ? readdirSync(CASES_DIR)
        .filter((name) => name.endsWith('.ts'))
        .sort()
        .map((name) => `${CASES_DIR}/${name}`)
    : []),
]

if (caseFiles.length === 0) {
  console.error(
    `Neither ${CASES_FILE} nor a ${CASES_DIR}/*.ts file exists. Run canon tooling sync to seed one.`,
  )
  process.exit(1)
}

/** A case beside the file that declared it, so a collision can name both. */
interface SourcedCase {
  readonly captureCase: CaptureCase
  readonly file: string
}

const modules = await Promise.all(
  caseFiles.map(
    async (file) =>
      [
        file,
        (await import(
          pathToFileURL(path.resolve(file)).href
        )) as Partial<CaptureModule>,
      ] as const,
  ),
)

const SOURCED: SourcedCase[] = []
for (const [file, module] of modules) {
  if (!Array.isArray(module.CASES)) {
    console.error(`${file} exports no CASES array.`)
    process.exit(1)
  }
  for (const captureCase of module.CASES) SOURCED.push({ captureCase, file })
}

const EVIDENCE_ROOT =
  modules.find(([file]) => file === CASES_FILE)?.[1].EVIDENCE_ROOT ??
  DEFAULT_EVIDENCE_ROOT

// A caller such as the README script reads the resolved root here rather
// than parsing the case files itself, and nothing is captured.
if (process.argv.includes('--print-evidence-root')) {
  console.log(EVIDENCE_ROOT)
  process.exit(0)
}

/**
 * One case at one width, which is the unit a filter selects and a context is
 * built for. A `frame` run writes images and a `reflow` run only checks.
 */
interface CaptureRun {
  readonly captureCase: CaptureCase
  readonly kind: 'frame' | 'reflow'
  readonly viewport: Pick<Viewport, 'name' | 'width' | 'height'> &
    Partial<Pick<Viewport, 'evidence'>>
  readonly label: string
  readonly file: string
}

const VIEWPORT_NAMES = new Set([
  ...VIEWPORTS.map((viewport) => viewport.name),
  REFLOW_FLOOR.name,
])

for (const { captureCase, file } of SOURCED) {
  for (const name of captureCase.excludeViewports ?? []) {
    if (!VIEWPORT_NAMES.has(name)) {
      console.warn(
        `${file}: case ${captureCase.section}/${captureCase.theme} excludes '${name}', which no viewport carries. Ignored.`,
      )
    }
  }
}

const ALL_RUNS: readonly CaptureRun[] = SOURCED.flatMap(
  ({ captureCase, file }) =>
    [
      { kind: 'reflow' as const, viewport: REFLOW_FLOOR },
      ...VIEWPORTS.map((viewport) => ({ kind: 'frame' as const, viewport })),
    ]
      .filter(
        ({ viewport }) =>
          !captureCase.excludeViewports?.includes(viewport.name),
      )
      .map(({ kind, viewport }) => ({
        captureCase,
        kind,
        viewport,
        file,
        label: `${captureCase.section}/${viewport.name}--${captureCase.theme}`,
      })),
)

// Two runs sharing a label write one output file, and the later would
// overwrite the earlier with no sign.
const firstFileByLabel = new Map<string, string>()
const collisions: string[] = []
for (const { label, file } of ALL_RUNS) {
  const first = firstFileByLabel.get(label)
  if (first === undefined) firstFileByLabel.set(label, file)
  else collisions.push(`  ${label}: ${first} and ${file}`)
}

if (collisions.length > 0) {
  console.error(
    `Two cases write the same output file. Give one a distinct section or theme:\n${collisions.join('\n')}`,
  )
  process.exit(1)
}

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
 * Scrolls each section into view once before the settle, since an observed
 * figure or a lazy frame stays at its start state until scrolled past and a
 * full-page capture scrolls nothing.
 */
async function settle(
  page: Page,
  label: string,
  sections: readonly CaptureSection[],
): Promise<CaptureSection[]> {
  const present: CaptureSection[] = []
  for (const section of sections) {
    const element = page.locator(section.selector)
    // Counted first, since scrolling to a selector matching nothing costs a timeout.
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
  // Not `networkidle`, which never re-arms for a load a scroll triggered.
  await page.waitForFunction(
    () => {
      if (document.readyState !== 'complete') return false
      for (const image of document.images) if (!image.complete) return false
      for (const frame of document.querySelectorAll('iframe')) {
        try {
          const inner = frame.contentDocument
          if (inner === null) continue
          if (inner.readyState !== 'complete') return false
          // A frame's fonts load after its `readyState`, outside the outer document's.
          if (inner.fonts.status !== 'loaded') return false
        } catch {
          // Cross-origin, so there is nothing to read or wait on.
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
 * Marks floating chrome, which rides a tall section's scroll over the frame.
 * An attribute rather than a style, so the screenshot's own rule acts on it
 * and nothing is left to restore. The whole-page frame is shot before this.
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
 * Whether an opaque element paints over this one's center, since a mask drawn
 * there lands across the cover. A center off-window reads uncovered, and the
 * target is made hittable for the test, since the hit test skips it otherwise.
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
 * Turns mask selectors into locators, reporting and dropping one that matches
 * nothing or sits covered, the cover read once for every frame.
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

/** How many clipped controls one run names before it stops listing them. */
const CLIPPED_LISTED = 5

/**
 * Content wider than the viewport, and each visible control partly past its edge or clipping its label.
 * A control wholly off the page is hidden on purpose, such as a skip link, and a 1px box is a screen-reader label.
 */
async function readReflow(page: Page): Promise<string[]> {
  return page.evaluate((listed) => {
    const root = document.documentElement
    const problems: string[] = []
    if (root.scrollWidth > root.clientWidth) {
      problems.push(
        `the page scrolls sideways, ${root.scrollWidth}px of content in a ${root.clientWidth}px viewport`,
      )
    }
    const scrollsSideways = (node: Element): boolean => {
      for (let at = node.parentElement; at !== null; at = at.parentElement) {
        if (at === document.body) return false
        const { overflowX } = getComputedStyle(at)
        if (overflowX === 'auto' || overflowX === 'scroll') return true
      }
      return false
    }
    const describe = (node: Element): string => {
      const text = (node.textContent ?? '').trim().slice(0, 40)
      const id = node.id === '' ? '' : `#${node.id}`
      return `${node.tagName.toLowerCase()}${id}${text === '' ? '' : ` "${text}"`}`
    }
    const clipped: string[] = []
    const controls = document.querySelectorAll(
      'a[href], button, input, select, textarea, summary, [role="button"], [role="link"]',
    )
    for (const control of controls) {
      const box = control.getBoundingClientRect()
      const style = getComputedStyle(control)
      if (box.width <= 1 || box.height <= 1) continue
      if (style.visibility === 'hidden') continue
      if (box.right <= 0 || box.left >= root.clientWidth) continue
      const pastEdge =
        (box.left < 0 || box.right > root.clientWidth) &&
        !scrollsSideways(control)
      const clipsLabel =
        style.overflowX !== 'visible' &&
        control.scrollWidth > control.clientWidth + 1
      if (pastEdge) clipped.push(`${describe(control)} runs past the edge`)
      else if (clipsLabel) clipped.push(`${describe(control)} clips its label`)
    }
    problems.push(...clipped.slice(0, listed))
    if (clipped.length > listed) {
      problems.push(`${clipped.length - listed} more clipped controls`)
    }
    return problems
  }, CLIPPED_LISTED)
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
    // Floating chrome already holds its space, so making it static moves no box.
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
const reflowFailures: string[] = []
let ranCases = 0

for (const { captureCase, kind, viewport, label } of RUNS) {
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

  if (kind === 'reflow') {
    for (const problem of await readReflow(page)) {
      reflowFailures.push(`${label}: ${problem}`)
    }
    console.log(`checked ${label}`)
    await context.close()
    continue
  }

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

if (reflowFailures.length > 0) {
  console.error(
    `${reflowFailures.length} reflow failures at ${REFLOW_FLOOR.width}px, the WCAG Reflow floor. Fix the layout, or name '${REFLOW_FLOOR.name}' in the case's excludeViewports to defer it:`,
  )
  for (const failure of reflowFailures) console.error(`  ${failure}`)
  process.exitCode = 1
}

if (checkConsoleClean && consoleErrors.length > 0) {
  console.error('console errors detected:')
  for (const error of consoleErrors) console.error(`  ${error}`)
  process.exit(1)
}
