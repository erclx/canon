import { bodyLines } from '@/markdown/scan'

/**
 * The index points at items and answers nothing itself, so it carries no answer slot.
 * It also displays the item format inside a fence.
 */
export const INDEX_FILE = '00-overview.md'

/**
 * An item heading, labeled per cluster file rather than per folder. The label takes
 * an optional letter suffix, since a split finding numbers its halves `3a` and
 * `3b`, and digits alone would drop them silently.
 */
const HEADING = /^###\s+(\d+[a-z]*)\.\s*(.*)$/i

/** A bolded field bullet, which is every line an item carries. */
const FIELD = /^-\s+\*\*([^*]+):\*\*\s*(.*)$/

/**
 * The word opening an answer that leaves an item waiting on a pick. It matches the
 * answer's first word alone, so an answer mentioning it later stays a decision.
 */
export const PENDING_PICK = 'sketch'

const PENDING = new RegExp(`^${PENDING_PICK}(?![\\w-])`, 'i')

/**
 * Any heading, which ends the item above it. A numbered `###` is tested first, so a
 * heading reaching here closes the open item, and a `### Notes` block must not stay
 * inside it.
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
  /** The `Decided:` pointer as written, absent when the item carries none. */
  readonly decided: string | undefined
}

/** Where a `Decided:` pointer sends a reader, as `<path>, finding <nn>`. */
export interface DecidedPointer {
  readonly path: string
  readonly finding: number
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
  decided: string | undefined
}

function seal(draft: Draft): IntakeItem {
  return { ...draft }
}

/**
 * Reads every item a cluster file holds, in file order. The walk runs over
 * `bodyLines`, so the item format block a folder copies into its own files parses
 * as the sample it is.
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
        decided: undefined,
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
      case 'decided':
        draft.decided = value === '' ? undefined : value
        break
    }
  }

  if (draft) items.push(seal(draft))

  return items
}

/**
 * Reads the finding a `Decided:` pointer names, compared as an integer so
 * `finding 2` meets a `## 02.` heading. Undefined when the text names no
 * finding, which the caller refuses rather than guesses at.
 */
export function parseDecided(text: string): DecidedPointer | undefined {
  const match = /^(.+?),\s*finding\s+(\d+)\s*\.?$/i.exec(text.trim())
  if (!match) return undefined
  return {
    path: match[1].trim().replace(/^`(.+)`$/, '$1'),
    finding: Number(match[2]),
  }
}

/**
 * Puts a selection in one item's slot, leaving every other line as it was. It
 * replaces the whole line, since a stream editor expands an unescaped ampersand.
 * The answer occupies one line, and the caller owes that guarantee.
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

/** An item whose answer waits on a pick, so it holds no decision yet. */
export function isPendingPick(item: IntakeItem): boolean {
  return item.answer !== undefined && PENDING.test(item.answer)
}

/**
 * An item carrying no slot at all, which the format says ships on every one. It is
 * neither unread nor answered, so it is reported on its own to get fixed.
 */
export function isMalformed(item: IntakeItem): boolean {
  return item.answerLine === undefined
}
