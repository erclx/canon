import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { repoRoot } from './canon-cli'

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
 * Reads a reel's stamp, which `scripts/core/regen-web-film.ts` writes beside it. A missing or unreadable field
 * fails the build, since the caption would otherwise print a number nothing read.
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
