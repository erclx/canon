import { basename, dirname, resolve } from 'node:path'
import {
  readField,
  readFrontmatter,
  readFrontmatterSource,
} from '@/indexes/frontmatter'
import { INDEX_FILE, listIndexes } from '@/indexes/walk'

export interface IndexEntry {
  readonly name: string
  readonly title: string
  readonly description: string
  readonly category?: string
}

export interface SubCatalog {
  readonly name: string
  readonly title: string
  readonly subtitle: string
}

export type RenderResult =
  | { readonly ok: true; readonly content: string }
  | { readonly ok: false; readonly errors: string[] }

interface IndexHead {
  readonly raw: string
  readonly title: string
  readonly subtitle: string
}

/**
 * Builds a folder's `index.md` from its own frontmatter plus every sibling's.
 *
 * Frontmatter is re-emitted verbatim rather than re-serialized, so key order
 * and any `auto: false` marker survive a regeneration untouched.
 */
export async function computeIndex(dir: string): Promise<RenderResult> {
  const indexPath = `${dir}/${INDEX_FILE}`
  const head = await readIndexHead(indexPath)
  if (!head.ok) return head

  const entries = await collectEntries(dir)
  if (!entries.ok) return entries

  const subCatalogs = await collectSubCatalogs(dir)

  return {
    ok: true,
    content: renderIndex(head.head, entries.entries, subCatalogs),
  }
}

async function readIndexHead(
  indexPath: string,
): Promise<{ ok: true; head: IndexHead } | { ok: false; errors: string[] }> {
  const frontmatter = await readFrontmatter(indexPath)
  const title = readField(frontmatter, 'title')
  const subtitle = readField(frontmatter, 'subtitle')

  const errors: string[] = []
  if (!title) errors.push(`missing frontmatter field "title" in ${indexPath}`)
  if (!subtitle) {
    errors.push(`missing frontmatter field "subtitle" in ${indexPath}`)
  }
  if (!frontmatter || !title || !subtitle) return { ok: false, errors }

  return { ok: true, head: { raw: frontmatter.raw, title, subtitle } }
}

export async function collectEntries(
  dir: string,
): Promise<
  { ok: true; entries: IndexEntry[] } | { ok: false; errors: string[] }
> {
  const glob = new Bun.Glob('*.md')
  const paths: string[] = []

  for await (const rel of glob.scan({ cwd: dir, onlyFiles: true, dot: true })) {
    if (rel === INDEX_FILE) continue
    paths.push(resolve(dir, rel))
  }
  paths.sort()

  const entries: IndexEntry[] = []
  const errors: string[] = []

  let invalid = 0

  for (const path of paths) {
    const reading = readFrontmatterSource(await Bun.file(path).text())
    if (reading.kind === 'invalid') {
      invalid += 1
      errors.push(
        `frontmatter is not valid YAML in ${path}: ${reading.message}`,
      )
      continue
    }
    const frontmatter =
      reading.kind === 'parsed' ? reading.frontmatter : undefined
    const title = readField(frontmatter, 'title')
    const description = readField(frontmatter, 'description')

    if (!title) errors.push(`missing frontmatter field "title" in ${path}`)
    if (!description) {
      errors.push(`missing frontmatter field "description" in ${path}`)
    }
    if (!title || !description) continue

    entries.push({
      name: basename(path),
      title,
      description,
      category: readField(frontmatter, 'category'),
    })
  }

  if (errors.length > 0) {
    const missing = errors.length - invalid
    if (missing > 0) {
      errors.push(`${missing} missing frontmatter field(s) in ${dir}`)
    }
    return { ok: false, errors }
  }

  return { ok: true, entries }
}

/**
 * Reuses the shared walker so nested discovery inherits the same prune and
 * gitignore rules, then keeps only direct children of this folder.
 */
async function collectSubCatalogs(dir: string): Promise<SubCatalog[]> {
  const nested = await listIndexes(dir)
  const catalogs: SubCatalog[] = []

  for (const indexPath of nested.sort()) {
    const childDir = dirname(indexPath)
    if (dirname(childDir) !== resolve(dir)) continue

    const frontmatter = await readFrontmatter(indexPath)
    const title = readField(frontmatter, 'title')
    const subtitle = readField(frontmatter, 'subtitle')

    if (!title || !subtitle) {
      process.stderr.write(
        `WARNING: skipping nested index ${childDir}/${INDEX_FILE} (missing title or subtitle)\n`,
      )
      continue
    }

    catalogs.push({ name: basename(childDir), title, subtitle })
  }

  return catalogs
}

function renderIndex(
  head: IndexHead,
  entries: IndexEntry[],
  subCatalogs: SubCatalog[],
): string {
  const hasCategories = entries.some((entry) => Boolean(entry.category))

  let out = `${head.raw}\n\n# ${head.title}\n\n${head.subtitle}\n`
  if (entries.length > 0 || subCatalogs.length > 0) out += '\n'

  if (hasCategories) {
    const categories = [
      ...new Set(entries.map((entry) => entry.category).filter(Boolean)),
    ].sort() as string[]

    categories.forEach((category, position) => {
      if (position > 0) out += '\n'
      out += `## ${category}\n\n`
      for (const entry of entries) {
        if (entry.category !== category) continue
        out += formatEntry(entry)
      }
    })
  } else {
    /**
     * Flat mode sorts sub-catalogs among the files rather than after them. A
     * folder and a file are both one domain to a reader scanning the catalog,
     * so a trailing folder reads as absent from the alphabetical run it belongs
     * in. Grouped mode keeps its own heading below, where a category is the
     * organizing key and alphabetical position carries no meaning.
     */
    const lines = [
      ...entries.map((entry) => ({
        key: entry.name,
        text: formatEntry(entry),
      })),
      ...subCatalogs.map((catalog) => ({
        key: catalog.name,
        text: formatSubCatalog(catalog),
      })),
    ].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))

    for (const line of lines) out += line.text
  }

  if (hasCategories && subCatalogs.length > 0) {
    out += '\n## Sub-catalogs\n\n'
    for (const catalog of subCatalogs) {
      out += formatSubCatalog(catalog)
    }
  }

  return out
}

function formatSubCatalog(catalog: SubCatalog): string {
  return `- [${catalog.title}](${catalog.name}/${INDEX_FILE}): ${catalog.subtitle}\n`
}

function formatEntry(entry: IndexEntry): string {
  return `- [${entry.title}](${entry.name}): ${entry.description}\n`
}
