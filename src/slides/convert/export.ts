import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import JSZip from 'jszip'
import type { Browser, Page } from 'playwright-core'
import PptxGenJS from 'pptxgenjs'
import { isBrowserMissing, isEngineMissing } from '@/browser/engine'
import { resolveFrameTokens } from '@/canvas/tokens'
import {
  type DrawOp,
  type Fallback,
  planSlide,
  type RefusedLink,
} from '@/slides/convert/shapes'
import {
  ID_ATTRIBUTE,
  type WalkedSlide,
  walkSlide,
} from '@/slides/convert/walk'

/**
 * Turns a folder of HTML slides into one editable deck. Chromium lays each
 * slide out at 1280 by 720 in the project's tokens, `walkSlide` reads what it
 * placed, `planSlide` maps the records onto shapes, and an element whose CSS has
 * no mapping lands as a screenshot of itself.
 *
 * Every browser reference this feature adds lives here, and the command reaches
 * it through a dynamic import so no other command resolves the engine.
 */

export const SLIDE_WIDTH = 1280
export const SLIDE_HEIGHT = 720

/** Device pixels per CSS pixel in every screenshot, so a picture stays sharp. */
const SCREENSHOT_SCALE = 2

/** English Metric Units per inch, the unit a slide's XML measures in. */
const EMU_PER_INCH = 914400

export interface SlideFallback extends Fallback {
  readonly slide: number
}

export interface SlideRefusedLink extends RefusedLink {
  readonly slide: number
}

export type ExportRefusal =
  | 'empty-source'
  | 'engine-missing'
  | 'browser-missing'
  | 'export-failed'

export type ExportResult =
  | {
      readonly status: 'written'
      readonly pptxPath: string
      readonly mirrorPath?: string
      readonly slideCount: number
      readonly fallbacks: readonly SlideFallback[]
      readonly refusedLinks: readonly SlideRefusedLink[]
    }
  | {
      readonly status: 'refused'
      readonly reason: ExportRefusal
      readonly message: string
    }

export interface ExportOptions {
  /** The project whose tokens the slides are laid out in. */
  readonly root: string
  readonly mirror?: string
}

function refused(reason: ExportRefusal, message: string): ExportResult {
  return { status: 'refused', reason, message }
}

/** Every `.html` file directly in the folder, in filename order. */
export function slideFiles(sourceDir: string): string[] {
  return readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((name) => join(sourceDir, name))
}

/** A picture whose bytes the post-write pass replaces or whose corners it rounds. */
interface Patch {
  readonly slide: number
  readonly name: string
  readonly png?: Buffer
  readonly radius?: number
}

export async function exportHtmlDeck(
  sourceDir: string,
  outDir: string,
  options: ExportOptions,
): Promise<ExportResult> {
  const files = slideFiles(sourceDir)
  if (files.length === 0) {
    return refused('empty-source', `${sourceDir} holds no .html slides`)
  }

  let chromium: typeof import('playwright-core').chromium
  try {
    ;({ chromium } = await import('playwright-core'))
  } catch (error) {
    if (!isEngineMissing(error)) throw error
    return refused('engine-missing', 'playwright-core is not installed')
  }

  let browser: Browser
  try {
    browser = await chromium.launch()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return refused(
      isBrowserMissing(error) ? 'browser-missing' : 'export-failed',
      message,
    )
  }

  const tokens = resolveFrameTokens(options.root).css
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  const fallbacks: SlideFallback[] = []
  const refusedLinks: SlideRefusedLink[] = []
  const patches: Patch[] = []

  try {
    const page = await browser.newPage({
      viewport: { width: SLIDE_WIDTH, height: SLIDE_HEIGHT },
      deviceScaleFactor: SCREENSHOT_SCALE,
    })
    for (const [index, file] of files.entries()) {
      const slideNumber = index + 1
      const walked = await layOut(page, file, tokens)
      const plan = planSlide(walked.records, { slideCount: files.length })
      fallbacks.push(
        ...plan.fallbacks.map((each) => ({ ...each, slide: slideNumber })),
      )
      refusedLinks.push(
        ...plan.refusedLinks.map((each) => ({ ...each, slide: slideNumber })),
      )
      const slide = pptx.addSlide()
      slide.background = { color: walked.background.hex }
      for (const [opIndex, op] of plan.ops.entries()) {
        const name = `canon-${slideNumber}-${opIndex + 1}`
        await draw(page, slide, { slide: slideNumber, name }, op, patches)
      }
    }
  } catch (error) {
    return refused(
      'export-failed',
      error instanceof Error ? error.message : String(error),
    )
  } finally {
    await browser.close().catch(() => undefined)
  }

  const written = await pptx.write({ outputType: 'nodebuffer' })
  if (!(written instanceof Uint8Array)) {
    return refused('export-failed', 'pptxgenjs returned no buffer')
  }
  const deck = await applyPatches(written, patches)

  mkdirSync(outDir, { recursive: true })
  const fileName = `${basename(sourceDir)}.pptx`
  const pptxPath = join(outDir, fileName)
  writeFileSync(pptxPath, deck)

  let mirrorPath: string | undefined
  if (options.mirror) {
    mkdirSync(options.mirror, { recursive: true })
    mirrorPath = join(options.mirror, fileName)
    copyFileSync(pptxPath, mirrorPath)
  }

  return {
    status: 'written',
    pptxPath,
    mirrorPath,
    slideCount: files.length,
    fallbacks,
    refusedLinks,
  }
}

/**
 * The tokens go in ahead of the slide's own styles, so a slide reads
 * `var(--color-*)` from the project and can still override any of it.
 */
async function layOut(
  page: Page,
  file: string,
  tokens: string,
): Promise<WalkedSlide> {
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load' })
  if (tokens) {
    await page.evaluate((css) => {
      const style = document.createElement('style')
      style.textContent = css
      document.head.prepend(style)
    }, tokens)
  }
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  return page.evaluate(walkSlide, ID_ATTRIBUTE)
}

async function screenshot(page: Page, id: number): Promise<Buffer> {
  return page
    .locator(`[${ID_ATTRIBUTE}="${id}"]`)
    .screenshot({ omitBackground: true, animations: 'disabled' })
}

function imageSource(src: string): Pick<PptxGenJS.ImageProps, 'path' | 'data'> {
  if (src.startsWith('data:')) return { data: src.slice('data:'.length) }
  if (src.startsWith('file:')) return { path: fileURLToPath(src) }
  return { path: src }
}

const base64 = (bytes: Buffer | string): string =>
  Buffer.from(bytes).toString('base64')

async function draw(
  page: Page,
  slide: PptxGenJS.Slide,
  target: { readonly slide: number; readonly name: string },
  op: DrawOp,
  patches: Patch[],
): Promise<void> {
  if (op.kind === 'shape') {
    slide.addShape(op.shape, op.options)
  } else if (op.kind === 'text') {
    slide.addText(op.runs, op.options)
  } else if (op.kind === 'table') {
    slide.addTable(op.rows, op.options)
  } else if (op.kind === 'image') {
    slide.addImage({
      ...op.options,
      ...imageSource(op.src),
      objectName: target.name,
    })
    if (op.radius > 0) patches.push({ ...target, radius: op.radius })
    if (op.frame) slide.addShape(op.radius > 0 ? 'roundRect' : 'rect', op.frame)
  } else if (op.kind === 'svg') {
    slide.addImage({
      ...op.options,
      data: `image/svg+xml;base64,${base64(op.markup)}`,
      objectName: target.name,
    })
    patches.push({ ...target, png: await screenshot(page, op.id) })
  } else {
    const png = await screenshot(page, op.id)
    slide.addImage({ ...op.options, data: `image/png;base64,${base64(png)}` })
  }
}

/**
 * Two things pptxgenjs cannot write, fixed in the package it wrote. An SVG's
 * PNG fallback comes out as the SVG's own bytes under a `.png` name in Node, so
 * a viewer that cannot draw SVG gets a broken image, and a picture takes no
 * corner radius. Each patched picture is found by the object name `draw` gave
 * it, which is the only handle the written XML keeps.
 */
async function applyPatches(
  deck: Uint8Array,
  patches: readonly Patch[],
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(deck)
  const bySlide = Map.groupBy(patches, (patch) => patch.slide)
  for (const [slideNumber, slidePatches] of bySlide) {
    const slidePath = `ppt/slides/slide${slideNumber}.xml`
    const relsPath = `ppt/slides/_rels/slide${slideNumber}.xml.rels`
    let xml = (await zip.file(slidePath)?.async('string')) ?? ''
    const rels = (await zip.file(relsPath)?.async('string')) ?? ''
    for (const patch of slidePatches) {
      const pic = pictureXml(xml, patch.name)
      if (!pic) continue
      if (patch.png) {
        const rId = /<a:blip r:embed="(rId\d+)"/.exec(pic)?.[1]
        const target = rId
          ? new RegExp(`Id="${rId}"[^>]*Target="\\.\\./([^"]+)"`).exec(
              rels,
            )?.[1]
          : undefined
        if (target) zip.file(`ppt/${target}`, patch.png)
      }
      if (patch.radius) {
        xml = xml.replace(pic, roundCorners(pic, patch.radius))
      }
    }
    zip.file(slidePath, xml)
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

function pictureXml(xml: string, name: string): string | undefined {
  const start = xml.indexOf(`name="${name}"`)
  if (start < 0) return undefined
  const open = xml.lastIndexOf('<p:pic>', start)
  const close = xml.indexOf('</p:pic>', start)
  return open < 0 || close < 0
    ? undefined
    : xml.slice(open, close + '</p:pic>'.length)
}

/** The adjust value is the radius over the shorter side, out of 100000. */
function roundCorners(pic: string, radius: number): string {
  const extent = /<a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(pic)
  const shorter = extent ? Math.min(Number(extent[1]), Number(extent[2])) : 0
  if (shorter === 0) return pic
  const adjust = Math.min(
    50000,
    Math.round((radius * EMU_PER_INCH * 100000) / shorter),
  )
  return pic.replace(
    /<a:prstGeom prst="rect"><a:avLst\/><\/a:prstGeom>/,
    `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ${adjust}"/></a:avLst></a:prstGeom>`,
  )
}
