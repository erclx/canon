import { spawnSync } from 'node:child_process'
import { FPS, VIEWPORT } from '@/take/log'
import { findShell } from '@/take/shell'

/**
 * What the film e2e suites share. Each suite films real takes of a served page
 * and reads the clip back, because the properties the stepper exists for are
 * visible only in the pixels it wrote.
 *
 * The suites need chrome-headless-shell and FFmpeg and skip without either.
 * The E2E Suites job in verify.yml installs both and fails before any suite
 * starts when one is missing.
 */

export const FRAME_MS = 1000 / FPS

/**
 * The stall limit the stepped takes run under, four times the product's, since
 * a frame on a loaded suite can pass 2 s on a page that steps fine.
 */
export const LOADED_STALL_MS = 8000

export function html(body: string): Response {
  return new Response(body, { headers: { 'content-type': 'text/html' } })
}

export function available(): boolean {
  try {
    findShell()
  } catch {
    return false
  }
  return spawnSync('ffmpeg', ['-version']).status === 0
}

export function probe(clip: string): {
  width: number
  height: number
  rate: string
} {
  const out = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height,r_frame_rate',
      '-of',
      'json',
      clip,
    ],
    { encoding: 'utf8' },
  ).stdout
  const [stream] = (
    JSON.parse(out) as {
      streams: { width: number; height: number; r_frame_rate: string }[]
    }
  ).streams
  if (!stream) throw new Error(`no video stream in ${clip}`)
  return {
    width: stream.width,
    height: stream.height,
    rate: stream.r_frame_rate,
  }
}

/**
 * The band's stored luma in each frame, TV range, 16 for black and 235 for
 * white. Read raw rather than converted to gray, since that conversion
 * stretches the range and clips the first and last steps of the fade.
 *
 * `crop` is `width:height:x:y` in CSS pixels, and is scaled to the clip's own
 * size so one crop reads the same place on a clip filmed at either device scale.
 */
export function bandLuma(media: string, crop = '8:8:100:500'): number[] {
  const scale = probe(media).width / VIEWPORT.width
  const scaled = crop
    .split(':')
    .map((part) => Number(part) * scale)
    .join(':')
  const raw = spawnSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-i',
      media,
      '-vf',
      // The still is full range and the clip TV range. From FFmpeg 7.1 a
      // conversion to yuv420p keeps the source range, so name the target.
      `crop=${scaled},scale=2:2:flags=area:out_range=tv`,
      '-pix_fmt',
      'yuv420p',
      '-f',
      'rawvideo',
      '-',
    ],
    { maxBuffer: 64 * 1024 * 1024 },
  ).stdout
  // Each 2x2 frame is four luma bytes, then one byte each of the two chroma planes.
  return [...raw].filter((_, index) => index % 6 === 0)
}
