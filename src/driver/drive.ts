import { chromium } from 'playwright-core'
import type { Browser, Page } from 'playwright-core'
import {
  SANDBOXED,
  isBrowserMissing,
  isSandboxBlocked,
  isServerUnreachable,
  launchSandboxFix,
} from '@/browser/engine'
import { AxeEngineMissing, probeAxe } from '@/driver/probes/axe'
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
  ColorScheme,
  DriverPlan,
  Finding,
  PlacedFinding,
  ProbeName,
} from '@/driver/steps'

/**
 * Walks a page through a caller's interaction sequence and measures each state
 * it reaches. Every browser reference the driver adds lives here, and
 * `src/commands/driver.ts` reaches it through a dynamic import so no other
 * command resolves the engine at startup. Like `@/inventory/walk` and
 * `@/capture/render`, it ships, and it reaches nothing in `@/capture/`, so the
 * two surfaces move independently.
 *
 * A render answers about a page as it loads, so a defect that exists only after
 * a menu opens, an answer is chosen, or the page scrolls is invisible to one.
 * Probes run after a step, and a run reaches the load state with a `wait` step.
 */

/** Each probe keyed by the name a caller writes in the run. */
const PROBES: Record<ProbeName, (page: Page) => Promise<Finding[]>> = {
  focus: probeFocus,
  details: probeDetails,
  'diagram-geometry': probeDiagramGeometry,
  'diagram-strokes': probeDiagramStrokes,
  axe: probeAxe,
}

/**
 * Runs `axe` after every other probe a step names, whatever order the run
 * wrote, so every probe sharing its step reads the page before the engine's
 * script has ever loaded into it.
 */
function inRunOrder(names: readonly ProbeName[]): ProbeName[] {
  return [
    ...names.filter((name) => name !== 'axe'),
    ...names.filter((name) => name === 'axe'),
  ]
}

export interface DriveOptions {
  readonly url: string
  readonly plan: DriverPlan
  /**
   * A browser binary in place of the engine's own, which a test points at a
   * fake to prove a refusal no real launch on its machine would raise.
   */
  readonly executablePath?: string
}

/** One step measured at one viewport, so a sweep reads as passes rather than a total. */
export interface PassReading {
  readonly viewport: string
  /** Set only when the run sweeps color schemes, like `background`. */
  readonly colorScheme?: ColorScheme
  /**
   * The first painted background up from the body, read after the step. Two
   * schemes reading the same value mean the page never answered the media
   * query, so the second pass rendered the first theme again.
   */
  readonly background?: string
  readonly step: string
  readonly probes: number
  readonly findings: number
}

export type DriverRefusal =
  | 'browser-missing'
  | 'sandbox-blocked'
  | 'axe-missing'
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
      /** The command that clears a `sandbox-blocked` refusal, when one does. */
      readonly fix?: string
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
    browser = await chromium.launch({
      ...SANDBOXED,
      ...(options.executablePath
        ? { executablePath: options.executablePath }
        : {}),
    })
  } catch (error) {
    if (isBrowserMissing(error)) return failed('browser-missing', error)
    if (isSandboxBlocked(error)) {
      const fix = launchSandboxFix()
      return { ...failed('sandbox-blocked', error), ...(fix ? { fix } : {}) }
    }
    return failed('drive-failed', error)
  }

  const findings: PlacedFinding[] = []
  const passes: PassReading[] = []

  try {
    // Unset rather than light, so a run naming no scheme keeps its record.
    const schemes = options.plan.colorSchemes ?? [undefined]
    for (const colorScheme of schemes) {
      for (const viewport of options.plan.viewports) {
        const pass = await driveViewport(
          browser,
          options,
          viewport,
          colorScheme,
        )
        findings.push(...pass.findings)
        passes.push(...pass.passes)
      }
    }
  } catch (error) {
    if (error instanceof AxeEngineMissing) return failed('axe-missing', error)
    return failed(
      isServerUnreachable(error) ? 'server-unreachable' : 'drive-failed',
      error,
    )
  } finally {
    // Dropped, since a close failing beside a drive that already failed would
    // replace the caller's refusal with a reason about teardown.
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
 * One pass at one viewport and scheme, in a fresh context rather than a resize
 * or a re-emulation of the last, since a step already run leaves the page in a
 * state the next pass would inherit instead of asking the same question again.
 */
async function driveViewport(
  browser: Browser,
  options: DriveOptions,
  viewport: Viewport,
  colorScheme: ColorScheme | undefined,
): Promise<{ findings: PlacedFinding[]; passes: PassReading[] }> {
  const context = await browser.newContext({
    viewport,
    // A measurement wants motion suppressed, since geometry read
    // mid-transition is a reading of neither state.
    reducedMotion: 'reduce',
    ...(colorScheme ? { colorScheme } : {}),
  })

  const findings: PlacedFinding[] = []
  const passes: PassReading[] = []
  const where = describeViewport(viewport)
  const scheme = colorScheme ? { colorScheme } : {}

  try {
    const page = await context.newPage()
    await page.goto(options.url, { waitUntil: 'domcontentloaded' })

    for (const step of options.plan.steps) {
      await runStep(page, step)

      const names = stepProbes(options.plan, step)
      let count = 0
      for (const name of inRunOrder(names)) {
        const probe = PROBES[name]
        for (const finding of await probe(page)) {
          findings.push({
            ...finding,
            step: step.name,
            viewport: where,
            ...scheme,
          })
          count += 1
        }
      }

      passes.push({
        viewport: where,
        ...(colorScheme
          ? { colorScheme, background: await paintedBackground(page) }
          : {}),
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

/**
 * The background a reader sees, walking up from the body because a page often
 * paints its theme on the root and leaves the body transparent.
 */
async function paintedBackground(page: Page): Promise<string> {
  return page.evaluate(() => {
    const transparent = 'rgba(0, 0, 0, 0)'
    for (const element of [document.body, document.documentElement]) {
      if (!element) continue
      const color = getComputedStyle(element).backgroundColor
      if (color !== transparent) return color
    }
    return transparent
  })
}
