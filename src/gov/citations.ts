import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { $ } from 'bun'
import { isMarked } from '@/sweep/exempt-marker'
import { gitEnv } from '@/git/env'
import { listRuleFiles } from '@/gov/payload'
import { parseFrontmatter } from '@/indexes/frontmatter'
import { findBacktickSpans } from '@/markdown/backticks'

/**
 * The inline token exempting one line from this sweep, read by the same two-line
 * rule as `canon-allow-superseded`. It is for the residue the classifier cannot
 * separate, and a bare token names no reason, so it mutes nothing.
 */
export const CITATION_MARKER = 'canon-allow-citation'

/** The two rule corpora, authored here and read from the repository root. */
export const RULE_DIRS: readonly string[] = [
  join('governance', 'rules'),
  join('internal', 'rules'),
]

/**
 * The corpus whose frontmatter globs resolve against this tree. A shipped rule's
 * `paths:` entries name a target's shape, so many correctly match nothing here,
 * while a glob matching nothing in the internal corpus is a rule that stopped firing.
 */
export const GLOB_CORPUS = join('internal', 'rules')

/**
 * How the citation was written, being a backticked repository path. A bare
 * filename is no form, since with no folder around it nothing tells a rule
 * from a convention such as `index.md`.
 */
export type CitationForm = 'path'

/**
 * What the sweep decided about one citation. `governed` and `ignored` are the
 * classes where a path reaching nothing is correct, named rather than dropped
 * so the report states what it declined to judge, and `exempt` is the marker.
 */
export type CitationStatus =
  | 'resolved'
  | 'governed'
  | 'ignored'
  | 'exempt'
  | 'dead'

export interface RuleCitation {
  /** The citing rule, relative to the root that was swept. */
  readonly file: string
  /** One-based, matching the `file:line` form a reader clicks. */
  readonly line: number
  readonly form: CitationForm
  /** The citation exactly as the rule wrote it. */
  readonly cited: string
  /** Repository-relative paths tried, in order, so a finding names its net. */
  readonly candidates: readonly string[]
  /** Which candidate answered, absent when none did. */
  readonly resolved: string | undefined
  readonly status: CitationStatus
  readonly preview: string
}

/**
 * One `paths:` entry from a rule's frontmatter, resolved against the tree. Only
 * the internal corpus is read, since a shipped rule's globs answer about a
 * tree that is not this one, as `GLOB_CORPUS` states.
 */
export interface RuleGlob {
  readonly file: string
  readonly line: number
  readonly glob: string
  readonly matched: boolean
}

export type CitationReport =
  | {
      readonly kind: 'measured'
      /** Rule files opened, which is what the verdict covers. */
      readonly rules: number
      readonly citations: readonly RuleCitation[]
      /** Frontmatter globs read, from `GLOB_CORPUS` alone. */
      readonly globs: readonly RuleGlob[]
    }
  | { readonly kind: 'unreadable'; readonly reason: string }

/**
 * The longest preview a finding carries, matching the superseded sweep beside
 * it. A rule bullet runs long and the report prints one line per citation.
 */
const PREVIEW_LIMIT = 200

const FENCE = /^\s*(?:```|~~~)/

const FRONTMATTER_DELIMITER = /^---\s*$/

/**
 * A character that puts the span outside this repository, or outside paths
 * altogether. `<` and `$` are placeholders, `*` is a glob, and the rest are
 * anchors nothing here resolves against, such as an absolute path or a URL scheme.
 */
function isNotRepositoryPath(span: string): boolean {
  if (/[\s<>$*|]/.test(span)) return true
  if (span.includes('://')) return true
  return /^[/~@#!]/.test(span)
}

/**
 * Whether the span's last segment carries a file extension, which separates a
 * citation from folder and module conventions such as `next/font`. A real folder
 * path goes unchecked, which is the bound the report states.
 */
function namesAFile(span: string): boolean {
  if (span.endsWith('/')) return false
  const segment = span.slice(span.lastIndexOf('/') + 1)
  return /\.[A-Za-z0-9]+$/.test(segment)
}

/**
 * Which form the span is written in, or nothing when it names no file this
 * sweep can resolve. The whole span is classified, since resolving a trailing
 * `<folder>/<name>.md` of a longer path manufactures a dead citation.
 */
export function classifySpan(span: string): CitationForm | undefined {
  if (isNotRepositoryPath(span)) return undefined
  if (!namesAFile(span)) return undefined
  return span.includes('/') ? 'path' : undefined
}

interface RawCitation {
  readonly line: number
  readonly form: CitationForm
  readonly cited: string
  readonly preview: string
  readonly marked: boolean
}

/**
 * Every citation one rule body carries. The frontmatter block is skipped, since
 * a `paths:` glob declares what the rule governs, and fenced blocks are skipped
 * since a fenced example displays a path rather than citing one.
 */
export function collectCitations(text: string): RawCitation[] {
  const lines = text.split('\n')
  const found: RawCitation[] = []
  let fenced = false
  let inFrontmatter = FRONTMATTER_DELIMITER.test(lines[0] ?? '')

  for (const [index, line] of lines.entries()) {
    if (inFrontmatter) {
      if (index > 0 && FRONTMATTER_DELIMITER.test(line)) inFrontmatter = false
      continue
    }
    if (FENCE.test(line)) {
      fenced = !fenced
      continue
    }
    if (fenced) continue

    const trimmed = line.trim()
    const preview =
      trimmed.length > PREVIEW_LIMIT
        ? `${trimmed.slice(0, PREVIEW_LIMIT)}…`
        : trimmed
    const marked = isMarked(lines, index, CITATION_MARKER)

    // A backticked span is the only carrier a rule writes a citation in, and prose would over-report.
    for (const { content: span } of findBacktickSpans(line)) {
      const form = classifySpan(span)
      if (form === undefined) continue
      found.push({ line: index + 1, form, cited: span, preview, marked })
    }
  }

  return found
}

/**
 * The paths one rule declares in its own frontmatter. A body line naming one
 * again names what the rule governs rather than pointing a reader somewhere, so
 * it is correctly absent from this tree.
 */
function governedPaths(text: string): string[] {
  const parsed = parseFrontmatter(text)
  const paths = parsed?.fields.paths
  if (!Array.isArray(paths)) return []
  return paths.filter((entry): entry is string => typeof entry === 'string')
}

/**
 * Exact declarations only, never a glob match against one. A glob declares a
 * shape, so a body path inside it is still a citation, and matching it would
 * exempt a stale path that moved.
 */
function isGoverned(cited: string, declared: readonly string[]): boolean {
  return declared.includes(cited)
}

/**
 * A `paths:` list entry, with the glob captured and its quoting dropped. It is
 * anchored on the entry shape, since a bare scan finds the glob text in the
 * `description:` line first wherever a rule names what it governs in prose.
 */
const LIST_ENTRY = /^\s*-\s*(?:'([^']*)'|"([^"]*)"|(\S.*?))\s*$/

/**
 * Where each declared glob sits, so a finding names a line a reader can click.
 * Values come from the YAML parse and line numbers from a scan of the block, so
 * a flow sequence resolves its value and reports no line.
 */
function locateGlobs(text: string): { line: number; glob: string }[] {
  const declared = governedPaths(text)
  if (declared.length === 0) return []

  const lines = text.split('\n')
  const close = lines.findIndex(
    (line, index) => index > 0 && FRONTMATTER_DELIMITER.test(line),
  )
  const block = close === -1 ? lines : lines.slice(0, close)
  const taken = new Set<number>()

  return declared.map((glob) => {
    const at = block.findIndex((line, index) => {
      if (taken.has(index)) return false
      const entry = line.match(LIST_ENTRY)
      return entry !== null && (entry[1] ?? entry[2] ?? entry[3]) === glob
    })
    if (at !== -1) taken.add(at)
    return { line: at + 1, glob }
  })
}

/**
 * Whether the glob matches a file present in this tree. Read only for
 * `internal/rules/`, since a shipped rule's glob names a target's shape and
 * resolving it here would report most correct globs as defects.
 */
function globMatches(root: string, glob: string): boolean {
  const scan = new Bun.Glob(glob).scanSync({
    cwd: root,
    onlyFiles: true,
    dot: true,
  })
  for (const _ of scan) return true
  return false
}

/**
 * Which of `paths` git ignores, or nothing when git could not answer. Session
 * scratch is real in a live project and absent from a fresh clone, so the
 * verdict must not depend on the tree. `git check-ignore` exits 1 on no match, a clean answer.
 */
async function readIgnored(
  root: string,
  paths: readonly string[],
): Promise<Set<string> | undefined> {
  if (paths.length === 0) return new Set()

  const input = Buffer.from(`${paths.join('\n')}\n`)
  const result = await $`git -C ${root} check-ignore --stdin < ${input}`
    .env(gitEnv())
    .quiet()
    .nothrow()

  if (result.exitCode > 1) return undefined
  return new Set(result.text().split('\n').filter(Boolean))
}

/**
 * Resolves every path the two rule corpora cite and names those reaching
 * nothing, plus every frontmatter glob under `GLOB_CORPUS`. This gates, since an
 * unresolved path carries no judgment, but it cannot see a citation that resolves wrongly.
 */
export async function readCitations(root: string): Promise<CitationReport> {
  const dirs = RULE_DIRS.map((rel) => ({
    rel,
    abs: resolve(root, rel),
  })).filter((dir) => existsSync(dir.abs))

  if (dirs.length === 0) {
    return {
      kind: 'unreadable',
      reason: `No rule corpus under ${root}. A tree holding neither ${RULE_DIRS.join(' nor ')} passes each of its zero rules, so it refuses rather than reporting clean.`,
    }
  }

  const citations: RuleCitation[] = []
  const globs: RuleGlob[] = []
  let rules = 0

  for (const dir of dirs) {
    for (const abs of listRuleFiles(dir.abs)) {
      const file = join(dir.rel, abs.slice(dir.abs.length + 1))

      let text: string
      try {
        text = await readFile(abs, 'utf8')
      } catch {
        // A rule removed since the glob answered is skipped, which under-reports rather than failing on a race.
        continue
      }

      rules += 1
      const declared = governedPaths(text)

      if (dir.rel === GLOB_CORPUS) {
        for (const { line, glob } of locateGlobs(text)) {
          globs.push({ file, line, glob, matched: globMatches(root, glob) })
        }
      }

      for (const raw of collectCitations(text)) {
        const candidates = [raw.cited]
        const resolved = candidates.find((path) =>
          existsSync(resolve(root, path)),
        )

        citations.push({
          file,
          line: raw.line,
          form: raw.form,
          cited: raw.cited,
          candidates,
          resolved,
          status: classifyStatus(raw, resolved, declared),
          preview: raw.preview,
        })
      }
    }
  }

  return applyIgnored(root, { kind: 'measured', rules, citations, globs })
}

function classifyStatus(
  raw: RawCitation,
  resolved: string | undefined,
  declared: readonly string[],
): CitationStatus {
  if (resolved !== undefined) return 'resolved'
  if (raw.marked) return 'exempt'
  if (isGoverned(raw.cited, declared)) return 'governed'
  return 'dead'
}

/**
 * Moves the unresolved paths git ignores out of the dead set in one batched
 * call, skipped when nothing is unresolved. A read git cannot answer refuses,
 * since treating it as "nothing ignored" would fail a push over session scratch.
 */
async function applyIgnored(
  root: string,
  measured: Extract<CitationReport, { kind: 'measured' }>,
): Promise<CitationReport> {
  const pending = measured.citations.filter(
    (citation) => citation.status === 'dead',
  )
  if (pending.length === 0) return measured

  const ignored = await readIgnored(
    root,
    pending.map((citation) => citation.cited),
  )

  if (ignored === undefined) {
    return {
      kind: 'unreadable',
      reason: `Git could not say which of ${pending.length} unresolved paths it ignores under ${root}. Session scratch is absent from a fresh clone and correctly cited anyway, so an unreadable answer refuses rather than reporting those paths dead.`,
    }
  }

  return {
    ...measured,
    citations: measured.citations.map((citation) =>
      citation.status === 'dead' && ignored.has(citation.cited)
        ? { ...citation, status: 'ignored' as const }
        : citation,
    ),
  }
}
