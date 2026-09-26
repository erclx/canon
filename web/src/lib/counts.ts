import { readCanonJson } from './canon-cli'

interface CatalogCounts {
  skills: number
  rules: number
  standards: number
  commands: number
  audits: number
}

interface GovCountsOutput {
  catalogs: CatalogCounts
}

/**
 * Reads the live catalog counts from `canon gov counts --json` at build time,
 * through the shared reader `catalogs.ts` also uses. No literal fallback: a
 * read that returns no parseable count fails rather than shipping a number
 * nothing measured. A non-zero exit alone is not that failure: the verb exits
 * 2 when it finds a stale count elsewhere in the tree, drift this page's own
 * build neither causes nor is responsible for gating.
 */
export function readCatalogCounts(): CatalogCounts {
  return readCanonJson<GovCountsOutput>(['gov', 'counts']).catalogs
}
