import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright-core'
import type { Browser, Page } from 'playwright-core'
import type { CaptureSource } from '@/capture/sources'
import { primaryFontFamily, resolveCaptureSources } from '@/capture/sources'
import { formatStamp, hashSource, stampPath } from '@/capture/stamp'

/**
 * Every browser reference the capture command makes lives in this module, and
 * `src/commands/capture.ts` reaches it through a dynamic import so `src/cli.ts`
 * never resolves the engine at startup.
 *
 * It ships, like `@/demo/drive`, `@/inventory/walk`, and `@/driver/drive`.
 * Regenerating this repository's own committed images was the reason it stayed
 * behind, and it was a reason about one caller rather than about the mechanism:
 * a target renders its own generated pages and proves its own fonts resolved,
 * which is the whole of what this module does.
 *
 * It imports `playwright-core` rather than `@playwright/test` for the same
 * reason the three siblings do. The test runner is a development dependency the
 * published tarball never carries, so the earlier import resolved here and
 * threw `ERR_MODULE_NOT_FOUND` in every target install.
 */

const DEVICE_SCALE_FACTOR = 2
const FONT_PROBE_SIZE = 72
const FONT_PROBE_TEXT = 'canon capture 0123456789'
const ABSENT_FAMILY = '__canon_absent_family__'

export interface CaptureOptions {
  selector: string
  outDir?: string
}

export type CaptureResult =
  | {
      status: 'rendered'
      source: string
      pngPath: string
      width: number
      height: number
    }
  | { status: 'failed'; source: string; reason: string }

export async function captureSources(
  sourcePath: string,
  options: CaptureOptions,
): Promise<CaptureResult[]> {
  const sources = resolveCaptureSources(sourcePath, options.outDir)
  if (!sources.length) return []

  const browser = await chromium.launch()
  try {
    return await Promise.all(
      sources.map((source) => captureOne(browser, source, options.selector)),
    )
  } finally {
    await browser.close()
  }
}

/**
 * Resolves to a failed result rather than throwing, so one source that cannot
 * render does not drop the rest of the batch.
 */
async function captureOne(
  browser: Browser,
  source: CaptureSource,
  selector: string,
): Promise<CaptureResult> {
  const page = await browser.newPage({
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
  })
  try {
    await page.goto(
      source.kind === 'url' ? source.url : pathToFileURL(source.htmlPath).href,
    )
    const element = page.locator(selector).first()
    if ((await element.count()) === 0) {
      return failed(source, `no element matched ${selector}`)
    }

    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    const family = primaryFontFamily(
      await element.evaluate((node) => getComputedStyle(node).fontFamily),
    )
    if (family && !(await resolvesFont(page, family))) {
      return failed(
        source,
        `${family} is not installed, so the capture would rewrap against a fallback`,
      )
    }

    mkdirSync(dirname(source.pngPath), { recursive: true })
    const png = await element.screenshot({ omitBackground: true })
    writeFileSync(source.pngPath, png)
    writeStamp(source, png)
    return {
      status: 'rendered',
      source: sourceIdentifier(source),
      pngPath: source.pngPath,
      width: png.readUInt32BE(16),
      height: png.readUInt32BE(20),
    }
  } catch (error) {
    return failed(
      source,
      error instanceof Error ? error.message : String(error),
    )
  } finally {
    await page.close()
  }
}

/**
 * Runs inside the render rather than in a wrapper around it, so a capture
 * cannot succeed and leave the provenance unrecorded. A throw here reaches the
 * caller's catch and reports the source as failed, which is correct: a PNG
 * whose stamp never landed is the state the verify stage exists to reject.
 *
 * A file source is stored as a bare filename. An absolute path would record
 * the machine that ran the capture into a tracked file and differ per
 * checkout. A URL source is stored as the URL itself, and its digest hashes
 * the URL string's UTF-8 bytes rather than any local file, since there is
 * none to hash.
 *
 * The image digest is taken over the buffer the screenshot returned rather than
 * by reading the file back, so the stamp describes the bytes this run wrote.
 */
function writeStamp(source: CaptureSource, png: Uint8Array): void {
  writeFileSync(
    stampPath(source.pngPath),
    formatStamp({
      source: source.kind === 'url' ? source.url : basename(source.htmlPath),
      sourceSha256:
        source.kind === 'url'
          ? hashSource(Buffer.from(source.url, 'utf8'))
          : hashSource(readFileSync(source.htmlPath)),
      imageSha256: hashSource(png),
    }),
  )
}

/**
 * The identifier a `CaptureResult` reports, kept as the full path for a file
 * source so `displayPath` in `src/commands/capture.ts` can still show it
 * relative to the working directory.
 */
function sourceIdentifier(source: CaptureSource): string {
  return source.kind === 'url' ? source.url : source.htmlPath
}

function failed(source: CaptureSource, reason: string): CaptureResult {
  return { status: 'failed', source: sourceIdentifier(source), reason }
}

/**
 * Compares the family's text metrics against a family that cannot exist. Equal
 * widths mean the browser fell through to its default for both, which is the
 * only signal available: `document.fonts.check` reports every system family as
 * present, including invented ones.
 */
async function resolvesFont(page: Page, family: string): Promise<boolean> {
  return page.evaluate(
    ({ family, absent, size, text }) => {
      const context = document.createElement('canvas').getContext('2d')
      if (!context) return false
      const widthOf = (name: string): number => {
        context.font = `${size}px "${name}"`
        return context.measureText(text).width
      }
      return widthOf(family) !== widthOf(absent)
    },
    {
      family,
      absent: ABSENT_FAMILY,
      size: FONT_PROBE_SIZE,
      text: FONT_PROBE_TEXT,
    },
  )
}
