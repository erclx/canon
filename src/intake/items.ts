import { bodyLines } from '@/markdown/scan'

/**
 * The index points at items and answers nothing itself, so it carries no
 * answer slot for this verb to reach. It also displays the item format inside a
 * fence, which the fence walk already masks, so skipping it by name is about
 * what the file is rather than about the block it holds.
 */
export const INDEX_FILE = '00-overview.md'

/**
 * An item heading, labeled per cluster file rather than per folder.
 *
 * The label carries an optional letter suffix because a pass that splits one
 * finding after the fact numbers the halves `3a` and `3b` rather than
 * renumbering every item below them. A pattern accepting digits alone parses
 * such a file without complaint and drops those items, leaving them
 * unanswerable through this verb with nothing reporting the gap.
 */
const HEADING = /^###\s+(\d+[a-z]*)\.\s*(.*)$/i

/** A bolded field bullet, which is every line an item carries. */
const FIELD = /^-\s+\*\*([^*]+):\*\*\s*(.*)$/

/**
 * Any heading, which ends the item above it.
 *
 * A numbered `###` is tested first and opens the next item, so what reaches
 * here is a heading that is not an item and therefore closes the one open. The
 * narrower test for `##` alone let a `### Notes` block stay inside the item
 * above it, and the stray slot such a block carries then displaced the real
 * one, leaving the item reading as answered while its own slot sat empty and
 * sending a write into the wrong section.
 */
const SECTION = /^#{1,6}\s/

export interface IntakeItem {
  /** The label as the heading spells it, such as `3` or `3a`. */
  readonly label: string
  readonly title: string
  /** Line the heading sits on, 1-based against the whole file. */
  readonly line: number
  /** Line the answer slot sits on, absent when the item carries no slot. */
  readonly answerLine: number | undefined
  /** Text in the slot, absent when the slot is empty and the item is unread. */
  readonly answer: string | undefined
  /** What is wrong today, absent when the item carries no `Problem:` line. */
  readonly problem: string | undefined
  /** The one change proposed, absent when the item carries no `Fix:` line. */
  readonly fix: string | undefined
  readonly open: string | undefined
  readonly suggested: string | undefined
  readonly worth: string | undefined
}

interface Draft {
  label: string
  title: string
  line: number
  answerLine: number | undefined
  answer: string | undefined
  problem: string | undefined
  fix: string | undefined
  open: string | undefined
  suggested: string | undefined
  worth: string | undefined
}

function seal(draft: Draft): IntakeItem {
  return { ...draft }
}

/**
 * Reads every item a cluster file holds, in file order.
 *
 * The walk runs over `bodyLines` rather than a raw split so the item format
 * block a folder copies into its own files parses as the sample it is. A
 * heading counted out of a fence shifts nothing on its own, but it offers an
 * answer slot no reader owns and the write-back would land inside the sample.
 */
export function readItems(text: string): IntakeItem[] {
  const items: IntakeItem[] = []
  let draft: Draft | undefined

  for (const line of bodyLines(text)) {
    if (line.fenced) continue

    const heading = HEADING.exec(line.text)

    if (heading) {
      if (draft) items.push(seal(draft))
      draft = {
        label: heading[1].toLowerCase(),
        title: heading[2].trim(),
        line: line.number,
        answerLine: undefined,
        answer: undefined,
        problem: undefined,
        fix: undefined,
        open: undefined,
        suggested: undefined,
        worth: undefined,
      }
      continue
    }

    if (!draft) continue

    if (SECTION.test(line.text)) {
      items.push(seal(draft))
      draft = undefined
      continue
    }

    const field = FIELD.exec(line.text)
    if (!field) continue

    const value = field[2].trim()

    switch (field[1].trim().toLowerCase()) {
      case 'you':
        draft.answerLine = line.number
        draft.answer = value === '' ? undefined : value
        break
      case 'problem':
        draft.problem = value
        break
      case 'fix':
        draft.fix = value
        break
      case 'open':
        draft.open = value
        break
      case 'suggested':
        draft.suggested = value
        break
      case 'worth it':
        draft.worth = value
        break
    }
  }

  if (draft) items.push(seal(draft))

  return items
}

/**
 * Puts a selection in one item's slot, leaving every other line as it was.
 *
 * The rewrite replaces the whole line rather than patching inside it, which is
 * the reason this is a verb at all. A stream editor expands an unescaped
 * ampersand in the replacement to the whole match and exits zero on a
 * non-match, so an answer carrying one would rewrite the line it anchored to
 * and a missed slot would report success with the answer lost.
 *
 * The answer occupies one line, and the caller owes that guarantee. A line
 * break splices a bare continuation into the item matching none of the patterns
 * the reader tests, so the slot reads back as the text before the break while
 * the item counts as answered, which puts correcting it behind the refusal on
 * an item that already carries one.
 */
export function writeAnswerLine(
  text: string,
  answerLine: number,
  answer: string,
): string {
  const lines = text.split('\n')
  lines[answerLine - 1] = `- **You:** ${answer}`
  return lines.join('\n')
}

/** An item nobody has reached, which is an empty slot rather than a missing one. */
export function isUnread(item: IntakeItem): boolean {
  return item.answerLine !== undefined && item.answer === undefined
}

/**
 * An item carrying no slot at all, which the format says ships on every one.
 *
 * Such an item is neither unread nor answered, and counting it as either hides
 * it: as answered it drops out of the work a reader is told remains, and as
 * unread it joins a list whose every entry the answer verb then refuses. It is
 * reported on its own so the file gets fixed.
 */
export function isMalformed(item: IntakeItem): boolean {
  return item.answerLine === undefined
}
