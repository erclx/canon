import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { $ } from 'bun'
import { isMarked } from '@/exempt-marker'
import { gitEnv } from '@/git-env'
import { listRuleFiles } from '@/gov/payload'
import { parseFrontmatter } from '@/indexes/frontmatter'
import { findBacktickSpans } from '@/markdown/backticks'

/**
 * The inline token exempting one line from this sweep, shaped on the
 * `canon-allow-superseded` precedent and read by the same two-line rule.
 *
 * Everything the classifier below can separate mechanically is separated
 * there. This is for the residue: a line whose path is written as a reference
 * and is correct in naming something absent, for a reason a later reader has
 * to be able to weigh. A bare token names no reason, so it mutes nothing.
 */
export const CITATION_MARKER = 'canon-allow-citation'

/** The two rule corpora, authored here and read from the repository root. */
export const RULE_DIRS: readonly string[] = [
  join('governance', 'rules'),
  join('internal', 'rules'),
]

/**
 * The corpus whose frontmatter globs resolve against this tree.
 *
 * Bodies are read across both corpora and globs across this one alone. A rule
 * under `governance/rules/` installs into a target and its `paths:` entries
 * name that project's shape, which is why 32 of the 72 globs there match
 * nothing here and every one of them is correct: `src/pages/**` in the Astro
 * rule is indistinguishable by pattern from a path this repository might hold.
 * Gating on them would ship a permanent exemption list the length of the
 * corpus. The internal corpus ships nowhere, so the tree it governs is the
 * tree present and a glob matching nothing there is a rule that stopped
 * firing.
 */
export const GLOB_CORPUS = join('internal', 'rules')

/**
 * How the citation was written, kept on the finding because the three resolve
 * against different roots and a reader repairing one needs to know which.
 *
 * `standard` is the live form, carried by 20 rules. `path` is a backticked
 * repository path. `sibling` is a rule naming another rule by filename alone,
 * which resolves inside the folder the citing rule sits in.
 */
export type CitationForm = 'path' | 'standard' | 'sibling'

/**
 * What the sweep decided about one citation.
 *
 * `governed` and `ignored` are the two classes where a path reaching nothing is
 * correct rather than stale, and they are named rather than dropped so the
 * report states what it declined to judge. `exempt` is the marker.
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
 * One `paths:` entry from a rule's frontmatter, resolved against the tree.
 *
 * Only the internal corpus is read. A rule shipping to a target declares the
 * shape that target holds, so its globs answer about a tree that is not this
 * one, which `GLOB_CORPUS` states and the report repeats on every run.
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
 * The verb form, with the name captured. A leading letter or digit is required,
 * which is what leaves `canon standards <name>` unmatched: that line teaches the
 * form rather than citing a standard, and it is the only one in either corpus.
 */
const STANDARD_CALL = /canon standards ([A-Za-z0-9][A-Za-z0-9._-]*)/g

/** A rule filename, which is how a rule names a sibling with no folder around it. */
const SIBLING_RULE = /^\d{3}-[a-z0-9-]+\.md$/

/**
 * A character that puts the span outside this repository, or outside paths
 * altogether.
 *
 * `<` and `$` are the placeholder forms, `*` is a glob, and both describe a
 * shape rather than name a file. The rest are anchors nothing here resolves
 * against: an absolute path, a home path, a module alias, a URL scheme.
 */
function isNotRepositoryPath(span: string): boolean {
  if (/[\s<>$*|]/.test(span)) return true
  if (span.includes('://')) return true
  return /^[/~@#!]/.test(span)
}

/**
 * Whether the span's last segment carries a file extension.
 *
 * This is what separates a citation from the folder and module conventions the
 * corpus is full of. `next/font`, `try/except`, `react-hooks/set-state-in-effect`,
 * and `oven-sh/setup-bun@v2` all carry a slash and name no file, and a trailing
 * slash is a folder rather than a document. The cost is that `claude/standards`
 * is a real path this declines to check, which is the bound the report states.
 */
function namesAFile(span: string): boolean {
  if (span.endsWith('/')) return false
  const segment = span.slice(span.lastIndexOf('/') + 1)
  return /\.[A-Za-z0-9]+$/.test(segment)
}

/**
 * Which form the span is written in, or nothing when it names no file this
 * sweep can resolve.
 *
 * The whole span is classified rather than a trailing pattern inside it.
 * Extracting `standards/tooling-reference.md` out of
 * `internal/standards/tooling-reference.md` and resolving that against the
 * standards root manufactures a dead citation out of a file that exists, which
 * a session measuring this corpus did before the check was written.
 */
export function classifySpan(span: string): CitationForm | undefined {
  if (isNotRepositoryPath(span)) return undefined
  if (!namesAFile(span)) return undefined
  if (span.includes('/')) return 'path'
  return SIBLING_RULE.test(span) ? 'sibling' : undefined
}

/**
 * Where a citation could answer, which is wherever the reader's own tools look
 * and nowhere else.
 *
 * A standard name takes the authoring root alone, matching `standardRoots` in
 * `@/standards/read`, which reads `standards/` at the working root and then the
 * package corpus. This verb refuses a tree holding no rule corpus, so it runs
 * only where those two roots are one directory. `internal/standards/` is
 * deliberately absent: `canon standards <name>` never reaches it, so admitting it
 * here would pass a citation that refuses for the session opening it, which is a
 * gate failing open.
 *
 * A sibling resolves inside the folder the citing rule sits in, since that is
 * the only place a bare rule filename means anything.
 */
function candidatesFor(
  form: CitationForm,
  cited: string,
  ruleFile: string,
): string[] {
  if (form === 'standard') return [join('standards', `${cited}.md`)]
  if (form === 'sibling') return [join(dirname(ruleFile), cited)]
  return [cited]
}

interface RawCitation {
  readonly line: number
  readonly form: CitationForm
  readonly cited: string
  readonly preview: string
  readonly marked: boolean
}

/**
 * Every citation one rule body carries.
 *
 * The frontmatter block is skipped, since a `paths:` glob declares what the
 * rule governs rather than what it points a reader at, and the two questions
 * resolve against different trees. Fenced blocks are skipped for the reason the
 * marker exists: a fenced example displays a path rather than citing one. No
 * rule in either corpus opens a fence today, so this is a floor rather than a
 * filter over anything present.
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

    for (const match of line.matchAll(STANDARD_CALL)) {
      found.push({
        line: index + 1,
        form: 'standard',
        cited: match[1] ?? '',
        preview,
        marked,
      })
    }

    // A backticked span is the only carrier a rule writes a citation in. No
    // rule in either corpus uses a markdown link, and matching running prose
    // would report every sentence that happens to name a file.
    for (const { content: span } of findBacktickSpans(line)) {
      const form = classifySpan(span)
      if (form === undefined) continue
      found.push({ line: index + 1, form, cited: span, preview, marked })
    }
  }

  return found
}

/**
 * The paths one rule declares in its own frontmatter.
 *
 * A rule spelling a whole path there is declaring that exact artifact, and a
 * body line naming it again is naming what the rule governs rather than
 * pointing a reader somewhere. `governance/rules/canon/660-diagrams.md` tells
 * its reader to convert a `.claude/DIAGRAMS.md` left by an older install, which
 * is correctly absent from this tree and correctly named in the rule.
 */
function governedPaths(text: string): string[] {
  const parsed = parseFrontmatter(text)
  const paths = parsed?.fields.paths
  if (!Array.isArray(paths)) return []
  return paths.filter((entry): entry is string => typeof entry === 'string')
}

/**
 * Exact declarations only, never a glob match against one.
 *
 * A glob declares a shape rather than an artifact, so a body path sitting
 * inside one is still a citation and a stale one is still a defect. Matching
 * the glob would exempt a rule scoped at `docs/**` citing a
 * `docs/agents/renamed.md` that moved, which is the class this check exists
 * to catch.
 */
function isGoverned(cited: string, declared: readonly string[]): boolean {
  return declared.includes(cited)
}

/**
 * A `paths:` list entry, with the glob captured and its quoting dropped.
 *
 * Anchored on the entry shape rather than searched for as a substring. A bare
 * scan for the glob text finds it in the `description:` line first wherever a
 * rule names what it governs in prose, which is how `596-claude-md.md` reported
 * its `CLAUDE.md` glob against line 2 instead of line 4.
 */
const LIST_ENTRY = /^\s*-\s*(?:'([^']*)'|"([^"]*)"|(\S.*?))\s*$/

/**
 * Where each declared glob sits, so a finding names a line a reader can click.
 *
 * The values come from the YAML parse and the line numbers from a scan of the
 * frontmatter block alone, rather than from a second parse of the list syntax.
 * A quoted entry, a bare one, and a flow sequence all reach the parse
 * identically, and only the first two are what this corpus writes, so a flow
 * sequence resolves its value and reports no line.
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
 * Whether the glob matches a file present in this tree.
 *
 * Read only for `internal/rules/`. A shipped rule's glob names the shape a
 * target holds, so `src/pages/**` in the Astro rule is indistinguishable by
 * pattern from a path here and resolving it would report 32 of 72 correct
 * globs as defects. The internal corpus ships nowhere, which makes the tree it
 * governs the tree present and the question answerable.
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
 * Which of `paths` git ignores, or nothing when git could not answer.
 *
 * Session scratch is the class this reaches. `.canon/tasks/index.md` is real
 * in a live project, absent from a fresh clone and from every linked worktree,
 * and a rule naming it is right either way. Resolving against the filesystem
 * alone would make the verdict depend on which tree the check ran in.
 *
 * `git check-ignore` exits 1 when nothing matches, which is a clean answer
 * rather than a failure, so only a higher code is read as one.
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
 * Resolves every path the two rule corpora cite and names the ones reaching
 * nothing, plus every frontmatter glob under `GLOB_CORPUS`.
 *
 * Two questions rather than one, because they fail the same way. A citation
 * broken by a move sends a reader to an absence, and a glob broken by a move
 * stops the rule firing at all, and neither says anything when it happens. One
 * stage reads both rather than two reading one file each.
 *
 * This gates rather than reports, unlike the superseded sweep it sits beside. A
 * path resolving to nothing carries no judgment: either the file is there or the
 * citation is stale, and the classes where absence is correct are separated
 * before the verdict rather than left for a reader to settle.
 *
 * What it cannot see is a citation that resolves and points somewhere wrong,
 * a path written without backticks, a folder or module specifier carrying no
 * extension, which `namesAFile` declines rather than guessing at, and a glob
 * that matches real files while reaching none of the work it was scoped at.
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
        // A rule git listed and the filesystem will not open is a file removed
        // since the glob answered. Skipping it under-reports rather than
        // failing a push on a race.
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
        const candidates = candidatesFor(raw.form, raw.cited, file)
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
  if (raw.form === 'path' && isGoverned(raw.cited, declared)) return 'governed'
  return 'dead'
}

/**
 * Moves the unresolved paths git ignores out of the dead set.
 *
 * Batched into one call over the whole sweep rather than one per citation, and
 * skipped outright when nothing is unresolved, so a clean corpus spawns no git
 * at all. A read git cannot answer refuses, since treating it as "nothing is
 * ignored" would fail a push over session scratch that was never in the tree.
 */
async function applyIgnored(
  root: string,
  measured: Extract<CitationReport, { kind: 'measured' }>,
): Promise<CitationReport> {
  const pending = measured.citations.filter(
    (citation) => citation.status === 'dead' && citation.form === 'path',
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
