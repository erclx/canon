import { linesOutsideFences } from '@/markdown/scan'

/**
 * The closed list of section headings a pull request body may carry, in the
 * sentence case `claude/skills/git-pr/references/pr.md` states.
 */
const ALLOWED_HEADINGS: readonly string[] = [
  '## Summary',
  '## Key changes',
  '## Technical context',
  '## Outcome',
  '## Testing',
  '## For the reviewer',
]

const REQUIRED_HEADINGS: readonly string[] = ['## Summary', '## Key changes']

const H2 = /^##\s/

export interface SectionsCheck {
  /** Level-two headings the closed list does not hold, as written. */
  readonly outside: readonly string[]
  /** Required headings the body never carries. */
  readonly missing: readonly string[]
}

/**
 * Grades the level-two headings of a pull request body against the closed list.
 * The comparison is exact, while `canon pr key-changes` reads case-insensitively
 * so an older body still parses. Subheadings and fenced lines are not headings.
 */
export function checkSections(body: string): SectionsCheck {
  const headings = linesOutsideFences(body)
    .map((line) => line.trim())
    .filter((line) => H2.test(line))

  return {
    outside: headings.filter((heading) => !ALLOWED_HEADINGS.includes(heading)),
    missing: REQUIRED_HEADINGS.filter((heading) => !headings.includes(heading)),
  }
}
