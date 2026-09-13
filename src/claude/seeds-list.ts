import { readFile } from 'node:fs/promises'
import { relative } from 'node:path'
import { planSeeds } from '@/claude/seeds'

export interface SeedListing {
  readonly name: string
  readonly source: string
  readonly target: string
  readonly src: string
}

export interface SeedListingWithContent {
  readonly name: string
  readonly source: string
  readonly target: string
  readonly content: string
}

/**
 * Reads the same plan `canon claude init` applies. The bash re-globbed the seeds
 * directory with its own hard-coded subdirectory list, which had drifted: it
 * never listed `canon/context/`, so a seed init installs went unreported.
 *
 * The target is irrelevant to a listing, so it resolves against the source
 * root and only the source-side fields are read.
 */
export function listSeeds(root: string): SeedListing[] {
  return planSeeds(root, root).map(({ seed }) => ({
    name: seed.scanLabel,
    source: relative(root, seed.src),
    target: seed.applyLabel,
    src: seed.src,
  }))
}

export async function readSeedContents(
  listings: readonly SeedListing[],
): Promise<SeedListingWithContent[]> {
  return Promise.all(
    listings.map(async ({ name, source, target, src }) => ({
      name,
      source,
      target,
      content: await readFile(src, 'utf8'),
    })),
  )
}
