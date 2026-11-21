import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import { listRepositoryFiles } from '@/git/files'
import { RECORD_ROOTS } from '@/roots/record'
import { SURFACE_ROOTS } from '@/roots/surface'
import { stampPaths } from '@/sync/stamp'

/**
 * Suppresses citation checking for the source line carrying it. Prose that
 * teaches a naming pattern displays a path rather than pointing at one, and
 * no syntax separates the two, so this covers what location rules cannot.
 */
export const IGNORE_MARKER = 'audit-ignore-citations'

/**
 * Matches the marker plus an optional comma-separated path list. A named list
 * narrows the skip to those paths, and the bare form skips every citation the
 * line carries, which is the shape every earlier marker still uses.
 */
const IGNORE_MARKER_LINE =
  /<!--\s*audit-ignore-citations(?::\s*([^>]+?))?\s*-->/

interface IgnoredCitations {
  readonly all: boolean
  readonly paths: ReadonlySet<string>
}

/**
 * Reads which citations on a line the marker excuses. A bare marker excuses all,
 * and a named one only the paths listed, so a real reference beside a
 * placeholder keeps being checked.
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
 * Trees holding content authored to be parsed rather than followed. Their
 * paths name scratch fixtures and a target project, not this repository, so an
 * unresolved one there is correct rather than stale.
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
 * The boundary a root's own leading character rules out. A dotted root admits a
 * preceding slash, which a relative link needs, and a bare root rejects a name
 * character, a dot, and a slash, except one closing a `..` segment.
 */
function rootBoundary(root: string): string {
  return root.startsWith('.') ? '(?<![\\w.])' : '(?<![\\w.])(?<!(?<!\\.\\.)/)'
}

/**
 * Every record and surface root is spelled, so a citation into a moved folder
 * still resolves, since a pattern fixed at one root would pass a stale reference.
 * Each root carries its own boundary, since a shared one blocked dotted roots.
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
 * names a sibling, which `citationPattern` cannot see. The backticks are
 * required, since a filename in running prose is no reference.
 */
export const BARE_NAME = /`([A-Za-z0-9._-]+\.md)`/g

/**
 * Pulls the cited paths out of one file's text. Fenced blocks are skipped for
 * markdown only, since applying a fence to a shell source would let a heredoc of
 * triple backticks hide the rest of the file.
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
 * Resolves every cited path outside the fixture trees and the install stamps,
 * which record a decline as a key and would report it stale. This check gates
 * the repository check, so it reports only a path that does not resolve on disk.
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
