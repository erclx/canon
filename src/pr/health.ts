import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Where a project declares what `canon pr local` checks beyond the page. */
export const LOCAL_CONFIG_REL = join('canon', 'config', 'local.toml')

/**
 * The health paths a project declared. `none` is an absent file or an empty
 * `health = []`. `invalid` is a declaration that exists and cannot be used,
 * which refuses rather than falling back to the page-only probe, since that
 * fallback is the failure the declaration exists to catch.
 */
export type HealthDeclaration =
  | { readonly kind: 'paths'; readonly paths: readonly string[] }
  | { readonly kind: 'none' }
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

export function readHealthPaths(root: string): HealthDeclaration {
  const path = join(root, LOCAL_CONFIG_REL)
  if (!existsSync(path)) return { kind: 'none' }

  let parsed: Record<string, unknown>
  try {
    parsed = Bun.TOML.parse(readFileSync(path, 'utf8')) as Record<
      string,
      unknown
    >
  } catch {
    return { kind: 'invalid', reason: `${LOCAL_CONFIG_REL} is not valid TOML` }
  }

  const declared = parsed.health
  if (!Array.isArray(declared) || !declared.every(isLocalPath)) {
    return {
      kind: 'invalid',
      reason: `${LOCAL_CONFIG_REL} needs health as a list of paths, each starting with a single /`,
    }
  }

  return declared.length === 0
    ? { kind: 'none' }
    : { kind: 'paths', paths: declared }
}
