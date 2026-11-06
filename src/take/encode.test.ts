import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { openFrameEncoder } from '@/take/encode'

/** A frame large enough that a write fills the pipe FFmpeg stopped reading. */
function noiseJpeg(): Buffer {
  return spawnSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'nullsrc=s=1920x1080,geq=random(1)*255:128:128',
      '-frames:v',
      '1',
      '-q:v',
      '1',
      '-f',
      'image2pipe',
      '-c:v',
      'mjpeg',
      '-',
    ],
    { maxBuffer: 64 * 1024 * 1024 },
  ).stdout
}

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0

describe.skipIf(!hasFfmpeg)('openFrameEncoder', () => {
  it('should refuse a write once FFmpeg exits rather than wait on the pipe', async () => {
    const jpeg = noiseJpeg()
    const encoder = openFrameEncoder('/nonexistent-canon-take/clip.mp4', 60)

    const writing = (async () => {
      for (let frame = 0; frame < 500; frame += 1) await encoder.write(jpeg)
    })()

    await expect(writing).rejects.toThrow(/ffmpeg/)
    encoder.abort()
  }, 30_000)
})
