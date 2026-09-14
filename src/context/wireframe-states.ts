import { readFile, readdir, stat } from 'node:fs/promises'
import { basename, dirname, join, relative } from 'node:path'
import type { AuditedFolder } from '@/context/folders'
import { type BodyLine, bodyLines } from '@/markdown/scan'

/** `standards/wireframes.md`'s `## States` heading, matched by text alone. */
const STATES_HEADING = /^##\s+States\s*$/i
const SECTION_HEADING = /^##\s+\S/
const TABLE_ROW = /^\s*\|/
const TABLE_SEPARATOR = /^\s*\|[\s:|-]+\|\s*$/

/** The one exception the standard admits to the states/evidence bijection. */
const NOT_CAPTURED = 'not captured'

/** A fenced block's opening delimiter naming the `plaintext` info string. */
const PLAINTEXT_FENCE = /^`{3,}\s*plaintext\s*$/i

export interface StateRow {
  readonly line: number
  readonly state: string
  /** The evidence cell as written, backticks and all. */
  readonly evidence: string
}

export interface MissingFolderFinding {
  readonly line: number
  readonly state: string
  /** The cited path, so a report names what to go create or fix. */
  readonly path: string
}

export interface UnlistedFolderFinding {
  /** The evidence root the folder sits under, cited by at least one row. */
  readonly root: string
  readonly folder: string
}

export interface WireframeStatesReport {
  readonly rel: string
  readonly rows: readonly StateRow[]
  /** A row whose evidence cell names a path with no folder at it. */
  readonly missingFolders: readonly MissingFolderFinding[]
  /** A folder under a cited root that no row names. */
  readonly unlistedFolders: readonly UnlistedFolderFinding[]
  /** Line of the `plaintext` fence, absent from an entry carrying no sketch. */
  readonly sketchLine?: number
  /** Whether that sketch sits beside a state whose evidence already exists. */
  readonly sketchWithEvidence: boolean
}

function cells(row: string): string[] {
  const parts = row.split('|')
  if ((parts[0] ?? '').trim() === '') parts.shift()
  if ((parts[parts.length - 1] ?? '').trim() === '') parts.pop()
  return parts.map((cell) => cell.trim())
}

function columnIndex(headers: readonly string[], name: string): number {
  return headers.findIndex(
    (header) => header.toLowerCase() === name.toLowerCase(),
  )
}

/**
 * Reads the States table under the `## States` heading, matching its `State`
 * and `Evidence` columns by header text rather than position.
 *
 * Column order is the one part of the standard's own table the standard could
 * still move during its own review, per the plan this ships under. Matching
 * position would break silently on a reorder, where matching text breaks the
 * same way a renamed header would: visibly, by finding nothing.
 */
export function parseStatesTable(lines: readonly BodyLine[]): StateRow[] {
  let index = 0
  while (index < lines.length && !STATES_HEADING.test(lines[index].text)) {
    index++
  }
  if (index >= lines.length) return []
  index++

  while (index < lines.length && !SECTION_HEADING.test(lines[index].text)) {
    const separator = lines[index + 1]
    if (
      TABLE_ROW.test(lines[index].text) &&
      separator !== undefined &&
      TABLE_SEPARATOR.test(separator.text)
    ) {
      break
    }
    index++
  }
  if (
    index >= lines.length ||
    SECTION_HEADING.test(lines[index].text) ||
    !TABLE_ROW.test(lines[index].text)
  ) {
    return []
  }

  const headers = cells(lines[index].text)
  const stateCol = columnIndex(headers, 'State')
  const evidenceCol = columnIndex(headers, 'Evidence')
  if (stateCol === -1 || evidenceCol === -1) return []

  index += 2
  const rows: StateRow[] = []
  while (index < lines.length && TABLE_ROW.test(lines[index].text)) {
    const row = cells(lines[index].text)
    rows.push({
      line: lines[index].number,
      state: row[stateCol] ?? '',
      evidence: row[evidenceCol] ?? '',
    })
    index++
  }

  return rows
}

/** Line of the first `plaintext`-fenced sketch, or nothing. */
export function findSketchLine(lines: readonly BodyLine[]): number | undefined {
  for (const line of lines) {
    if (PLAINTEXT_FENCE.test(line.text.trim())) return line.number
  }
  return undefined
}

/**
 * Reads an evidence cell into the path it cites, or nothing for the one cell
 * value the standard exempts from having one.
 */
function evidencePath(cell: string): string | undefined {
  const stripped = cell.replace(/^`+|`+$/g, '').trim()
  if (stripped.toLowerCase() === NOT_CAPTURED) return undefined
  return stripped.replace(/\/+$/, '')
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

async function subfolders(path: string): Promise<string[]> {
  try {
    const entries = await readdir(path, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  } catch {
    return []
  }
}

/**
 * Measures one wireframe entry against its own States table.
 *
 * The evidence cell resolves as the literal path it names against `root`,
 * per the plan's operator answer, since the standard puts the path there and a
 * root guessed from convention reads wrong in a monorepo carrying more than
 * one evidence tree.
 *
 * An unlisted folder is reported only under a root at least one row already
 * cites, per the same operator answer, so a project holding evidence with no
 * states table at all reports nothing. `roots` is built from the rows this
 * loop already resolved rather than scanned separately, which is what keeps
 * the two readings in the same pass.
 */
export async function measureWireframeStates(
  root: string,
  rel: string,
  source: string,
): Promise<WireframeStatesReport> {
  const lines = bodyLines(source)
  const rows = parseStatesTable(lines)
  const sketchLine = findSketchLine(lines)

  const missingFolders: MissingFolderFinding[] = []
  const cited = new Map<string, Set<string>>()
  let anyCaptured = false

  for (const row of rows) {
    const path = evidencePath(row.evidence)
    if (path === undefined) continue

    if (!(await isDirectory(join(root, path)))) {
      missingFolders.push({ line: row.line, state: row.state, path })
      continue
    }

    anyCaptured = true
    const evidenceRoot = dirname(path)
    const folder = basename(path)
    const named = cited.get(evidenceRoot) ?? new Set<string>()
    named.add(folder)
    cited.set(evidenceRoot, named)
  }

  const unlistedFolders: UnlistedFolderFinding[] = []
  for (const [evidenceRoot, named] of cited) {
    for (const folder of await subfolders(join(root, evidenceRoot))) {
      if (!named.has(folder)) {
        unlistedFolders.push({ root: evidenceRoot, folder })
      }
    }
  }

  return {
    rel,
    rows,
    missingFolders,
    unlistedFolders,
    ...(sketchLine !== undefined && { sketchLine }),
    sketchWithEvidence: sketchLine !== undefined && anyCaptured,
  }
}

/** Measures every wireframe entry in a resolved `wireframes` folder. */
export async function measureWireframeFolder(
  root: string,
  folder: AuditedFolder,
): Promise<WireframeStatesReport[]> {
  const reports: WireframeStatesReport[] = []

  for (const path of folder.entries) {
    reports.push(
      await measureWireframeStates(
        root,
        relative(root, path),
        await readFile(path, 'utf8'),
      ),
    )
  }

  return reports
}
