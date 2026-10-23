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

/**
 * The opening headings of the posts a canon skill writes to a pull request,
 * after `.canon/groundwork/170-github-comment-density/04-post-catalog.md`. A
 * body opening on any other heading is not a post this reader grades.
 */
export const POST_HEADINGS = [
  'Evidence',
  'Review',
  'Review closed',
  'UI review',
  'UI review closed',
  'Review response',
  'Post-review findings',
  'Rebase',
] as const

export type PostDensityKind = CountedKind | 'heading-depth'

export interface PostDensityFinding extends Omit<BodyDensityFinding, 'kind'> {
  readonly kind: PostDensityKind
}

const LENGTHS: readonly DensityKind[] = ['paragraph-length', 'bullet-length']
const CHECKBOX = /^\s*[-*+]\s+\[[ xX]\]/
const FOOTER = /^🤖/

/**
 * Every density breach in a post a skill writes to a pull request, keyed on
 * its opening H2, or none when that heading is not in `POST_HEADINGS`.
 *
 * A post allows H3s, which the UI review groups its verdicts under, so only a
 * heading past H3 reports. The `🤖` footer and the marker never report, and a
 * table never does. Inside `<details>` a block takes the length limits alone,
 * since a reader opens it on purpose. A bold-led paragraph starts a new
 * paragraph run, and a checklist box under `What to look at` takes no length
 * limit, since a driver needs its route, action, and result.
 *
 * A nested item is measured as a bullet of its own by `densityFindings()`, which
 * leaves it out of its parent, so a finding's subject and its evidence never sum.
 */
export function postDensity(body: string): PostDensityFinding[] {
  const lines = bodyLines(body).map((line) =>
    !line.fenced && FOOTER.test(line.text) ? { ...line, text: '' } : line,
  )
  if (!opensOnPostHeading(lines)) return []

  const found: PostDensityFinding[] = []
  const text = new Map(lines.map((line) => [line.number, line.text]))

  for (const section of sectionsOf(lines)) {
    const { outside, inside } = foldedApart(section.lines)
    const measured = [
      ...splitAt(outside, opensBlock(outside, BOLD_LED), false).flatMap(
        (chunk) => densityFindings(chunk),
      ),
      ...densityFindings(inside).filter(({ kind }) => LENGTHS.includes(kind)),
    ]

    for (const finding of measured) {
      const { kind } = finding
      if (!isCounted(kind) && kind !== 'heading-depth') continue
      if (
        section.name === 'What to look at' &&
        kind === 'bullet-length' &&
        CHECKBOX.test(text.get(finding.line) ?? '')
      ) {
        continue
      }
      found.push({ section: section.name, ...finding, kind })
    }
  }

  return found.sort((a, b) => a.line - b.line)
}

/** Whether the body's first H2 outside a fence is one of `POST_HEADINGS`. */
export function isPost(body: string): boolean {
  return opensOnPostHeading(bodyLines(body))
}

function opensOnPostHeading(lines: readonly BodyLine[]): boolean {
  const opening = lines.find((line) => !line.fenced && H2.test(line.text))
  const heading = opening && H2.exec(opening.text)?.[1]
  return (POST_HEADINGS as readonly string[]).includes(heading ?? '')
}

/**
 * Parts a section into the lines outside `<details>` and the lines inside it.
 * The tags stay outside, where each breaks a paragraph run as raw HTML does.
 */
function foldedApart(lines: readonly BodyLine[]): {
  outside: BodyLine[]
  inside: BodyLine[]
} {
  const outside: BodyLine[] = []
  const inside: BodyLine[] = []
  let depth = 0

  for (const line of lines) {
    const tag = line.fenced ? '' : line.text.trim()
    if (tag.startsWith('<details')) {
      depth++
      outside.push(line)
    } else if (tag.startsWith('</details')) {
      depth = Math.max(0, depth - 1)
      outside.push(line)
    } else if (depth > 0) {
      inside.push(line)
    } else {
      outside.push(line)
    }
  }

  return { outside, inside }
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
