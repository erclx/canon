import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveSkillsCorpus } from '@/claude/skills-list'
import { SURFACE_ROOTS } from '@/roots/surface'

/**
 * The authoring roots this repository owns and no install channel delivers.
 * `src/`, `scripts/`, and bare `docs/` are absent, since a body naming one
 * describes the reader's own tree, and `docs/agents/` exists here alone.
 */
const AUTHORING_ROOTS = [
  ...SURFACE_ROOTS.map((root) => `${root}/context/`),
  'claude/',
  'docs/agents/',
  'governance/',
  'internal/',
  'tooling/',
  'wiki/',
] as const

/**
 * What marks a citation as deliberately naming this repository's own copy. The
 * word rather than a notation, matching the bodies that already spell it.
 */
const QUALIFIER = /toolkit/i

/** A backticked token, which is how every body spells a path it cites. */
const TOKEN = /`([^`\s]+)`/g

/**
 * A path a reader could open, which is the only kind worth measuring. It needs
 * an extension and a separator and admits no `<`, `$`, or `*`, which name a
 * shape or resolve against the plugin root.
 */
const CONCRETE = /^[.A-Za-z0-9_][A-Za-z0-9._/-]*\.[a-z]{1,4}$/

export interface Citation {
  readonly file: string
  /** One-based, matching the `file:line` form a reader clicks. */
  readonly line: number
  readonly path: string
  readonly qualified: boolean
}

/** Why a scan produced no corpus, which is never the same as a clean one. */
export type ReachRefusal = 'no-skills'

export type ReachReport =
  | {
      readonly kind: 'measured'
      /** The corpus spelling read, since a root can carry either one. */
      readonly corpus: string
      /** Files opened, so a report can state what the verdict covers. */
      readonly bodies: number
      readonly qualified: readonly Citation[]
      readonly unqualified: readonly Citation[]
    }
  | { readonly kind: 'refused'; readonly reason: ReachRefusal }

export function isQualified(line: string): boolean {
  return QUALIFIER.test(line)
}

/**
 * The roots that belong to the toolkit rather than to the reader, read against
 * the corpus measured. A target with no `tooling/` cannot answer through
 * `readReceivedPaths`, so the root comes out by corpus instead.
 */
export function authoringRootsFor(corpus: string): readonly string[] {
  if (!SURFACE_ROOTS.some((root) => corpus.startsWith(`${root}/`))) {
    return AUTHORING_ROOTS
  }

  return AUTHORING_ROOTS.filter(
    (root) => !SURFACE_ROOTS.some((surface) => root.startsWith(`${surface}/`)),
  )
}

/**
 * Every path a seed lands on in a target, spelled the way a body would cite it.
 * Read off the seed tree so a new seed clears its own citations, and dotfiles
 * are in scope because the seeded context sits under `.claude/`.
 */
export function readReceivedPaths(root: string): Set<string> {
  const toolingRoot = join(root, 'tooling')
  if (!existsSync(toolingRoot)) return new Set()

  const received = new Set<string>()
  for (const path of new Bun.Glob('*/seeds/**/*').scanSync({
    cwd: toolingRoot,
    onlyFiles: true,
    dot: true,
  })) {
    const posix = path.replaceAll('\\', '/')
    received.add(posix.replace(/^[^/]+\/seeds\//, ''))
  }
  return received
}

/**
 * Whether a cited path is this repository's own rather than the reader's. A
 * seeded path is disowned under its own name and under the folder spelling it
 * takes once a target splits the entry.
 */
export function isToolkitOwned(
  path: string,
  received: Set<string>,
  roots: readonly string[] = AUTHORING_ROOTS,
): boolean {
  if (received.has(path)) return false

  for (const seeded of received) {
    const stem = seeded.replace(/\.md$/, '')
    if (stem !== seeded && path.startsWith(`${stem}/`)) return false
  }

  return roots.some((prefix) => path.startsWith(prefix))
}

/**
 * Every toolkit-owned path one shipped file cites, with the line's verdict.
 * Existence is not checked here, so the shape test needs no tree on disk.
 */
export function citationsIn(
  file: string,
  text: string,
  received: Set<string>,
  roots: readonly string[] = AUTHORING_ROOTS,
): Citation[] {
  const citations: Citation[] = []

  for (const [index, line] of text.split('\n').entries()) {
    const qualified = isQualified(line)

    for (const match of line.matchAll(TOKEN)) {
      const path = match[1]
      if (!CONCRETE.test(path) || !path.includes('/')) continue
      if (!isToolkitOwned(path, received, roots)) continue

      citations.push({ file, line: index + 1, path, qualified })
    }
  }

  return citations
}

/**
 * Reads every body in the root's skill corpus for a path its reader cannot open.
 * `resolveSkillsCorpus` prefers `claude/skills/`, and a project carrying only
 * `.claude/skills/` has its own skills as the whole corpus.
 */
export function scanReach(root: string): ReachReport {
  const corpus = resolveSkillsCorpus(root)
  if (corpus === undefined) return { kind: 'refused', reason: 'no-skills' }

  const received = readReceivedPaths(root)
  const roots = authoringRootsFor(corpus.rel)
  const files = [
    ...new Bun.Glob('**/*.md').scanSync({ cwd: corpus.dir, onlyFiles: true }),
  ].sort()

  const qualified: Citation[] = []
  const unqualified: Citation[] = []

  for (const file of files) {
    const posix = file.replaceAll('\\', '/')
    const text = readFileSync(join(corpus.dir, file), 'utf8')

    for (const citation of citationsIn(
      `${corpus.rel}/${posix}`,
      text,
      received,
      roots,
    )) {
      if (!existsSync(join(root, citation.path))) continue

      if (citation.qualified) qualified.push(citation)
      else unqualified.push(citation)
    }
  }

  return {
    kind: 'measured',
    corpus: corpus.rel,
    bodies: files.length,
    qualified,
    unqualified,
  }
}
