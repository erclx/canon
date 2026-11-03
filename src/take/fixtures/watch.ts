/**
 * Films `motion.json` on the motion fixture and renders each beat the way an
 * edit plays it, with the camera track's zoom applied and the drawn cursor
 * burned in, so the operator can judge a change to `canon take` by eye. The
 * reel `canon take --reel` writes draws the cursor and leaves the zoom out,
 * and the zoom is the half a change to the camera moves.
 *
 * Usage: bun src/take/fixtures/watch.ts <out dir>
 *
 * Writes each beat's take into its own folder under `<out dir>`, beside a
 * `watch.mp4` at 1920x1080. Needs FFmpeg and the headless shell, as a take does.
 */

import { spawnSync } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { CameraTrack } from '@/take/camera'
import { take } from '@/take/film'
import { MOTION_PLAN, serveMotion } from '@/take/fixtures/motion-server'
import { VIEWPORT } from '@/take/log'
import { readTakePlan } from '@/take/plan'

/** The drawn cursor's side in output pixels. */
const CURSOR = 18

/**
 * One FFmpeg command per frame: scale the frame up by the track's zoom, crop
 * the view back to the window, and move the cursor box to where it draws.
 */
function commands(track: CameraTrack): string {
  const { width, height } = VIEWPORT
  return track.frames
    .flatMap((frame) => {
      const at = (frame.ms / 1000).toFixed(4)
      const scaled = {
        w: 2 * Math.round((width / 2) * frame.scale),
        h: 2 * Math.round((height / 2) * frame.scale),
      }
      const x = Math.min(
        Math.max(0, Math.round(frame.x * frame.scale)),
        scaled.w - width,
      )
      const y = Math.min(
        Math.max(0, Math.round(frame.y * frame.scale)),
        scaled.h - height,
      )
      const cx = (frame.cursor.x - frame.x) * frame.scale - CURSOR / 2
      const cy = (frame.cursor.y - frame.y) * frame.scale - CURSOR / 2
      return [
        `${at} scale@z w ${scaled.w}, scale@z h ${scaled.h}, crop@k x ${x}, crop@k y ${y};`,
        `${at} drawbox@c x ${cx.toFixed(1)}, drawbox@c y ${cy.toFixed(1)};`,
      ]
    })
    .join('\n')
}

function render(clip: string, track: CameraTrack, out: string): void {
  const script = `${out}.cmd`
  writeFileSync(script, commands(track))
  const { width, height } = VIEWPORT
  const filter = [
    `scale=${width}:${height}`,
    `sendcmd=f=${script}`,
    `scale@z=w=${width}:h=${height}:eval=frame`,
    `crop@k=w=${width}:h=${height}:x=0:y=0`,
    `drawbox@c=x=0:y=0:w=${CURSOR}:h=${CURSOR}:color=black:t=fill`,
  ].join(',')
  const run = spawnSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-y',
      '-i',
      clip,
      '-vf',
      filter,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-crf',
      '20',
      out,
    ],
    { encoding: 'utf8' },
  )
  rmSync(script, { force: true })
  if (run.status !== 0) throw new Error(`ffmpeg refused ${clip}: ${run.stderr}`)
}

async function main(dir: string | undefined): Promise<number> {
  if (!dir) {
    process.stderr.write('Usage: bun src/take/fixtures/watch.ts <out dir>\n')
    return 2
  }
  const out = resolve(dir)
  const read = readTakePlan(readFileSync(MOTION_PLAN, 'utf8'))
  if (read.kind !== 'read') {
    process.stderr.write(`motion.json: ${read.detail}\n`)
    return 1
  }
  const server = serveMotion()
  try {
    const result = await take({ url: server.url, plan: read.plan, out })
    if (result.status !== 'filmed') {
      process.stderr.write(`${result.reason}: ${result.message}\n`)
      return 1
    }
    for (const beat of result.beats) {
      const track = JSON.parse(
        readFileSync(join(out, beat.camera), 'utf8'),
      ) as CameraTrack
      const watched = join(out, beat.dir, 'watch.mp4')
      render(join(out, beat.clip), track, watched)
      process.stdout.write(`${watched}\n`)
    }
    return 0
  } finally {
    server.stop()
  }
}

process.exitCode = await main(process.argv[2])
