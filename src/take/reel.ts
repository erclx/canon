import { spawn } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { type CameraTrack, cameraTrack } from '@/take/camera'
import { finished } from '@/take/encode'
import type { FilmedBeat } from '@/take/film'
import { FPS, type Point, readTakeLog } from '@/take/log'
import { type Frame, drawPointer } from '@/take/pointer'

/**
 * Joins a take's beats into one short reel for a pull request: each beat's
 * clip cropped to a camera built for the reel and shrunk to one width, every
 * third frame kept, the pointer drawn through the same view, encoded as an
 * animated WebP that GitHub plays inline. Captions and cuts stay the edit's
 * work for a launch video.
 */

export const REEL_WIDTH = 960

/**
 * How deep the reel's camera zooms, the deepest a 1920-wide decode reaches at
 * `REEL_WIDTH` with no upscale, so a CSS pixel takes a whole reel pixel at the
 * hold and a 2 px focus ring draws at 2.
 */
export const REEL_DEPTH = 2

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
  /** Where the pointer's tip was drawn, in reel pixels. */
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
): AsyncGenerator<ReelFrame> {
  for (const [beat, filmed] of beats.entries()) {
    const camera = reelCamera(out, filmed)
    const { width, height } = reelSize(camera)
    // Every route's clip decodes at the viewport's size, one pixel to a CSS
    // pixel, so one crop places the view and the pointer on either.
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
      const view = snapped(at ?? { scale: 1, x: 0, y: 0 })
      const cursor = at?.cursor ?? { x: 0, y: 0 }
      const pointer = {
        x: (cursor.x - view.x) * view.scale * factor,
        y: (cursor.y - view.y) * view.scale * factor,
      }
      const ring = at?.ring ?? null
      const frame = {
        data: crop({ data, ...source }, view, width, height),
        width,
        height,
        beat,
        index,
        pointer,
        ring,
      }
      if (at) drawPointer(frame, pointer, ring)
      yield frame
      index += 1
    }
  }
}

/**
 * The beat's camera rebuilt from its log at the reel's depth, rather than read
 * from `camera.json`, which keeps the launch depth an edit at 1920 reads.
 */
function reelCamera(out: string, filmed: FilmedBeat): CameraTrack {
  const read = readTakeLog(readFileSync(join(out, filmed.log), 'utf8'))
  if (read.kind === 'refused') {
    throw new Error(`${filmed.log} is not a take's log.json: ${read.detail}`)
  }
  return cameraTrack(read.log, {
    depth: REEL_DEPTH,
    outputWidth: REEL_WIDTH,
    focus: true,
  })
}

/**
 * The view moved onto whole source pixels, so a held zoom at `REEL_DEPTH`
 * copies the clip pixel for pixel rather than blending each pixel with its
 * neighbor and softening a thin ring.
 */
function snapped(view: View): View {
  return { scale: view.scale, x: Math.round(view.x), y: Math.round(view.y) }
}

/**
 * The part of `source` the view shows, resampled to `width` by `height` by
 * averaging the source pixels each output pixel covers, the same area filter
 * the decoder shrinks with. It runs one axis at a time, since a per-pixel
 * two-dimensional sum costs a frame several times more.
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
 * lossless, since the lossy encoder skips a frame whose change is faint and
 * never repaints the last copy of an element that faded out. A reel past
 * `maxBytes` is encoded again lossy so a long reel still posts.
 */
export async function renderReel(
  out: string,
  beats: readonly FilmedBeat[],
  file: string,
  maxBytes: number = REEL_MAX_BYTES,
): Promise<Reel> {
  const lossless = await encode(out, beats, file, true)
  if (lossless.bytes <= maxBytes) return { ...lossless, lossless: true }
  return { ...(await encode(out, beats, file, false)), lossless: false }
}

async function encode(
  out: string,
  beats: readonly FilmedBeat[],
  file: string,
  lossless: boolean,
): Promise<Reel> {
  const first = beats[0]
  if (!first) throw new Error('a reel needs at least one filmed beat')
  const { width, height } = reelSize(
    JSON.parse(readFileSync(join(out, first.camera), 'utf8')) as CameraTrack,
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
  // Held so an encoder that dies mid-stream surfaces through `done` rather than
  // as an unhandled rejection or a broken pipe thrown out of the stream.
  done.catch(() => {})
  proc.stdin?.on('error', () => {})

  let frames = 0
  try {
    for await (const frame of reelFrames(out, beats)) {
      // Raced against the exit, since a write waiting on a drain from an
      // encoder that already died would wait forever.
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
  }
}

function reelSize(camera: CameraTrack): { width: number; height: number } {
  const height =
    Math.round(
      (REEL_WIDTH * camera.viewport.height) / camera.viewport.width / 2,
    ) * 2
  return { width: REEL_WIDTH, height }
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
