import {
  CHECKLIST_END,
  CHECKLIST_START,
  parseBoxLine,
  readChecklistBoxes,
  writeBoxLine,
} from '@/pr/evidence'

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
