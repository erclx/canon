import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { parseSectionTables } from '@/design/parse'
import { DESIGN_DOCUMENT } from '@/design/regen'

/** One row of the design record's `## Behavior` table. */
export interface BehaviorRow {
  readonly surface: string
  readonly behavior: string
}

/**
 * Entry text as every reader compares it: a leading bold label and a trailing
 * period dropped, and whitespace collapsed. The text is the identity, since
 * neither a requirements goal nor a Behavior row carries an id.
 */
export function normalizeEntryText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\*\*[^*]+\*\*\s*/, '')
    .replace(/\.$/, '')
    .trim()
}

export function normalizeSurface(text: string): string {
  return text.replace(/`/g, '').trim()
}

/**
 * Every row of every table under the design record's `## Behavior`, with the
 * Surface cell's code span dropped and the Behavior cell normalized. A project
 * with no record, or a record with no section, has no rows.
 */
export function readBehaviorRows(root: string): BehaviorRow[] {
  const path = join(root, DESIGN_DOCUMENT)
  if (!existsSync(path)) return []
  return parseSectionTables(path, 'Behavior')
    .flat()
    .map((row) => ({
      surface: normalizeSurface(row.Surface?.value ?? ''),
      behavior: normalizeEntryText(row.Behavior?.value ?? ''),
    }))
    .filter((row) => row.surface !== '' && row.behavior !== '')
}
