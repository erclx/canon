import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * The corpus is the package's own `files` field rather than a list kept here.
 *
 * That field is what npm packs, so it is already the single statement of which
 * trees leave this repository, and a second list beside it would answer the
 * same question and drift. It also carries the negations the publish already
 * makes, so the sandbox tree, the eval tree, and every test file are out of
 * scope by the same rule that keeps them out of the tarball rather than by an
 * exclusion this check invented.
 *
 * What it does not cover is the plugin, which a marketplace install reads live
 * from `claude/` rather than from a tarball. That folder is a `files` entry
 * too, and its `standards` symlink resolves into a tree the field lists in its
 * own right, so both routes land inside the same corpus.
 */
export type ShipEntries =
  /** The field declares a corpus, which is what this check reads. */
  | { readonly kind: 'entries'; readonly entries: readonly string[] }
  /** No manifest at all, so nothing is published from this tree. */
  | { readonly kind: 'no-manifest' }
  /** The manifest declares it is never published, so there is no shipped tree. */
  | { readonly kind: 'no-publish' }
  /**
   * A manifest that publishes and declares no corpus.
   *
   * npm packs the whole tree in that case, so this is the package that ships
   * the most rather than one that ships nothing. This check reads a declared
   * corpus and does not stand in an undeclared one, so the caller reports the
   * shipped tree as unread rather than as empty.
   */
  | { readonly kind: 'no-files-field' }

export async function readShipEntries(root: string): Promise<ShipEntries> {
  let manifest: unknown
  try {
    manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  } catch {
    return { kind: 'no-manifest' }
  }

  const record = manifest as { files?: unknown; private?: unknown } | null

  // The one field that separates a project publishing nothing from one
  // publishing everything, which the `files` field alone cannot tell apart.
  if (record?.private === true) return { kind: 'no-publish' }

  const files = record?.files
  if (!Array.isArray(files)) return { kind: 'no-files-field' }

  const entries = files.filter(
    (entry): entry is string => typeof entry === 'string',
  )

  return entries.length === 0
    ? { kind: 'no-files-field' }
    : { kind: 'entries', entries }
}

/**
 * Root files npm packs whether or not the `files` field names them.
 *
 * They leave the repository on every publish, so a corpus built from the field
 * alone would let a credential in any of them ship unreported. Matched by stem
 * against any extension, since each is packed under whichever one it carries.
 */
const ALWAYS_PACKED = ['package.json', 'readme', 'license', 'licence', 'notice']

function isAlwaysPacked(path: string): boolean {
  if (path.includes('/')) return false

  const stem = path.toLowerCase().split('.')[0] ?? ''
  return (
    ALWAYS_PACKED.includes(path.toLowerCase()) || ALWAYS_PACKED.includes(stem)
  )
}

/** Whether the entry reaches this path, as a directory prefix or as a glob. */
function covers(entry: string, path: string): boolean {
  if (entry.includes('*')) return new Bun.Glob(entry).match(path)

  return path === entry || path.startsWith(`${entry}/`)
}

/**
 * Narrows a repository listing to what the package publishes.
 *
 * Negations are collected first and applied to every candidate, since npm
 * reads the field as one set rather than in order, and an entry's position in
 * the array says nothing about what it overrides.
 */
export function selectShipped(
  paths: readonly string[],
  entries: readonly string[],
): string[] {
  const included = entries.filter((entry) => !entry.startsWith('!'))
  const excluded = entries
    .filter((entry) => entry.startsWith('!'))
    .map((entry) => entry.slice(1))

  return paths
    .filter(
      (path) =>
        (isAlwaysPacked(path) ||
          included.some((entry) => covers(entry, path))) &&
        !excluded.some((entry) => covers(entry, path)),
    )
    .sort()
}
