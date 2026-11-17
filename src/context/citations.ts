import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import { listRepositoryFiles } from '@/git/files'
import { RECORD_ROOTS } from '@/roots/record'
import { SURFACE_ROOTS } from '@/roots/surface'
import { stampPaths } from '@/sync/stamp'

/**
 * Suppresses citation checking for the source line carrying it.
 *
 * Prose that teaches a naming pattern displays a path rather than pointing at
 * one, and no syntax separates the two: an illustration and a reference are
 * both inline code in a sentence. Location covers the fixture trees and fenced
 * examples, and this covers what is left, which is a sentence naming a
 * hypothetical entry to show the shape of the name.
 */
export const IGNORE_MARKER = 'audit-ignore-citations'

/**
 * Matches the marker plus an optional comma-separated path list.
 *
 * `<!-- audit-ignore-citations: .claude/standards/X.md -->` narrows the skip
 * to the paths named. The bare form with no colon skips every citation the
 * line carries, which is the only shape a line with nothing else worth
 * checking needs and the shape every marker predating this pattern still
 * carries.
 */
const IGNORE_MARKER_LINE =
  /<!--\s*audit-ignore-citations(?::\s*([^>]+?))?\s*-->/

interface IgnoredCitations {
  readonly all: boolean
  readonly paths: ReadonlySet<string>
}

/**
 * Reads which citations on a line the marker excuses.
 *
 * A bare marker excuses every citation the line carries, matching the
 * pre-named-path behavior. A named marker excuses only the paths listed,
 * so a line carrying both a placeholder and a real reference keeps the real
 * one checked rather than losing it to the placeholder beside it.
 */
function ignoredCitations(line: string): IgnoredCitations | undefined {
  const match = line.match(IGNORE_MARKER_LINE)
  if (!match) return undefined
  if (match[1] === undefined) return { all: true, paths: new Set() }

  const paths = match[1]
    .split(',')
    .map((path) => path.trim())
    .filter(Boolean)
  return { all: false, paths: new Set(paths) }
}

/**
 * Trees holding content authored to be parsed rather than followed.
 *
 * Sandbox scenarios describe paths inside their own scratch fixtures and the
 * eval harness names paths in its target project. Neither is a reference into
 * this repository, so an unresolved path there is correct rather than stale.
 */
const FIXTURE_TREES: readonly string[] = ['sandbox/', 'scripts/eval/']

const FIXTURE_SEGMENTS: readonly string[] = ['fixtures', '__fixtures__']

const FENCE = /^\s*(```|~~~)/

export interface Citation {
  readonly file: string
  readonly line: number
  readonly path: string
}

export function isFixture(rel: string): boolean {
  if (rel.endsWith('.test.ts')) return true
  if (FIXTURE_TREES.some((tree) => rel.startsWith(tree))) return true
  return rel.split('/').some((segment) => FIXTURE_SEGMENTS.includes(segment))
}

/**
 * The boundary a root's own leading character rules out.
 *
 * A dotted root cannot be a suffix of a path segment, so its boundary admits a
 * preceding slash, which a relative link into it needs. A bare root is a
 * suffix of a dotted root's name and of any `/<root>/` segment, such as a seed
 * tree's own `canon/`, so its boundary rejects a name character, a dot, and a
 * slash, except one closing a `..` segment, the form a moved docs page writes.
 */
function rootBoundary(root: string): string {
  return root.startsWith('.') ? '(?<![\\w.])' : '(?<![\\w.])(?<!(?<!\\.\\.)/)'
}

/**
 * Every record and surface root is spelled, so a citation into a folder that
 * has moved is still resolved. A pattern fixed at one root matches nothing
 * after the move and reports nothing, which is a stale reference passing the
 * check that exists to find it rather than a check that fails.
 *
 * Each root carries its own boundary rather than one shared ahead of the whole
 * alternation, per `rootBoundary`. A shared boundary rejecting a slash blocked
 * every dotted root from a relative link, which is the same failure this
 * function's own boundary exists to prevent, aimed at the roots that never
 * needed it.
 */
export function citationPattern(folders: readonly string[]): RegExp {
  const names = folders.map((name) => escape(name))
  const roots = [...new Set([...RECORD_ROOTS, ...SURFACE_ROOTS])]
  const alternatives = roots
    .map((root) => `${rootBoundary(root)}${escape(root)}`)
    .join('|')

  return new RegExp(
    `(?:${alternatives})/(?:${names.join('|')})/[A-Za-z0-9._/-]+\\.md`,
    'g',
  )
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * A backticked filename carrying no folder, the form a reference takes when it
 * names a sibling rather than a path.
 *
 * `citationPattern` spells a record-root prefix and cannot see this shape.
 * Widening it was declined, since a spelled path is a reference by
 * construction and a bare name is a candidate its caller still tests against
 * its folder. The backticks are required, since a filename in running prose is
 * no reference, and matching one would report every sentence naming a file.
 */
export const BARE_NAME = /`([A-Za-z0-9._-]+\.md)`/g

/**
 * Pulls the cited paths out of one file's text.
 *
 * Fenced blocks are skipped for markdown only. A fence is markdown syntax, and
 * applying it to a shell or TypeScript source would let a heredoc of triple
 * backticks silently hide the rest of the file.
 */
export function collectCitations(
  rel: string,
  text: string,
  pattern: RegExp,
): Citation[] {
  const isMarkdown = rel.endsWith('.md')
  const found: Citation[] = []
  let fenced = false

  for (const [index, line] of text.split('\n').entries()) {
    if (isMarkdown && FENCE.test(line)) {
      fenced = !fenced
      continue
    }
    if (fenced) continue

    const ignored = ignoredCitations(line)

    for (const match of line.matchAll(pattern)) {
      if (ignored && (ignored.all || ignored.paths.has(match[0]))) continue
      found.push({ file: rel, line: index + 1, path: match[0] })
    }
  }

  return found
}

/**
 * `unavailable` is a distinct state from a clean scan.
 *
 * Finding nothing and being unable to look mean opposite things, and only one
 * of them should let a push through.
 */
export type CitationReport =
  | {
      readonly kind: 'scanned'
      readonly scanned: number
      readonly total: number
      readonly unresolved: readonly Citation[]
    }
  | { readonly kind: 'unavailable' }

/**
 * Resolves every cited path outside the fixture trees and the install stamps.
 *
 * `canon tooling decline` records a declined path as a key in a stamp, so a
 * scanned stamp reports a deliberate decline as a stale citation. A stamp
 * matches at any depth, since a subfolder install carries its own, but only
 * after a slash, so a file merely ending in the same letters is scanned.
 *
 * This is the only check gating the repository check, so its false positives
 * are the only ones that cost a contributor. It reports only a path that does
 * not resolve on disk, and the exclusions keep it off prose about paths.
 */
export async function auditCitations(
  root: string,
  folders: readonly string[],
): Promise<CitationReport> {
  const pattern = citationPattern(folders)
  const listed = await listRepositoryFiles(root)
  if (!listed) return { kind: 'unavailable' }

  const stamps = stampPaths(root).map((path) => relative(root, path))
  const isStamp = (rel: string): boolean =>
    stamps.some((stamp) => rel === stamp || rel.endsWith(`/${stamp}`))
  const candidates = listed.filter((rel) => !isFixture(rel) && !isStamp(rel))
  const citations: Citation[] = []

  for (const rel of candidates) {
    const path = resolve(root, rel)
    if (!existsSync(path)) continue

    let text: string
    try {
      text = await readFile(path, 'utf8')
    } catch {
      continue
    }

    citations.push(...collectCitations(rel, text, pattern))
  }

  return {
    kind: 'scanned',
    scanned: candidates.length,
    total: citations.length,
    unresolved: citations.filter(
      (citation) => !existsSync(resolve(root, citation.path)),
    ),
  }
}
