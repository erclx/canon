import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { repoRoot } from './canon-cli'

/**
 * The launch film's length in seconds, read off the rendered MP4's movie
 * header so the poster's play label states a measured duration rather than a
 * typed one. Parsing the header here keeps ffprobe off the build machine.
 */
export function readFilmSeconds(): number {
  return mp4Seconds(readFileSync(join(repoRoot(), 'assets/loops/launch.mp4')))
}

/** Walks the top-level boxes to `moov`, then its children to `mvhd`, refusing a file with neither. */
export function mp4Seconds(file: Buffer): number {
  const moov = findBox(file, 0, file.length, 'moov')
  if (!moov) throw new Error('The MP4 carries no moov box, so no mvhd to read')
  const mvhd = findBox(file, moov.start, moov.end, 'mvhd')
  if (!mvhd) throw new Error('The MP4 moov box carries no mvhd')

  const version = file.readUInt8(mvhd.start)
  const timescale =
    version === 1
      ? file.readUInt32BE(mvhd.start + 20)
      : file.readUInt32BE(mvhd.start + 12)
  const duration =
    version === 1
      ? Number(file.readBigUInt64BE(mvhd.start + 24))
      : file.readUInt32BE(mvhd.start + 16)
  if (timescale === 0) throw new Error('The MP4 mvhd carries a zero timescale')
  return duration / timescale
}

interface Span {
  readonly start: number
  readonly end: number
}

/** The body span of the first box of `type` between `from` and `to`. */
function findBox(
  file: Buffer,
  from: number,
  to: number,
  type: string,
): Span | undefined {
  let at = from
  while (at + 8 <= to) {
    const size = file.readUInt32BE(at)
    if (size < 8) return undefined
    if (file.toString('latin1', at + 4, at + 8) === type) {
      return { start: at + 8, end: at + size }
    }
    at += size
  }
  return undefined
}
