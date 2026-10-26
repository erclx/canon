import { spawn } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { CameraTrack } from '@/take/camera'
import { finished } from '@/take/encode'
import type { FilmedBeat } from '@/take/film'
import { FPS } from '@/take/log'
import { type Frame, drawPointer } from '@/take/pointer'

/**
 * Joins a take's beats into one short reel for a pull request: each beat's
 * clip shrunk to one width, every third frame kept, the pointer drawn from its
 * camera track, encoded as an animated WebP that GitHub plays inline. It
 * draws the pointer and nothing else, since the zoom, captions, and cuts are
 * the edit's work for a launch video.
 */

export const REEL_WIDTH = 960

/** How many take frames each reel frame stands for, 60 fps down to 20. */
export const REEL_EVERY = 3

export const REEL_FPS = FPS / REEL_EVERY

/** WebP quality, measured at about 1.4 MB for a 9 s reel at this width. */
const QUALITY = 60

export interface ReelFrame extends Frame {
  /** Which beat of the take, in plan order. */
  readonly beat: number
  /** The frame's place in its beat, which draws camera frame `index * REEL_EVERY`. */
  readonly index: number
}

export interface Reel {
  readonly file: string
  readonly frames: number
  readonly seconds: number
  readonly bytes: number
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
    const camera = JSON.parse(
      readFileSync(join(out, filmed.camera), 'utf8'),
    ) as CameraTrack
    const { width, height } = reelSize(camera)
    // The camera is in CSS pixels of the page, and every route's clip shrinks
    // to the same width, so one factor places the pointer on either.
    const factor = width / camera.viewport.width

    let index = 0
    for await (const data of decode(join(out, filmed.clip), width, height)) {
      const at =
        camera.frames[Math.min(index * REEL_EVERY, camera.frames.length - 1)]
      const frame = { data, width, height, beat, index }
      if (at) {
        drawPointer(
          frame,
          { x: at.cursor.x * factor, y: at.cursor.y * factor },
          at.ring,
        )
      }
      yield frame
      index += 1
    }
  }
}

/** Renders the reel of a filmed take to `file`, an animated WebP. */
export async function renderReel(
  out: string,
  beats: readonly FilmedBeat[],
  file: string,
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
      '-quality',
      String(QUALITY),
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

/** Decodes every `REEL_EVERY`th frame of a clip as RGBA at the reel's size. */
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
