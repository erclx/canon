/**
 * Which rule in `standards/pr.md`'s `## Title` section a title breaks.
 *
 * `structure` stands alone rather than beside the other three, because a
 * title failing the shape match has no parsed `<type>`, `<scope>`, or
 * `<subject>` to grade for casing, and `length` is read off the raw string
 * regardless of whether it parses.
 */
export type TitleFormatIssue =
  | 'structure'
  | 'casing-type'
  | 'casing-scope'
  | 'casing-subject'
  | 'length'

export interface TitleFormatCheck {
  readonly conforms: boolean
  readonly issues: readonly TitleFormatIssue[]
}

const TITLE_MAX_LENGTH = 72

// Casing-agnostic on purpose. Casing is graded separately once the shape
// matches, so `type` and `scope` accept either case here and `structure`
// reports only a title with no `<type>(<scope>)[!]: <subject>` shape at all.
const TITLE_SHAPE = /^([A-Za-z]+)\(([A-Za-z0-9][\w.-]*)\)!?: (.+)$/
const LEADING_LETTERS = /^[A-Za-z]+/

/**
 * Grades a pull request title, or a commit subject sharing the same form,
 * against `standards/pr.md`'s structure, casing, and length rules.
 *
 * Does not check `<type>` against `standards/commit.md`'s fixed enum.
 * `pr.md`'s own `## Title` section states format, casing, and length only,
 * and names no type list of its own to check against.
 */
export function checkTitleFormat(title: string): TitleFormatCheck {
  const match = TITLE_SHAPE.exec(title)

  if (match === null) {
    return { conforms: false, issues: ['structure'] }
  }

  const [, type, scope, subject] = match
  const issues: TitleFormatIssue[] = []

  if (type !== type.toLowerCase()) issues.push('casing-type')
  if (scope !== scope.toLowerCase()) issues.push('casing-scope')

  const leadingWord = LEADING_LETTERS.exec(subject)?.[0]
  if (leadingWord !== undefined && leadingWord !== leadingWord.toLowerCase()) {
    issues.push('casing-subject')
  }

  if (title.length > TITLE_MAX_LENGTH) issues.push('length')

  return { conforms: issues.length === 0, issues }
}
