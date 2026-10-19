import {
  CHECKLIST_END,
  CHECKLIST_START,
  parseBoxLine,
  readChecklistBoxes,
  SHORT_SHA_LENGTH,
  writeBoxLine,
} from '@/pr/evidence'

const UI_PASS_MARKER = '<!-- pr-ui-pass -->'
const TESTING_HEADING = /^## Testing\s*$/
const SECTION_HEADING = /^## /
const REVIEWER_HEADING = /^## For the reviewer\s*$/
const UI_PASS_HEAD = /at `([0-9a-f]+)`/

/** What the UI pass line reports, either a pass or a reset to a head nobody has driven. */
export type UiPassSummary =
  | {
      readonly kind: 'passed'
      /** Driven boxes ticked, taste boxes excluded. */
      readonly passed: number
      /** Boxes a driver can run, taste boxes excluded. */
      readonly total: number
      readonly taste: number
      readonly head: string
    }
  | { readonly kind: 'reset'; readonly head: string }

/**
 * The one `## Testing` line a UI pass owns. It is ticked only when every box
 * a driver can run passed, so a failed box never reads as done, and taste
 * boxes are counted apart so a full pass never reads as one box failed.
 */
export function uiPassLine(summary: UiPassSummary): string {
  const at = `\`${summary.head.slice(0, SHORT_SHA_LENGTH)}\``
  if (summary.kind === 'reset') {
    return `- [ ] UI pass, not run at ${at} ${UI_PASS_MARKER}`
  }
  const taste =
    summary.taste === 0
      ? ''
      : `${summary.taste} taste ${summary.taste === 1 ? 'box' : 'boxes'} left to the operator`
  if (summary.total === 0) {
    return `- [ ] UI pass, no box a driver can run, ${taste} at ${at} ${UI_PASS_MARKER}`
  }
  const box = summary.passed === summary.total ? 'x' : ' '
  const tail = taste === '' ? '' : `, ${taste}`
  return `- [${box}] UI pass, ${summary.passed} of ${summary.total} boxes passed at ${at}${tail} ${UI_PASS_MARKER}`
}

/** The short sha the marked line names, absent when the body carries no such line. */
export function readUiPassHead(body: string): string | undefined {
  const line = body.split('\n').find((row) => row.includes(UI_PASS_MARKER))
  return line === undefined ? undefined : UI_PASS_HEAD.exec(line)?.[1]
}

/**
 * Puts the UI pass line in a pull request body and touches nothing else.
 * The marked line is replaced where it stands, else appended to the end of
 * `## Testing`, which is created ahead of `## For the reviewer` when absent.
 */
export function writeUiPassLine(body: string, summary: UiPassSummary): string {
  const line = uiPassLine(summary)
  const lines = body.split('\n')

  const marked = lines.findIndex((row) => row.includes(UI_PASS_MARKER))
  if (marked !== -1) {
    lines[marked] = line
    return lines.join('\n')
  }

  const heading = lines.findIndex((row) => TESTING_HEADING.test(row))
  if (heading === -1) {
    const reviewer = lines.findIndex((row) => REVIEWER_HEADING.test(row))
    if (reviewer === -1) {
      return `${body.trimEnd()}\n\n## Testing\n\n${line}\n`
    }
    lines.splice(reviewer, 0, '## Testing', '', line, '')
    return lines.join('\n')
  }

  const next = lines.findIndex(
    (row, index) => index > heading && SECTION_HEADING.test(row),
  )
  let last = next === -1 ? lines.length - 1 : next - 1
  while (last > heading && lines[last]?.trim() === '') last -= 1

  if (last > heading) {
    lines.splice(last + 1, 0, line)
  } else if (lines[heading + 1] === '') {
    lines.splice(heading + 2, 0, line)
  } else {
    lines.splice(heading + 1, 0, '', line)
  }
  return lines.join('\n')
}

export type TickRefusal = 'no-checklist' | 'no-box' | 'taste-box'

export type TickResult =
  | { readonly kind: 'ticked'; readonly body: string }
  | { readonly kind: 'refused'; readonly reason: TickRefusal }

/**
 * Ticks the named boxes of a marked body's checklist and stamps each with the
 * commit it passed at. A refusal writes nothing, so a taste box named among
 * passed ones leaves every box as it was. A box already ticked is restamped,
 * which makes a repeat at one head a no-op.
 */
export function tickBoxes(
  body: string,
  numbers: readonly number[],
  head: string,
): TickResult {
  const start = body.indexOf(CHECKLIST_START)
  const end = body.indexOf(CHECKLIST_END, start)
  if (start === -1 || end === -1) {
    return { kind: 'refused', reason: 'no-checklist' }
  }

  const from = start + CHECKLIST_START.length
  const region = body.slice(from, end)
  const boxes = readChecklistBoxes(region)

  const named = numbers.map((number) =>
    boxes.find((box) => box.number === number),
  )
  if (named.some((box) => box === undefined)) {
    return { kind: 'refused', reason: 'no-box' }
  }
  if (named.some((box) => box?.isTaste === true)) {
    return { kind: 'refused', reason: 'taste-box' }
  }

  const lines = region.split('\n')
  for (const box of named) {
    if (box === undefined) continue
    const parsed = parseBoxLine(lines[box.line] ?? '')
    if (parsed !== undefined) lines[box.line] = writeBoxLine(parsed, head)
  }
  return {
    kind: 'ticked',
    body: `${body.slice(0, from)}${lines.join('\n')}${body.slice(end)}`,
  }
}
