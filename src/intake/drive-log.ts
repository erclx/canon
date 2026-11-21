import { join } from 'node:path'
import { bodyLines } from '@/markdown/scan'

/** The one folder inside an intake folder that evidence may live in. */
export const EVIDENCE_DIR = 'evidence'

/** The log a person reads, which the `undrawn` axis parses by its labels. */
export const DRIVE_LOG = join(EVIDENCE_DIR, 'drive-log.md')

export interface DrawnReading {
  /** Each decided finding's heading, as `<nn>. <title>`, with nothing drawn. */
  readonly undrawn: readonly string[]
  /** Every path a `Drawn` field cites, for the evidence tests. */
  readonly paths: readonly string[]
}

const FINDING_HEADING = /^##\s+(\d+\.\s.*?)\s*$/
const LOG_FIELD = /^[-*]\s+\*\*([^*]+):\*\*\s*(.*)$/
const DECISION_LABEL = 'Decision (operator)'
const DRAWN_LABEL = 'Drawn'
const SEE = /^see\s+(\d+)/i

/**
 * Reads the drive log's numbered findings for a decision with nothing drawn. A
 * `Drawn` field passes when it cites a path in a code span or reads `skipped,
 * <reason>`, and `see <nn>` was drawn under the finding it names.
 */
export function readDrawn(source: string): DrawnReading {
  const undrawn: string[] = []
  const paths: string[] = []
  let finding: string | undefined
  let decision: string | undefined
  let drawn: string | undefined

  const close = () => {
    if (finding !== undefined && decision && !SEE.test(decision)) {
      const field = drawn ?? ''
      if (/^skipped\b/i.test(field)) {
        if (!/^skipped\s*,\s*\S/i.test(field)) undrawn.push(finding)
      } else {
        const cited = [...field.matchAll(/`([^`]+)`/g)].map((match) => match[1])
        paths.push(...cited)
        if (cited.length === 0) undrawn.push(finding)
      }
    }
    finding = decision = drawn = undefined
  }

  for (const line of bodyLines(source)) {
    if (line.fenced) continue
    if (/^#{1,2}\s/.test(line.text)) {
      close()
      finding = FINDING_HEADING.exec(line.text)?.[1]
      continue
    }
    const field = LOG_FIELD.exec(line.text)
    if (finding === undefined || !field) continue
    if (field[1] === DECISION_LABEL) decision = field[2].trim()
    if (field[1] === DRAWN_LABEL) drawn = field[2].trim()
  }
  close()

  return { undrawn, paths }
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
