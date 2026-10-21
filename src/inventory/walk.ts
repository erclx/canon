import { chromium } from 'playwright-core'
import type { Browser } from 'playwright-core'
import {
  enterKeyboardModality,
  isBrowserMissing,
  isServerUnreachable,
} from '@/browser/engine'
import { routeUrl } from '@/inventory/config'
import type { Reading } from '@/inventory/group'
import type { Subject } from '@/inventory/subjects'

/**
 * Walks a running application and reads one property off every element a
 * subject names. Every browser reference the inventory feature adds lives here,
 * and `src/commands/inventory.ts` reaches it through a dynamic import so no
 * other command resolves the engine at startup.
 *
 * Like `@/driver/drive` and `@/capture/render`, this module
 * ships, because a command whose whole purpose is running inside someone else's
 * project cannot stay toolkit-only.
 */

/**
 * The reader and the query arrive apart because they come from different
 * owners. The toolkit ships the reader and the project declares which elements
 * it runs over, which is what keeps the walk answering to the target rather
 * than to a fixed selector nobody there chose.
 */
export interface WalkOptions {
  readonly baseUrl: string
  readonly routes: readonly string[]
  readonly subject: Subject
  readonly query: string
}

/** A route that answered, and the elements read off it. */
export interface RouteReading {
  readonly route: string
  readonly elements: number
}

export type WalkRefusal =
  | 'browser-missing'
  | 'server-unreachable'
  | 'walk-failed'

export type WalkResult =
  | {
      readonly status: 'read'
      readonly readings: readonly Reading[]
      readonly routes: readonly RouteReading[]
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
  const routes: RouteReading[] = []

  try {
    const page = await browser.newPage()

    for (const route of options.routes) {
      await page.goto(routeUrl(options.baseUrl, route), {
        waitUntil: 'domcontentloaded',
      })

      await enterKeyboardModality(page)

      const rows = await page.evaluate(options.subject.read, options.query)
      for (const row of rows) readings.push({ route, ...row })
      routes.push({ route, elements: rows.length })
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
    routes,
    durationMs: Date.now() - started,
  }
}
