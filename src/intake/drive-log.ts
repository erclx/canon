import { isAbsolute, join, normalize } from 'node:path'
import { bodyLines } from '@/markdown/scan'

/** The one folder inside an intake folder that evidence may live in. */
export const EVIDENCE_DIR = 'evidence'

/** The log a person reads, which the `undrawn` axis parses by its labels. */
export const DRIVE_LOG = join(EVIDENCE_DIR, 'drive-log.md')

/** A relative path inside the folder's `evidence/`, never one climbing out of it. */
export function isEvidencePath(path: string): boolean {
  if (isAbsolute(path)) return false
  const segments = normalize(path).split(/[\\/]/)
  return (
    segments[0] === EVIDENCE_DIR &&
    segments.length > 1 &&
    !segments.includes('..')
  )
}

export interface DrawnReading {
  /** Each finding's heading, as `<nn>. <title>`, with nothing drawn, decided or not. */
  readonly undrawn: readonly string[]
  /** Every path a `Drawn` field cites, for the evidence tests. */
  readonly paths: readonly string[]
  /** Each finding whose `Drawn` field skips with a reason. */
  readonly skipped: readonly SkippedFinding[]
  /** Whether the `Board` setup row holds a value, which a drive that drew a board always writes. */
  readonly board: boolean
}

export interface SkippedFinding {
  readonly finding: number
  /** The finding's heading, as `<nn>. <title>`. */
  readonly heading: string
}

const FINDING_HEADING = /^##\s+(\d+\.\s.*?)\s*$/
const LOG_FIELD = /^[-*]\s+\*\*([^*]+):\*\*\s*(.*)$/
const DECISION_LABEL = 'Decision (operator)'
const DRAWN_LABEL = 'Drawn'
const BOARD_ROW = /^\|\s*Board\s*\|(.*?)\|?\s*$/
const SEE = /^see\s+(\d+)/i
/** The meta line of a passed goal, script, or Behavior row, which owes no drawing. */
const PASS_META = /^`pass`/

/**
 * The paths a `Drawn` value cites in code spans. A skip cites none, since its
 * reason may backtick a term that is no path.
 */
export function citedDrawings(value: string): string[] {
  if (/^skipped\b/i.test(value.trim())) return []
  return [...value.matchAll(/`([^`]+)`/g)].map((match) => match[1])
}

/**
 * Reads every logged finding, decided or not, for one with nothing drawn. A path
 * in a code span or `skipped, <reason>` passes, and so does a `see <nn>` decision,
 * drawn under the finding it names. A passed entry owes nothing.
 */
export function readDrawn(source: string): DrawnReading {
  const undrawn: string[] = []
  const paths: string[] = []
  const skipped: SkippedFinding[] = []
  let board = false
  let finding: string | undefined
  let decision: string | undefined
  let drawn: string | undefined
  let passed = false

  const close = () => {
    if (finding !== undefined && !passed && !SEE.test(decision ?? '')) {
      const field = drawn ?? ''
      if (/^skipped\b/i.test(field)) {
        if (/^skipped\s*,\s*\S/i.test(field)) {
          skipped.push({
            finding: Number.parseInt(finding, 10),
            heading: finding,
          })
        } else {
          undrawn.push(finding)
        }
      } else {
        const cited = citedDrawings(field)
        paths.push(...cited)
        if (cited.length === 0) undrawn.push(finding)
      }
    }
    finding = decision = drawn = undefined
    passed = false
  }

  for (const line of bodyLines(source)) {
    if (line.fenced) continue
    if (/^#{1,2}\s/.test(line.text)) {
      close()
      finding = FINDING_HEADING.exec(line.text)?.[1]
      continue
    }
    const row = BOARD_ROW.exec(line.text)
    if (row && row[1].trim() !== '') board = true
    if (finding !== undefined && PASS_META.test(line.text)) passed = true
    const field = LOG_FIELD.exec(line.text)
    if (finding === undefined || !field) continue
    if (field[1] === DECISION_LABEL) decision = field[2].trim()
    if (field[1] === DRAWN_LABEL) drawn = field[2].trim()
  }
  close()

  return { undrawn, paths, skipped, board }
}

/**
 * Maps each logged finding's number to the operator's decision. A decision reading
 * `see <nn>` takes that finding's decision, one hop only, and drops out when it
 * is missing or itself points on.
 */
export function readDecisions(source: string): Map<number, string> {
  const raw = new Map<number, string>()
  let finding: number | undefined

  for (const line of bodyLines(source)) {
    if (line.fenced) continue
    if (/^#{1,2}\s/.test(line.text)) {
      const heading = FINDING_HEADING.exec(line.text)?.[1]
      finding = heading === undefined ? undefined : Number.parseInt(heading, 10)
      continue
    }
    const field = LOG_FIELD.exec(line.text)
    if (finding === undefined || !field || field[1] !== DECISION_LABEL) continue
    const decision = field[2].trim()
    if (decision !== '') raw.set(finding, decision)
  }

  const decisions = new Map<number, string>()
  for (const [finding, decision] of raw) {
    const hop = SEE.exec(decision)
    if (!hop) {
      decisions.set(finding, decision)
      continue
    }
    const target = raw.get(Number(hop[1]))
    if (target !== undefined && !SEE.test(target)) {
      decisions.set(finding, target)
    }
  }
  return decisions
}
