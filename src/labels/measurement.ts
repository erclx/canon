import { linesOutsideFences, maskCodeSpans } from '@/markdown/scan'

const PERF_TITLE = /^perf(\([^)]*\))?!?:/
const H2 = /^##\s/
const OUTCOME = '## Outcome'
const TECHNICAL_CONTEXT = '## Technical context'
const VERIFICATION = '## Verification'
const MEASUREMENT_WORD =
  /\b(eval|evals|benchmark|benchmarks|benchmarked|latency|p50|p95|median|timed)\b/i
const SEPARATOR_ROW = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/

export type MeasurementGap = 'table' | 'technical-context' | 'results-table'

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

/** The lines under one level-two heading, stopping at the next one. */
function sectionLines(lines: readonly string[], heading: string): string[] {
  const held: string[] = []
  let section = ''

  for (const line of lines) {
    if (H2.test(line)) section = line
    else if (section === heading) held.push(line)
  }

  return held
}

/**
 * Reads that a `perf` body has an Outcome table and a Technical context, never
 * that its numbers are true. A fenced table is an example, so it never counts.
 */
export function checkMeasurement(
  title: string,
  body: string,
): MeasurementCheck {
  if (!PERF_TITLE.test(title)) return { checked: false, missing: [] }

  const lines = linesOutsideFences(body).map((line) => line.trim())
  const outcome = sectionLines(lines, OUTCOME)
  const hasContext = lines.includes(TECHNICAL_CONTEXT)

  const missing: MeasurementGap[] = []
  if (!holdsTable(outcome)) missing.push('table')
  if (!hasContext) missing.push('technical-context')

  return { checked: true, missing }
}

/**
 * Reads that a body carries an Outcome table when its plan's Verification ran a
 * measurement, whatever the title says. The trigger is a measurement word in
 * prose, so a fence or a code span naming a command never fires it, and it reads
 * that the table exists, never that its numbers are true.
 */
export function checkMeasuredResults(
  body: string,
  plan: string,
): MeasurementCheck {
  const verification = sectionLines(
    linesOutsideFences(plan).map((line) => line.trim()),
    VERIFICATION,
  )
  const measured = verification.some((line) =>
    MEASUREMENT_WORD.test(maskCodeSpans(line)),
  )
  if (!measured) return { checked: false, missing: [] }

  const outcome = sectionLines(
    linesOutsideFences(body).map((line) => line.trim()),
    OUTCOME,
  )

  return {
    checked: true,
    missing: holdsTable(outcome) ? [] : ['results-table'],
  }
}
