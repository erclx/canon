import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { isMarked } from '@/sweep/exempt-marker'

/**
 * The `files` field less `src`, narrower than `src/secrets/shipped.ts` reads:
 * a corpus serves its files to a reader outside this repository, while a `src/`
 * comment is read in this checkout, where every number resolves.
 */
export const SHIPPED_CORPORA = [
  'claude',
  'docs',
  'governance',
  'scripts',
  'tooling',
] as const

/**
 * Trees inside a corpus above that no target receives, matching the negations
 * the `files` field already makes. A number under one names something its only
 * reader can already resolve.
 */
export const SHIPPED_EXCLUSIONS = [/^scripts\/eval\//] as const

/** Whether a repository-relative path sits in the gated corpus. */
export function isShippedCorpus(path: string): boolean {
  if (SHIPPED_EXCLUSIONS.some((pattern) => pattern.test(path))) return false
  if (path.endsWith('.test.ts')) return false

  return SHIPPED_CORPORA.some((corpus) => path.startsWith(`${corpus}/`))
}

export const REFERENCE_MARKER = 'canon-allow-reference'

/**
 * A pull request number, bounded so `owner/repo#1` and a Tailwind `bg-[#hex]`
 * pass. `isHexColor` spares a digit-only color by its context, never its digits.
 */
const PULL_REQUEST = /(?<![0-9A-Za-z_])#([0-9]+)(?![0-9A-Za-z_])/g

const STYLESHEET = /\.(?:css|scss|sass|less)$/

const CSS_HEX_DIGITS = new Set([3, 4, 6, 8])

/** A code span drops `#RGBA`, since a current pull request number runs four digits. */
const CODE_SPAN_HEX_DIGITS = new Set([3, 6, 8])

/**
 * Blanks a stylesheet's comments, keeping columns and line breaks. Plain CSS
 * has no `//` comment, where it opens a protocol-relative `url()` instead.
 */
function blankComments(text: string, lineComments: boolean): string {
  const comments = lineComments
    ? /\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\n]*/g
    : /\/\*[\s\S]*?(?:\*\/|$)/g
  return text.replace(comments, (comment) => comment.replace(/[^\n]/g, ' '))
}

/**
 * Whether a `PULL_REQUEST` match is a color: alone in a code span, alone in a
 * quoted attribute, or in a stylesheet's `code`, the line with comments blanked.
 */
function isHexColor(
  line: string,
  code: string | undefined,
  match: RegExpExecArray,
): boolean {
  const digits = match[1]?.length ?? 0
  const start = match.index
  const end = start + match[0].length
  const before = line.slice(0, start)

  const inCodeSpan = before.endsWith('`') && line[end] === '`'
  if (inCodeSpan && CODE_SPAN_HEX_DIGITS.has(digits)) return true
  if (!CSS_HEX_DIGITS.has(digits)) return false
  if (code?.[start] === '#') return true

  const quote = /=\s*(["'])$/.exec(before)?.[1]
  return quote !== undefined && line[end] === quote
}

/**
 * A commit sha, which resolves to nothing anywhere. Seven to forty characters
 * with no letter required, and the lookbehind rejects `@`, `/`, and `#` so the
 * qualified form and a long hex color pass. The marker answers the other survivors.
 */
const COMMIT_SHA = /(?<![0-9A-Za-z_@/#])([0-9a-f]{7,40})(?![0-9A-Za-z_])/g

/**
 * A same-repository citation, qualified or not. Qualifying against
 * `erclx/canon` fixes nothing, since a reader holding only the plugin cache or
 * package cannot open this repository's history. The literal is hardcoded.
 */
const SAME_REPOSITORY =
  /(?<![0-9A-Za-z_/])erclx\/canon(#[0-9]+|@[0-9a-f]{7,40})(?![0-9A-Za-z_])/g

/**
 * A repository-relative path under `docs/`, reported only where `isResolvable`
 * confirms it resolves here, since shape cannot separate this repository's docs
 * from an illustration of a target's tree. `canon/context/` carries no equivalent.
 */
const DOCS_PATH = /(?<![\w./-])docs\/[^\s`)\]]*\.md\b/g

/**
 * A call to `canon standards`, a verb no installed CLI carries any more, so a
 * shipped body naming it sends a reader to an unknown-command error. A page
 * saying the verb is gone carries the reference marker, and `standards-audit` is spared.
 */
const STANDARDS_CALL = /\bcanon standards(?![\w-])/g

/**
 * A phase-label-shaped token: exactly two numeric groups, with a negative
 * lookahead rejecting a third. A shipped file has no pull request to tell a
 * release by, so two groups against three is the only discriminator.
 */
const PHASE_LABEL = /\bv\d+\.\d+(?!\.\d)\b/g

/**
 * A `.claude/rules/<segments>/<slug>.md` citation from a body under
 * `claude/skills/`, the installed-path spelling `authoring-layout.md` bans as
 * authority. A folder mention passes, and the placeholder check spares an illustration.
 */
const RULE_PATH = /(?<![\w./-])\.claude\/rules\/[^\s`)\]]*?[\w-]+\.md\b/g

/**
 * A path into a stack's `configs/` or `seeds/` folder under `tooling/`, from a
 * body under `claude/skills/`, a layout no target holds. Unlike `RULE_PATH`, a
 * placeholder is reported too, and no filesystem read backs the match.
 */
const SOURCE_PATH =
  /(?<![\w./-])tooling\/[\w<>.*-]+\/(?:configs|seeds|\{[\w,]*\b(?:configs|seeds)\b[\w,]*\})(?![\w.-])[^\s`)\]]*/g

export interface ShippedReference {
  readonly file: string
  /** One-based, matching the `file:line` form a reader clicks. */
  readonly line: number
  readonly kind:
    | 'pull-request'
    | 'commit'
    | 'docs-path'
    | 'retired-verb'
    | 'phase-label'
    | 'rule-path'
    | 'source-path'
  /** The reference as written, so a report names the token to qualify. */
  readonly text: string
  /**
   * Set only for a citation of this repository's own history. Qualifying it
   * is not the fix `kind` alone would suggest, so a caller reads this before
   * choosing a remedy.
   */
  readonly selfCitation?: true
}

/**
 * Whether a matched path is a deliberate placeholder rather than a real
 * citation, true when the text carries both `<` and `>`. A real path never
 * carries either character, so the two classes cannot collide.
 */
function isPlaceholderPath(path: string): boolean {
  return path.includes('<') && path.includes('>')
}

/**
 * Whether a `DOCS_PATH` match should be reported. `file` gates out the `docs/`
 * corpus, and the placeholder check runs ahead of `existsSync`, since existence
 * mutes an illustration the check catches when bracketed.
 */
function isDocsPathReportable(
  file: string,
  path: string,
  root: string,
): boolean {
  if (file.startsWith('docs/')) return false
  if (isPlaceholderPath(path)) return false
  return existsSync(join(root, path))
}

/**
 * Whether `file` sits in the one corpus `RULE_PATH` and `SOURCE_PATH` gate: a
 * shipped skill body, minus its `REQUIREMENT.md`, which a maintainer or audit
 * reads rather than a session loading it, per `authoring-layout.md`.
 */
function isSkillBodyScope(file: string): boolean {
  return file.startsWith('claude/skills/') && !file.endsWith('/REQUIREMENT.md')
}

/**
 * Every reference in one shipped file that no marker mutes. `root` has no
 * default, since a dropped one would report zero findings rather than raise, and
 * `isMarked` reads a line and the one above, so a real citation beside a marked one ships unreported.
 */
export function referencesIn(
  file: string,
  text: string,
  root: string,
): ShippedReference[] {
  const lines = text.split('\n')
  const codeLines = STYLESHEET.test(file)
    ? blankComments(text, !file.endsWith('.css')).split('\n')
    : undefined
  const references: ShippedReference[] = []

  for (const [index, line] of lines.entries()) {
    if (isMarked(lines, index, REFERENCE_MARKER)) continue

    for (const match of line.matchAll(PULL_REQUEST)) {
      if (isHexColor(line, codeLines?.[index], match)) continue
      references.push({
        file,
        line: index + 1,
        kind: 'pull-request',
        text: match[0],
      })
    }

    for (const match of line.matchAll(COMMIT_SHA)) {
      references.push({
        file,
        line: index + 1,
        kind: 'commit',
        text: match[0],
      })
    }

    for (const match of line.matchAll(SAME_REPOSITORY)) {
      references.push({
        file,
        line: index + 1,
        kind: match[1]?.startsWith('#') ? 'pull-request' : 'commit',
        text: match[0],
        selfCitation: true,
      })
    }

    for (const match of line.matchAll(DOCS_PATH)) {
      if (!isDocsPathReportable(file, match[0], root)) continue
      references.push({
        file,
        line: index + 1,
        kind: 'docs-path',
        text: match[0],
      })
    }

    for (const match of line.matchAll(STANDARDS_CALL)) {
      references.push({
        file,
        line: index + 1,
        kind: 'retired-verb',
        text: match[0],
      })
    }

    for (const match of line.matchAll(PHASE_LABEL)) {
      references.push({
        file,
        line: index + 1,
        kind: 'phase-label',
        text: match[0],
      })
    }

    if (isSkillBodyScope(file)) {
      for (const match of line.matchAll(RULE_PATH)) {
        if (isPlaceholderPath(match[0])) continue
        references.push({
          file,
          line: index + 1,
          kind: 'rule-path',
          text: match[0],
        })
      }

      for (const match of line.matchAll(SOURCE_PATH)) {
        references.push({
          file,
          line: index + 1,
          kind: 'source-path',
          text: match[0],
        })
      }
    }
  }

  return references
}
