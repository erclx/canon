import {
  type Box,
  type ContentRefused,
  readPage,
  resizeFrame,
} from '@/canvas/content'
import {
  type CaptureDeps,
  resolveCaptureTargets,
  type ServeRefused,
  serveCanvas,
} from '@/canvas/capture'
import { resolveFrameTokens, servedFamilies } from '@/canvas/tokens'

/** What the capture browser read off one frame at its box width. */
export interface Measured {
  readonly page: string
  readonly frame: string
  readonly box: Box
  readonly contentHeight: number
  readonly contentWidth: number
  /** The document height with the viewport at the box height, as a viewer draws it. */
  readonly renderedHeight: number
  /** The first family of the body text, unquoted. */
  readonly family: string
}

export interface FitRow {
  readonly page: string
  readonly frame: string
  /** The box height now. */
  readonly height: number
  /** The content's height, which is what the box should be. */
  readonly fitted: number
  /** The content is wider than the box, which fit reports and never widens. */
  readonly wide: boolean
  /** The first family is not one the canvas serves, so the height may not hold. */
  readonly font: boolean
  /**
   * The document height depends on the viewport, as a height in `vh` does, so
   * the content measure is not the height a viewer draws and nothing is written.
   */
  readonly viewport: boolean
  readonly family: string
}

/**
 * Turns measurements into rows. The box width is the frame's declared render
 * width, so an overflow in it is a finding and never a resize. `served` is the
 * set of families the served sheet carries a face for.
 *
 * A document that does not depend on the viewport reads the larger of its
 * content and the viewport when drawn at the box height. A read that differs
 * from that means a unit such as `vh` is sizing it, so the row keeps its
 * height and reports `viewport`.
 */
export function planFit(
  measured: readonly Measured[],
  served: ReadonlySet<string>,
): FitRow[] {
  return measured.map((item) => {
    const content = Math.max(1, Math.ceil(item.contentHeight))
    const viewport =
      Math.ceil(item.renderedHeight) !== Math.max(content, item.box.height)
    return {
      page: item.page,
      frame: item.frame,
      height: item.box.height,
      fitted: viewport ? item.box.height : content,
      wide: item.contentWidth > item.box.width,
      font: !served.has(item.family),
      viewport,
      family: item.family,
    }
  })
}

/** Whether a row asks anything of the operator or the session. */
export function isOwed(row: FitRow): boolean {
  return row.fitted !== row.height || row.wide || row.font || row.viewport
}

export type FitOutcome =
  | {
      readonly ok: true
      readonly rows: readonly FitRow[]
      /** Whether heights were written, which is false under a check. */
      readonly written: boolean
    }
  | ContentRefused
  | ServeRefused

export interface FitDeps extends Pick<CaptureDeps, 'start'> {
  /** What a test stands in for, which the command never passes. */
  readonly measure?: (targets: readonly MeasureTarget[]) => Promise<Measured[]>
}

export interface MeasureTarget {
  readonly page: string
  readonly frame: string
  readonly url: string
  readonly box: Box
}

/**
 * Loads each frame at its box width through the served address, which is what
 * injects the tokens and the faces, and reads the document once fonts and the
 * load event have settled, the moment a capture waits for. The content is read
 * at a one pixel tall viewport, since a document shorter than the viewport
 * reports the viewport and a frame could then never shrink. The viewport then
 * takes the box height and the document is read again, which is what a viewer
 * draws and what shows a height set in viewport units.
 */
async function measureInBrowser(
  targets: readonly MeasureTarget[],
): Promise<Measured[]> {
  const { chromium } = await import('playwright-core')
  const browser = await chromium.launch()
  try {
    const measured: Measured[] = []
    for (const target of targets) {
      const page = await browser.newPage({
        viewport: { width: target.box.width, height: 1 },
      })
      try {
        await page.goto(target.url, { waitUntil: 'load' })
        const read = await page.evaluate(async () => {
          await document.fonts.ready
          const root = document.documentElement
          const family = getComputedStyle(document.body).fontFamily
          return {
            contentHeight: root.scrollHeight,
            contentWidth: root.scrollWidth,
            family,
          }
        })
        await page.setViewportSize({
          width: target.box.width,
          height: target.box.height,
        })
        const renderedHeight = await page.evaluate(
          () => document.documentElement.scrollHeight,
        )
        measured.push({
          page: target.page,
          frame: target.frame,
          box: target.box,
          contentHeight: read.contentHeight,
          contentWidth: read.contentWidth,
          renderedHeight,
          family: firstFamily(read.family),
        })
      } finally {
        await page.close()
      }
    }
    return measured
  } finally {
    await browser.close()
  }
}

/** The first entry of a computed `font-family` list, without its quotes. */
export function firstFamily(list: string): string {
  const first = list.split(',')[0] ?? ''
  return first.trim().replace(/^["']|["']$/g, '')
}

/**
 * Measures the frames `spec` names and, unless `write` is false, sets each
 * box's height to its content through `resizeFrame`, the writer the operator's
 * drags share. Serves the canvas for the call, so it needs no running board.
 */
export async function fitCanvas(
  root: string,
  spec: string,
  write: boolean,
  deps: FitDeps = {},
): Promise<FitOutcome> {
  const early = resolveCaptureTargets(root, spec, '')
  if (!early.ok) return early

  const served = await serveCanvas(root, deps.start, async (base) => {
    const resolved = resolveCaptureTargets(root, spec, base)
    if (!resolved.ok) return resolved
    const frames = readPage(root, resolved.targets[0]?.page ?? '')?.frames ?? []

    const targets: MeasureTarget[] = []
    for (const item of resolved.targets) {
      const frame = frames.find((candidate) => candidate.name === item.frame)
      if (!frame) continue
      targets.push({
        page: item.page,
        frame: item.frame,
        url: item.url,
        box: {
          x: frame.x,
          y: frame.y,
          width: frame.width,
          height: frame.height,
        },
      })
    }
    const measure = deps.measure ?? measureInBrowser
    return { ok: true as const, targets, measured: await measure(targets) }
  })
  if (!served.ok) return served

  const rows = planFit(
    served.measured,
    servedFamilies(resolveFrameTokens(root).css),
  )
  if (!write) return { ok: true, rows, written: false }

  for (const row of rows.filter((item) => item.fitted !== item.height)) {
    const target = served.targets.find((item) => item.frame === row.frame)
    if (!target) continue
    const outcome = resizeFrame(root, row.page, row.frame, {
      ...target.box,
      height: row.fitted,
    })
    if (!outcome.ok) return outcome
  }
  return { ok: true, rows, written: true }
}
