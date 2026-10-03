/**
 * The prose budget `standards/design.md` sets for a design record, and the
 * counter the `design` gate stage reads it through.
 *
 * The limits live here and in the standard, never in the stage, so the stage
 * names a failure without restating what it measured against.
 *
 * A row is excluded on the same test `table()` in `@/design/parse` reads one
 * by, a line opening with a pipe, so a code span carrying a pipe or a cell
 * carrying the uncertainty tag never reaches the count.
 */
export const DESIGN_BUDGET = {
  /** Words before the first `##` section, the title excluded. */
  leadWords: 40,
  /** Words in `## Personality`, held to one paragraph. */
  personalityWords: 60,
  personalityParagraphs: 1,
  /** Bullets or paragraphs in any other section, beside its table. */
  rules: 3,
  /** Words in one of those rules, the proxy for one line. */
  ruleWords: 25,
} as const

const PERSONALITY = 'Personality'

/** A list item at any depth, which starts a rule of its own. */
const BULLET = /^\s*(?:[-*+]|\d+[.)])\s+/

interface Section {
  readonly heading: string | undefined
  readonly lines: readonly string[]
}

/**
 * Every place the record exceeds the budget, one sentence each, in document
 * order. An empty list is a record within budget, including an empty one.
 */
export function measureDesignProse(source: string): string[] {
  const findings: string[] = []

  for (const section of splitSections(source)) {
    const rules = readRules(section.lines)
    const total = rules.reduce((sum, rule) => sum + rule, 0)

    if (section.heading === undefined) {
      if (total > DESIGN_BUDGET.leadWords) {
        findings.push(
          `The lead holds ${total} words against a cap of ${DESIGN_BUDGET.leadWords}`,
        )
      }
    } else if (section.heading === PERSONALITY) {
      if (rules.length > DESIGN_BUDGET.personalityParagraphs) {
        findings.push(
          `${PERSONALITY} holds ${rules.length} paragraphs against a cap of ${DESIGN_BUDGET.personalityParagraphs}`,
        )
      }
      if (total > DESIGN_BUDGET.personalityWords) {
        findings.push(
          `${PERSONALITY} holds ${total} words against a cap of ${DESIGN_BUDGET.personalityWords}`,
        )
      }
    } else {
      if (rules.length > DESIGN_BUDGET.rules) {
        findings.push(
          `${section.heading} holds ${rules.length} rules against a cap of ${DESIGN_BUDGET.rules}`,
        )
      }
      rules.forEach((words, index) => {
        if (words > DESIGN_BUDGET.ruleWords) {
          findings.push(
            `${section.heading} rule ${index + 1} holds ${words} words against a cap of ${DESIGN_BUDGET.ruleWords}`,
          )
        }
      })
    }
  }

  return findings
}

/** The lead under an undefined heading, then each `##` section in order. */
function splitSections(source: string): Section[] {
  const sections: { heading: string | undefined; lines: string[] }[] = [
    { heading: undefined, lines: [] },
  ]
  for (const line of source.split('\n')) {
    const match = line.match(/^##\s+(.+?)\s*$/)
    if (match) {
      sections.push({ heading: match[1], lines: [] })
    } else if (!/^#\s/.test(line)) {
      sections[sections.length - 1].lines.push(line)
    }
  }
  return sections
}

/**
 * The word count of each rule in a section. A rule opens on a bullet or on
 * the first prose line after a break, and every following prose line joins it
 * until a blank line, a table row, a heading, or the next bullet.
 */
function readRules(lines: readonly string[]): number[] {
  const rules: number[] = []
  let isOpen = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('|') || trimmed.startsWith('#')) {
      isOpen = false
      continue
    }
    const text = trimmed.replace(BULLET, '')
    const count = text.split(/\s+/).filter(Boolean).length
    if (BULLET.test(line) || !isOpen) {
      rules.push(count)
      isOpen = true
    } else {
      rules[rules.length - 1] += count
    }
  }

  return rules
}
