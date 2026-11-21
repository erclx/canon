import { chromium } from 'playwright-core'
import type { Browser, Page } from 'playwright-core'
import {
  SANDBOXED,
  enterKeyboardModality,
  isBrowserMissing,
  isSandboxBlocked,
  isServerUnreachable,
  launchSandboxFix,
} from '@/browser/engine'
import type { Reading } from '@/inventory/group'
import type { Subject } from '@/inventory/subjects'

/**
 * Walks a running application, or board frame files, and reads one property off
 * every element a subject names. `src/commands/inventory.ts` reaches it through a
 * dynamic import so no other command resolves the engine, and it ships to targets.
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
 * The reader and the query arrive apart, since the toolkit ships the reader and
 * the project declares which elements it runs over. `frames` reads each target
 * light then dark, since a board frame carries both themes in one file.
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
  | 'browser-missing'
  | 'sandbox-blocked'
  | 'server-unreachable'
  | 'walk-failed'

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
      /** The command that clears a `sandbox-blocked` refusal, when one does. */
      readonly fix?: string
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
    browser = await chromium.launch(SANDBOXED)
  } catch (error) {
    if (isBrowserMissing(error)) return failed('browser-missing', error)
    if (isSandboxBlocked(error)) {
      const fix = launchSandboxFix()
      return { ...failed('sandbox-blocked', error), ...(fix ? { fix } : {}) }
    }
    return failed('walk-failed', error)
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

      // A frame's stylesheets and fonts change what computes, so the read waits for load.
      await page.emulateMedia({ colorScheme: 'light' })
      await page.goto(target.url, { waitUntil: 'load' })
      await readInto(page, target.label)

      // The dark read sets both `data-theme` and the media query and finishes each color transition.
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
    // Dropped, since a failing close would replace the caller's refusal with one about teardown.
    await browser.close().catch(() => undefined)
  }

  return {
    status: 'read',
    readings,
    targets,
    durationMs: Date.now() - started,
  }
}
