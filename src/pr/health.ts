import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** The key listing folders whose listeners skip the health paths. */
export const PAGE_ONLY_KEY = 'page-only'

/** Where a project declares what `canon pr local` checks beyond the page. */
export const LOCAL_CONFIG_REL = join('canon', 'config', 'local.toml')

/**
 * The health paths a project declared, with the folders whose listeners skip
 * them. `none` is an absent file or an empty `health = []`. `invalid` is a
 * declaration that exists and cannot be used, which refuses rather than
 * falling back to the page-only probe, since that fallback is the failure the
 * declaration exists to catch.
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
 * is not one. Absolute paths, drive letters, backslashes, and `..` refuse,
 * since each would name a place outside the repository. A leading `./` and
 * trailing slashes are dropped so the match compares segments alone.
 */
function toFolder(entry: unknown): string | undefined {
  if (typeof entry !== 'string') return undefined
  if (entry.startsWith('/') || entry.includes('\\')) return undefined
  if (/^[A-Za-z]:/.test(entry)) return undefined
  const segments = entry.split('/').filter((s) => s !== '' && s !== '.')
  if (segments.length === 0 || segments.includes('..')) return undefined
  return segments.join('/')
}

export function readHealthPaths(root: string): HealthDeclaration {
  const path = join(root, LOCAL_CONFIG_REL)
  if (!existsSync(path)) return { kind: 'none', pageOnly: [] }

  let parsed: Record<string, unknown>
  try {
    parsed = Bun.TOML.parse(readFileSync(path, 'utf8')) as Record<
      string,
      unknown
    >
  } catch {
    return { kind: 'invalid', reason: `${LOCAL_CONFIG_REL} is not valid TOML` }
  }

  const hasHealth = 'health' in parsed
  const hasPageOnly = PAGE_ONLY_KEY in parsed
  if (!hasHealth && !hasPageOnly) return invalidHealth()

  let paths: readonly string[] = []
  if (hasHealth) {
    const declared = parsed.health
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
        reason: `${LOCAL_CONFIG_REL} needs ${PAGE_ONLY_KEY} as a list of folders relative to the repository, with no leading / and no ..`,
      }
    }
    pageOnly = folders as string[]
  }

  return paths.length === 0
    ? { kind: 'none', pageOnly }
    : { kind: 'paths', paths, pageOnly }
}

function invalidHealth(): HealthDeclaration {
  return {
    kind: 'invalid',
    reason: `${LOCAL_CONFIG_REL} needs health as a list of paths, each starting with a single /`,
  }
}
