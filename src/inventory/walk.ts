import { chromium } from 'playwright-core'
import type { Browser, Page } from 'playwright-core'
import {
  enterKeyboardModality,
  isBrowserMissing,
  isServerUnreachable,
} from '@/browser/engine'
import type { Reading } from '@/inventory/group'
import type { Subject } from '@/inventory/subjects'

/**
 * Walks a running application, or a set of board frame files, and reads one
 * property off every element a subject names. Every browser reference the
 * inventory feature adds lives here, and `src/commands/inventory.ts` reaches
 * it through a dynamic import so no other command resolves the engine at
 * startup.
 *
 * Like `@/driver/drive` and `@/capture/render`, this module
 * ships, because a command whose whole purpose is running inside someone else's
 * project cannot stay toolkit-only.
 */

/**
 * One page the walk opens, by the label the listing prints for it. A route
 * walk labels a target by its route, and a frame walk by the frame's path.
 */
export interface WalkTarget {
  readonly label: string
  readonly url: string
}

/**
 * The reader and the query arrive apart because they come from different
 * owners. The toolkit ships the reader and the project declares which elements
 * it runs over, which is what keeps the walk answering to the target rather
 * than to a fixed selector nobody there chose.
 *
 * `frames` reads each target twice, light and then dark, since a board frame
 * carries both themes in one file where a route serves whichever the project
 * chose.
 */
export interface WalkOptions {
  readonly targets: readonly WalkTarget[]
  readonly subject: Subject
  readonly query: string
  readonly frames: boolean
}

/** A target that answered, and the elements read off it. */
export interface TargetReading {
  readonly location: string
  readonly elements: number
}

export type WalkRefusal =
  'browser-missing' | 'server-unreachable' | 'walk-failed'

export type WalkResult =
  | {
      readonly status: 'read'
      readonly readings: readonly Reading[]
      readonly targets: readonly TargetReading[]
      readonly durationMs: number
    }
  | {
      readonly status: 'failed'
      readonly reason: WalkRefusal
      readonly message: string
    }

function failed(reason: WalkRefusal, error: unknown): WalkResult {
  return {
    status: 'failed',
    reason,
    message: error instanceof Error ? error.message : String(error),
  }
}

/** The location a frame's dark read is listed under. */
function darkLabel(label: string): string {
  return `${label} (dark)`
}

export async function walk(options: WalkOptions): Promise<WalkResult> {
  const started = Date.now()

  let browser: Browser
  try {
    browser = await chromium.launch()
  } catch (error) {
    return failed(
      isBrowserMissing(error) ? 'browser-missing' : 'walk-failed',
      error,
    )
  }

  const readings: Reading[] = []
  const targets: TargetReading[] = []

  const readInto = async (page: Page, location: string): Promise<void> => {
    const rows = await page.evaluate(options.subject.read, {
      query: options.query,
      subject: options.subject.name,
    })
    for (const row of rows) readings.push({ location, ...row })
    targets.push({ location, elements: rows.length })
  }

  try {
    const page = await browser.newPage()

    for (const target of options.targets) {
      if (!options.frames) {
        await page.goto(target.url, { waitUntil: 'domcontentloaded' })
        await enterKeyboardModality(page)
        await readInto(page, target.label)
        continue
      }

      // A frame's stylesheets and fonts change what computes, so the read
      // waits for load. A stylesheet the frame cannot reach fails without
      // failing the load, and the read reports what the frame shows without it.
      await page.emulateMedia({ colorScheme: 'light' })
      await page.goto(target.url, { waitUntil: 'load' })
      await readInto(page, target.label)

      // Board frames switch on `data-theme`, and a few on the media query, so
      // the dark read sets both. Flipping the attribute starts any transition
      // a frame declares on a color, and a read mid-transition reports a value
      // between the two themes, so each one is finished first.
      await page.emulateMedia({ colorScheme: 'dark' })
      await page.evaluate(() => {
        document.documentElement.setAttribute('data-theme', 'dark')
        for (const animation of document.getAnimations()) {
          if (animation instanceof CSSTransition) animation.finish()
        }
      })
      await readInto(page, darkLabel(target.label))
    }
  } catch (error) {
    return failed(
      isServerUnreachable(error) ? 'server-unreachable' : 'walk-failed',
      error,
    )
  } finally {
    // The rejection is dropped rather than propagated, because a close that
    // fails beside a walk that already failed would replace the refusal the
    // caller was about to receive with a reason about teardown. Nothing the
    // caller does depends on the browser having closed cleanly.
    await browser.close().catch(() => undefined)
  }

  return {
    status: 'read',
    readings,
    targets,
    durationMs: Date.now() - started,
  }
}
