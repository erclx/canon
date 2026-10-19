import { type DensityKind, densityFindings } from '@/markdown/density'
import { bodyLines } from '@/markdown/scan'
import { isSectionMarker } from '@/markdown/structure'

/**
 * The criteria `plan.md`'s `### Structure` states for every hand-written
 * record. `S6`, a full path in a section a parser reads, is not here, since
 * `canon tasks plan-reach` already reports a bare filename as unclaimed.
 */
export const STRUCTURE_CRITERIA = ['S1', 'S2', 'S3', 'S4', 'S5'] as const

export type StructureCriterion = (typeof STRUCTURE_CRITERIA)[number]

/** One place a record misses a criterion, or an intake field spilling past its line. */
export interface StructureEntry {
  readonly criterion: StructureCriterion | 'intake-spill'
  /** The line as an editor numbers it, frontmatter included. */
  readonly line: number
  readonly message: string
}

/**
 * The density limits a record criterion takes over. The paragraph limits are
 * left out, since the record standard caps no paragraph and names no run.
 */
const CRITERION_OF: Partial<Record<DensityKind, StructureCriterion>> = {
  'bullet-run': 'S2',
  'h3-opening': 'S3',
  'bullet-length': 'S4',
  'heading-depth': 'S5',
}

const MESSAGE: Record<StructureCriterion, string> = {
  S1: 'is a bold label standing alone as a section marker. Write it as an H2.',
  S2: 'opens a run of more than 5 plain bullets. Group them under H3s.',
  S3: 'opens with no lead sentence carrying what its bullets share.',
  S4: 'is a bullet past 200 characters. Make it a short paragraph, or split it.',
  S5: 'is an H4 or deeper. Fold it into its H3.',
}

/**
 * Every place a record misses `S1` to `S5`, in line order.
 *
 * `S2` to `S5` are the markdown density limits read on the record's own
 * terms, so a labeled field run stays exempt from `S2` here as it does there.
 * `S1` is any line `isSectionMarker` reads as a bold section marker, which an
 * old plan carries on every section and still parses through.
 */
export function structureFindings(text: string): StructureEntry[] {
  const lines = bodyLines(text)
  const found: StructureEntry[] = []

  for (const line of lines) {
    if (!line.fenced && isSectionMarker(line.text)) {
      found.push({ criterion: 'S1', line: line.number, message: MESSAGE.S1 })
    }
  }

  for (const density of densityFindings(lines)) {
    const criterion = CRITERION_OF[density.kind]
    if (criterion) {
      found.push({ criterion, line: density.line, message: MESSAGE[criterion] })
    }
  }

  return found.sort((a, b) => a.line - b.line)
}

/** An item heading, as `readItems` in `src/intake/items.ts` reads one. */
const ITEM_HEADING = /^###\s+\d+[a-z]*\.\s/i

/** A bolded field bullet, the one line `readItems` takes from a field. */
const FIELD = /^-\s+\*\*([^*]+):\*\*/

/** Any heading, which closes the item above it. */
const SECTION = /^#{1,6}\s/

/**
 * Every block of content sitting under an intake field rather than on its
 * line, one entry at the block's first line.
 *
 * `canon intake list` reads a field's own line and nothing under it, so a
 * nested list or a paragraph below a field never reaches the operator
 * answering in chat. A trailing paragraph after the last field is reported
 * too, since it is dropped the same way.
 */
export function intakeSpill(text: string): StructureEntry[] {
  const found: StructureEntry[] = []
  let item: string | undefined
  let field: string | undefined
  let spilling = false

  for (const line of bodyLines(text)) {
    if (line.fenced) continue

    const heading = ITEM_HEADING.exec(line.text)
    if (heading || SECTION.test(line.text)) {
      item = heading
        ? line.text.replace(/^###\s+/, '').split('.')[0]
        : undefined
      field = undefined
      spilling = false
      continue
    }

    if (item === undefined || line.text.trim() === '') continue

    const match = FIELD.exec(line.text)
    if (match) {
      field = match[1].trim()
      spilling = false
      continue
    }

    if (spilling) continue
    spilling = true

    const under = field ? `the ${field} field of item ${item}` : `item ${item}`
    found.push({
      criterion: 'intake-spill',
      line: line.number,
      message: `sits under ${under}, and canon intake list reads only a field's own line. Keep the content on the line, or split the item.`,
    })
  }

  return found
}

/**
 * The structure report for an intake cluster file. Item headings open on
 * their fields by the template's design, so `S3` skips them, and a field
 * carries its whole content on one line, so `S4` skips it.
 */
export function intakeStructure(text: string): StructureEntry[] {
  const lines = text.split('\n')
  const exempt = (entry: StructureEntry): boolean => {
    const source = lines[entry.line - 1] ?? ''
    if (entry.criterion === 'S3') return ITEM_HEADING.test(source)
    if (entry.criterion === 'S4') return FIELD.test(source)
    return false
  }

  return [
    ...structureFindings(text).filter((entry) => !exempt(entry)),
    ...intakeSpill(text),
  ].sort((a, b) => a.line - b.line)
}
