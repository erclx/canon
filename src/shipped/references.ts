import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { isMarked } from '@/sweep/exempt-marker'

/**
 * The corpora a target reader reaches, which is the `files` field less `src`.
 *
 * The field is the statement of what leaves this repository, and `src/secrets/
 * shipped.ts` reads it directly for the credential sweep. This list is narrower
 * on purpose rather than by omission. What decides membership here is whether
 * anything serves the file to a reader who does not hold this repository: a
 * skill body loads into a session, a docs page is read through `canon docs`, a
 * rule through a glob match, and a seed through an install. A `src/` doc comment
 * is read by someone working on the toolkit, in this checkout, where every
 * number resolves.
 *
 * That is also what keeps the check a prose pattern rather than a parser.
 * `src/design/tokens.ts` carries twenty values shaped `#191512`, which no width or boundary rule separates from a pull request
 * number, so telling them apart would need the line's syntactic position.
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
 * A pull request number a target reader resolves against their own repository.
 *
 * The leading boundary is what excludes the repair form by construction rather
 * than by exemption, and that is load bearing. A lookbehind rejecting a word
 * character before `#` never matches `erclx/canon#1299`, so a qualified
 * reference passes with no marker, and `claude/skills/session-worktree/SKILL.md`
 * already ships `anthropics/claude-code#58345` in exactly that form.
 *
 * The trailing boundary is what the first shape of this pattern lacked, and it
 * costs a live finding to omit. `governance/rules/framework/tailwind.md`
 * writes `bg-[#316ff6]`, a Tailwind arbitrary hex color, which an unbounded
 * `#[0-9]+` reads as pull request 316. Requiring a non-word character after the
 * digits rejects it and rejects nothing real, since a citation is always
 * followed by a space, a backtick, or punctuation.
 *
 * Any digit run counts. This repository is past `#1300` so a four-digit pattern
 * reads as complete, and `#1`, `#12`, and `#123` all resolve to the wrong thing
 * in a target just as surely.
 */
const PULL_REQUEST = /(?<![0-9A-Za-z_])#([0-9]+)(?![0-9A-Za-z_])/g

/**
 * A commit sha, which is the worse half: it resolves to nothing anywhere rather
 * than to the wrong pull request.
 *
 * Seven characters is git's own short-sha floor and forty is a full one. No
 * rule here requires a letter, because an all-digit sha is real:
 * `orchestrator-poll.md` cites `5653721`.
 *
 * The lookbehind rejects `@` and `/` so the repair form `erclx/canon@5653721`
 * passes the check that told the author to write it, and rejects `#` so a hex
 * color long enough to reach the floor is not reported twice under two names.
 *
 * Three false-positive classes survive by construction, and the marker answers
 * each: an all-digit hex color, a seven-letter word spelled from `a` through
 * `f` alone, such as `defaced`, and any run of seven or more decimal digits,
 * such as an unseparated date or a large count. No narrowing answers the third,
 * since requiring a letter loses the all-digit sha above.
 */
const COMMIT_SHA = /(?<![0-9A-Za-z_@/#])([0-9a-f]{7,40})(?![0-9A-Za-z_])/g

/**
 * A same-repository citation, qualified or not. Qualifying `#123` or a sha
 * against `erclx/canon` is the repair `PULL_REQUEST` and `COMMIT_SHA` above
 * read as the fix, and it fixes nothing here: a reader holding only the
 * plugin cache or the published package still cannot open this repository's
 * own history, so the qualified form resolves exactly as badly as the bare
 * one.
 *
 * The literal is hardcoded rather than read from `package.json` or
 * `git remote`, matching `src/feedback/github-format.ts` and `src/commands/repo.ts`,
 * which already hardcode it.
 *
 * Same word-boundary discipline as the two patterns above: a word character
 * ahead of `erclx` would mean this match is a suffix of some other token, and
 * a word character behind the digits would mean the citation continues past
 * what was captured.
 */
const SAME_REPOSITORY =
  /(?<![0-9A-Za-z_/])erclx\/canon(#[0-9]+|@[0-9a-f]{7,40})(?![0-9A-Za-z_])/g

/**
 * A repository-relative path under `docs/`, reported only where `isResolvable`
 * confirms it resolves against this checkout.
 *
 * Shape alone cannot separate a citation of this repository's own reference
 * corpus from an illustration naming a target's own tree, since both are
 * `docs/...md` tokens: `docs/agents/tasks.md` and `docs/retry.md` read
 * identically to a pattern with no filesystem behind it. Of 124 such tokens
 * across the shipped corpora, four distinct paths resolved here and the rest
 * named a target's own tree, measured on 2026-09-03. Resolving against `root`
 * is what turns that 124-hit pattern into the four-hit gate.
 *
 * `canon/context/` carries no equivalent pattern. The same resolution test
 * cannot separate a path every scaffolded project holds, such as
 * `canon/context/index.md`, from this repository's own domain entry, such
 * as `canon/context/context-model.md`, since both resolve here and only the
 * second is a defect. That is a semantic read no pattern makes, so it stays
 * with the rule and the review checklist rather than joining this reader.
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
 * `VERSION_TOKEN` in `src/labels/phase.ts` also matches a semver tag, which
 * fits there because `scanPhaseLabels` asks whether the carrying pull request
 * is release-please's own. A shipped file carries no pull request, so shape is
 * the only discriminator: a phase label has two groups and a semver tag three.
 *
 * A target holds no board to resolve a label against, so a bare instance
 * here is unresolvable the same way a same-repository citation is, and is
 * muted the same way when it names the label format rather than a real row.
 */
const PHASE_LABEL = /\bv\d+\.\d+(?!\.\d)\b/g

/**
 * A `.claude/rules/<segments>/<slug>.md` citation from a body under
 * `claude/skills/`, the installed-path spelling `authoring-layout.md` bans a
 * shipped skill body from citing as authority for its own behavior.
 *
 * Anchored on a trailing `.md` file rather than on the bare `.claude/rules/`
 * prefix, which is what keeps a folder mention, such as `create-rule`,
 * `target-check`, and `target-setup` write, from matching: it ends in `/` or
 * names no `.md`. The segments between `rules/` and the file admit both a
 * governance-namespace path (`canon/canon/scratch.md`) and a
 * project-namespace one (`project/<subdir>/<slug>.md`) without distinguishing
 * them, since either shape is the same broken citation, and the placeholder
 * check spares the bracketed illustration.
 */
const RULE_PATH = /(?<![\w./-])\.claude\/rules\/[^\s`)\]]*?[\w-]+\.md\b/g

/**
 * A path into a stack's `configs/` or `seeds/` folder under `tooling/`, from a
 * body under `claude/skills/`. That tree is this toolkit's own source layout,
 * which a target never holds under any name, since install copies its contents
 * to the target's root rather than reproducing the folders.
 *
 * Unlike `RULE_PATH`, a placeholder such as `tooling/<stack>/configs/` is
 * reported too. The bracket spares an illustration of a path a target does
 * hold, and no target holds this one, so the bracketed form still describes
 * this checkout alone. The segment class admits `<` and `>` for that reason,
 * and a brace group such as `{configs,seeds}` matches when it lists either.
 *
 * Only `configs` and `seeds` match. A bare `tooling/`, which names the
 * category, a stack's `manifest.toml`, and a `canon tooling sync` call pass.
 *
 * The leading boundary is `DOCS_PATH`'s, so `foo/tooling/base/configs/` reads
 * as some other tree's folder and passes. No filesystem read backs the match,
 * since a path resolving here proves nothing about a target.
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
 * `file` gates the `docs/` corpus out by the caller's own location rather
 * than by a pattern exemption: a citation from inside `docs/` is read
 * together with the rest of that corpus through the same `canon docs`
 * resolution, which is a weaker claim than one from a skill body with no
 * `docs/` sibling at all.
 *
 * The placeholder check runs ahead of `existsSync` rather than replacing it.
 * Shape alone cannot separate a genuinely broken same-repository citation
 * from a legitimate illustration of a target project's own tree, such as
 * `docs/retry.md`, and no signal in the text draws that line, so existence
 * still does the work of muting those. The placeholder check only catches
 * the bracketed illustrations existence alone would report as broken.
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
 * The corpus walk is deliberately absent, which lets most of the shape be
 * tested against a string rather than against a fixture. That is the seam
 * `headingCitationsIn` draws in `src/claude/skills-headings.ts` and `citationsIn`
 * draws in `skills-reach.ts`. `DOCS_PATH` is the one pattern that still
 * needs a filesystem, since resolving against this checkout is the only thing
 * that separates a real citation from an illustration, so `referencesIn`
 * takes `root` as the one caller-supplied exception to that rule. `root` is
 * required rather than defaulted, since a caller that dropped it silently
 * would report zero findings rather than raising, which is the wrong failure
 * direction for a gate.
 *
 * The unit is the match rather than the line, unlike those two, because one
 * line here can carry three separate tokens each needing its own repair and a
 * report naming the line once leaves two of them unsaid.
 *
 * `isMarked` reads the line itself and the line above and stops there, so the
 * marker mutes a line and nothing narrower. A real citation later added beside
 * a marked illustration ships unreported.
 */
export function referencesIn(
  file: string,
  text: string,
  root: string,
): ShippedReference[] {
  const lines = text.split('\n')
  const references: ShippedReference[] = []

  for (const [index, line] of lines.entries()) {
    if (isMarked(lines, index, REFERENCE_MARKER)) continue

    for (const match of line.matchAll(PULL_REQUEST)) {
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
