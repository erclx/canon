import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { stripFrontmatter } from '@/frontmatter'
import { SURFACE_ROOTS } from '@/surface-root'

const INDEX_TOPIC = 'index'

/**
 * The roots a topic resolves against, in precedence order. `docs/` holds
 * consumer-facing reference and the context folder holds per-domain internal
 * narrative, so a name present in both resolves to the consumer-facing copy.
 * The context folder is read at every surface root, so a checkout the surface
 * move has not reached still resolves its own entries.
 */
const ROOTS: readonly string[] = [
  'docs',
  ...SURFACE_ROOTS.map((root) => join(root, 'context')),
]

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
 * Names every sub-area file called `<topic>.md`, across both roots. A name
 * carried by more than one folder resolves to none of them, since answering a
 * bare `overview` with whichever folder sorts first is a confident wrong answer
 * where the miss is a listing of what the caller could have typed.
 */
function findLeaves(root: string, topic: string): string[] {
  const matches: string[] = []

  for (const dir of ROOTS) {
    for (const folder of catalogedFolders(join(root, dir))) {
      const rel = join(dir, folder, `${topic}.md`)
      if (existsSync(join(root, rel))) matches.push(rel)
    }
  }

  return matches
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
  const named = ROOTS.map((dir) => collectNamed(root, dir))
  const leaves = ROOTS.map((dir) => collectLeaves(root, dir))

  const taken = new Set(named.flat())
  const counts = new Map<string, number>()
  for (const name of leaves.flat()) {
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }

  const reachable = (name: string): boolean =>
    !taken.has(name) && counts.get(name) === 1

  return ROOTS.flatMap((_, position) =>
    [
      ...(named[position] as string[]),
      ...(leaves[position] as string[]).filter(reachable),
    ].sort(),
  )
}

/** The sibling files and split folders of one root, which shadow every leaf. */
function collectNamed(root: string, dir: string): string[] {
  const cwd = join(root, dir)
  if (!existsSync(cwd)) return []

  return [...markdownNames(cwd), ...catalogedFolders(cwd)]
}

/** One entry per occurrence, so a name carried twice is counted twice. */
function collectLeaves(root: string, dir: string): string[] {
  const cwd = join(root, dir)

  return catalogedFolders(cwd).flatMap((folder) =>
    markdownNames(join(cwd, folder)),
  )
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
