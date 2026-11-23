import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveExisting } from '@/roots/legacy'

/**
 * Where a project declares its pull request label map. `LEGACY_MAP_REL` is the
 * one other place code spells it, a read fallback, so the next move is one edit
 * to the write path rather than a sweep.
 */
export const MAP_REL = join('canon', 'config', 'pr-labels.toml')

/**
 * Where the map lived before this move, `.claude/canon/pr-labels.toml`.
 * `readLabelMap` falls back to it so a project that has not moved still reads
 * its declared map.
 */
const LEGACY_MAP_REL = join('.claude', 'canon', 'pr-labels.toml')

/**
 * A label name and the path prefixes that earn it, in the map's own order. The
 * `color` is a lowercase hex without `#`, present only when the row declares one.
 */
export interface DomainRow {
  readonly label: string
  readonly prefixes: readonly string[]
  readonly color?: string
}

/** A reason a path is deliberately unlabelled, and the prefixes it covers. */
export interface DeclinedRow {
  readonly reason: string
  readonly prefixes: readonly string[]
}

/**
 * Why a map could not be read, which is never the same as a map with no rows.
 * `no-map` is an answer, since a project declaring none is labelled silently by
 * design, and the other two are a file that exists and cannot be used.
 */
export type MapRefusal = 'no-map' | 'unreadable-map' | 'no-domains'

export type LabelMap =
  | {
      readonly kind: 'map'
      readonly domains: readonly DomainRow[]
      readonly declined: readonly DeclinedRow[]
    }
  | { readonly kind: 'refused'; readonly reason: MapRefusal }

/**
 * Reads a TOML table of string arrays into rows, dropping any key with no usable
 * prefix. A malformed row is skipped rather than refused, since one bad hand-written
 * entry should not blind the check to the rest, and a typo surfaces as uncovered.
 */
function readRows(table: unknown): { key: string; prefixes: string[] }[] {
  if (typeof table !== 'object' || table === null || Array.isArray(table)) {
    return []
  }

  const rows: { key: string; prefixes: string[] }[] = []
  for (const [key, value] of Object.entries(table)) {
    if (!Array.isArray(value)) continue
    const prefixes = readPrefixes(value)
    if (prefixes.length > 0) rows.push({ key, prefixes })
  }

  return rows
}

const HEX_COLOR = /^#?[0-9a-fA-F]{6}$/

type DomainRead =
  | { readonly ok: true; readonly rows: DomainRow[] }
  | { readonly ok: false }

/**
 * A table row with no usable paths or a non-hex color is refused, since dropping
 * it silently would color nothing. A malformed bare row is skipped as before.
 */
function readDomains(table: unknown): DomainRead {
  if (typeof table !== 'object' || table === null || Array.isArray(table)) {
    return { ok: true, rows: [] }
  }

  const rows: DomainRow[] = []
  for (const [label, value] of Object.entries(table)) {
    if (Array.isArray(value)) {
      const prefixes = readPrefixes(value)
      if (prefixes.length > 0) rows.push({ label, prefixes })
      continue
    }
    if (typeof value !== 'object' || value === null) continue

    const { paths, color } = value as { paths?: unknown; color?: unknown }
    const prefixes = Array.isArray(paths) ? readPrefixes(paths) : []
    if (prefixes.length === 0) return { ok: false }
    if (color === undefined) {
      rows.push({ label, prefixes })
      continue
    }
    if (typeof color !== 'string' || !HEX_COLOR.test(color)) {
      return { ok: false }
    }
    rows.push({ label, prefixes, color: color.replace('#', '').toLowerCase() })
  }

  return { ok: true, rows }
}

function readPrefixes(value: readonly unknown[]): string[] {
  return value.filter(
    (entry): entry is string => typeof entry === 'string' && entry !== '',
  )
}

/** Parses map text, so a caller holding the bytes skips the filesystem. */
export function parseLabelMap(source: string): LabelMap {
  let parsed: Record<string, unknown>
  try {
    parsed = Bun.TOML.parse(source) as Record<string, unknown>
  } catch {
    return { kind: 'refused', reason: 'unreadable-map' }
  }

  const read = readDomains(parsed.domains)
  if (!read.ok) return { kind: 'refused', reason: 'unreadable-map' }
  if (read.rows.length === 0) return { kind: 'refused', reason: 'no-domains' }

  return {
    kind: 'map',
    domains: read.rows,
    declined: readRows(parsed.declined).map(({ key, prefixes }) => ({
      reason: key,
      prefixes,
    })),
  }
}

/** Reads the map a project declares at `root`, or says why it could not. */
export function readLabelMap(root: string): LabelMap {
  const path = resolveExisting([
    join(root, MAP_REL),
    join(root, LEGACY_MAP_REL),
  ])

  let source: string
  try {
    source = readFileSync(path, 'utf8')
  } catch {
    return { kind: 'refused', reason: 'no-map' }
  }

  return parseLabelMap(source)
}
