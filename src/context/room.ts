import {
  GOTCHA_CAP,
  HEADING_LEVEL,
  LAYOUT_BULLET_CAP,
  LIST_ITEM,
  OTHER_FOLDERS,
  SCRIPTS_HEADING,
  TABLE_ROW,
  isDevelopmentEntry,
} from '@/context/audit'
import type { BodyLine } from '@/markdown/scan'
import { CHECKPOINTS } from '@/markdown/structure'

/** A block of a context entry the length limits reach, being a Layout folder or Gotchas. */
export interface Room {
  readonly kind: 'folder' | 'gotchas'
  /** The block's heading line, which is where the shape audit reports it. */
  readonly start: number
  /** The last line before the next heading, so a finding inside it can be matched. */
  readonly end: number
  readonly title: string
  readonly bullets: number
  /** Characters of the first paragraph, 0 for a block that opens without one. */
  readonly lead: number
}

interface OpenRoom {
  readonly kind: Room['kind']
  readonly start: number
  readonly title: string
  bullets: number
  lead: string
  leadClosed: boolean
}

/**
 * Measures each Layout folder H3 and the Gotchas section of one entry. `Other
 * folders` and the development entry's `Scripts` H3 are skipped, since no limit
 * reaches them. Bullets count at any indent, as the shape audit counts them.
 */
export function measureRooms(rel: string, lines: readonly BodyLine[]): Room[] {
  const exempt = new Set([OTHER_FOLDERS])
  if (isDevelopmentEntry(rel)) exempt.add(SCRIPTS_HEADING)

  const rooms: Room[] = []
  let section: string | undefined
  let open: OpenRoom | undefined

  const close = (end: number): void => {
    if (open) {
      rooms.push({
        kind: open.kind,
        start: open.start,
        end,
        title: open.title,
        bullets: open.bullets,
        lead: open.lead.length,
      })
    }
    open = undefined
  }

  for (const line of lines) {
    if (line.fenced) continue

    const heading = line.text.match(HEADING_LEVEL)
    if (heading) {
      const level = heading[1].length
      const title = heading[2]
      if (level <= 3) close(line.number - 1)
      if (level <= 2) {
        section = level === 2 ? title : undefined
      }
      if (level === 2 && title === 'Gotchas') {
        open = newRoom('gotchas', line.number, title)
      } else if (level === 3 && section === 'Layout' && !exempt.has(title)) {
        open = newRoom('folder', line.number, title)
      }
      continue
    }

    if (!open) continue

    if (line.text.trim() === '') {
      if (open.lead) open.leadClosed = true
    } else if (LIST_ITEM.test(line.text)) {
      open.bullets++
      open.leadClosed = true
    } else if (TABLE_ROW.test(line.text)) {
      open.leadClosed = true
    } else if (!open.leadClosed && open.kind === 'folder') {
      open.lead += `${open.lead ? ' ' : ''}${line.text.trim()}`
    }
  }
  close(lines.length === 0 ? 0 : lines[lines.length - 1].number)

  return rooms
}

function newRoom(kind: Room['kind'], start: number, title: string): OpenRoom {
  return { kind, start, title, bullets: 0, lead: '', leadClosed: false }
}

/** The ways out of a full block, the same text from both audits. */
export function roomAdvice(room: Room): string {
  if (room.kind === 'gotchas') {
    return `Gotchas holds ${room.bullets} of ${GOTCHA_CAP}. Remove a trap the code no longer has, or state the fact as a bullet on the folder it belongs to.`
  }
  return `${room.title} holds ${room.bullets} of ${LAYOUT_BULLET_CAP} bullets and a lead of ${room.lead} of ${CHECKPOINTS.paragraph} characters. Cut a bullet the code or --help already says, move like facts into one table after the lead, give a subfolder its own H3, or open a sibling entry. Folding the line into the lead or a second paragraph fails the next limit.`
}

/** The block holding a line, since a density finding carries a line and not a block. */
export function roomAt(rooms: readonly Room[], line: number): Room | undefined {
  return rooms.find((room) => line >= room.start && line <= room.end)
}
