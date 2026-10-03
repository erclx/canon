import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import JSZip from 'jszip'
import type { Browser, Page } from 'playwright-core'
import PptxGenJS from 'pptxgenjs'
import { isBrowserMissing, isEngineMissing } from '@/browser/engine'
import { resolveFrameTokens } from '@/canvas/tokens'
import {
  type ChartTheme,
  planChart,
  seriesColors,
} from '@/slides/convert/chart'
import { type DeckConfig, readDeck } from '@/slides/convert/deck'
import {
  bandTexts,
  buildMaster,
  type DeckTheme,
  deckTheme,
  type MarkSize,
  type MasterBands,
  masterName,
  slideNumberProps,
} from '@/slides/convert/master'
import {
  type DrawOp,
  type ElementRecord,
  type Fallback,
  type NamedShape,
  planSlide,
  type RefusedLink,
} from '@/slides/convert/shapes'
import {
  type BandOverride,
  type EntranceRecord,
  ID_ATTRIBUTE,
  readTheme,
  type SlideMeta,
  type WalkedSlide,
  walkSlide,
} from '@/slides/convert/walk'
import { embedFonts, type FontNotice } from '@/slides/package/fonts'
import {
  type EntranceSpec,
  type MotionNotice,
  type SlideMotionEdit,
  writeMotion,
} from '@/slides/package/motion'

/**
 * Turns a folder of HTML slides into one editable deck. Chromium lays each
 * slide out at 1280 by 720 in the project's tokens, `walkSlide` reads what it
 * placed, `planSlide` maps the records onto shapes, and an element whose CSS has
 * no mapping lands as a screenshot of itself. The first slide's computed tokens
 * build the masters, and `deck.json` sets the bands they carry. Once pptxgenjs
 * has written the package, `src/slides/package/` adds the transitions,
 * entrances, and embedded faces it declares nothing for.
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

/** A chart left out of the deck, with the reason the report prints. */
export interface RefusedChart {
  readonly slide: number
  readonly selector: string
  readonly message: string
}

export type ExportRefusal =
  | 'empty-source'
  | 'deck-invalid'
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
      readonly refusedCharts: readonly RefusedChart[]
      /** Transitions and entrances left out, each with the reason. */
      readonly refusedMotion: readonly MotionNotice[]
      /** Faces `deck.json` lists that the deck does not carry, with the reason. */
      readonly refusedFonts: readonly FontNotice[]
      /** What the deck master could not take from the project's tokens. */
      readonly notices: readonly string[]
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
  const deckRead = readDeck(sourceDir)
  if (deckRead.status === 'refused') {
    return refused('deck-invalid', deckRead.message)
  }
  const deck = deckRead.deck

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
  pptx.title = deck.title
  const fallbacks: SlideFallback[] = []
  const refusedLinks: SlideRefusedLink[] = []
  const refusedCharts: RefusedChart[] = []
  const patches: Patch[] = []
  const motions: SlideMotionEdit[] = []
  const notices: string[] = []

  try {
    const page = await browser.newPage({
      viewport: { width: SLIDE_WIDTH, height: SLIDE_HEIGHT },
      deviceScaleFactor: SCREENSHOT_SCALE,
    })
    await prepare(page, files[0] ?? '', tokens)
    const reading = await page.evaluate(readTheme)
    const read = deckTheme(reading)
    const theme = read.theme
    notices.push(...read.notices)
    const drifted: number[] = []
    const chartTheme: ChartTheme = {
      colors: seriesColors(theme.accent, reading.roles),
      ink: theme.ink,
      muted: theme.muted,
      face: theme.face,
    }
    pptx.theme = { headFontFace: theme.face, bodyFontFace: theme.face }
    const markSize = deck.mark ? await measure(page, deck.mark) : undefined
    const masters = new Set<string>()
    const sections = new Sections(deck.title, declaresSections(files))

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
      const { textToken } = walked.meta
      if (textToken !== undefined && textToken !== theme.ink) {
        drifted.push(slideNumber)
      }
      // pptxgenjs binds a slide to its master at creation, so the bands this
      // slide keeps decide the master before any shape is added.
      const bands = masterBands(deck, walked.meta)
      const master = masterName(bands)
      if (!masters.has(master)) {
        pptx.defineSlideMaster(buildMaster(deck, theme, bands, markSize))
        masters.add(master)
      }
      const sectionTitle = sections.titleFor(walked.meta, pptx)
      const slide = pptx.addSlide({
        masterName: master,
        ...(sectionTitle ? { sectionTitle } : {}),
      })
      if (walked.background.hex !== theme.background) {
        slide.background = { color: walked.background.hex }
      }
      if (walked.meta.isHidden) slide.hidden = true
      for (const op of plan.ops) {
        await draw(page, slide, slideNumber, op, patches)
      }
      for (const record of walked.charts) {
        const chart = planChart(record, chartTheme)
        if (chart.status === 'refused') {
          refusedCharts.push({ ...chart, slide: slideNumber })
          continue
        }
        slide.addChart(chart.type, [...chart.data], chart.options)
      }
      drawOverrides(slide, deck, theme, walked.meta)
      if (walked.meta.notes) slide.addNotes(walked.meta.notes)
      const { transition } = walked.meta
      const entrances = walked.entrances.map((entrance) =>
        entranceSpec(entrance, walked.records, plan.names),
      )
      if (transition || entrances.length > 0) {
        motions.push({
          slide: slideNumber,
          motion: { ...(transition ? { transition } : {}), entrances },
        })
      }
    }
    if (drifted.length > 0) {
      const noun = drifted.length === 1 ? 'slide' : 'slides'
      const verb = drifted.length === 1 ? 'sets' : 'set'
      notices.push(
        `${noun} ${drifted.join(', ')} ${verb} a --color-text apart from the master, so ${drifted.length === 1 ? 'its' : 'their'} bands keep the master colors`,
      )
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
  // A deck needing no edit keeps the bytes pptxgenjs wrote.
  let packaged: Uint8Array = written
  const refusedMotion: MotionNotice[] = []
  const refusedFonts: FontNotice[] = []
  if (patches.length > 0 || motions.length > 0 || deck.fonts.length > 0) {
    const zip = await JSZip.loadAsync(written)
    await applyPatches(zip, patches)
    refusedMotion.push(...(await writeMotion(zip, motions)))
    const faces = deck.fonts.map((font) => ({
      family: font.family,
      weight: font.weight,
      style: font.style,
      path: font.source,
      bytes: readFileSync(font.path),
    }))
    refusedFonts.push(...(await embedFonts(zip, faces)))
    packaged = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    })
  }

  mkdirSync(outDir, { recursive: true })
  const fileName = `${basename(sourceDir)}.pptx`
  const pptxPath = join(outDir, fileName)
  writeFileSync(pptxPath, packaged)

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
    refusedCharts,
    refusedMotion,
    refusedFonts,
    notices,
  }
}

/**
 * An entrance animates every shape drawn from its element and from the
 * elements inside it, so a card's box and its text come in together. A record
 * follows its parent in document order, which lets one pass collect the subtree.
 */
function entranceSpec(
  entrance: EntranceRecord,
  records: readonly ElementRecord[],
  names: readonly NamedShape[],
): EntranceSpec {
  const subtree = new Set<number>()
  if (entrance.record !== null) subtree.add(entrance.record)
  for (const record of records) {
    if (record.parent !== null && subtree.has(record.parent)) {
      subtree.add(record.id)
    }
  }
  const { record: _record, ...spec } = entrance
  return {
    ...spec,
    shapes: names
      .filter((named) => subtree.has(named.record))
      .map((named) => named.name),
  }
}

/**
 * A band stays on the master unless the deck has it off anyway, so a slide
 * hiding only the header keeps the master's footer and numbers.
 */
function masterBands(deck: DeckConfig, meta: SlideMeta): MasterBands {
  return {
    header: deck.header.show && meta.header.kind === 'master',
    footer: deck.footer.show && meta.footer.kind === 'master',
  }
}

type Override = Extract<BandOverride, { readonly kind: 'override' }>

/** The slide's slots over the deck's, so overriding the center keeps the title. */
function mergeBand(override: Override, base: DeckConfig['header']) {
  return {
    left: override.left ?? base.left,
    center: override.center ?? base.center,
    right: override.right ?? base.right,
  }
}

function drawOverrides(
  slide: PptxGenJS.Slide,
  deck: DeckConfig,
  theme: DeckTheme,
  meta: SlideMeta,
): void {
  if (meta.header.kind === 'override') {
    const band = mergeBand(meta.header, deck.header)
    const hasMark = deck.mark !== undefined
    for (const text of bandTexts(band, 'header', theme, { hasMark })) {
      slide.addText(text.text, text.options)
    }
  }
  if (meta.footer.kind === 'override') {
    const band = mergeBand(meta.footer, deck.footer)
    for (const text of bandTexts(band, 'footer', theme)) {
      slide.addText(text.text, text.options)
    }
    if (deck.slideNumbers && band.right === undefined) {
      slide.slideNumber = slideNumberProps(theme)
    }
  }
}

/**
 * A slide's `data-section` opens a section the slides after it stay in.
 * PowerPoint wants every slide in a section once any exists, so slides ahead of
 * the first declared one open a section named after the deck.
 *
 * pptxgenjs files a slide under the first section carrying its title, so a
 * title the deck returns to takes a numbered suffix rather than sending the
 * slide back into the earlier section, which PowerPoint reads as a broken list.
 */
export class Sections {
  /** The title as declared, and as written once a repeat is numbered. */
  private declared: string | undefined
  private current: string | undefined
  private readonly opened = new Map<string, number>()

  constructor(
    private readonly deckTitle: string,
    private readonly isUsed: boolean,
  ) {}

  titleFor(meta: SlideMeta, pptx: PptxGenJS): string | undefined {
    if (!this.isUsed) return undefined
    const isContinuing =
      meta.section === undefined || meta.section === this.declared
    if (isContinuing && this.current !== undefined) return this.current
    const title = meta.section ?? this.deckTitle
    const count = (this.opened.get(title) ?? 0) + 1
    this.opened.set(title, count)
    this.declared = title
    this.current = count === 1 ? title : `${title} (${count})`
    pptx.addSection({ title: this.current })
    return this.current
  }
}

/**
 * Whether any slide declares a section, read from the source ahead of layout,
 * since the first slide is placed before the last is laid out.
 */
function declaresSections(files: readonly string[]): boolean {
  return files.some((file) =>
    /<body\b[^>]*\sdata-section\s*=/i.test(readFileSync(file, 'utf8')),
  )
}

/** The mark's intrinsic size as Chromium decodes it, square where unknown. */
async function measure(page: Page, path: string): Promise<MarkSize> {
  const size = await page.evaluate(async (src) => {
    const image = new Image()
    image.src = src
    await image.decode().catch(() => undefined)
    return { width: image.naturalWidth, height: image.naturalHeight }
  }, pathToFileURL(path).href)
  return size.width > 0 && size.height > 0 ? size : { width: 1, height: 1 }
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
  await prepare(page, file, tokens)
  return page.evaluate(walkSlide, ID_ATTRIBUTE)
}

async function prepare(
  page: Page,
  file: string,
  tokens: string,
): Promise<void> {
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load' })
  if (tokens) {
    await page.evaluate((css) => {
      const style = document.createElement('style')
      style.textContent = css
      document.head.prepend(style)
    }, tokens)
  }
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
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
  slideNumber: number,
  op: DrawOp,
  patches: Patch[],
): Promise<void> {
  const target = { slide: slideNumber, name: op.options.objectName ?? '' }
  if (op.kind === 'shape') {
    slide.addShape(op.shape, op.options)
  } else if (op.kind === 'text') {
    slide.addText(op.runs, op.options)
  } else if (op.kind === 'table') {
    slide.addTable(op.rows, op.options)
  } else if (op.kind === 'image') {
    slide.addImage({ ...op.options, ...imageSource(op.src) })
    if (op.radius > 0) patches.push({ ...target, radius: op.radius })
    if (op.frame) slide.addShape(op.radius > 0 ? 'roundRect' : 'rect', op.frame)
  } else if (op.kind === 'svg') {
    slide.addImage({
      ...op.options,
      data: `image/svg+xml;base64,${base64(op.markup)}`,
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
 * corner radius. Each patched picture is found by the object name `planSlide`
 * gave it, which is the only handle the written XML keeps.
 */
async function applyPatches(
  zip: JSZip,
  patches: readonly Patch[],
): Promise<void> {
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
