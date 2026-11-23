import { spawn } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { type CameraTrack, cameraTrack } from '@/take/camera'
import { finished } from '@/take/encode'
import type { FilmedBeat } from '@/take/film'
import { FPS, type Point, type TakeLog, readTakeLog } from '@/take/log'
import type { Viewport } from '@/take/plan'
import { type Frame, drawPointer } from '@/take/pointer'

/**
 * Joins a take's beats into one short reel for a pull request: each clip cropped
 * to a reel camera, shrunk to one width, every third frame kept, the pointer
 * drawn through the same view, and encoded as an animated WebP GitHub plays inline.
 */

export const REEL_WIDTH = 960

/** The narrowest reel `--reel-width` allows, the floor `--viewport` holds a window to. */
export const MIN_REEL_WIDTH = 320

/**
 * How deep the reel's camera zooms, the deepest a 1920-wide decode reaches at
 * `REEL_WIDTH` with no upscale, so a CSS pixel takes a whole reel pixel at the
 * hold and a 2 px focus ring draws at 2. A wider reel zooms less, per `reelDepth`.
 */
export const REEL_DEPTH = 2

/**
 * The depth a reel `width` wide zooms to over a decode `source` wide. Past the
 * default width it is lowered until the hold copies whole source pixels, and
 * at or under it stays `REEL_DEPTH`, so an existing reel is written as before.
 */
export function reelDepth(source: number, width: number): number {
  return width > REEL_WIDTH ? Math.min(REEL_DEPTH, source / width) : REEL_DEPTH
}

/** How many take frames each reel frame stands for, 60 fps down to 20. */
export const REEL_EVERY = 3

export const REEL_FPS = FPS / REEL_EVERY

/** The most GitHub renders inline as an image in a comment. */
export const REEL_MAX_BYTES = 10_000_000

/**
 * Quality of the lossy fallback, measured at about 1.4 MB for a 9 s reel at
 * this width. It skips frames whose change is faint, so a fade-out can leave a
 * ghost, and the fallback exists only to keep a long reel under the cap.
 */
const LOSSY_QUALITY = 60

export interface ReelFrame extends Frame {
  /** Which beat of the take, in plan order. */
  readonly beat: number
  /** The frame's place in its beat, which draws camera frame `index * REEL_EVERY`. */
  readonly index: number
  /**
   * Where the pointer's tip was drawn, in reel pixels, or would sit on a beat
   * no hand drives, which draws none.
   */
  readonly pointer: Point
  /** How far the click ring had expanded, 0 to 1, or null with none drawn. */
  readonly ring: number | null
}

/** The part of the page a reel frame shows, as `CameraFrame` places it. */
interface View {
  readonly scale: number
  readonly x: number
  readonly y: number
}

export interface Reel {
  readonly file: string
  readonly frames: number
  readonly seconds: number
  readonly bytes: number
  /** The size the reel was written at, in pixels. */
  readonly width: number
  readonly height: number
  /** False when the reel passed the cap lossless and was encoded again lossy. */
  readonly lossless?: boolean
}

/**
 * Yields every reel frame in order with the pointer drawn on it. The decoder
 * keeps frames by index rather than by timestamp, since an `fps` filter that
 * rounds timestamps drifts the pointer off what it pressed.
 */
export async function* reelFrames(
  out: string,
  beats: readonly FilmedBeat[],
  reelWidth: number = REEL_WIDTH,
): AsyncGenerator<ReelFrame> {
  for (const [beat, filmed] of beats.entries()) {
    const camera = reelCamera(beatLog(out, filmed), reelWidth)
    const { width, height } = reelSize(camera, reelWidth)
    // Every route's clip decodes at the viewport's size, so one crop places the view and pointer on either.
    const source = camera.viewport
    const factor = width / source.width

    let index = 0
    for await (const data of decode(
      join(out, filmed.clip),
      source.width,
      source.height,
    )) {
      const at =
        camera.frames[Math.min(index * REEL_EVERY, camera.frames.length - 1)]
      const view = snapped(at ?? { scale: 1, x: 0, y: 0 }, source)
      const cursor = at?.cursor ?? { x: 0, y: 0 }
      const pointer = {
        x: (cursor.x - view.x) * view.scale * factor,
        y: (cursor.y - view.y) * view.scale * factor,
      }
      const hand = camera.hand !== false
      const ring = hand ? (at?.ring ?? null) : null
      const frame = {
        data: crop({ data, ...source }, view, width, height),
        width,
        height,
        beat,
        index,
        pointer,
        ring,
      }
      if (at && hand) drawPointer(frame, pointer, ring)
      yield frame
      index += 1
    }
  }
}

/**
 * The beat's camera rebuilt from its log at the reel's depth, rather than read
 * from `camera.json`, which keeps the launch depth an edit at 1920 reads.
 */
export function reelCamera(log: TakeLog, width: number): CameraTrack {
  return cameraTrack(log, {
    depth: reelDepth(log.viewport.width, width),
    outputWidth: width,
    focus: true,
  })
}

function beatLog(out: string, filmed: FilmedBeat): TakeLog {
  const read = readTakeLog(readFileSync(join(out, filmed.log), 'utf8'))
  if (read.kind === 'refused') {
    throw new Error(`${filmed.log} is not a take's log.json: ${read.detail}`)
  }
  return read.log
}

/**
 * Names the first beat whose window differs in aspect ratio from the first beat's,
 * or nothing. A reel shrinks each beat to one width, so beats of two shapes
 * would make frames of two heights.
 */
export function reelShapeMismatch(
  beats: readonly { readonly name: string; readonly viewport: Viewport }[],
): string | undefined {
  const [first, ...rest] = beats
  if (!first) return undefined
  const { width, height } = first.viewport
  const differing = rest.find(
    ({ viewport }) => viewport.width * height !== width * viewport.height,
  )
  if (!differing) return undefined
  const size = (viewport: Viewport) => `${viewport.width}x${viewport.height}`
  return `${differing.name} films a ${size(differing.viewport)} window, not the shape of ${first.name}'s ${size(first.viewport)}, so a reel cannot join them`
}

/**
 * Reads `--reel-width`, capped at the narrowest window since a clip decodes at
 * its window and a wider reel would upscale it. Even, since the encoder refuses odd.
 */
export function readReelWidth(
  text: string,
  windows: readonly Viewport[],
): { kind: 'read'; width: number } | { kind: 'refused'; detail: string } {
  if (!/^\d+$/.test(text.trim())) {
    return {
      kind: 'refused',
      detail: `${text} is not a whole number of pixels, such as 1180`,
    }
  }
  const width = Number(text)
  if (width % 2 !== 0) {
    return {
      kind: 'refused',
      detail: `${width} is odd, and a reel width is even`,
    }
  }
  if (width < MIN_REEL_WIDTH) {
    return {
      kind: 'refused',
      detail: `${width} is under the ${MIN_REEL_WIDTH} px floor`,
    }
  }
  const narrowest = Math.min(...windows.map((window) => window.width))
  if (width > narrowest) {
    return {
      kind: 'refused',
      detail: `${width} is wider than the narrowest window filmed, ${narrowest} px, so the reel would upscale it`,
    }
  }
  return { kind: 'read', width }
}

/**
 * The view moved onto whole source pixels, so a held zoom copies the clip pixel
 * for pixel rather than softening a thin ring. It stays inside the source, since
 * a rounded origin past the far edge leaves the last pixels short of weight.
 */
function snapped(
  view: View,
  source: { readonly width: number; readonly height: number },
): View {
  const axis = (origin: number, size: number) =>
    Math.min(
      Math.max(Math.round(origin), 0),
      Math.floor(size - size / view.scale),
    )
  return {
    scale: view.scale,
    x: axis(view.x, source.width),
    y: axis(view.y, source.height),
  }
}

/**
 * The part of `source` the view shows, resampled to `width` by `height` by
 * averaging the source pixels each output pixel covers. It runs one axis at a
 * time, since a per-pixel two-dimensional sum costs a frame several times more.
 */
function crop(source: Frame, view: View, width: number, height: number) {
  const columns = taps(view.x, source.width / view.scale, width, source.width)
  const rows = taps(view.y, source.height / view.scale, height, source.height)
  const top = rows.first[0] ?? 0
  const bottom = (rows.first[height - 1] ?? 0) + rows.stride
  const span = Math.min(bottom, source.height) - top

  // Each needed source row narrowed to the output width.
  const narrowed = new Float32Array(span * width * 4)
  for (let row = 0; row < span; row += 1) {
    const from = (top + row) * source.width * 4
    const to = row * width * 4
    for (let col = 0; col < width; col += 1) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      const first = columns.first[col] ?? 0
      for (let k = 0; k < columns.stride; k += 1) {
        const weight = columns.weights[col * columns.stride + k] ?? 0
        if (weight === 0) continue
        const at = from + (first + k) * 4
        r += (source.data[at] ?? 0) * weight
        g += (source.data[at + 1] ?? 0) * weight
        b += (source.data[at + 2] ?? 0) * weight
        a += (source.data[at + 3] ?? 0) * weight
      }
      const out = to + col * 4
      narrowed[out] = r
      narrowed[out + 1] = g
      narrowed[out + 2] = b
      narrowed[out + 3] = a
    }
  }

  const data = new Uint8Array(width * height * 4)
  for (let row = 0; row < height; row += 1) {
    const first = (rows.first[row] ?? 0) - top
    for (let col = 0; col < width; col += 1) {
      for (let c = 0; c < 4; c += 1) {
        let sum = 0
        for (let k = 0; k < rows.stride; k += 1) {
          const weight = rows.weights[row * rows.stride + k] ?? 0
          if (weight === 0) continue
          sum += (narrowed[((first + k) * width + col) * 4 + c] ?? 0) * weight
        }
        data[(row * width + col) * 4 + c] = Math.round(sum)
      }
    }
  }
  return data
}

/**
 * For each of `count` output pixels along one axis, the first source pixel it
 * covers and the share each covered pixel adds, over a view `span` source
 * pixels long from `origin`, kept inside the `limit` pixels the source has.
 */
function taps(
  origin: number,
  span: number,
  count: number,
  limit: number,
): { first: Int32Array; weights: Float32Array; stride: number } {
  const step = span / count
  const stride = Math.ceil(step) + 1
  const first = new Int32Array(count)
  const weights = new Float32Array(count * stride)
  for (let i = 0; i < count; i += 1) {
    const low = origin + i * step
    const high = low + step
    const start = Math.min(Math.max(Math.floor(low), 0), limit - stride)
    first[i] = start
    for (let k = 0; k < stride; k += 1) {
      const pixel = start + k
      const overlap = Math.min(high, pixel + 1) - Math.max(low, pixel)
      if (overlap > 0) weights[i * stride + k] = overlap / step
    }
  }
  return { first, weights, stride }
}

/**
 * Renders the reel of a filmed take to `file`, an animated WebP. It encodes
 * lossless, since the lossy encoder never repaints the last copy of a faded-out
 * element, and re-encodes lossy past `maxBytes` so a long reel still posts.
 */
export async function renderReel(
  out: string,
  beats: readonly FilmedBeat[],
  file: string,
  maxBytes: number = REEL_MAX_BYTES,
  width: number = REEL_WIDTH,
): Promise<Reel> {
  const mismatch = reelShapeMismatch(
    beats.map((filmed) => ({
      name: filmed.name,
      viewport: beatLog(out, filmed).viewport,
    })),
  )
  if (mismatch) throw new Error(mismatch)
  const lossless = await encode(out, beats, file, true, width)
  if (lossless.bytes <= maxBytes) return { ...lossless, lossless: true }
  return { ...(await encode(out, beats, file, false, width)), lossless: false }
}

async function encode(
  out: string,
  beats: readonly FilmedBeat[],
  file: string,
  lossless: boolean,
  reelWidth: number,
): Promise<Reel> {
  const first = beats[0]
  if (!first) throw new Error('a reel needs at least one filmed beat')
  const { width, height } = reelSize(
    JSON.parse(readFileSync(join(out, first.camera), 'utf8')) as CameraTrack,
    reelWidth,
  )

  const proc = spawn(
    'ffmpeg',
    [
      '-y',
      '-loglevel',
      'error',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgba',
      '-s',
      `${width}x${height}`,
      '-framerate',
      String(REEL_FPS),
      '-i',
      '-',
      '-c:v',
      'libwebp_anim',
      ...(lossless ? ['-lossless', '1'] : ['-quality', String(LOSSY_QUALITY)]),
      '-loop',
      '0',
      '-f',
      'webp',
      file,
    ],
    { stdio: ['pipe', 'ignore', 'pipe'] },
  )
  const done = finished(proc)
  // Held so an encoder that dies mid-stream surfaces through `done` rather than as a broken pipe.
  done.catch(() => {})
  proc.stdin?.on('error', () => {})

  let frames = 0
  try {
    for await (const frame of reelFrames(out, beats, reelWidth)) {
      // Raced against the exit, since a write awaiting a drain from a dead encoder would wait forever.
      await Promise.race([write(proc.stdin, frame.data), done])
      frames += 1
    }
  } catch (error) {
    proc.kill('SIGKILL')
    throw error
  }
  proc.stdin?.end()
  await done

  return {
    file,
    frames,
    seconds: Number((frames / REEL_FPS).toFixed(2)),
    bytes: statSync(file).size,
    width,
    height,
  }
}

function reelSize(
  camera: CameraTrack,
  width: number,
): { width: number; height: number } {
  const height =
    Math.round((width * camera.viewport.height) / camera.viewport.width / 2) * 2
  return { width, height }
}

/** Decodes every `REEL_EVERY`th frame of a clip as RGBA at the given size. */
async function* decode(
  clip: string,
  width: number,
  height: number,
): AsyncGenerator<Uint8Array> {
  const proc = spawn(
    'ffmpeg',
    [
      '-loglevel',
      'error',
      '-i',
      clip,
      '-vf',
      `select='not(mod(n\\,${REEL_EVERY}))',scale=${width}:${height}:flags=area`,
      '-fps_mode',
      'passthrough',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgba',
      '-',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  )
  const done = finished(proc)
  done.catch(() => {})

  const size = width * height * 4
  let pending: Buffer = Buffer.alloc(0)
  let drained = false
  try {
    for await (const chunk of proc.stdout as AsyncIterable<Buffer>) {
      pending = pending.length ? Buffer.concat([pending, chunk]) : chunk
      while (pending.length >= size) {
        // Copied out, since the frame is drawn on and outlives the chunk.
        yield new Uint8Array(pending.subarray(0, size))
        pending = pending.subarray(size)
      }
    }
    drained = true
  } finally {
    // A reader that stopped early leaves FFmpeg decoding into a full pipe.
    if (!drained) proc.kill('SIGKILL')
  }
  await done
}

function write(
  stdin: NodeJS.WritableStream | null,
  data: Uint8Array,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!stdin) {
      reject(new Error('ffmpeg stopped reading frames'))
      return
    }
    if (stdin.write(data)) resolve()
    else stdin.once('drain', () => resolve())
  })
}
