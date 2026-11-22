import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { repoRoot } from './canon-cli'

/** One beat's closing still in the filmstrip, and the reel time it lands at. */
export interface FilmBeat {
  readonly at: string
  readonly still: string
}

export interface Film {
  /** The whole reel, rounded to the second. */
  readonly seconds: number
  readonly beats: readonly FilmBeat[]
}

const clock = (seconds: number) => {
  const whole = Math.round(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/**
 * Times each beat from a reel's stamp, which `scripts/core/regen-web-film.ts`
 * writes beside it with every beat's length, so the filmstrip reads the reel
 * it shows rather than typed times.
 */
export function filmFrom(
  stamp: string,
  still: (n: number) => string = (n) => `/film-beat-${n}.webp`,
): Film {
  const fields = Object.fromEntries(
    stamp
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const at = line.indexOf(': ')
        return [line.slice(0, at), line.slice(at + 2)]
      }),
  )
  const lengths = (fields.beats ?? '').split(' ').filter(Boolean).map(Number)
  if (lengths.length === 0)
    throw new Error(
      'the film stamp names no beat, so the filmstrip has no still',
    )
  let elapsed = 0
  return {
    seconds: Math.round(Number(fields['reel-seconds'])),
    beats: lengths.map((length, index) => {
      elapsed += length
      return { at: clock(elapsed), still: still(index + 1) }
    }),
  }
}

/** A reel a pull request carried, as its stamp names it. */
export interface Reel {
  readonly pullRequest: number
  /** The pull request's page, which the caption links. */
  readonly address: string
  /** The whole reel, to the frame. */
  readonly seconds: number
  readonly width: number
  readonly height: number
}

const REEL_FIELDS = [
  'pull-request',
  'address',
  'reel-seconds',
  'width',
  'height',
] as const

function stampFields(stamp: string): Record<string, string> {
  return Object.fromEntries(
    stamp
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const at = line.indexOf(': ')
        return [line.slice(0, at), line.slice(at + 2)]
      }),
  )
}

/**
 * Reads the pull request, its address, the length, and the size from a reel's
 * stamp, which `scripts/core/regen-web-film.ts` writes beside it. A field it
 * lacks or cannot read as a number fails the build, since the caption would
 * otherwise print a number nothing read.
 */
export function reelFrom(stamp: string): Reel {
  const fields = stampFields(stamp)
  const missing = REEL_FIELDS.filter((key) => !fields[key])
  if (missing.length)
    throw new Error(`the reel stamp names no ${missing.join(', ')}`)
  const number = (key: (typeof REEL_FIELDS)[number]) => {
    const value = Number(fields[key])
    if (!Number.isFinite(value) || value <= 0)
      throw new Error(`the reel stamp's ${key} is not a number: ${fields[key]}`)
    return value
  }
  return {
    pullRequest: number('pull-request'),
    address: fields.address ?? '',
    seconds: number('reel-seconds'),
    width: number('width'),
    height: number('height'),
  }
}

/** Reads the committed reel's stamp, as the evidence section draws it. */
export function readReel(): Reel {
  return reelFrom(
    readFileSync(join(repoRoot(), 'assets/loops/reel.stamp'), 'utf8'),
  )
}

/** Reads the committed reel's stamp for a theme, as the evidence section draws it. */
export function readFilm(theme: 'dark' | 'light'): Film {
  const suffix = theme === 'light' ? '-light' : ''
  const stamp = readFileSync(
    join(repoRoot(), `assets/loops/film${suffix}.stamp`),
    'utf8',
  )
  return filmFrom(stamp, (n) => `/film-beat-${n}${suffix}.webp`)
}
