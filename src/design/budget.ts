import { canonicalHeading } from '@/design/parse'
import { stripFrontmatter } from '@/markdown/frontmatter'

/**
 * The prose budget `claude/skills/design-record/references/design.md` sets for a
 * design record, and the counter the `design` gate stage reads it through. A row,
 * a `<` line, a fenced block, and a multi-line HTML comment are excluded, as `table()` and `prose()` in `@/design/parse` do.
 */
export const DESIGN_BUDGET = {
  /** Words before the first `##` section, the title excluded. */
  leadWords: 40,
  /** Words in `## Overview`, held to one paragraph. */
  overviewWords: 60,
  overviewParagraphs: 1,
  /** Bullets or paragraphs in any other section, beside its table. */
  rules: 3,
  /** Words in one of those rules, the proxy for one line. */
  ruleWords: 25,
} as const

const OVERVIEW = 'Overview'

const LAYOUT = 'Layout'

/** The labeled line `## Layout` carries as data a reader parses, the board's draw widths, which spends no rule. */
const LAYOUT_DATA = /^\s*(?:[-*+]\s+)?Draw widths:/i

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
    const rules = readRules(
      section.heading === LAYOUT
        ? section.lines.filter((line) => !LAYOUT_DATA.test(line))
        : section.lines,
    )
    const total = rules.reduce((sum, rule) => sum + rule, 0)

    if (section.heading === undefined) {
      if (total > DESIGN_BUDGET.leadWords) {
        findings.push(
          `The lead holds ${total} words against a cap of ${DESIGN_BUDGET.leadWords}`,
        )
      }
    } else if (canonicalHeading(section.heading) === OVERVIEW) {
      if (rules.length > DESIGN_BUDGET.overviewParagraphs) {
        findings.push(
          `${section.heading} holds ${rules.length} paragraphs against a cap of ${DESIGN_BUDGET.overviewParagraphs}`,
        )
      }
      if (total > DESIGN_BUDGET.overviewWords) {
        findings.push(
          `${section.heading} holds ${total} words against a cap of ${DESIGN_BUDGET.overviewWords}`,
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
  for (const line of stripFrontmatter(source).split('\n')) {
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
  let isFenced = false
  let isCommented = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (isCommented) {
      isCommented = !trimmed.includes('-->')
      continue
    }
    if (trimmed.startsWith('<!--')) {
      isCommented = !trimmed.includes('-->', 4)
      isOpen = false
      continue
    }
    if (trimmed.startsWith('```')) {
      isFenced = !isFenced
      isOpen = false
      continue
    }
    if (
      isFenced ||
      trimmed === '' ||
      trimmed.startsWith('|') ||
      trimmed.startsWith('#') ||
      trimmed.startsWith('<')
    ) {
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
