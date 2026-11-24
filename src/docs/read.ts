import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { stripFrontmatter } from '@/markdown/frontmatter'
import { SURFACE_ROOTS } from '@/roots/surface'

const INDEX_TOPIC = 'index'

/**
 * The roots a topic resolves against, in precedence order, so a name present in
 * both `docs/` and the context folder resolves to the consumer-facing copy. The
 * context folder is read at every surface root, so an unmoved checkout still resolves.
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
 * `index.md`, so a topic names either a sibling file or such a folder. A
 * sub-area file resolves by bare name last, which keeps the widening additive.
 */
export function resolveTopic(
  root: string,
  rawTopic: string,
): ResolvedTopic | undefined {
  const topic = rawTopic.replace(/\/+$/, '')

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
 * Names every sub-area entry called `<topic>` in the first root offering one.
 * A name carried by more than one folder resolves to none, since picking
 * whichever sorts first is a confident wrong answer.
 */
function findLeaves(root: string, topic: string): string[] {
  for (const dir of ROOTS) {
    const matches = walkEntries(root, dir)
      .filter((entry) => entry.name === topic)
      .filter((entry) => entry.kind === 'leaf' || entry.parent !== undefined)
      .map((entry) => entry.rel)

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
 * Names every topic a `get` could resolve, per root in search order. Shown when
 * a topic misses, so it carries exactly what `resolveTopic` answers for and
 * nothing else.
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
 * A `file` is a sibling `<name>.md`, a `folder` is a split domain carried by
 * its `index.md`, and a `leaf` is a sub-area file named by its bare filename,
 * or `<folder>/<leaf>` inside a folder nested under a `parent`.
 */
export type EntryKind = 'file' | 'folder' | 'leaf'

export interface WalkedEntry {
  readonly name: string
  readonly kind: EntryKind
  /** The path under the project root, which is the catalog's `target`. */
  readonly rel: string
  /** The cataloged folder holding a nested folder, absent at the top level. */
  readonly parent?: string
}

/**
 * Every entry one root offers, with a leaf counted once per occurrence so a name
 * a folder pair both carry stays visible as a collision. This is the one
 * reading of the tree, so `listTopics` and the catalog cannot disagree.
 */
export function walkEntries(root: string, dir: string): WalkedEntry[] {
  const cwd = join(root, dir)
  if (!existsSync(cwd)) return []

  const files = markdownNames(cwd).map((name): WalkedEntry => ({
    name,
    kind: 'file',
    rel: join(dir, `${name}.md`),
  }))
  const folders = catalogedFolders(cwd)
  const split = folders.map((folder): WalkedEntry => ({
    name: folder,
    kind: 'folder',
    rel: join(dir, folder, `${INDEX_TOPIC}.md`),
  }))
  const leaves = folders.flatMap((folder) =>
    markdownNames(join(cwd, folder)).map((name): WalkedEntry => ({
      name,
      kind: 'leaf',
      rel: join(dir, folder, `${name}.md`),
    })),
  )
  const nested = folders.flatMap((folder) => walkNested(dir, cwd, folder))

  return [...files, ...split, ...leaves, ...nested]
}

function walkNested(dir: string, cwd: string, parent: string): WalkedEntry[] {
  return catalogedFolders(join(cwd, parent)).flatMap((folder) => [
    {
      name: folder,
      kind: 'folder' as const,
      rel: join(dir, parent, folder, `${INDEX_TOPIC}.md`),
      parent,
    },
    ...markdownNames(join(cwd, parent, folder)).map((name): WalkedEntry => ({
      name: `${folder}/${name}`,
      kind: 'leaf',
      rel: join(dir, parent, folder, `${name}.md`),
    })),
  ])
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
