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
 * A commit sha, which is the worse half: it resolves to nothing anywhere rather
 * than to the wrong pull request.
 *
 * Seven characters is git's short-sha floor and forty a full one, and no letter
 * is required, since an all-digit sha is real. The lookbehind rejects `@` and
 * `/` so the qualified repair form passes, and `#` so a long hex color is not
 * reported twice. An all-digit hex color, a word spelled only from `a` to `f`,
 * and a long decimal run survive by construction, and the marker answers each.
 */
const COMMIT_SHA = /(?<![0-9A-Za-z_@/#])([0-9a-f]{7,40})(?![0-9A-Za-z_])/g

/**
 * A same-repository citation, qualified or not. Qualifying a number or a sha
 * against `erclx/canon` fixes nothing, since a reader holding only the plugin
 * cache or the package still cannot open this repository's history.
 *
 * The literal is hardcoded, as `src/feedback/github-format.ts` and
 * `src/commands/repo.ts` already do. Word boundaries on both ends keep a match
 * from being the suffix of another token or stopping short of the citation.
 */
const SAME_REPOSITORY =
  /(?<![0-9A-Za-z_/])erclx\/canon(#[0-9]+|@[0-9a-f]{7,40})(?![0-9A-Za-z_])/g

/**
 * A repository-relative path under `docs/`, reported only where `isResolvable`
 * confirms it resolves against this checkout.
 *
 * Shape alone cannot separate this repository's own docs from an illustration
 * of a target's tree, such as `docs/retry.md`, and most such tokens name a
 * target's tree, so resolving against `root` is what makes this a gate.
 * `canon/context/` carries no equivalent, since every scaffolded project holds
 * some of those paths too, and telling them apart is a semantic read left to
 * the rule and the review checklist.
 */
const DOCS_PATH = /(?<![\w./-])docs\/[^\s`)\]]*\.md\b/g

/**
 * A call to `canon standards`, a verb no installed CLI carries any more. A
 * shipped body naming it sends a target reader to an unknown-command error,
 * so every corpus reports it, `docs/` included. A page saying the verb is gone
 * carries the reference marker on that line.
 *
 * The trailing lookahead keeps a hyphenated token such as a `standards-audit`
 * page name from matching, since that names a file rather than a call.
 */
const STANDARDS_CALL = /\bcanon standards(?![\w-])/g

/**
 * A phase-label-shaped token: exactly two numeric groups, with a negative
 * lookahead rejecting a third.
 *
 * `VERSION_TOKEN` in `src/labels/phase.ts` also matches a semver tag, since
 * `scanPhaseLabels` can ask whether a pull request is a release. A shipped
 * file has no pull request, so two groups against three is the only
 * discriminator. A bare label is muted the same way as a same-repository
 * citation when it names the format rather than a row.
 */
const PHASE_LABEL = /\bv\d+\.\d+(?!\.\d)\b/g

/**
 * A `.claude/rules/<segments>/<slug>.md` citation from a body under
 * `claude/skills/`, the installed-path spelling `authoring-layout.md` bans a
 * shipped skill body from citing as authority for its own behavior.
 *
 * Anchored on a trailing `.md` file, so a folder mention ending in `/` passes.
 * The segments admit a governance or a project namespace alike, since either
 * is the same broken citation, and the placeholder check spares the bracketed
 * illustration.
 */
const RULE_PATH = /(?<![\w./-])\.claude\/rules\/[^\s`)\]]*?[\w-]+\.md\b/g

/**
 * A path into a stack's `configs/` or `seeds/` folder under `tooling/`, from a
 * body under `claude/skills/`, a source layout no target holds under any name.
 *
 * Unlike `RULE_PATH`, a bracketed placeholder is reported too, since no target
 * holds this path in any form, and a brace group matches when it lists either
 * folder. A bare `tooling/`, a `manifest.toml`, and a `canon tooling sync` call
 * pass. The leading boundary is `DOCS_PATH`'s, and no filesystem read backs
 * the match, since resolving here proves nothing about a target.
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
 * Whether a `DOCS_PATH` match should be reported.
 *
 * `file` gates out the `docs/` corpus by the caller's location, since a
 * citation inside it resolves through `canon docs` with the rest. The
 * placeholder check runs ahead of `existsSync` rather than replacing it, since
 * existence still mutes an illustration of a target's tree and the check only
 * catches bracketed illustrations existence would report as broken.
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
 * Whether `file` sits in the one corpus `RULE_PATH` and `SOURCE_PATH` gate:
 * a shipped skill body, minus its own `REQUIREMENT.md`.
 *
 * The ban lives in `authoring-layout.md`, stated for one reader: a
 * session loading the `SKILL.md` body a target actually receives.
 * `REQUIREMENT.md` is excluded for the reason that file states there, since a
 * maintainer or an audit command reads it rather than a session loading it,
 * so the resolver rule never applies to it.
 */
function isSkillBodyScope(file: string): boolean {
  return file.startsWith('claude/skills/') && !file.endsWith('/REQUIREMENT.md')
}

/**
 * Every reference in one shipped file that no marker mutes.
 *
 * The corpus walk is absent, so most of the shape tests against a string, the
 * seam `headingCitationsIn` and `citationsIn` draw. `root` is the one exception,
 * since `DOCS_PATH` resolves against this checkout, and it has no default, since
 * a dropped root would report zero findings rather than raise. The unit is the
 * match rather than the line, since one line can carry several tokens.
 * `isMarked` reads a line and the one above it, so a real citation added
 * beside a marked illustration ships unreported.
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
