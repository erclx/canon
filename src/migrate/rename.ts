/**
 * The token rewrite behind a mechanical rename.
 *
 * The sweep is mechanical and its danger is entirely in what it must not
 * touch, so the scanner is one pass with the protected forms tried first
 * rather than a chain of replacements. A chain reprocesses its own output,
 * which is how a protected form that contains the token gets rewritten by a
 * later rule that cannot see it was already decided.
 *
 * The token map, the protected forms, and the exclusion set are a parameter
 * rather than module state, so one engine serves more than one rename. Two
 * sweeps sharing a module constant would have to agree on a single map, and
 * the second rename this repository needed shares nothing with the first
 * except the scanning discipline above.
 */

/**
 * An article whose agreement the rename breaks.
 *
 * Stated as a pattern and a replacement rather than a function so a preset is
 * data a test can read back. It runs against the already-rewritten line, which
 * is what keeps it clear of the protected forms: a form the scanner passed
 * through still spells the old token afterward, so it never matches here.
 */
export interface ArticleFixup {
  readonly pattern: RegExp
  readonly replacement: string
}

/** One rename's rules, as an author states them. */
export interface RenameRuleSpec {
  /** Every spelling of the token, and what each becomes. */
  readonly replacements: Readonly<Record<string, string>>
  /** Marks a line that names a retired spelling on purpose. */
  readonly keepMarker: string
  /** Forms carrying a token that name something the rename leaves alone. */
  readonly protectedForms?: readonly string[]
  /** Files whose content is left alone entirely. */
  readonly excludedPaths?: readonly string[]
  /** Path prefixes whose files are left alone entirely. */
  readonly excludedPrefixes?: readonly string[]
  readonly articleFixups?: readonly ArticleFixup[]
  /**
   * Whether a token has to end where the word ends.
   *
   * A rename whose tokens are whole names wants this, and one whose tokens are
   * word stems cannot have it. `aitk` is a stem that legitimately carries a
   * suffix, as in `aitk-allow-superseded`, so requiring a boundary there would
   * leave every hyphenated form behind. A skill name is not a stem, and the
   * spelling below is the pre-rename one on purpose (canon-keep-retired):
   * `claude-worktree` inside `claude-worktrees` is a different subject, the
   * wiki page about the harness feature, which the rename must not move.
   */
  readonly wholeToken?: boolean
}

/**
 * A spec with its scanner compiled and its alternatives ordered.
 *
 * `tokenOrder` is reported rather than kept private because the ordering is a
 * correctness property a caller has to be able to assert. A token containing a
 * shorter token has to be tried first, and reading that off the rewritten
 * string only works when the two happen to share a destination, which is
 * correctness by accident rather than by rule.
 */
export interface RenameRules {
  readonly replacements: Readonly<Record<string, string>>
  readonly keepMarker: string
  readonly protectedForms: readonly string[]
  readonly tokenOrder: readonly string[]
  readonly excludedPaths: readonly string[]
  readonly excludedPrefixes: readonly string[]
  readonly articleFixups: readonly ArticleFixup[]
  readonly scan: RegExp
}

/**
 * A branch that can never take, standing in for an empty protected list.
 *
 * The scanner reads a protected match off capture group 1, so a preset that
 * protects nothing still has to emit that group or every later group shifts by
 * one. An empty alternation would match the empty string at every position
 * instead, which reports a protected hit on every character.
 */
const NEVER_MATCHES = '(?!)'

/**
 * What may not follow a token when a preset asks for whole tokens.
 *
 * A plain word boundary rejects a following letter and accepts a following
 * hyphen, since `\b` reads a hyphen as the end of a word. That leaves
 * `plan-intake` matching inside `plan-intake-answer`, with the ordering of
 * the alternation the only thing standing between them. Naming the characters
 * that continue an identifier holds on both, so the ordering and the boundary
 * each cover what the other could miss, and a slash, a dot, or a backtick
 * still ends a token.
 */
const TOKEN_TAIL = '(?![A-Za-z0-9_-])'

function escapeForPattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Longest first, so a token is never consumed by a shorter token it contains.
 *
 * The sort is stable, so alternatives of equal length keep the order the
 * author wrote them in and a preset whose tokens are all one length compiles
 * to the alternation it already had.
 */
function longestFirst(values: readonly string[]): readonly string[] {
  return [...values].sort((left, right) => right.length - left.length)
}

/**
 * One alternation so the engine decides each position once. Group 1 is a
 * protected form and group 2 is a token to rewrite, and the protected branch
 * sits first because a regex alternation is ordered.
 */
function compileScan(
  protectedForms: readonly string[],
  tokenOrder: readonly string[],
  wholeToken: boolean,
): RegExp {
  const guarded =
    protectedForms.length > 0
      ? protectedForms.map(escapeForPattern).join('|')
      : NEVER_MATCHES

  const tail = wholeToken ? TOKEN_TAIL : ''

  return new RegExp(
    `(${guarded})|(${tokenOrder.map(escapeForPattern).join('|')})${tail}`,
    'g',
  )
}

export function defineRenameRules(spec: RenameRuleSpec): RenameRules {
  const protectedForms = longestFirst(spec.protectedForms ?? [])
  const tokenOrder = longestFirst(Object.keys(spec.replacements))

  return {
    replacements: spec.replacements,
    keepMarker: spec.keepMarker,
    protectedForms,
    tokenOrder,
    excludedPaths: spec.excludedPaths ?? [],
    excludedPrefixes: spec.excludedPrefixes ?? [],
    articleFixups: spec.articleFixups ?? [],
    scan: compileScan(protectedForms, tokenOrder, spec.wholeToken === true),
  }
}

/**
 * An indefinite article that agreed with the retired name and no longer
 * agrees with the replacement.
 *
 * The old name opens on a vowel sound and the new one does not, so every
 * `an aitk` in the corpus reads wrong the moment the token moves.
 *
 * The tail rejects a following letter rather than asking for a word boundary,
 * which is what separates `an canonical` from `an CANON_STATE_DIR`. A boundary
 * treats the underscore as part of the word and declines the environment
 * variable, where the whole identifier is the token continuing.
 */
const AITK_ARTICLE = /\b([Aa])n(\s+`?)(canon|CANON|Canon)(?![A-Za-z])/g

/**
 * The `aitk` to `canon` rename.
 *
 * `aitk-sandbox` is the retired spelling of a repository that was later renamed
 * `canon-sandbox`, and GitHub still resolves the old name through a redirect.
 * It has to win against the bare token, and it also has to win against the
 * owner-scoped spelling, so a consumer's text naming `erclx/aitk-sandbox` keeps
 * the form that resolves rather than being rewritten.
 *
 * Case is carried in the map rather than derived, because the uppercase form
 * is an environment variable prefix and the title-case form is a heading word,
 * and a derived transform would have to guess which convention it was looking
 * at.
 *
 * The changelog is release history. Its entries record what shipped under the
 * old name, so rewriting them falsifies the record, and the pull request links
 * it carries keep resolving because GitHub redirects a renamed repository's
 * old URLs. An eval result is a transcript on the same argument, recording the
 * commands a session actually ran under whatever name was current then.
 *
 * The sweep's own source is the other excluded member, and it is not a
 * preference. This module states the `aitk` map as literal keys, so rewriting
 * it turns every key into its own replacement and leaves a rewriter that maps
 * `canon` to `canon` and matches nothing.
 *
 * The four test files below exist to prove the retired spellings still
 * resolve, so both names appear in each on purpose. Rewriting one is worse
 * than a broken test: the retired-variable case would collapse into a copy of
 * the current-variable case beside it and keep passing, reporting coverage for
 * a fallback nothing exercises any more.
 */
export const AITK_RULES: RenameRules = defineRenameRules({
  replacements: {
    aitk: 'canon',
    AITK: 'CANON',
    Aitk: 'Canon',
  },
  keepMarker: 'canon-keep-retired',
  protectedForms: ['aitk-sandbox'],
  excludedPrefixes: ['src/migrate/', 'scripts/eval/result-'],
  excludedPaths: [
    'CHANGELOG.md',
    'src/commands/migrate.ts',
    'src/sync/stamp.test.ts',
    'src/targets/registry.test.ts',
    'src/targets/sweep.test.ts',
    'src/cli/ui.test.ts',
  ],
  articleFixups: [{ pattern: AITK_ARTICLE, replacement: '$1$2$3' }],
})

export interface ScanCount {
  readonly renamed: number
  readonly protectedCount: number
}

export function isExcludedPath(path: string, rules: RenameRules): boolean {
  if (rules.excludedPaths.includes(path)) return true
  return rules.excludedPrefixes.some((prefix) => path.startsWith(prefix))
}

/** Rewrites every unprotected spelling of the token. */
export function renameText(text: string, rules: RenameRules): string {
  const lines = text.split('\n')
  const rewritten = lines.map((line, index) =>
    isKept(lines, index, rules) ? line : renameLine(line, rules),
  )

  return rewritten.join('\n')
}

/**
 * Whether a line names a retired spelling on purpose.
 *
 * A fallback path, a retired environment variable, and a dictionary entry
 * covering the record corpora all have to keep saying the old name, and a
 * second run over an already-renamed tree would otherwise strip exactly the
 * compatibility a rename shipped. The marker sits on the line itself or on the
 * one above it, which is the same placement `canon-allow-superseded` already
 * uses in this repository.
 */
function isKept(
  lines: readonly string[],
  index: number,
  rules: RenameRules,
): boolean {
  if (lines[index]?.includes(rules.keepMarker)) return true
  return index > 0 && (lines[index - 1]?.includes(rules.keepMarker) ?? false)
}

function renameLine(line: string, rules: RenameRules): string {
  const replaced = line.replace(
    rules.scan,
    (match, guarded: string | undefined) =>
      guarded === undefined ? rules.replacements[match] : guarded,
  )

  return rules.articleFixups.reduce(
    (text, fixup) => text.replace(fixup.pattern, fixup.replacement),
    replaced,
  )
}

/**
 * What `renameText` would do, without doing it. Reported rather than inferred
 * from a diff so a run can say how much it protected, which is the number a
 * reader needs to trust that the exclusions fired at all.
 */
export function scanText(text: string, rules: RenameRules): ScanCount {
  let renamed = 0
  let protectedCount = 0
  const lines = text.split('\n')

  for (const [index, line] of lines.entries()) {
    if (isKept(lines, index, rules)) continue

    for (const [, guarded] of line.matchAll(rules.scan)) {
      if (guarded === undefined) renamed += 1
      else protectedCount += 1
    }
  }

  return { renamed, protectedCount }
}

/**
 * The path a file moves to. Runs the same scanner as the content rewrite, so
 * a protected form appearing in a path is protected there too and the two
 * halves of the sweep cannot disagree about what the token means.
 */
export function renamePath(path: string, rules: RenameRules): string {
  return renameText(path, rules)
}
