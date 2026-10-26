import { type ChildProcess, spawn } from 'node:child_process'

/**
 * Joins a take's frames into an H.264 clip through the system FFmpeg. Canon
 * ships no encoder, so FFmpeg is a setup step a target runs, and its absence is
 * refused up front rather than after a take has been filmed.
 */

export class FfmpegMissing extends Error {}

/** H.264 in yuv420p plays in every browser and editor HyperFrames reads from. */
const OUTPUT = [
  '-c:v',
  'libx264',
  '-preset',
  'medium',
  '-crf',
  '16',
  '-pix_fmt',
  'yuv420p',
  '-movflags',
  '+faststart',
]

/** Resolves when `ffmpeg` runs, and throws `FfmpegMissing` when it does not. */
export async function requireFfmpeg(): Promise<void> {
  const proc = spawn('ffmpeg', ['-version'], { stdio: 'ignore' })
  try {
    await finished(proc)
  } catch (error) {
    throw new FfmpegMissing(
      `ffmpeg did not run: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

export interface FrameEncoder {
  /** Appends one JPEG frame, waiting while FFmpeg catches up. */
  write(jpeg: Buffer): Promise<void>
  /** Ends the stream and resolves once the clip is written. */
  close(): Promise<void>
  /** Stops FFmpeg and leaves whatever it wrote. */
  abort(): void
}

/**
 * Streams JPEG frames into one clip at `fps`, so a 4K take never lands on disk
 * as a folder of stills.
 */
export function openFrameEncoder(out: string, fps: number): FrameEncoder {
  const proc = spawn(
    'ffmpeg',
    [
      '-y',
      '-loglevel',
      'error',
      '-f',
      'image2pipe',
      '-framerate',
      String(fps),
      '-c:v',
      'mjpeg',
      '-i',
      '-',
      // A JPEG is full range and H.264 is read as TV range, so without this the
      // levels pass through unscaled and a player crushes the blacks and whites.
      '-vf',
      'scale=in_range=full:out_range=tv',
      ...OUTPUT,
      out,
    ],
    { stdio: ['pipe', 'ignore', 'pipe'] },
  )
  const done = finished(proc)
  // Held so a failure while frames are still being written surfaces at close
  // rather than as an unhandled rejection.
  done.catch(() => {})

  return {
    write: (jpeg) =>
      new Promise((resolve, reject) => {
        const stdin = proc.stdin
        if (!stdin || stdin.destroyed) {
          reject(new Error('ffmpeg stopped reading frames'))
          return
        }
        if (stdin.write(jpeg)) resolve()
        else stdin.once('drain', resolve)
      }),
    close: async () => {
      proc.stdin?.end()
      await done
    },
    abort: () => {
      proc.kill('SIGKILL')
    },
  }
}

/** Re-encodes a recorded clip to the same H.264 output at a constant `fps`. */
export async function transcode(
  input: string,
  out: string,
  fps: number,
): Promise<void> {
  const proc = spawn(
    'ffmpeg',
    [
      '-y',
      '-loglevel',
      'error',
      '-i',
      input,
      '-r',
      String(fps),
      ...OUTPUT,
      out,
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  )
  await finished(proc)
}

/**
 * Counts a clip's frames, which a real-time take cannot know in advance and a
 * camera track has to match one for one.
 */
export async function probeFrames(clip: string): Promise<number> {
  const proc = spawn(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-count_packets',
      '-show_entries',
      'stream=nb_read_packets',
      '-of',
      'csv=p=0',
      clip,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  )
  let stdout = ''
  proc.stdout?.on('data', (chunk: Buffer) => {
    stdout += chunk.toString()
  })
  await finished(proc)
  const frames = Number.parseInt(stdout.trim(), 10)
  if (!Number.isFinite(frames)) {
    throw new Error(`ffprobe read no frame count from ${clip}`)
  }
  return frames
}

function finished(proc: ChildProcess): Promise<void> {
  let stderr = ''
  proc.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString()
  })
  return new Promise((resolve, reject) => {
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else
        reject(new Error(`ffmpeg exited ${code}: ${stderr.trim().slice(-400)}`))
    })
  })
}
