import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chromium } from 'playwright-core'
import { composeSheet, decodeFrames, pickFrames, readReel } from '@/take/stills'

/**
 * Writes a reel of one-colour frames through FFmpeg and reads it back through
 * Chromium, since which frame came back shows only in its pixels. Skips without
 * Chromium or FFmpeg with libwebp, as `reel.e2e.test.ts` does.
 */

const WIDTH = 96
const HEIGHT = 54
const COLOURS: readonly (readonly [number, number, number])[] = [
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
  [255, 255, 0],
  [255, 0, 255],
  [0, 255, 255],
]

function available(): boolean {
  try {
    if (!existsSync(chromium.executablePath())) return false
  } catch {
    return false
  }
  const encoders = spawnSync('ffmpeg', ['-hide_banner', '-encoders'], {
    encoding: 'utf8',
  })
  return encoders.status === 0 && encoders.stdout.includes('libwebp_anim')
}

function solid(colour: readonly [number, number, number]): Buffer {
  const png = new PNG({ width: WIDTH, height: HEIGHT })
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = colour[0]
    png.data[i + 1] = colour[1]
    png.data[i + 2] = colour[2]
    png.data[i + 3] = 255
  }
  return PNG.sync.write(png)
}

function centre(still: Buffer): { size: number[]; rgb: number[] } {
  const png = PNG.sync.read(still)
  const at = ((png.height >> 1) * png.width + (png.width >> 1)) * 4
  return {
    size: [png.width, png.height],
    rgb: Array.from(png.data.subarray(at, at + 3)),
  }
}

describe.skipIf(!available())('stills read back from a written reel', () => {
  let dir: string
  let reel: Buffer

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'canon-stills-e2e-'))
    COLOURS.forEach((colour, i) => {
      writeFileSync(join(dir, `f${i}.png`), solid(colour))
    })
    const encoded = spawnSync(
      'ffmpeg',
      [
        '-y',
        '-framerate',
        '5',
        '-i',
        join(dir, 'f%d.png'),
        '-c:v',
        'libwebp_anim',
        '-lossless',
        '1',
        join(dir, 'reel.webp'),
      ],
      { encoding: 'utf8' },
    )
    if (encoded.status !== 0) throw new Error(encoded.stderr)
    reel = readFileSync(join(dir, 'reel.webp'))
  }, 60_000)

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('should return the frames asked for at the reel size', async () => {
    const read = readReel(reel)
    if (read.kind !== 'read') throw new Error(read.detail)

    const picked = pickFrames(read.reel.frames.length, 3)
    const stills = await decodeFrames(reel, picked)

    expect(read.reel.frames).toHaveLength(COLOURS.length)
    expect(stills.map(centre)).toEqual(
      picked.map((index) => ({
        size: [WIDTH, HEIGHT],
        rgb: [...(COLOURS[index] ?? [])],
      })),
    )
  }, 60_000)

  it('should lay four stills on a sheet two columns wide', async () => {
    const stills = await decodeFrames(reel, [0, 1, 2, 3])

    const sheet = PNG.sync.read(composeSheet(stills))

    const cell = (column: number, row: number) => {
      const at = ((row * HEIGHT + 5) * sheet.width + column * WIDTH + 5) * 4
      return Array.from(sheet.data.subarray(at, at + 3))
    }
    expect([sheet.width, sheet.height]).toEqual([WIDTH * 2, HEIGHT * 2])
    expect([cell(0, 0), cell(1, 0), cell(0, 1), cell(1, 1)]).toEqual(
      COLOURS.slice(0, 4).map((colour) => [...colour]),
    )
  }, 60_000)
})
