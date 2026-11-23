import { PNG } from 'pngjs'
import { SANDBOXED } from '@/browser/engine'

/**
 * Reads frames back out of a reel `canon take --reel` wrote, the reading half of
 * `src/take/reel.ts`. The container is read here off its chunks, since FFmpeg
 * decodes no animated WebP, and the pixels are decoded by the headless Chromium
 * the filming path already installs, one frame by index through the browser's
 * `ImageDecoder` rather than a timed capture of a playing animation.
 */

export const DEFAULT_STILLS = 4

export interface ReelFrame {
  /** Where the frame sits in the reel, from 0. */
  readonly index: number
  /** Milliseconds from the reel's start to this frame's first showing. */
  readonly ms: number
}

export interface ReelInfo {
  readonly width: number
  readonly height: number
  readonly frames: readonly ReelFrame[]
}

export type ReelRead =
  | { readonly kind: 'read'; readonly reel: ReelInfo }
  | { readonly kind: 'refused'; readonly detail: string }

const NOT_ANIMATED = 'is not an animated WebP, as `canon take --reel` writes'

/**
 * Reads the canvas size and each frame's start from the container's chunks.
 * A frame identical to the last folds into its duration at encode, so these
 * are the frames written rather than a count at the reel's frame rate.
 */
export function readReel(bytes: Buffer): ReelRead {
  if (
    bytes.length < 12 ||
    bytes.toString('ascii', 0, 4) !== 'RIFF' ||
    bytes.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    return { kind: 'refused', detail: `the file ${NOT_ANIMATED}` }
  }
  let width = 0
  let height = 0
  let animated = false
  let ms = 0
  const frames: ReelFrame[] = []
  for (let at = 12; at + 8 <= bytes.length; ) {
    const kind = bytes.toString('ascii', at, at + 4)
    const size = bytes.readUInt32LE(at + 4)
    const body = at + 8
    if (body + size > bytes.length) {
      return { kind: 'refused', detail: 'the file ends inside a chunk' }
    }
    if (kind === 'VP8X') {
      animated = (bytes[body] ?? 0) & 0x02 ? true : false
      width = bytes.readUIntLE(body + 4, 3) + 1
      height = bytes.readUIntLE(body + 7, 3) + 1
    }
    if (kind === 'ANMF') {
      frames.push({ index: frames.length, ms })
      ms += bytes.readUIntLE(body + 12, 3)
    }
    at = body + size + (size % 2)
  }
  if (!animated || frames.length === 0) {
    return { kind: 'refused', detail: `the file ${NOT_ANIMATED}` }
  }
  return { kind: 'read', reel: { width, height, frames } }
}

/**
 * Picks `count` frame indices spaced evenly across `total`, the first and the
 * last included, each once. A count at or over `total` is every frame, and a
 * count of one is the first.
 */
export function pickFrames(total: number, count: number): number[] {
  if (total <= 0 || count <= 0) return []
  if (count >= total) return Array.from({ length: total }, (_, i) => i)
  if (count === 1) return [0]
  return Array.from({ length: count }, (_, i) =>
    Math.round((i * (total - 1)) / (count - 1)),
  )
}

export const SHEET_COLUMNS = 2

/**
 * Lays the stills out left to right, `SHEET_COLUMNS` to a row, in one image the
 * size of the grid, so a session compares several reels at a glance. Every still
 * of a reel is one size, so each takes a whole cell.
 */
export function composeSheet(stills: readonly Buffer[]): Buffer {
  const decoded = stills.map((still) => PNG.sync.read(still))
  const first = decoded[0]
  if (!first) throw new Error('a sheet needs at least one still')
  const columns = Math.min(SHEET_COLUMNS, decoded.length)
  const rows = Math.ceil(decoded.length / columns)
  const sheet = new PNG({
    width: first.width * columns,
    height: first.height * rows,
  })
  decoded.forEach((still, i) => {
    PNG.bitblt(
      still,
      sheet,
      0,
      0,
      first.width,
      first.height,
      (i % columns) * first.width,
      Math.floor(i / columns) * first.height,
    )
  })
  return PNG.sync.write(sheet)
}

/**
 * Runs in the page. `ImageDecoder` reads a frame by index, which a timed capture
 * of a playing animation cannot, and it needs a secure origin, so the page is
 * served from a routed https address rather than opened blank or from disk.
 */
const DECODE_SCRIPT = `async ({ base64, indices }) => {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  const decoder = new ImageDecoder({ data: bytes, type: 'image/webp' })
  await decoder.tracks.ready
  const read = (blob) =>
    new Promise((done) => {
      const reader = new FileReader()
      reader.onload = () => done(String(reader.result).split(',')[1])
      reader.readAsDataURL(blob)
    })
  const out = []
  for (const frameIndex of indices) {
    const { image } = await decoder.decode({ frameIndex, completeFramesOnly: true })
    const canvas = new OffscreenCanvas(image.displayWidth, image.displayHeight)
    canvas.getContext('2d').drawImage(image, 0, 0)
    image.close()
    out.push(await read(await canvas.convertToBlob({ type: 'image/png' })))
  }
  return out
}`

const PAGE_ORIGIN = 'https://reel.invalid/'

/**
 * Decodes the frames at `indices` of a reel as PNGs, in the order asked. The
 * browser is imported here rather than at the top, since `src/commands/take.ts`
 * imports this module at startup and a target without the engine must still load.
 */
export async function decodeFrames(
  bytes: Buffer,
  indices: readonly number[],
): Promise<Buffer[]> {
  const { chromium } = await import('playwright-core')
  const browser = await chromium.launch({ ...SANDBOXED })
  try {
    const page = await browser.newPage()
    await page.route(PAGE_ORIGIN, (route) =>
      route.fulfill({ contentType: 'text/html', body: '<!doctype html>' }),
    )
    await page.goto(PAGE_ORIGIN)
    const base64 = bytes.toString('base64')
    const decoded = (await page.evaluate(
      `(${DECODE_SCRIPT})(${JSON.stringify({ base64, indices })})`,
    )) as string[]
    return decoded.map((png) => Buffer.from(png, 'base64'))
  } finally {
    await browser.close()
  }
}
