import { type BehaviorRow, normalizeBehaviorText } from '@/design/behavior'
import { readBullets, shorten } from '@/records/counterpart'

export interface BehaviorFinding {
  readonly kind: 'behavior-unstated'
  readonly subject: string
  readonly message: string
}

/** The group is the folder under `canon/design/`, however deep the cited path. */
const CITED_GROUP = /`[^`]*canon\/design\/([^/`\s]+)[^`]*`/g

/**
 * The first colon followed by a mark ends the row text, so a row whose own
 * text carries a colon still reads whole.
 */
const BULLET = /^-[ \t]*(.+?):[ \t]*(here|out)\b[ \t]*,?[ \t]*(.*)$/i

const BULLET_FORM =
  'Write it under ## Behavior rows as "- <row>: here, <the check that proves it>" or "- <row>: out, <why>".'

function citedGroups(designReferences: readonly string[]): Set<string> {
  const groups = new Set<string>()
  for (const line of designReferences) {
    for (const match of line.matchAll(CITED_GROUP)) groups.add(match[1])
  }
  return groups
}

/** Row text the section states with a reason, keyed by its normalized form. */
function statedRows(section: readonly string[]): Map<string, boolean> {
  const stated = new Map<string, boolean>()
  for (const bullet of readBullets(section)) {
    const match = BULLET.exec(bullet)
    if (match === null) continue
    stated.set(normalizeBehaviorText(match[1]), match[3].trim() !== '')
  }
  return stated
}

/**
 * Reports each Behavior row of a group cited under `## Design references`
 * that `## Behavior rows` neither builds nor rules out with a reason. A group
 * whose record holds no rows owes the section nothing.
 */
export function checkBehaviorRows(
  designReferences: readonly string[],
  section: readonly string[] | undefined,
  rows: readonly BehaviorRow[],
): BehaviorFinding[] {
  const groups = citedGroups(designReferences)
  const stated = statedRows(section ?? [])

  return rows
    .filter((row) => groups.has(row.surface))
    .flatMap((row): BehaviorFinding[] => {
      const reasoned = stated.get(row.behavior)
      if (reasoned === true) return []

      return [
        {
          kind: 'behavior-unstated',
          subject: shorten(`${row.surface}: ${row.behavior}`),
          message:
            reasoned === false
              ? `is marked with no check or reason after it. ${BULLET_FORM}`
              : `is a Behavior row of a cited design group the plan does not name. ${BULLET_FORM}`,
        },
      ]
    })
}
