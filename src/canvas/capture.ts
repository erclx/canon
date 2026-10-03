import { join } from 'node:path'
import type { CaptureResult } from '@/capture/render'
import { type ContentRefused, type Frame, readPage } from '@/canvas/content'
import { FRAMES_PREFIX, startCanvas } from '@/canvas/server'
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
      readonly reason: 'no-server'
      readonly detail: string
    }

/**
 * Serves the canvas for the length of the call and captures through it, so the
 * run needs no `canon canvas serve` and still never reads the raw file. The
 * port is whatever is free, which keeps it clear of a canvas already running.
 */
export async function captureCanvas(
  root: string,
  spec: string,
  out?: string,
): Promise<CaptureOutcome> {
  /*
   * Refused before the server starts, since starting it creates the canvas
   * folder and a refused capture should leave the project as it found it.
   */
  const early = resolveCaptureTargets(root, spec, '')
  if (!early.ok) return early

  const server = startCanvas(root, { port: 0, shell: new Response('') })
  if (!server.ok) {
    return {
      ok: false,
      reason: 'no-server',
      detail: `${server.detail}, so run canon canvas serve and capture again`,
    }
  }

  try {
    const resolved = resolveCaptureTargets(root, spec, server.url, out)
    if (!resolved.ok) return resolved

    const { captureSources } = await import('@/capture/render')
    const captures: { target: CaptureTarget; result: CaptureResult }[] = []
    for (const target of resolved.targets) {
      const [result] = await captureSources(target.url, {
        selector: CAPTURE_SELECTOR,
        width: target.width,
        outDir: target.pngPath,
      })
      if (result) captures.push({ target, result })
    }
    return { ok: true, captures }
  } finally {
    await server.stop()
  }
}
