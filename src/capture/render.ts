import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright-core'
import { PNG } from 'pngjs'
import type {
  Browser,
  BrowserContextOptions,
  Locator,
  Page,
} from 'playwright-core'
import {
  mergeBlocks,
  preparePage,
  revealSection,
  splitBlocks,
} from '@/capture/sections'
import type { CaptureSource } from '@/capture/sources'
import {
  isGenericFamily,
  isUrlSource,
  resolveCaptureSources,
  textFamilies,
} from '@/capture/sources'
import { formatStamp, hashSource, stampPath } from '@/capture/stamp'

/**
 * Every browser reference the capture command makes lives in this module, and
 * `src/commands/capture.ts` reaches it through a dynamic import so `src/cli.ts`
 * never resolves the engine at startup.
 *
 * It ships, like `@/inventory/walk` and `@/driver/drive`.
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
const DEFAULT_VIEWPORT_HEIGHT = 720
const FONT_PROBE_SIZE = 72
const FONT_PROBE_TEXT = 'canon capture 0123456789'
const ABSENT_FAMILY = '__canon_absent_family__'

export type ColorScheme = 'light' | 'dark'

export interface CaptureOptions {
  selector: string
  outDir?: string
  width?: number
  colorScheme?: ColorScheme
  touch?: boolean
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
      sources.map((source) => captureOne(browser, source, options)),
    )
  } finally {
    await browser.close()
  }
}

interface PageEmulation {
  width?: number
  colorScheme?: ColorScheme
  touch?: boolean
}

/**
 * A viewport rather than a wrapper, since a media query answers to the
 * viewport. Absent leaves the option out so the browser default stands and
 * every committed capture renders as before. The height is Playwright's own
 * default, which keeps `vh` units where they were.
 *
 * Touch sets `hasTouch` alone, which turns `(hover: hover)` false and
 * `(pointer: coarse)` true. `isMobile` stays off, since it lays out a page with
 * no meta viewport at 980 wide and stops the wheel the section prep scrolls by.
 */
function pageOptions({
  width,
  colorScheme,
  touch,
}: PageEmulation): BrowserContextOptions {
  return {
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    ...(width === undefined
      ? {}
      : { viewport: { width, height: DEFAULT_VIEWPORT_HEIGHT } }),
    ...(colorScheme === undefined ? {} : { colorScheme }),
    ...(touch ? { hasTouch: true } : {}),
  }
}

/**
 * Resolves to a failed result rather than throwing, so one source that cannot
 * render does not drop the rest of the batch.
 */
async function captureOne(
  browser: Browser,
  source: CaptureSource,
  { selector, width, colorScheme, touch }: CaptureOptions,
): Promise<CaptureResult> {
  const page = await browser.newPage(pageOptions({ width, colorScheme, touch }))
  try {
    await page.goto(
      source.kind === 'url' ? source.url : pathToFileURL(source.htmlPath).href,
    )
    if (colorScheme !== undefined) await applyColorScheme(page, colorScheme)
    const element = page.locator(selector).first()
    if ((await element.count()) === 0) {
      return failed(source, `no element matched ${selector}`)
    }

    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    const declarations = await renderedTextFamilies(element)
    const generic = declarations.find(isGenericFamily)
    if (generic !== undefined) {
      return failed(
        source,
        `${generic.split(',')[0]?.trim()} is a generic family that resolves differently per machine, so name a real font`,
      )
    }
    for (const family of textFamilies(declarations)) {
      if (!(await resolvesFont(page, family))) {
        return failed(
          source,
          `${family} is not installed, so the capture would rewrap against a fallback`,
        )
      }
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

export interface SectionOptions {
  outDir: string
  root?: string
  width?: number
  colorScheme?: ColorScheme
  touch?: boolean
}

export interface SectionShot {
  readonly index: number
  readonly path: string
  readonly top: number
  readonly height: number
}

/**
 * Families the page draws text in that a shot cannot promise to reproduce,
 * recorded rather than refused, since a reference shows a site as a browser
 * draws it and most outside sites declare a generic family somewhere.
 */
export interface SectionFonts {
  readonly generic: readonly string[]
  readonly missing: readonly string[]
}

export type SectionsResult =
  | {
      status: 'captured'
      source: string
      sections: SectionShot[]
      failed: { index: number; reason: string }[]
      fonts: SectionFonts
    }
  | { status: 'failed'; source: string; reason: string }

/**
 * Shoots one page as one PNG per section, in page order, each with its stamp.
 * A section that fails to shoot is reported beside the rest rather than
 * dropping them, and a page that never loads or names no root fails whole.
 *
 * Each shot is a document-coordinate clip rather than an element shot, since a
 * merged section spans several elements and one element cannot frame them.
 */
export async function captureSections(
  sourcePath: string,
  { outDir, root, width, colorScheme, touch }: SectionOptions,
): Promise<SectionsResult> {
  const pageSource: CaptureSource = isUrlSource(sourcePath)
    ? { kind: 'url', url: sourcePath, pngPath: outDir }
    : { kind: 'file', htmlPath: sourcePath, pngPath: outDir }
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage(
      pageOptions({ width, colorScheme, touch }),
    )
    await page.goto(
      pageSource.kind === 'url'
        ? pageSource.url
        : pathToFileURL(pageSource.htmlPath).href,
    )
    if (colorScheme !== undefined) await applyColorScheme(page, colorScheme)
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    await preparePage(page)

    const blocks = await splitBlocks(page, root)
    if (blocks === null) {
      return failed(pageSource, `no element matched ${root}`)
    }
    if (blocks.length === 0) {
      return failed(
        pageSource,
        `${root ?? 'main, or body without one,'} drew no box to split into sections`,
      )
    }
    const fonts = await unresolvedFonts(page)

    mkdirSync(outDir, { recursive: true })
    const shots: SectionShot[] = []
    const misses: { index: number; reason: string }[] = []
    for (const [offset, section] of mergeBlocks(blocks).entries()) {
      const index = offset + 1
      const pngPath = join(
        outDir,
        `section-${String(index).padStart(2, '0')}.png`,
      )
      try {
        const clip = await revealSection(page, section)
        if (clip === null) {
          misses.push({ index, reason: 'the section drew no box' })
          continue
        }
        const png = touch
          ? await shootByViewport(page, clip)
          : await page.screenshot({ clip, fullPage: true })
        writeFileSync(pngPath, png)
        writeStamp({ ...pageSource, pngPath }, png)
        shots.push({ index, path: pngPath, top: clip.y, height: clip.height })
      } catch (error) {
        misses.push({
          index,
          reason: error instanceof Error ? error.message : String(error),
        })
      }
    }
    return {
      status: 'captured',
      source: sourceIdentifier(pageSource),
      sections: shots,
      failed: misses,
      fonts,
    }
  } catch (error) {
    return failed(
      pageSource,
      error instanceof Error ? error.message : String(error),
    )
  } finally {
    await browser.close()
  }
}

interface Clip {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Shoots a document-coordinate clip one viewport at a time, down and across,
 * and stitches the tiles, since Playwright's `fullPage` shot resets the device metrics while it
 * paints and drops touch emulation with them, so a `(hover: hover)` rule paints
 * its desktop form though `matchMedia` reads false before and after. A shot
 * inside the viewport keeps it. Neither `isMobile` nor an emulated `hover`
 * media feature survives the `fullPage` path either.
 */
async function shootByViewport(page: Page, clip: Clip): Promise<Buffer> {
  const viewport = page.viewportSize()
  const viewportWidth = viewport?.width ?? clip.width
  const viewportHeight = viewport?.height ?? DEFAULT_VIEWPORT_HEIGHT
  const sheet = new PNG({
    width: clip.width * DEVICE_SCALE_FACTOR,
    height: clip.height * DEVICE_SCALE_FACTOR,
  })
  for (let down = 0; down < clip.height; down += viewportHeight) {
    for (let across = 0; across < clip.width; across += viewportWidth) {
      const left = clip.x + across
      const top = clip.y + down
      const scroll = await page.evaluate(
        ({ x, y }) => {
          window.scrollTo(x, y)
          return { x: window.scrollX, y: window.scrollY }
        },
        { x: left, y: top },
      )
      const tile = PNG.sync.read(
        await page.screenshot({
          clip: {
            x: left - scroll.x,
            y: top - scroll.y,
            width: Math.min(viewportWidth, clip.width - across),
            height: Math.min(viewportHeight, clip.height - down),
          },
        }),
      )
      const destinationX = across * DEVICE_SCALE_FACTOR
      const destinationY = down * DEVICE_SCALE_FACTOR
      PNG.bitblt(
        tile,
        sheet,
        0,
        0,
        Math.min(tile.width, sheet.width - destinationX),
        Math.min(tile.height, sheet.height - destinationY),
        destinationX,
        destinationY,
      )
    }
  }
  return PNG.sync.write(sheet)
}

/**
 * The generic and the absent families among those the page's text draws in,
 * read once over the whole body, which is the probe single-element capture
 * refuses on, turned into a record.
 */
async function unresolvedFonts(page: Page): Promise<SectionFonts> {
  const declarations = await renderedTextFamilies(page.locator('body'))
  const generic = textFamilies(declarations.filter(isGenericFamily))
  const named = textFamilies(
    declarations.filter((declaration) => !isGenericFamily(declaration)),
  )
  const resolved = await Promise.all(
    named.map((family) => resolvesFont(page, family)),
  )
  return {
    generic,
    missing: named.filter((_, index) => !resolved[index]),
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

/**
 * Writes the theme the three switches a stylesheet reads, being the media
 * query, a `data-theme` attribute, and a `light` or `dark` class on the root,
 * which is the set Frameboard's theme toggle writes on every frame. The media
 * query alone leaves a stylesheet keyed on the attribute in its default set,
 * which is dark for one `canon design css` emits.
 *
 * Written after the load event, so a page script restoring a stored theme on
 * load has already run and cannot overwrite it.
 */
async function applyColorScheme(
  page: Page,
  scheme: ColorScheme,
): Promise<void> {
  await page.evaluate((theme) => {
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
    root.style.colorScheme = theme
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
  }, scheme)
}

function failed(
  source: CaptureSource,
  reason: string,
): Extract<CaptureResult, { status: 'failed' }> {
  return { status: 'failed', source: sourceIdentifier(source), reason }
}

/**
 * The computed families of the captured element and of each element under it
 * holding a non-blank text node of its own that draws a box, which is the text
 * the screenshot shows. Testing the text node's box rather than the element's
 * keeps out `<style>`, `<script>`, `<title>`, and anything hidden, whose
 * computed family is the browser default and would refuse every source that
 * styles a descendant rather than the root, and keeps in text directly inside a
 * `display: contents` element, which draws no box of its own.
 *
 * Returns nothing when no element holds text, since a font cannot rewrap text
 * that is not there, so a container of iframes skips the probe.
 */
async function renderedTextFamilies(element: Locator): Promise<string[]> {
  return element.evaluate((root) => {
    const range = document.createRange()
    const holdsText = (node: Element): boolean =>
      [...node.childNodes].some((child) => {
        if (child.nodeType !== Node.TEXT_NODE) return false
        if ((child.textContent ?? '').trim() === '') return false
        range.selectNodeContents(child)
        return range.getClientRects().length > 0
      })
    const texts = [root, ...root.querySelectorAll('*')].filter(holdsText)
    return texts.map((node) => getComputedStyle(node).fontFamily)
  })
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
