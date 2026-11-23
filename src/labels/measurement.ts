import { linesOutsideFences } from '@/markdown/scan'

const PERF_TITLE = /^perf(\([^)]*\))?!?:/
const H2 = /^##\s/
const OUTCOME = '## Outcome'
const TECHNICAL_CONTEXT = '## Technical context'
const SEPARATOR_ROW = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/

export type MeasurementGap = 'table' | 'technical-context'

export interface MeasurementCheck {
  /** False for a title that is not `perf`, which carries no measurement rule. */
  readonly checked: boolean
  /** What a `perf` body lacks, in the order the standard states it. */
  readonly missing: readonly MeasurementGap[]
}

function isTableRow(line: string): boolean {
  return line.startsWith('|') && line.indexOf('|', 1) > 0
}

/** True when the lines hold a header row, a separator, and at least one data row. */
function holdsTable(lines: readonly string[]): boolean {
  for (let i = 0; i + 2 < lines.length; i++) {
    if (
      isTableRow(lines[i]) &&
      SEPARATOR_ROW.test(lines[i + 1]) &&
      isTableRow(lines[i + 2]) &&
      !SEPARATOR_ROW.test(lines[i + 2])
    ) {
      return true
    }
  }
  return false
}

/**
 * Grades a `perf` pull request for the measurement it claims: a table under
 * `## Outcome` and a `## Technical context` for what it trades. It reads that
 * the table exists and never that its numbers are true, which stays with the
 * reviewer. A fence is an example rather than a result, so it never counts.
 */
export function checkMeasurement(
  title: string,
  body: string,
): MeasurementCheck {
  if (!PERF_TITLE.test(title)) return { checked: false, missing: [] }

  const lines = linesOutsideFences(body).map((line) => line.trim())
  const outcome: string[] = []
  let section = ''
  let hasContext = false

  for (const line of lines) {
    if (H2.test(line)) {
      section = line
      if (line === TECHNICAL_CONTEXT) hasContext = true
    } else if (section === OUTCOME) {
      outcome.push(line)
    }
  }

  const missing: MeasurementGap[] = []
  if (!holdsTable(outcome)) missing.push('table')
  if (!hasContext) missing.push('technical-context')

  return { checked: true, missing }
}
