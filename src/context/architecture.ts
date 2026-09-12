import { access, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { AUDITS } from '@/audits/catalog'
import { bodyLines } from '@/markdown/scan'
import { surfaceDir } from '@/surface-root'

/**
 * The record this measures, relative to `root`.
 *
 * A function rather than a fixed constant, because the path now resolves at
 * either surface root and a constant naming one of them would be believed to
 * be true of a project that has moved. One fixed name rather than a folder
 * walk otherwise, because the standard governing it names one document, and
 * the length rule this measures is stated by whichever record sits there
 * rather than by the standard or by this file.
 */
export function architectureRel(root: string): string {
  return relative(root, surfaceDir(root, 'ARCHITECTURE.md'))
}

/**
 * The line allowances a record states for itself, absent when it states none.
 *
 * No standard sets a length rule for this document, so the numbers belong to
 * whichever record declares them rather than to the toolkit. Holding a pair in
 * code and gating every project against it audits a target against a rule it
 * never adopted, which is the failure `canResolveAtRoot` already answers on the
 * folder side. A record stating no rule is measured and never gated.
 */
export interface Allowances {
  readonly frame: number
  readonly perDecision: number
}

/**
 * What a machine could do with the entry's reasoning, which is a candidate
 * rather than a verdict.
 *
 * - `countable`: carries a figure over a tree, so a run could recompute it.
 * - `invariant`: quantifies over a named tree, so a walk could falsify it.
 * - `neither`: says why a choice was made, which nothing tests.
 */
export type ClaimKind = 'countable' | 'invariant' | 'neither'

export interface DecisionReport {
  readonly heading: string
  /** Line of the `###` heading, so a report line opens at the entry. */
  readonly line: number
  readonly claim: ClaimKind
  /** The digit-spelled figures behind a `countable` reading, in order. */
  readonly figures: readonly string[]
  /** The first sentence behind an `invariant` reading, absent otherwise. */
  readonly quantified?: string
  /**
   * Executable checks the entry names, which is the only coverage signal the
   * record carries. Empty on an entry that names none, including one whose
   * claim some check happens to cover without the entry saying so.
   */
  readonly checks: readonly string[]
}

export interface ArchitectureReport {
  readonly rel: string
  readonly lines: number
  /** What the record declared, absent when it states no length rule. */
  readonly allowances?: Allowances
  /** The frame plus the per-decision allowance, absent alongside it. */
  readonly ceiling?: number
  readonly decisions: readonly DecisionReport[]
}

const DECISION_HEADING = /^###\s+(.+?)\s*$/
const SECTION_HEADING = /^##\s+\S/
const CODE_SPAN = /`[^`]*`/g
/** Dropped ahead of the figure scan, since an anchor date is not a claim. */
const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/g
const FIGURE = /\b\d+(?:,\d{3})*\b/g
const SENTENCE_SPLIT = /(?<=[.])\s+/

/** A code span naming a path, which is what a quantifier has to govern. */
const PATH_SPAN = String.raw`\`[^\`]*(?:/|\.md|\.ts|\.sh|\.json)[^\`]*\``
const QUANTIFIER = String.raw`\b(?:every|each|no|nothing|any|all|never|only)\b`
/** Six words is the widest gap the corpus puts between the two. */
const WINDOW = String.raw`(?:\s+\S+){0,6}?\s+`

const QUANTIFIES_PATH = new RegExp(
  `${QUANTIFIER}${WINDOW}${PATH_SPAN}|${PATH_SPAN}${WINDOW}${QUANTIFIER}`,
  'i',
)

/** A code span naming a shell check this repository could run. */
const SCRIPT_SPAN = /^scripts\/[\w./-]+\.sh$/
/** A code span invoking the CLI, which may or may not name a registered audit. */
const CANON_SPAN = /^canon\s+(.+)$/

/**
 * The audit invocations a decision could name, spelled as a reader writes them.
 *
 * Read off the catalog rather than listed, so a verb renamed at its source
 * stops matching here instead of going on matching a string nobody maintains.
 */
const AUDIT_INVOCATIONS: readonly string[] = AUDITS.map((audit) =>
  audit.argv.filter((arg) => arg !== '--json').join(' '),
)

function codeSpans(text: string): string[] {
  return (text.match(CODE_SPAN) ?? []).map((span) => span.slice(1, -1))
}

/**
 * Names the executable checks an entry spells.
 *
 * A script has to exist on disk and a `canon` invocation has to match a
 * registered audit, because an entry naming a check that was removed is an
 * uncovered claim wearing a covered one's words.
 */
async function namedChecks(root: string, body: string): Promise<string[]> {
  const spans = [...new Set(codeSpans(body))]

  const verbs = spans.filter((span) => {
    const invocation = span.match(CANON_SPAN)?.[1]
    return invocation !== undefined && AUDIT_INVOCATIONS.includes(invocation)
  })

  const scripts = spans.filter((span) => SCRIPT_SPAN.test(span))
  const present = await Promise.all(
    scripts.map((span) =>
      access(join(root, span)).then(
        () => true,
        () => false,
      ),
    ),
  )

  return [...verbs, ...scripts.filter((_, index) => present[index])]
}

/**
 * Reads the figures a decision carries, which is the countable-claim signal.
 *
 * Digits alone. A cardinal spelled in words reads as pronominal far more often
 * than as measured in this corpus, where "the alternative and it is one nobody
 * passes" outnumbers "eleven copies", and admitting the spelled form classified
 * 22 of 24 entries as countable, which distinguishes nothing. The cost is that
 * a measured claim written in words reads as uncounted, which the report says.
 */
function figuresIn(body: string): string[] {
  return body.replace(ISO_DATE, ' ').replace(CODE_SPAN, ' ').match(FIGURE) ?? []
}

/**
 * The first sentence quantifying over a named tree, or undefined.
 *
 * The quantifier has to sit within a short window of the path so a sentence
 * mentioning both without relating them does not read as a claim about the
 * tree. Both orders are matched, since the corpus writes the property before
 * the path as readily as after it.
 */
function quantifiedSentence(body: string): string | undefined {
  return body
    .replace(ISO_DATE, ' ')
    .split(SENTENCE_SPLIT)
    .map((sentence) => sentence.replace(/\n/g, ' ').trim())
    .find((sentence) => QUANTIFIES_PATH.test(sentence))
}

/**
 * Classifies one entry, with the countable reading taking precedence.
 *
 * An entry carrying both a figure and a quantified tree is recomputable, which
 * is the stronger test, and the two readings are reported as one kind because
 * the coverage split a reader wants is testable against unverifiable rather
 * than a per-entry inventory of every claim in it.
 */
export function classifyDecision(body: string): {
  claim: ClaimKind
  figures: string[]
  quantified?: string
} {
  const figures = figuresIn(body)
  if (figures.length > 0) return { claim: 'countable', figures }

  const quantified = quantifiedSentence(body)
  if (quantified !== undefined) {
    return { claim: 'invariant', figures: [], quantified }
  }

  return { claim: 'neither', figures: [] }
}

interface RawDecision {
  readonly heading: string
  readonly line: number
  readonly body: string
}

/**
 * Splits the record into its `###` entries.
 *
 * A heading inside a fenced block is skipped, since the seed template shows the
 * shape it asks a project to write and a template entry is not a decision.
 *
 * A heading carrying several decisions counts once, so the total reads low by
 * however many it holds. The report states that rather than parsing for it,
 * because splitting a decision from its heading needs a marker the standard
 * does not ask a record to carry.
 */
export function splitDecisions(source: string): RawDecision[] {
  const lines = bodyLines(source)
  const decisions: RawDecision[] = []
  let open: { heading: string; line: number; body: string[] } | undefined

  for (const line of lines) {
    if (line.fenced) {
      open?.body.push(line.text)
      continue
    }

    const heading = line.text.match(DECISION_HEADING)?.[1]
    if (heading !== undefined) {
      if (open) decisions.push({ ...open, body: open.body.join('\n') })
      open = { heading, line: line.number, body: [] }
      continue
    }

    // A decision runs to the next `###` or to the section that follows the
    // decision list, so the risks below never read as the last entry's body.
    if (SECTION_HEADING.test(line.text)) {
      if (open) decisions.push({ ...open, body: open.body.join('\n') })
      open = undefined
      continue
    }

    open?.body.push(line.text)
  }

  if (open) decisions.push({ ...open, body: open.body.join('\n') })
  return decisions
}

/** Cardinals a record spells rather than writes, which the corpus does for both. */
const SPELLED: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
}

const CARDINAL = String.raw`(\d+|${Object.keys(SPELLED).join('|')})`
const FRAME_CLAUSE = new RegExp(String.raw`${CARDINAL}-line frame`, 'i')
const PER_DECISION_CLAUSE = new RegExp(
  String.raw`${CARDINAL}\s+lines?\s+a\s+decision`,
  'i',
)

function readCardinal(token: string | undefined): number | undefined {
  if (token === undefined) return undefined
  const spelled = SPELLED[token.toLowerCase()]
  if (spelled !== undefined) return spelled

  const digits = Number.parseInt(token, 10)
  return Number.isNaN(digits) ? undefined : digits
}

/**
 * Reads the allowances a record declares for itself, or nothing.
 *
 * Both clauses have to be present, because half a formula is not one. A record
 * whose wording drifts past these clauses falls back to reporting rather than
 * to a stale ceiling held here, so the failure is visible in the run's own
 * output instead of gating a project on a rule nobody can point at.
 */
export function readAllowances(source: string): Allowances | undefined {
  const frame = readCardinal(source.match(FRAME_CLAUSE)?.[1])
  const perDecision = readCardinal(source.match(PER_DECISION_CLAUSE)?.[1])

  if (frame === undefined || perDecision === undefined) return undefined
  return { frame, perDecision }
}

/** Whether a read failed because nothing sits at the path. */
function isMissing(error: unknown): boolean {
  const code = (error as { code?: unknown }).code
  return code === 'ENOENT' || code === 'ENOTDIR'
}

/** The ceiling the record's own formula derives from its decision count. */
export function ceilingFor(allowances: Allowances, decisions: number): number {
  return allowances.frame + allowances.perDecision * decisions
}

/**
 * Measures the record, or reports nothing when the project carries none.
 *
 * Absent rather than empty, for the reason the sibling checks state: a project
 * with no record and one whose record holds no decision are different answers,
 * and a zeroed report reads as the second.
 */
export async function measureArchitecture(
  root: string,
): Promise<ArchitectureReport | undefined> {
  const rel = architectureRel(root)
  const path = join(root, rel)

  let source: string
  try {
    source = await readFile(path, 'utf8')
  } catch (error) {
    // Only a record that is not there reads as absent. A record present and
    // unreadable propagates the way every sibling reader here lets one
    // propagate, since swallowing it reports a project with no record and the
    // length gate passes over a file nobody opened.
    if (!isMissing(error)) throw error
    return undefined
  }

  const allowances = readAllowances(source)
  const raw = splitDecisions(source)
  const decisions = await Promise.all(
    raw.map(async (entry) => {
      const { claim, figures, quantified } = classifyDecision(entry.body)
      return {
        heading: entry.heading,
        line: entry.line,
        claim,
        figures,
        ...(quantified !== undefined && { quantified }),
        checks: await namedChecks(root, entry.body),
      }
    }),
  )

  return {
    rel,
    lines: source.replace(/\n$/, '').split('\n').length,
    ...(allowances !== undefined && {
      allowances,
      ceiling: ceilingFor(allowances, raw.length),
    }),
    decisions,
  }
}

/**
 * Whether the record is longer than the ceiling it derives for itself.
 *
 * False for a record declaring no allowances, which has no ceiling to be past.
 * That is the answer rather than a gap, since the length rule is the record's
 * own and a project that never wrote one owes nothing to it.
 */
export function isOverLength(report: ArchitectureReport): boolean {
  return report.ceiling !== undefined && report.lines > report.ceiling
}

/** How many entries carry a claim a machine could test. */
export function testableCount(report: ArchitectureReport): number {
  return report.decisions.filter((entry) => entry.claim !== 'neither').length
}

/** How many testable entries name a check that exists. */
export function coveredCount(report: ArchitectureReport): number {
  return report.decisions.filter(
    (entry) => entry.claim !== 'neither' && entry.checks.length > 0,
  ).length
}
