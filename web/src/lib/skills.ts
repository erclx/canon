import { readCanonJson } from './canon-cli'

interface Catalog {
  readonly skills: readonly { name: string; description: string }[]
}

export interface SkillLine {
  readonly name: string
  /** The description's first sentence, which the opening's `/` menu shows beside the name. */
  readonly line: string
}

/**
 * The plugin's skills as the catalog lists them at build time, so the
 * opening's menu never carries a name the plugin no longer ships.
 */
export function readSkills(): SkillLine[] {
  const { skills } = readCanonJson<Catalog>(['claude', 'skills', 'list'])
  if (skills.length === 0)
    throw new Error('canon claude skills list returned no skills')
  return skills.map(({ name, description }) => ({
    name,
    line: firstSentence(description),
  }))
}

/** Ends at the first period followed by a space and a capital, so a dotted name such as `index.md` stays whole. */
export function firstSentence(text: string): string {
  const end = /\.\s+(?=[A-Z])/.exec(text)
  return end ? text.slice(0, end.index + 1) : text
}
