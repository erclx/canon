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

/** Reads the committed reel's stamp for a theme, as the evidence section draws it. */
export function readFilm(theme: 'dark' | 'light'): Film {
  const suffix = theme === 'light' ? '-light' : ''
  const stamp = readFileSync(
    join(repoRoot(), `assets/loops/film${suffix}.stamp`),
    'utf8',
  )
  return filmFrom(stamp, (n) => `/film-beat-${n}${suffix}.webp`)
}
