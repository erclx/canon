import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Path prefixes, from the repository root, whose context entries gate on the
 * section shape under `--gate` when a project declares no `gated` key. A batch
 * rebuilding a folder adds its prefix here in the same change.
 */
export const SHAPE_GATED_FOLDERS: readonly string[] = [
  'canon/context/context-model.md',
  'canon/context/development/',
  'canon/context/features/',
  'canon/context/surfaces/',
  'canon/context/workflow/',
  'tooling/base/seeds/',
]

/**
 * The prefixes a run gates on. A declared list replaces the default rather
 * than adding to it, so an empty one gates no folder, and only an absent key,
 * read as null, falls back to the toolkit's own layout.
 */
export function resolveGatedPrefixes(
  declared: readonly string[] | null,
): readonly string[] {
  return declared ?? SHAPE_GATED_FOLDERS
}

/**
 * Whether a relative entry path sits under a gated prefix. A prefix matches on
 * a segment boundary, so it reaches no sibling such as `canon/context/authz/`,
 * and a prefix naming a file matches that file.
 */
export function isShapeGated(
  rel: string,
  prefixes: readonly string[] = SHAPE_GATED_FOLDERS,
): boolean {
  return prefixes.some((prefix) => {
    const bare = prefix.replace(/^(\.\/)+/, '').replace(/\/+$/, '')
    return rel === bare || rel.startsWith(`${bare}/`)
  })
}

/** The prefixes naming nothing on disk under `base`, in declared order. */
export function missingGatedPrefixes(
  base: string,
  prefixes: readonly string[],
): string[] {
  return prefixes.filter((prefix) => !existsSync(join(base, prefix)))
}
