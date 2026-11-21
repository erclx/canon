import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * The corpus is the package's own `files` field rather than a list kept here,
 * since that field is what npm packs and its negations keep tests and sandbox
 * trees out. The plugin is a `files` entry too, so both routes share one corpus.
 */
export type ShipEntries =
  /** The field declares a corpus, which is what this check reads. */
  | { readonly kind: 'entries'; readonly entries: readonly string[] }
  /** No manifest at all, so nothing is published from this tree. */
  | { readonly kind: 'no-manifest' }
  /** The manifest declares it is never published, so there is no shipped tree. */
  | { readonly kind: 'no-publish' }
  /**
   * A manifest that publishes and declares no corpus. npm packs the whole tree
   * then, so this ships the most, and the caller reports the shipped tree as
   * unread rather than empty.
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

  // The one field separating a project publishing nothing from one publishing everything.
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
 * Root files npm packs whether or not the `files` field names them, so a corpus
 * from the field alone would let a credential in one ship unreported. They are
 * matched by stem against any extension.
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
 * Narrows a repository listing to what the package publishes. Negations are
 * collected first and applied to every candidate, since npm reads the field as
 * one set and an entry's position overrides nothing.
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
