import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CONTEXT_ROOTS,
  DOCS_ROOT,
  walkEntries,
  type WalkedEntry,
} from '@/docs/read'
import { parseFrontmatter, readField } from '@/indexes/frontmatter'

/** The categories a target-facing doc declares, which no workflow doc does. */
const TARGET_CATEGORIES: readonly string[] = [
  'Agent surface',
  'Domain references',
]

/** Domain context a target has no use for, so the catalog leaves it out. */
const INTERNAL_TOPICS: readonly string[] = ['ci', 'development', 'sandbox']

export interface DocEntry {
  readonly name: string
  readonly description: string
  readonly category: string
  readonly target: string
}

export interface DocsCatalog {
  readonly docs: DocEntry[]
  readonly context: DocEntry[]
  /** False in a registry install, which ships `docs/` without a context root. */
  readonly hasContext: boolean
}

/**
 * A split folder is described by its generated index, which carries `subtitle`
 * where a sibling file or a sub-area file carries `description`.
 */
function describe(root: string, entry: WalkedEntry): [string, string] {
  const fields = parseFrontmatter(readFileSync(join(root, entry.rel), 'utf8'))
  const key = entry.kind === 'folder' ? 'subtitle' : 'description'

  return [readField(fields, 'category') ?? '', readField(fields, key) ?? '']
}

function byName(a: DocEntry, b: DocEntry): number {
  if (a.name === b.name) return a.target < b.target ? -1 : 1
  return a.name < b.name ? -1 : 1
}

/**
 * A folder declares its category on its own index, since the allowlist is what
 * separates a target-facing doc from a workflow one and a split domain is not
 * exempt from it. A sub-area file declares its own, which keeps a page's
 * listing membership unchanged by the folder it moves into.
 */
function collectDocs(root: string): DocEntry[] {
  return walkEntries(root, DOCS_ROOT)
    .flatMap((entry): DocEntry[] => {
      const [category, description] = describe(root, entry)
      if (!TARGET_CATEGORIES.includes(category)) return []

      return [{ name: entry.name, description, category, target: entry.rel }]
    })
    .sort(byName)
}

/**
 * Stops at the folder where `listTopics` goes on to name each sub-area file.
 * This is the downstream catalog and that one answers what a caller could have
 * typed, so a reachable name absent here is the same divergence the internal
 * topics already carry. A name present at more than one surface root lists
 * once, at the first.
 */
function collectContext(root: string): DocEntry[] {
  const seen = new Set<string>()
  const entries: DocEntry[] = []

  for (const dir of CONTEXT_ROOTS) {
    for (const entry of walkEntries(root, dir)) {
      if (entry.kind === 'leaf') continue
      if (INTERNAL_TOPICS.includes(entry.name) || seen.has(entry.name)) continue

      seen.add(entry.name)
      const [, description] = describe(root, entry)
      entries.push({
        name: entry.name,
        description,
        category: '',
        target: entry.rel,
      })
    }
  }

  return entries.sort(byName)
}

export function listDocs(root: string): DocsCatalog {
  return {
    docs: collectDocs(root),
    context: collectContext(root),
    hasContext: CONTEXT_ROOTS.some((dir) => existsSync(join(root, dir))),
  }
}
