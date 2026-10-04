import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { stripFrontmatter } from '@/markdown/frontmatter'
import { SURFACE_ROOTS } from '@/roots/surface'

const INDEX_TOPIC = 'index'

/**
 * The roots a topic resolves against, in precedence order. `docs/` holds
 * consumer-facing reference and the context folder holds per-domain internal
 * narrative, so a name present in both resolves to the consumer-facing copy.
 * The context folder is read at every surface root, so a checkout the surface
 * move has not reached still resolves its own entries.
 */
export const DOCS_ROOT = 'docs'
export const CONTEXT_ROOTS: readonly string[] = SURFACE_ROOTS.map((root) =>
  join(root, 'context'),
)
const ROOTS: readonly string[] = [DOCS_ROOT, ...CONTEXT_ROOTS]

export interface ResolvedTopic {
  readonly path: string
  readonly rel: string
}

/**
 * A domain too large for one file splits into `<domain>/` with a generated
 * `index.md`, so a topic names either a sibling file or such a folder. Both
 * spellings resolve to the same name a caller types.
 *
 * A sub-area file one level down resolves by its bare name too, but only after
 * every root has been tried for both spellings above. Reading the folder last
 * is what keeps the widening additive: no name that resolved before this
 * resolves anywhere else now.
 */
export function resolveTopic(
  root: string,
  topic: string,
): ResolvedTopic | undefined {
  for (const dir of ROOTS) {
    const candidates = [
      join(dir, `${topic}.md`),
      join(dir, topic, `${INDEX_TOPIC}.md`),
    ]

    for (const rel of candidates) {
      const path = join(root, rel)
      if (existsSync(path)) return { path, rel }
    }
  }

  const leaves = findLeaves(root, topic)
  if (leaves.length !== 1) return undefined

  const rel = leaves[0] as string
  return { path: join(root, rel), rel }
}

/**
 * Names every sub-area file called `<topic>.md` in the first root whose folders
 * carry one, so the root precedence above holds one folder down as well. A name
 * carried by more than one folder of that root resolves to none of them, since
 * answering a bare `overview` with whichever folder sorts first is a confident
 * wrong answer where the miss is a listing of what the caller could have typed.
 */
function findLeaves(root: string, topic: string): string[] {
  for (const dir of ROOTS) {
    const matches = catalogedFolders(join(root, dir))
      .map((folder) => join(dir, folder, `${topic}.md`))
      .filter((rel) => existsSync(join(root, rel)))

    if (matches.length > 0) return matches
  }

  return []
}

/**
 * The split folders of one root, which is every sub-folder carrying an index.
 * A folder without one is absent from both verbs, so its files stay out of
 * reach with it rather than becoming nameable through a catalog nobody wrote.
 */
function catalogedFolders(dir: string): string[] {
  if (!existsSync(dir)) return []

  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(join(dir, name, `${INDEX_TOPIC}.md`)))
    .sort()
}

/**
 * Names every topic a `get` could resolve, listed per root in the order the
 * roots are searched. Shown when a topic misses, so it doubles as the answer to
 * what the caller should have typed, which is why it carries exactly what
 * `resolveTopic` answers for and nothing else.
 */
export function listTopics(root: string): string[] {
  const walked = ROOTS.map((dir) => walkEntries(root, dir))

  const taken = new Set(
    walked.flatMap((entries) =>
      entries.filter((entry) => entry.kind !== 'leaf').map((e) => e.name),
    ),
  )
  const claimed = new Set<string>()

  return walked.flatMap((entries) => {
    const named = entries
      .filter((entry) => entry.kind !== 'leaf')
      .map((entry) => entry.name)
    const here = entries
      .filter((entry) => entry.kind === 'leaf')
      .map((entry) => entry.name)
    const reachable = [...new Set(here)].filter(
      (name) =>
        !taken.has(name) &&
        !claimed.has(name) &&
        here.indexOf(name) === here.lastIndexOf(name),
    )
    for (const name of here) claimed.add(name)

    return [...named, ...reachable].sort()
  })
}

/**
 * How an entry is named. A `file` is a sibling `<name>.md`, a `folder` is a
 * split domain named by its folder and carried by its `index.md`, and a `leaf`
 * is a sub-area file one level down, named by its bare filename.
 */
export type EntryKind = 'file' | 'folder' | 'leaf'

export interface WalkedEntry {
  readonly name: string
  readonly kind: EntryKind
  /** The path under the project root, which is the catalog's `target`. */
  readonly rel: string
}

/**
 * Every entry one root offers, in the three kinds above, with a leaf counted
 * once per occurrence so a name a folder pair both carry stays visible as a
 * collision. A root that is absent offers nothing. This is the one reading of
 * the tree, so `listTopics` and the docs catalog cannot disagree on membership.
 */
export function walkEntries(root: string, dir: string): WalkedEntry[] {
  const cwd = join(root, dir)
  if (!existsSync(cwd)) return []

  const files = markdownNames(cwd).map(
    (name): WalkedEntry => ({
      name,
      kind: 'file',
      rel: join(dir, `${name}.md`),
    }),
  )
  const folders = catalogedFolders(cwd)
  const split = folders.map(
    (folder): WalkedEntry => ({
      name: folder,
      kind: 'folder',
      rel: join(dir, folder, `${INDEX_TOPIC}.md`),
    }),
  )
  const leaves = folders.flatMap((folder) =>
    markdownNames(join(cwd, folder)).map(
      (name): WalkedEntry => ({
        name,
        kind: 'leaf',
        rel: join(dir, folder, `${name}.md`),
      }),
    ),
  )

  return [...files, ...split, ...leaves]
}

function markdownNames(dir: string): string[] {
  return [
    ...new Bun.Glob('*.md').scanSync({ cwd: dir, onlyFiles: true, dot: true }),
  ]
    .map((name) => basename(name, '.md'))
    .filter((name) => name !== INDEX_TOPIC)
}

export function readTopic(topic: ResolvedTopic): string {
  return stripFrontmatter(readFileSync(topic.path, 'utf8'))
}
