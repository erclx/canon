/**
 * Reads the human-facing draft `script-screencast` writes. Nothing here knows
 * about a browser: the draft is prose aimed at a person, and turning it into
 * something executable is `@/demo/compile`'s job.
 */

export interface Beat {
  readonly index: number
  readonly name: string
  readonly onScreen: string
  readonly action: string
  readonly watchFor: string
  readonly emphasis: string
  readonly caption: string
  readonly transitionOut?: string
}

export interface Draft {
  readonly title: string
  readonly beats: readonly Beat[]
}

export type DraftParse =
  | { status: 'parsed'; draft: Draft }
  | { status: 'failed'; reason: string }

const TITLE = /^#\s+Screencast:\s*(.+)$/m
const BEAT_SHEET = /^##\s+.*Beat sheet.*$/im
const BEAT_HEADING = /^###\s+Beat\s+(\d+)\s*:\s*(.*)$/i
const FIELD = /^-\s+([A-Za-z][A-Za-z\s]*?)\s*:\s*(.*)$/

/**
 * Labels are matched case-insensitively with whitespace collapsed, because the
 * draft is hand-edited between being written and being compiled and a
 * capitalization change there is not a reason to refuse the whole file.
 */
const FIELDS: Record<string, keyof Beat> = {
  'on screen': 'onScreen',
  action: 'action',
  'watch for': 'watchFor',
  emphasis: 'emphasis',
  caption: 'caption',
  'transition out': 'transitionOut',
}

export function parseDraft(markdown: string): DraftParse {
  const sheet = beatSheetSection(markdown)
  if (sheet === undefined) {
    return {
      status: 'failed',
      reason: 'no "Beat sheet" section, so the draft carries no beats to run',
    }
  }

  const beats = readBeats(sheet)
  if (!beats.length) {
    return {
      status: 'failed',
      reason: 'the beat sheet holds no "### Beat" heading',
    }
  }

  return {
    status: 'parsed',
    draft: { title: TITLE.exec(markdown)?.[1]?.trim() ?? '', beats },
  }
}

/**
 * Returns the lines between the beat sheet heading and the next `##`, so a
 * `### Beat` heading elsewhere in the draft cannot be read as a beat.
 */
function beatSheetSection(markdown: string): string[] | undefined {
  const lines = markdown.split('\n')
  const start = lines.findIndex((line) => BEAT_SHEET.test(line))
  if (start === -1) return undefined

  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => /^##\s/.test(line))
  return end === -1 ? rest : rest.slice(0, end)
}

function readBeats(lines: string[]): Beat[] {
  const beats: Beat[] = []
  let open: Partial<Beat> | undefined

  for (const line of lines) {
    const heading = BEAT_HEADING.exec(line)
    if (heading) {
      if (open) beats.push(sealBeat(open))
      open = {
        index: Number(heading[1]),
        name: (heading[2] ?? '').trim(),
      }
      continue
    }

    if (!open) continue
    const field = FIELD.exec(line)
    if (!field) continue

    const key = FIELDS[normalizeLabel(field[1] ?? '')]
    if (key) open = { ...open, [key]: (field[2] ?? '').trim() }
  }

  if (open) beats.push(sealBeat(open))
  return beats
}

/**
 * Fills the five required fields with empty strings rather than leaving them
 * undefined, so a downstream reader distinguishes "the operator left it blank"
 * from "the label was misspelt" by the presence of the key alone.
 *
 * `transitionOut` stays optional, because the draft adds it only when it is
 * not the default and an empty one would claim a decision nobody made.
 */
function sealBeat(open: Partial<Beat>): Beat {
  const beat: Beat = {
    index: open.index ?? 0,
    name: open.name ?? '',
    onScreen: open.onScreen ?? '',
    action: open.action ?? '',
    watchFor: open.watchFor ?? '',
    emphasis: open.emphasis ?? '',
    caption: open.caption ?? '',
  }
  return open.transitionOut === undefined
    ? beat
    : { ...beat, transitionOut: open.transitionOut }
}

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ')
}
