import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { planSeeds, type Seed } from '@/claude/seeds'
import { rewritesOnInstall, stripSeedMarker } from '@/tooling/seed-marker'
import { findInstalledOrigin, readHistoryIndex } from '@/sync/history'

/**
 * How an installed seed compares to the seed the toolkit currently ships.
 *
 * `missing` has no counterpart in the domain scan, which walks what a target
 * installed and so cannot see a file that never arrived. Seeds are enumerated
 * from the source instead, which is what makes the absence legible.
 *
 * There is no `customized` here. That verdict needs a stamp, and seeds carry
 * none, so a file history cannot attribute stays `drifted` and a consumer reads
 * it as the local edit it almost always is.
 */
export type SeedState = 'matching' | 'stale' | 'drifted' | 'missing'

export interface SeedReportEntry {
  readonly state: SeedState
  readonly rel: string
  /** Toolkit revision this file's content came from, when history proved it. */
  readonly since?: string
}

export interface SeedsReport {
  readonly entries: readonly SeedReportEntry[]
  /** Set when a file needed history to attribute it and this toolkit has none. */
  readonly historyUnavailable: boolean
}

/**
 * Classifies every seed the toolkit ships against the target's copy, and never
 * returns a change. Seeds are copy-once files a project is expected to edit, so
 * the engine's copy path would overwrite `CLAUDE.md` wholesale. Reporting alone
 * is what lets `seed-sync` merge one section at a time instead.
 *
 * Attribution reuses the history reader rather than the engine's own recovery
 * pass, which is private and takes a `SyncAdapter` seeds have no way to supply.
 */
export function buildSeedsReport(
  toolkitRoot: string,
  target: string,
): SeedsReport {
  const differing: DifferingSeed[] = []
  const entries: SeedReportEntry[] = []

  for (const { seed, present } of planSeeds(toolkitRoot, target)) {
    const rel = relative(target, seed.dest)

    if (!present) {
      entries.push({ state: 'missing', rel })
      continue
    }

    if (sameContent(seed.src, seed.dest)) {
      entries.push({ state: 'matching', rel })
      continue
    }

    differing.push({ index: entries.length, seed })
    entries.push({ state: 'drifted', rel })
  }

  const historyUnavailable = attribute(toolkitRoot, entries, differing)

  return { entries, historyUnavailable }
}

interface DifferingSeed {
  readonly index: number
  readonly seed: Seed
}

/**
 * Second pass over the seeds that differ, matching installed content against
 * every version the toolkit ever published. A match proves the file is
 * untouched since it landed, so the toolkit is what moved and the entry becomes
 * `stale`. Runs as one git call for the whole set rather than one per file.
 */
function attribute(
  toolkitRoot: string,
  entries: SeedReportEntry[],
  differing: readonly DifferingSeed[],
): boolean {
  if (differing.length === 0) return false

  const index = readHistoryIndex(
    toolkitRoot,
    differing.map((file) => relative(toolkitRoot, file.seed.src)),
  )

  if (index === undefined) return true

  for (const file of differing) {
    const since = findInstalledOrigin(
      index,
      relative(toolkitRoot, file.seed.src),
      file.seed.dest,
    )

    if (since === undefined) continue
    entries[file.index] = { ...entries[file.index], state: 'stale', since }
  }

  return false
}

/**
 * Compares the target against what an install would write, not against the seed
 * source. The two differ for a markdown seed carrying the stub marker, which the
 * install strips, so comparing sources would report a file the target never
 * touched as drifted for as long as the marker stays set.
 */
function sameContent(source: string, dest: string): boolean {
  const installed = readFileSync(dest)

  if (!rewritesOnInstall(source)) {
    return readFileSync(source).equals(installed)
  }

  return (
    stripSeedMarker(readFileSync(source, 'utf8')) === installed.toString('utf8')
  )
}
