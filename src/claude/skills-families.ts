export interface SkillFamily {
  /** The value a shipped `SKILL.md` declares as `metadata.family`. */
  readonly key: string
  /** The skill map heading the family's rows sit under, verbatim. */
  readonly group: string
}

/**
 * The one vocabulary a shipped skill's family is drawn from, in the order the
 * skill map reads across its two pages. A heading is the map's prose and a key
 * is what frontmatter carries, so renaming a heading touches this constant and
 * no skill.
 *
 * Import-free on purpose: `skills-list.ts` and `skills-audit.ts` both read it,
 * and the first already imports the second.
 */
export const SKILL_FAMILIES: readonly SkillFamily[] = [
  { key: 'setup', group: 'Set up a project' },
  { key: 'decide', group: 'Decide what to build' },
  { key: 'build', group: 'Build the feature' },
  { key: 'check', group: 'Check the work before it leaves the branch' },
  { key: 'ship', group: 'Ship it' },
  { key: 'after-pr', group: 'After the pull request opens' },
  { key: 'parallel', group: 'Run several tracks at once' },
  { key: 'upkeep', group: 'Keep the project current with the toolkit' },
  { key: 'generate', group: 'Generate an artifact on demand' },
  { key: 'answer', group: 'Answer a question at any point' },
]

export function familyKeys(): string[] {
  return SKILL_FAMILIES.map((family) => family.key)
}

export function isFamilyKey(value: string): boolean {
  return SKILL_FAMILIES.some((family) => family.key === value)
}
