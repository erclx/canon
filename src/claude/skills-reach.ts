import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveSkillsCorpus } from '@/claude/skills-list'
import { SURFACE_ROOTS } from '@/roots/surface'

/**
 * The authoring roots this repository owns and no install channel delivers.
 *
 * Every entry is a folder a target never holds under that spelling. `src/`,
 * `scripts/`, and bare `docs/` are absent, since a body naming one describes
 * the reader's own tree. `docs/agents/` is the exception, holding the
 * reference pages for verbs run by hand, which exist here alone. The context
 * folder carries both surface-root spellings, since a body naming either
 * names this repository's own tree.
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
 * What marks a citation as deliberately naming this repository's own copy.
 *
 * The word rather than a notation, matching the three bodies that already
 * spell it and the repair the plan settled on. A parser-visible syntax was the
 * alternative and it invents a spelling for a handful of lines while leaving
 * the shipped precedent unreadable.
 */
const QUALIFIER = /toolkit/i

/** A backticked token, which is how every body spells a path it cites. */
const TOKEN = /`([^`\s]+)`/g

/**
 * A path a reader could open, which is the only kind worth measuring.
 *
 * Requires an extension and a separator, and admits no `<`, `$`, or `*`. A
 * body writes `canon/context/<domain>.md` to name a shape rather than a
 * file, and `${CLAUDE_SKILL_DIR}/../<skill>/references/<name>.md` to resolve
 * against the plugin root, which is self-contained by construction.
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
 * The roots that belong to the toolkit rather than to the reader, read
 * against the corpus being measured.
 *
 * A target's `canon/context/` is the reader's own tree, seeded and then owned,
 * so a body under `.claude/skills/` citing one names a file its reader holds.
 * Here the seed tree settles that through `readReceivedPaths`, which a target
 * with no `tooling/` cannot answer, so the root comes out by corpus instead.
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
 *
 * Read off the seed tree rather than listed, so a seed added to any stack
 * clears its own citations without this module being edited. Dotfiles are in
 * scope because the whole seeded context corpus sits under `.claude/`.
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
 * Whether a cited path is this repository's own rather than the reader's.
 *
 * A seeded path is disowned twice over: under its own name, and under the
 * folder spelling it takes once a target splits the entry. A domain that
 * outgrows one file becomes `<domain>/`, which is still the entry the seed
 * delivered, so reporting the split form would fail a target for growing.
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
 *
 * Existence is not checked here. A body may name a path this repository once
 * held, and separating the shape test from the disk read is what lets the
 * shape be tested without a tree on disk.
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
 * Reads every body in the root's skill corpus for a path its reader cannot
 * open.
 *
 * A citation of a path this repository does not hold is dropped, since a path
 * true in neither place is a defect `canon context audit` already reports.
 * `resolveSkillsCorpus` prefers `claude/skills/`, the tree that installs into
 * a target. A project carrying `.claude/skills/` alone has no shipped tree, so
 * its own skills are the whole corpus.
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
