import { readAppTable } from '@/config/app'

/** The key listing folders whose listeners skip the health paths. */
export const PAGE_ONLY_KEY = 'page-only'

/**
 * The health paths a project declared, with the folders whose listeners skip
 * them. `none` is an absent table or an empty `paths = []`, and `invalid` exists
 * but cannot be used, so it refuses rather than fall back to the page-only probe.
 */
export type HealthDeclaration =
  | {
      readonly kind: 'paths'
      readonly paths: readonly string[]
      readonly pageOnly: readonly string[]
    }
  | { readonly kind: 'none'; readonly pageOnly: readonly string[] }
  | { readonly kind: 'invalid'; readonly reason: string }

/**
 * A path on the page's own host. A second leading slash would read as a
 * protocol-relative host, so it is refused to keep the probe on localhost.
 */
function isLocalPath(entry: unknown): entry is string {
  return (
    typeof entry === 'string' &&
    entry.startsWith('/') &&
    !entry.startsWith('//') &&
    !entry.startsWith('/\\')
  )
}

/**
 * A repository-relative folder as whole segments, or undefined when the entry
 * is not one. Absolute paths, drive letters, backslashes, and `..` refuse as
 * outside the repository, and `./` and trailing slashes drop so segments compare.
 */
function toFolder(entry: unknown): string | undefined {
  if (typeof entry !== 'string') return undefined
  if (entry.startsWith('/') || entry.includes('\\')) return undefined
  if (/^[A-Za-z]:/.test(entry)) return undefined
  const segments = entry.split('/').filter((s) => s !== '' && s !== '.')
  if (segments.length === 0 || segments.includes('..')) return undefined
  return segments.join('/')
}

/**
 * Reads the `[health]` table of `canon/config/app.toml`, or `local.toml` before
 * it, where `paths` was spelled `health`.
 */
export function readHealthPaths(root: string): HealthDeclaration {
  const read = readAppTable(root, 'health')
  if (read.kind === 'absent') return { kind: 'none', pageOnly: [] }
  if (read.kind === 'unparsable') {
    return { kind: 'invalid', reason: `${read.source} ${read.detail}` }
  }
  const { source, spell } = read
  const parsed: Record<string, unknown> =
    typeof read.value === 'object' &&
    read.value !== null &&
    !Array.isArray(read.value)
      ? (read.value as Record<string, unknown>)
      : {}

  const invalidHealth = (): HealthDeclaration => ({
    kind: 'invalid',
    reason: `${source} needs ${spell('paths')} as a list of paths, each starting with a single /`,
  })

  const hasPaths = 'paths' in parsed
  const hasPageOnly = PAGE_ONLY_KEY in parsed
  if (!hasPaths && !hasPageOnly) return invalidHealth()

  let paths: readonly string[] = []
  if (hasPaths) {
    const declared = parsed.paths
    if (!Array.isArray(declared) || !declared.every(isLocalPath)) {
      return invalidHealth()
    }
    paths = declared
  }

  let pageOnly: readonly string[] = []
  if (hasPageOnly) {
    const declared = parsed[PAGE_ONLY_KEY]
    const folders = Array.isArray(declared) ? declared.map(toFolder) : []
    if (!Array.isArray(declared) || folders.includes(undefined)) {
      return {
        kind: 'invalid',
        reason: `${source} needs ${spell(PAGE_ONLY_KEY)} as a list of folders relative to the repository, with no leading / and no ..`,
      }
    }
    pageOnly = folders as string[]
  }

  return paths.length === 0
    ? { kind: 'none', pageOnly }
    : { kind: 'paths', paths, pageOnly }
}
