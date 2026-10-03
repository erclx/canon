import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join, parse } from 'node:path'
import { execa } from 'execa'

/**
 * A post-step on the file `@/demo/drive` already wrote. It touches neither
 * the compiler nor the driving code, which is why deferring it out of the
 * feature that shipped first cost no rework.
 */

const CONVERTER_BIN = 'ffmpeg'
export const INSTALL_CONVERTER = 'ffmpeg (see https://ffmpeg.org/download.html)'

export type ContainerResult =
  | { status: 'converted'; mp4Path: string }
  | { status: 'skipped'; reason: 'converter-missing' }
  | { status: 'failed'; reason: string }

export type GifResult =
  | { status: 'converted'; gifPath: string }
  | { status: 'skipped'; reason: 'converter-missing' }
  | { status: 'failed'; reason: string }

export type FramesResult =
  | { status: 'extracted'; framePaths: string[] }
  | { status: 'skipped'; reason: 'converter-missing' }
  | { status: 'failed'; reason: string }

export interface ExtractFramesOptions {
  readonly fps?: number
}

/**
 * Writes mp4 beside the webm rather than instead of it, since both stated use
 * cases are a `<video>` tag on a page the operator controls, where webm
 * already plays, and the social platform case is what mp4 is for.
 *
 * A missing binary is reported as skipped rather than failed. The recording
 * already succeeded, and failing the run over an optional step would discard
 * a good artifact.
 */
export async function convertToMp4(
  webmPath: string,
  bin: string = CONVERTER_BIN,
): Promise<ContainerResult> {
  const { dir, name } = parse(webmPath)
  const mp4Path = join(dir, `${name}.mp4`)

  const result = await execa(
    bin,
    [
      '-y',
      '-i',
      webmPath,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-movflags',
      '+faststart',
      mp4Path,
    ],
    { reject: false },
  )

  if (result.failed && result.code === 'ENOENT') {
    return { status: 'skipped', reason: 'converter-missing' }
  }
  if (result.exitCode !== 0) {
    return {
      status: 'failed',
      reason: result.stderr?.trim() || `ffmpeg exited ${result.exitCode}`,
    }
  }
  return { status: 'converted', mp4Path }
}

/**
 * Opt-in rather than written beside every recording, because a gif is an order
 * of magnitude larger than the webm it derives from and only one destination
 * needs one: a README on a host that strips `<video>`, which GitHub does. The
 * mp4 above is unconditional for the opposite reason, being cheap and wanted
 * wherever the webm already plays.
 *
 * A palette is generated from the source and then applied, rather than letting
 * ffmpeg quantize per frame. A per-frame palette is what makes a screen
 * recording of flat UI colors band and shimmer, which is precisely the artifact
 * that would make a page look worse in the README than it does in a browser.
 *
 * Dithering is off because this command records applications rather than
 * photographs. A global palette already covers flat interface colors, so the
 * dither only writes noise the encoder then has to store: measured at 3.19MB
 * against 2.70MB on one recording, with the same text region cropped from both
 * and read as visually identical. Width is the larger lever at 2.38MB for 800
 * pixels, and it is not taken, since the terminal rows are what the recording
 * exists to have read. Frame rate is almost no lever at all.
 *
 * The missing-binary and failure handling matches `convertToMp4` exactly: the
 * recording already succeeded by the time this runs, so an optional step never
 * fails the run.
 */
export async function convertToGif(
  webmPath: string,
  bin: string = CONVERTER_BIN,
): Promise<GifResult> {
  const { dir, name } = parse(webmPath)
  const gifPath = join(dir, `${name}.gif`)

  const result = await execa(
    bin,
    [
      '-y',
      '-i',
      webmPath,
      '-filter_complex',
      '[0:v] fps=12,scale=960:-1:flags=lanczos,split [a][b];[a] palettegen [p];[b][p] paletteuse=dither=none',
      gifPath,
    ],
    { reject: false },
  )

  if (result.failed && result.code === 'ENOENT') {
    return { status: 'skipped', reason: 'converter-missing' }
  }
  if (result.exitCode !== 0) {
    return {
      status: 'failed',
      reason: result.stderr?.trim() || `ffmpeg exited ${result.exitCode}`,
    }
  }
  return { status: 'converted', gifPath }
}

/**
 * Written beside the video by default, so frames fall under the same
 * `take` folder gitignore entry the still already uses with no new rule
 * needed. One frame a second by default, matched to the seconds-to-tens-of-
 * seconds length a tuned recording runs, without a smarter sampling strategy
 * nobody has asked for.
 *
 * The missing-binary and failure handling matches `convertToMp4` exactly: the
 * recording already succeeded by the time this runs, so an optional step
 * never fails the run.
 *
 * A prior extraction's frames are cleared before ffmpeg runs, not left for
 * `-y` to overwrite. ffmpeg's `-y` only overwrites the indices this run
 * produces, so a shorter re-extraction against the same video's stable
 * output path (the plan's declared `output.video`, unchanged across
 * re-records) would otherwise leave the previous run's tail in place,
 * sorted into the returned list as if it were still current.
 */
export async function extractFrames(
  videoPath: string,
  outDir?: string,
  opts: ExtractFramesOptions = {},
  bin: string = CONVERTER_BIN,
): Promise<FramesResult> {
  const { dir, name } = parse(videoPath)
  const targetDir = outDir ?? dir
  const fps = opts.fps ?? 1
  if (outDir) mkdirSync(outDir, { recursive: true })

  if (existsSync(targetDir)) {
    for (const stale of new Bun.Glob(`${name}-frame-*.png`).scanSync({
      cwd: targetDir,
      onlyFiles: true,
    })) {
      rmSync(join(targetDir, stale))
    }
  }

  const pattern = join(targetDir, `${name}-frame-%03d.png`)
  const result = await execa(
    bin,
    ['-y', '-i', videoPath, '-vf', `fps=${fps}`, pattern],
    { reject: false },
  )

  if (result.failed && result.code === 'ENOENT') {
    return { status: 'skipped', reason: 'converter-missing' }
  }
  if (result.exitCode !== 0) {
    return {
      status: 'failed',
      reason: result.stderr?.trim() || `ffmpeg exited ${result.exitCode}`,
    }
  }

  return { status: 'extracted', framePaths: collectFrames(targetDir, name) }
}

/**
 * The glob-and-sort step `extractFrames` reads its result from, pulled out so
 * a test can drive it against a directory it wrote by hand rather than
 * through a real extraction, which is the only way to reach the four-digit
 * boundary below without an ffmpeg run long enough to produce one.
 *
 * ffmpeg's `%03d` pads to three characters and then widens rather than
 * truncating, so a run producing 1000 or more frames writes `-1000.png`
 * beside `-999.png`, and a lexicographic sort reads the wider name first.
 * `frameIndex` sorts on the parsed number instead.
 */
export function collectFrames(targetDir: string, name: string): string[] {
  return [
    ...new Bun.Glob(`${name}-frame-*.png`).scanSync({
      cwd: targetDir,
      onlyFiles: true,
    }),
  ]
    .sort((a, b) => frameIndex(a) - frameIndex(b))
    .map((frame) => join(targetDir, frame))
}

function frameIndex(filename: string): number {
  const match = filename.match(/-frame-(\d+)\.png$/)
  return match ? Number(match[1]) : 0
}
