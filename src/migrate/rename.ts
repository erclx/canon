/**
 * The token rewrite behind a mechanical rename. The scanner is one pass with the protected
 * forms tried first, since a chain of replacements reprocesses its own output. Read the
 * rewritten fixtures rather than trusting a clean run, and a path built with `join` is never seen.
 */

/**
 * An article whose agreement the rename breaks. Stated as a pattern and a replacement so a
 * preset is data a test can read back, and run against the rewritten line, clear of the
 * protected forms.
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
   * Whether a token has to end where the word ends, which whole names want and word stems cannot. A skill name is not a stem, and the
   * spelling below is the pre-rename one on purpose (canon-keep-retired):
   * `claude-worktree` inside `claude-worktrees` is a different subject the rename must not move.
   */
  readonly wholeToken?: boolean
}

/**
 * A spec with its scanner compiled and its alternatives ordered. `tokenOrder` is reported
 * because the ordering is a correctness property a caller has to assert, and the rewritten
 * string shows it only when two tokens happen to share a destination.
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
 * A branch that can never take, standing in for an empty protected list. The scanner reads a
 * protected match off capture group 1, so an empty alternation would match everywhere.
 */
const NEVER_MATCHES = '(?!)'

/**
 * What may not follow a token when a preset asks for whole tokens. A plain word boundary
 * accepts a following hyphen, so `plan-intake` would match inside `plan-intake-answer`.
 * Naming the characters that continue an identifier holds on both.
 */
const TOKEN_TAIL = '(?![A-Za-z0-9_-])'

function escapeForPattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Longest first, so a token is never consumed by a shorter token it contains. The sort is
 * stable, so alternatives of equal length keep the order the author wrote.
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
 * An indefinite article that agreed with the retired name and no longer agrees with the
 * replacement. The tail rejects a following letter rather than asking for a word boundary,
 * which separates `an canonical` from `an CANON_STATE_DIR`.
 */
const AITK_ARTICLE = /\b([Aa])n(\s+`?)(canon|CANON|Canon)(?![A-Za-z])/g

/**
 * The `aitk` to `canon` rename. `aitk-sandbox`, bare or owner-scoped, is protected, since
 * GitHub still redirects that repository name. Case is carried in the map rather than
 * derived, and the files stating the old name on purpose are excluded.
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
 * Whether a line names a retired spelling on purpose, such as a fallback path or a retired environment variable. The marker sits on the line itself or on the
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
