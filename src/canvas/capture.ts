import { mkdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import type { CaptureResult } from '@/capture/render'
import { type ContentRefused, type Frame, readPage } from '@/canvas/content'
import {
  type CanvasOptions,
  type CanvasOutcome,
  FRAMES_PREFIX,
  startCanvas,
} from '@/canvas/server'
import { recordDir } from '@/record-root'

/**
 * The element a frame is captured by. The document rather than its body, so a
 * frame that paints its background on the root is not cropped to the body's
 * box.
 */
export const CAPTURE_SELECTOR = 'html'

export interface CaptureTarget {
  readonly page: string
  readonly frame: string
  /** The served address, which is what carries the injected tokens. */
  readonly url: string
  /** The viewport width, so a media query resolves at the frame's own width. */
  readonly width: number
  readonly pngPath: string
}

export type TargetsOutcome =
  | { readonly ok: true; readonly targets: readonly CaptureTarget[] }
  | ContentRefused

function refuse(
  reason: ContentRefused['reason'],
  detail: string,
): ContentRefused {
  return { ok: false, reason, detail }
}

function frameUrl(base: string, page: string, frame: Frame): string {
  return `${base}${FRAMES_PREFIX.slice(1)}${encodeURIComponent(page)}/${encodeURIComponent(frame.file)}`
}

/**
 * Turns `<page>` or `<page>/<frame>` into what to capture. Every target is a
 * served address, never the file on disk, so a capture can only show what the
 * canvas shows. The width comes from the layout and not from the window, so a
 * frame narrower than its own breakpoint renders its narrow layout.
 *
 * `out` is the PNG for a frame and a folder for a page, the way a URL source
 * reads `--out` in `canon capture`.
 */
export function resolveCaptureTargets(
  root: string,
  spec: string,
  base: string,
  out?: string,
): TargetsOutcome {
  const [pageName, frameName, ...extra] = spec.split('/')
  if (!pageName || extra.length > 0 || frameName === '') {
    return refuse('invalid-name', `${spec} is not <page> or <page>/<frame>`)
  }

  const page = readPage(root, pageName)
  if (!page) return refuse('no-page', `page ${pageName} does not exist`)

  const frames =
    frameName === undefined
      ? page.frames
      : page.frames.filter((frame) => frame.name === frameName)
  if (frames.length === 0) {
    return frameName === undefined
      ? refuse('no-frame', `page ${pageName} has no frames`)
      : refuse('no-frame', `frame ${frameName} does not exist on ${pageName}`)
  }

  const scratch = recordDir(root, 'tmp', 'canvas-capture', pageName)
  return {
    ok: true,
    targets: frames.map((frame) => ({
      page: pageName,
      frame: frame.name,
      url: frameUrl(base, pageName, frame),
      width: frame.width,
      pngPath:
        frameName !== undefined && out !== undefined
          ? out
          : join(out ?? scratch, `${frame.name}.png`),
    })),
  }
}

export type CaptureOutcome =
  | {
      readonly ok: true
      readonly captures: readonly {
        readonly target: CaptureTarget
        readonly result: CaptureResult
      }[]
    }
  | ContentRefused
  | {
      readonly ok: false
      readonly reason: 'no-server' | 'capture-failed'
      readonly detail: string
    }

type CaptureEngine = (typeof import('@/capture/render'))['captureSources']

/** What a test stands in for, which the command never passes. */
export interface CaptureDeps {
  readonly start?: (root: string, options: CanvasOptions) => CanvasOutcome
  readonly capture?: CaptureEngine
}

/**
 * Serves the canvas for the length of the call and captures through it, so the
 * run needs no `canon canvas serve` and still never reads the raw file. The
 * port is whatever is free, which keeps it clear of a canvas already running.
 * An error the engine throws, such as a browser that will not launch, comes
 * back as `capture-failed` rather than escaping, so a caller reading the record
 * can tell it from a root that is wrong.
 */
export async function captureCanvas(
  root: string,
  spec: string,
  out?: string,
  deps: CaptureDeps = {},
): Promise<CaptureOutcome> {
  /*
   * Refused before the server starts, since starting it creates the canvas
   * folder and a refused capture should leave the project as it found it.
   */
  const early = resolveCaptureTargets(root, spec, '')
  if (!early.ok) return early

  return serveFor(root, deps, async (base, capture) => {
    const resolved = resolveCaptureTargets(root, spec, base, out)
    if (!resolved.ok) return resolved

    const captures: { target: CaptureTarget; result: CaptureResult }[] = []
    for (const target of resolved.targets) {
      const [result] = await capture(target.url, {
        selector: CAPTURE_SELECTOR,
        width: target.width,
        outDir: target.pngPath,
      })
      if (result) captures.push({ target, result })
    }
    return { ok: true, captures }
  })
}

type ServeRefused = {
  readonly ok: false
  readonly reason: 'no-server' | 'capture-failed'
  readonly detail: string
}

async function serveFor<T>(
  root: string,
  deps: CaptureDeps,
  run: (base: string, capture: CaptureEngine) => Promise<T>,
): Promise<T | ServeRefused> {
  const start = deps.start ?? startCanvas
  const server = start(root, { port: 0, shell: new Response('') })
  if (!server.ok) {
    return {
      ok: false,
      reason: 'no-server',
      detail: `${server.detail}, so run canon canvas serve and capture again`,
    }
  }

  try {
    const capture =
      deps.capture ?? (await import('@/capture/render')).captureSources
    return await run(server.url, capture)
  } catch (error) {
    return {
      ok: false,
      reason: 'capture-failed',
      detail: error instanceof Error ? error.message : String(error),
    }
  } finally {
    await server.stop()
  }
}

/** The element a composite is captured by, holding every frame and no chrome. */
export const COMPOSITE_SELECTOR = '#canvas-composite'

/**
 * The container holds no text, so its family exists only for the engine's
 * font probe, which rejects a family the machine lacks. The browser default is
 * Times New Roman, which a Linux runner often lacks, and `system-ui` is the one
 * every platform maps. Each frame keeps its own fonts inside its iframe.
 */
const COMPOSITE_FONT = 'system-ui'

export interface Placement {
  readonly frame: string
  readonly url: string
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

export interface Composite {
  readonly placements: readonly Placement[]
  readonly width: number
  readonly height: number
  readonly html: string
}

/**
 * One document showing every frame of a page at its layout position. Offsets
 * run from the top left of the union of the boxes, so a negative coordinate
 * never clips and a lone frame fills the container exactly. Each iframe takes
 * its box, so a document taller than its frame clips as it does on the board,
 * and frames paint in the order given, which is the board's.
 */
export function buildComposite(
  page: string,
  frames: readonly Frame[],
  base: string,
): Composite {
  const left = Math.min(...frames.map((frame) => frame.x))
  const top = Math.min(...frames.map((frame) => frame.y))
  const right = Math.max(...frames.map((frame) => frame.x + frame.width))
  const bottom = Math.max(...frames.map((frame) => frame.y + frame.height))
  const width = right - left
  const height = bottom - top

  const placements = frames.map((frame) => ({
    frame: frame.name,
    url: frameUrl(base, page, frame),
    left: frame.x - left,
    top: frame.y - top,
    width: frame.width,
    height: frame.height,
  }))

  const iframes = placements.map(
    (p) =>
      `<iframe title="${escapeAttribute(p.frame)}" src="${escapeAttribute(p.url)}" style="left:${p.left}px;top:${p.top}px;width:${p.width}px;height:${p.height}px"></iframe>`,
  )
  const html = [
    '<!doctype html>',
    '<html><head><meta charset="utf-8">',
    `<style>html,body{margin:0;background:transparent}#canvas-composite{position:relative;font-family:${COMPOSITE_FONT}}#canvas-composite iframe{position:absolute;display:block;border:0;background:transparent}</style>`,
    '</head><body>',
    `<div id="canvas-composite" style="width:${width}px;height:${height}px">`,
    ...iframes,
    '</div></body></html>',
    '',
  ].join('\n')

  return { placements, width, height, html }
}

function escapeAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
}

export interface CompositeTarget {
  readonly page: string
  readonly composite: Composite
  /** The generated document, kept in scratch rather than beside the PNG. */
  readonly htmlPath: string
  readonly pngPath: string
}

export type CompositeTargetOutcome =
  | { readonly ok: true; readonly target: CompositeTarget }
  | ContentRefused

/**
 * Turns `<page>` into one composite. `out` is the PNG, and without it the PNG
 * lands at `<page>.png` beside the per-frame folder of the same name, so the
 * two captures of one page never collide. The engine names a file source's PNG
 * after the document, so the document takes the PNG's stem inside a dot folder
 * no page name can match.
 */
export function resolveCompositeTarget(
  root: string,
  spec: string,
  base: string,
  out?: string,
): CompositeTargetOutcome {
  if (spec.includes('/')) {
    return refuse(
      'invalid-name',
      `--composite takes a page, not ${spec}, so capture <page> or drop the flag`,
    )
  }

  const page = readPage(root, spec)
  if (!page) return refuse('no-page', `page ${spec} does not exist`)
  if (page.frames.length === 0) {
    return refuse('no-frame', `page ${spec} has no frames`)
  }

  const scratch = recordDir(root, 'tmp', 'canvas-capture')
  const pngPath = out ?? join(scratch, `${spec}.png`)
  return {
    ok: true,
    target: {
      page: spec,
      composite: buildComposite(spec, page.frames, base),
      htmlPath: join(
        scratch,
        '.composite',
        `${basename(pngPath, '.png')}.html`,
      ),
      pngPath,
    },
  }
}

export type CompositeOutcome =
  | {
      readonly ok: true
      readonly composite: {
        readonly target: CompositeTarget
        readonly result: CaptureResult
      }
    }
  | ContentRefused
  | ServeRefused

/**
 * Captures a page as one PNG through the served canvas, the way `captureCanvas`
 * captures each frame. The viewport is the container's width, so no frame's
 * media query resolves against a window narrower than the frame itself. The
 * page load the engine waits on waits on every iframe.
 */
export async function captureComposite(
  root: string,
  spec: string,
  out?: string,
  deps: CaptureDeps = {},
): Promise<CompositeOutcome> {
  const early = resolveCompositeTarget(root, spec, '')
  if (!early.ok) return early

  return serveFor(root, deps, async (base, capture) => {
    const resolved = resolveCompositeTarget(root, spec, base, out)
    if (!resolved.ok) return resolved

    const { target } = resolved
    mkdirSync(dirname(target.htmlPath), { recursive: true })
    writeFileSync(target.htmlPath, target.composite.html)
    const [result] = await capture(target.htmlPath, {
      selector: COMPOSITE_SELECTOR,
      width: target.composite.width,
      outDir: dirname(target.pngPath),
    })
    if (!result) {
      return {
        ok: false,
        reason: 'capture-failed',
        detail: `the engine rendered nothing for ${spec}`,
      }
    }
    return { ok: true, composite: { target, result } }
  })
}
