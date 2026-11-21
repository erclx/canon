/**
 * Which rule in `claude/skills/git-pr/references/pr.md`'s `## Title` section a
 * title breaks. `structure` stands alone, since a title failing the shape match
 * has no parsed parts to grade, and `length` is read off the raw string.
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
 * Grades a pull request title, or a commit subject of the same form, against
 * `claude/skills/git-pr/references/pr.md`'s structure, casing, and length rules.
 * It checks no `<type>` list, since that section names none.
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
