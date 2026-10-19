import { type DensityKind, densityFindings } from '@/markdown/density'
import { type BodyLine, bodyLines } from '@/markdown/scan'
import { LIST_ITEM } from '@/markdown/structure'

/**
 * The four counted limits a pull request section carries. The heading limits
 * of `densityFindings()` are left out, since a body takes no subheading at all
 * and `subheading` reports that once.
 */
const COUNTED = [
  'paragraph-length',
  'paragraph-run',
  'bullet-length',
  'bullet-run',
] as const satisfies readonly DensityKind[]

type CountedKind = (typeof COUNTED)[number]

export type BodyDensityKind = CountedKind | 'subheading' | 'mixed-form'

function isCounted(kind: DensityKind): kind is CountedKind {
  return (COUNTED as readonly DensityKind[]).includes(kind)
}

export interface BodyDensityFinding {
  /** The H2 the finding sits under, without its hashes, or null before the first. */
  readonly section: string | null
  readonly kind: BodyDensityKind
  /** The line in the whole body, not in its section. */
  readonly line: number
  readonly value: number | null
  readonly limit: number | null
}

const H2 = /^##\s+(.*?)\s*$/
const SUBHEADING = /^(#{3,6})\s/
const BOLD_ONLY = /^(\*\*|__)[^*_].*\1\s*$/
const BOLD_LED = /^(\*\*|__)\S/

interface Section {
  readonly name: string | null
  readonly lines: readonly BodyLine[]
}

/**
 * Every density breach in a pull request body, graded per H2 section after
 * the shape `claude/skills/git-pr/references/pr.md` states.
 *
 * `densityFindings()` stays the docs measure, so the PR exemptions live here
 * as splits around it rather than as options on it. Testing takes no counted
 * limit, since its checkboxes count as a bullet run. Key changes splits at
 * each bold label alone on its own block, whatever its length, and Technical context
 * at each bold-led paragraph, so a lead-in starts a new run. Technical
 * context also reports mixing bullets with paragraphs.
 */
export function bodyDensity(body: string): BodyDensityFinding[] {
  const found: BodyDensityFinding[] = []

  for (const section of sectionsOf(bodyLines(body))) {
    found.push(...subheadings(section))
    if (section.name === 'Testing') continue

    const chunks =
      section.name === 'Key changes'
        ? splitAt(section.lines, opensBlock(section.lines, BOLD_ONLY), true)
        : section.name === 'Technical context'
          ? splitAt(section.lines, opensBlock(section.lines, BOLD_LED), false)
          : [section.lines]

    for (const chunk of chunks) {
      for (const finding of densityFindings(chunk)) {
        const { kind } = finding
        if (!isCounted(kind)) continue
        found.push({ section: section.name, ...finding, kind })
      }
    }

    if (section.name === 'Technical context') {
      const mixed = mixedForm(section.lines)
      if (mixed !== undefined) {
        found.push({
          section: section.name,
          kind: 'mixed-form',
          line: mixed,
          value: null,
          limit: null,
        })
      }
    }
  }

  return found.sort((a, b) => a.line - b.line)
}

function sectionsOf(lines: readonly BodyLine[]): Section[] {
  const sections: Section[] = []
  let current: { name: string | null; lines: BodyLine[] } = {
    name: null,
    lines: [],
  }

  for (const line of lines) {
    const heading = line.fenced ? null : H2.exec(line.text)
    if (heading) {
      sections.push(current)
      current = { name: heading[1], lines: [] }
    } else {
      current.lines.push(line)
    }
  }
  sections.push(current)

  return sections.filter((section) => section.lines.length > 0)
}

function subheadings(section: Section): BodyDensityFinding[] {
  return section.lines.flatMap((line) => {
    const match = line.fenced ? null : SUBHEADING.exec(line.text)
    if (!match) return []
    return [
      {
        section: section.name,
        kind: 'subheading' as const,
        line: line.number,
        value: match[1].length,
        limit: 2,
      },
    ]
  })
}

/**
 * Cuts a section into chunks at each line the test picks, never inside a
 * fence. `drop` leaves the picked line out of both chunks, as a bold label
 * that only names the group below it.
 */
function splitAt(
  lines: readonly BodyLine[],
  breaks: (line: BodyLine, index: number) => boolean,
  drop: boolean,
): BodyLine[][] {
  const chunks: BodyLine[][] = [[]]

  for (const [index, line] of lines.entries()) {
    if (!line.fenced && breaks(line, index)) {
      chunks.push(drop ? [] : [line])
    } else {
      chunks[chunks.length - 1].push(line)
    }
  }

  return chunks
}

/**
 * Picks a line matching the pattern that opens a block, after a blank line or
 * at the section start. A line directly under a bullet or a paragraph renders
 * as its lazy continuation, so it breaks nothing.
 */
function opensBlock(
  lines: readonly BodyLine[],
  pattern: RegExp,
): (line: BodyLine, index: number) => boolean {
  return (line, index) =>
    pattern.test(line.text) &&
    (index === 0 || lines[index - 1].text.trim() === '')
}

/**
 * The line of the first block of whichever form appears second, when a
 * section carries both bullets and paragraphs, else undefined.
 *
 * A column-zero line directly under an item with no blank between is a lazy
 * continuation of that item, not a paragraph.
 */
function mixedForm(lines: readonly BodyLine[]): number | undefined {
  let firstItem: number | undefined
  let firstParagraph: number | undefined
  let previous: 'blank' | 'item' | 'paragraph' | 'other' = 'blank'

  for (const line of lines) {
    const text = line.text
    if (line.fenced) {
      previous = 'other'
      continue
    }
    if (text.trim() === '') {
      previous = 'blank'
      continue
    }
    if (/^\s/.test(text)) continue

    if (LIST_ITEM.test(text)) {
      firstItem ??= line.number
      previous = 'item'
    } else if (/^(#|\||>|<)/.test(text)) {
      previous = 'other'
    } else if (previous === 'blank' || previous === 'other') {
      firstParagraph ??= line.number
      previous = 'paragraph'
    }
  }

  if (firstItem === undefined || firstParagraph === undefined) return undefined
  return Math.max(firstItem, firstParagraph)
}
