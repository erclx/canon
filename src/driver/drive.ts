import { chromium } from 'playwright-core'
import type { Browser, Page } from 'playwright-core'
import { isBrowserMissing, isServerUnreachable } from '@/browser/engine'
import { probeDetails } from '@/driver/probes/details'
import {
  probeDiagramGeometry,
  probeDiagramStrokes,
} from '@/driver/probes/diagram'
import { probeFocus } from '@/driver/probes/focus'
import { describeViewport } from '@/driver/probes/viewport'
import type { Viewport } from '@/driver/probes/viewport'
import { runStep, stepProbes } from '@/driver/steps'
import type {
  DriverPlan,
  Finding,
  PlacedFinding,
  ProbeName,
} from '@/driver/steps'

/**
 * Walks a page through a caller's interaction sequence and measures each state
 * it reaches. Every browser reference the driver adds lives here, and
 * `src/commands/driver.ts` reaches it through a dynamic import so no other
 * command resolves the engine at startup.
 *
 * Like `@/inventory/walk` and `@/capture/render`, this module
 * ships. A command whose whole purpose is measuring someone else's page cannot
 * stay toolkit-only, and nothing here reaches into `@/capture/`, so the two
 * surfaces move independently.
 *
 * What separates it from `canon capture` is the axis it adds. A render answers
 * about a page as it loads, and every defect that exists only after a menu
 * opens, an answer is chosen, or the page scrolls is invisible to one. Probes
 * therefore run after a step rather than on arrival, and a run reaches the load
 * state by opening with a `wait` step of its own. That matters most where no
 * capture runs against the page, since this command is then the only thing
 * measuring it at all.
 */

/** Each probe keyed by the name a caller writes in the run. */
const PROBES: Record<ProbeName, (page: Page) => Promise<Finding[]>> = {
  focus: probeFocus,
  details: probeDetails,
  'diagram-geometry': probeDiagramGeometry,
  'diagram-strokes': probeDiagramStrokes,
}

export interface DriveOptions {
  readonly url: string
  readonly plan: DriverPlan
}

/** One step measured at one viewport, so a sweep reads as passes rather than a total. */
export interface PassReading {
  readonly viewport: string
  readonly step: string
  readonly probes: number
  readonly findings: number
}

export type DriverRefusal =
  | 'browser-missing'
  | 'server-unreachable'
  | 'drive-failed'

export type DriverResult =
  | {
      readonly status: 'driven'
      readonly findings: readonly PlacedFinding[]
      readonly passes: readonly PassReading[]
      readonly durationMs: number
    }
  | {
      readonly status: 'failed'
      readonly reason: DriverRefusal
      readonly message: string
    }

function failed(reason: DriverRefusal, error: unknown): DriverResult {
  return {
    status: 'failed',
    reason,
    message: error instanceof Error ? error.message : String(error),
  }
}

export async function drive(options: DriveOptions): Promise<DriverResult> {
  const started = Date.now()

  let browser: Browser
  try {
    browser = await chromium.launch()
  } catch (error) {
    return failed(
      isBrowserMissing(error) ? 'browser-missing' : 'drive-failed',
      error,
    )
  }

  const findings: PlacedFinding[] = []
  const passes: PassReading[] = []

  try {
    for (const viewport of options.plan.viewports) {
      const pass = await driveViewport(browser, options, viewport)
      findings.push(...pass.findings)
      passes.push(...pass.passes)
    }
  } catch (error) {
    return failed(
      isServerUnreachable(error) ? 'server-unreachable' : 'drive-failed',
      error,
    )
  } finally {
    // Dropped rather than propagated, because a close that fails beside a drive
    // that already failed would replace the refusal the caller is about to
    // receive with a reason about teardown.
    await browser.close().catch(() => undefined)
  }

  return {
    status: 'driven',
    findings,
    passes,
    durationMs: Date.now() - started,
  }
}

/**
 * One full pass of the sequence at one viewport, in a context of its own.
 *
 * A fresh context per height rather than a resize of the last one, because a
 * step already run has left the page in a state the next height would inherit,
 * and a sweep exists to ask the same question of each rather than to ask a
 * later one of a page the earlier heights already drove.
 */
async function driveViewport(
  browser: Browser,
  options: DriveOptions,
  viewport: Viewport,
): Promise<{ findings: PlacedFinding[]; passes: PassReading[] }> {
  const context = await browser.newContext({
    viewport,
    // A measurement wants motion suppressed, since geometry read
    // mid-transition is a reading of neither state.
    reducedMotion: 'reduce',
  })

  const findings: PlacedFinding[] = []
  const passes: PassReading[] = []
  const where = describeViewport(viewport)

  try {
    const page = await context.newPage()
    await page.goto(options.url, { waitUntil: 'domcontentloaded' })

    for (const step of options.plan.steps) {
      await runStep(page, step)

      const names = stepProbes(options.plan, step)
      let count = 0
      for (const name of names) {
        const probe = PROBES[name]
        for (const finding of await probe(page)) {
          findings.push({ ...finding, step: step.name, viewport: where })
          count += 1
        }
      }

      passes.push({
        viewport: where,
        step: step.name,
        probes: names.length,
        findings: count,
      })
    }
  } finally {
    await context.close().catch(() => undefined)
  }

  return { findings, passes }
}
