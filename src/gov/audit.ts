import { existsSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import { listRuleFiles } from '@/gov/payload'

/**
 * The six shape limits a rule body is held to.
 *
 * `create-rule`'s `references/rule.md` states the same six numbers to the
 * session writing a rule, and nothing compares the two, so a change to one is
 * a change to both in the same commit. The numbers come from groundwork 158's
 * decision rather than from the density limits, which bound prose sections a
 * rule never carries.
 */
export const RULE_LIMITS = {
  words: 300,
  bullets: 15,
  h2: 6,
  perH2: 7,
  chars: 200,
  sentences: 2,
} as const

export type RuleLimit = keyof typeof RULE_LIMITS | 'emphasis'

/**
 * Rule folders whose findings fail `--gate`, as path prefixes from the root.
 *
 * Each folder's rewrite appends its own line once that folder reaches zero, so
 * the slices merge without touching one another's entries. `canon/` waits on
 * `plan.md`, which a later slice rewrites.
 */
export const RULE_GATED_FOLDERS: readonly string[] = [
  join('governance', 'rules', 'claude') + sep,
  join('governance', 'rules', 'code') + sep,
  join('governance', 'rules', 'framework') + sep,
  join('governance', 'rules', 'writing') + sep,
  join('internal', 'rules') + sep,
]

/** The folders whose rules claim outside practice, so each carries a ledger. */
export const PRACTICE_FOLDERS: readonly string[] = [
  'lang',
  'lib',
  'framework',
  'ui',
  'tooling',
]

const SHIPPED_RULES = join('governance', 'rules')
const LEDGERS = join('governance', 'ledger')

/** Both corpora authored here, read when the tree is a canon checkout. */
const CANON_CORPUS: readonly string[] = [
  SHIPPED_RULES,
  join('internal', 'rules'),
]

/**
 * What a target authors. `.claude/rules/canon/` is installed from the toolkit
 * and fixed at its source, so a finding there is one the target cannot act on.
 */
const TARGET_CORPUS: readonly string[] = [join('.claude', 'rules', 'project')]

export interface ShapeFinding {
  readonly limit: RuleLimit
  readonly count: number
  readonly max: number
  /** One-based file line of the bullet, absent for a whole-body limit. */
  readonly line?: number
}

export interface RuleShape {
  readonly words: number
  readonly bullets: number
  readonly h2: number
  /** The most bullets under one H2, with the text above the first H2 a group. */
  readonly perH2: number
  readonly findings: readonly ShapeFinding[]
  /** Bullets per H2 heading, `null` for the group above the first one. */
  readonly groups: readonly HeadingCount[]
}

export interface HeadingCount {
  readonly heading: string | null
  readonly count: number
}

export interface LedgerMismatch {
  readonly heading: string | null
  readonly bullets: number
  readonly rows: number
}

export type LedgerReading =
  | { readonly status: 'not-required' }
  | { readonly status: 'missing'; readonly path: string }
  | {
      readonly status: 'present'
      readonly path: string
      readonly mismatches: readonly LedgerMismatch[]
    }

export interface RuleReading extends Omit<RuleShape, 'groups'> {
  /** Relative to the root that was read. */
  readonly file: string
  readonly ledger: LedgerReading
}

export type RuleAuditRefusal = 'no-rules' | 'no-path' | 'outside-root'

export type RuleAuditReport =
  | {
      readonly kind: 'measured'
      /** `canon` reads both authored corpora and ledgers, `target` neither. */
      readonly scope: 'canon' | 'target'
      readonly corpus: readonly string[]
      readonly rules: readonly RuleReading[]
    }
  | {
      readonly kind: 'unreadable'
      readonly reason: RuleAuditRefusal
      readonly message: string
    }

const FRONTMATTER = /^---\n[\s\S]*?\n---\n/
const FENCE = /^\s*(?:```|~~~)/
const H2 = /^## /

/**
 * Case-sensitive on the capitals, since "Never" opening a directive is plain
 * wording and "NEVER" is the shouting the prompting guide says newer models
 * overtrigger on.
 */
const EMPHASIS = /\b(?:CRITICAL|IMPORTANT|MUST|ALWAYS|NEVER)\b|\b[Yy]ou must\b/

function stripCodeSpans(text: string): string {
  return text.replace(/`[^`]*`/g, 'X')
}

/**
 * Sentence ends in one bullet, never fewer than one.
 *
 * Copied from groundwork 158's `audit.py`, which measured the baseline. A
 * period inside a code span or a short abbreviation ends nothing, and counting
 * either would put most of the corpus past two.
 */
export function countSentences(bullet: string): number {
  const text = stripCodeSpans(bullet).replace(/\b(?:e\.g|i\.e|etc|vs)\./g, 'X')
  return text.match(/[.!?](?:\s|$)/g)?.length ?? 1
}

interface Bullet {
  text: string
  line: number
}

/**
 * Measures one rule file against `RULE_LIMITS`.
 *
 * A bullet is a top-level `- ` line plus any indented line directly under it,
 * so a wrapped bullet is measured whole. A nested bullet is not counted, which
 * matches the groundwork script the baseline came from. Fenced blocks display
 * a list rather than state one.
 */
export function measureRule(text: string): RuleShape {
  const frontmatter = text.match(FRONTMATTER)
  const body = frontmatter ? text.slice(frontmatter[0].length) : text
  const offset = frontmatter ? frontmatter[0].split('\n').length - 1 : 0
  const lines = body.split('\n')

  const bullets: Bullet[] = []
  const groups: { heading: string | null; count: number }[] = [
    { heading: null, count: 0 },
  ]
  let fenced = false
  let open: Bullet | undefined

  for (const [index, line] of lines.entries()) {
    if (FENCE.test(line)) {
      fenced = !fenced
      open = undefined
      continue
    }
    if (fenced) continue

    if (H2.test(line)) {
      groups.push({ heading: line.slice(3).trim(), count: 0 })
      open = undefined
    } else if (line.startsWith('- ')) {
      open = { text: line.slice(2).trim(), line: offset + index + 1 }
      bullets.push(open)
      groups[groups.length - 1].count += 1
    } else if (
      open !== undefined &&
      line.startsWith('  ') &&
      !line.trim().startsWith('- ')
    ) {
      open.text += ` ${line.trim()}`
    } else {
      open = undefined
    }
  }

  const words = body.match(/\S+/g)?.length ?? 0
  const h2 = groups.length - 1
  const perH2 = Math.max(...groups.map((group) => group.count))
  const findings: ShapeFinding[] = []

  const whole: [RuleLimit & keyof typeof RULE_LIMITS, number][] = [
    ['words', words],
    ['bullets', bullets.length],
    ['h2', h2],
    ['perH2', perH2],
  ]
  for (const [limit, count] of whole) {
    if (count > RULE_LIMITS[limit]) {
      findings.push({ limit, count, max: RULE_LIMITS[limit] })
    }
  }

  for (const bullet of bullets) {
    const chars = [...bullet.text].length
    if (chars > RULE_LIMITS.chars) {
      findings.push({
        limit: 'chars',
        count: chars,
        max: RULE_LIMITS.chars,
        line: bullet.line,
      })
    }
    const sentences = countSentences(bullet.text)
    if (sentences > RULE_LIMITS.sentences) {
      findings.push({
        limit: 'sentences',
        count: sentences,
        max: RULE_LIMITS.sentences,
        line: bullet.line,
      })
    }
    // A code span quotes a word rather than shouting it.
    if (EMPHASIS.test(stripCodeSpans(bullet.text))) {
      findings.push({ limit: 'emphasis', count: 1, max: 0, line: bullet.line })
    }
  }

  return {
    words,
    bullets: bullets.length,
    h2,
    perH2,
    findings,
    groups: groups.filter((group) => group.count > 0),
  }
}

/**
 * Table rows per H2 in a ledger, `null` for a table above the first H2.
 *
 * A row is a table line after the header and its separator. Rows are matched
 * to bullets by count under a heading of the same name rather than by text,
 * since matching text breaks on every reword and whether a source says what
 * its bullet says is a review judgment either way.
 */
export function countLedgerRows(text: string): HeadingCount[] {
  const counts = new Map<string | null, number>()
  let heading: string | null = null
  let tableLines = 0
  let fenced = false

  for (const line of text.split('\n')) {
    if (FENCE.test(line)) fenced = !fenced
    if (fenced) continue

    if (line.startsWith('|')) {
      tableLines += 1
      if (tableLines > 2) counts.set(heading, (counts.get(heading) ?? 0) + 1)
      continue
    }
    tableLines = 0
    if (H2.test(line)) heading = line.slice(3).trim()
  }

  return [...counts].map(([key, count]) => ({ heading: key, count }))
}

function compareLedger(
  groups: readonly HeadingCount[],
  rows: readonly HeadingCount[],
): LedgerMismatch[] {
  const bullets = new Map(groups.map((group) => [group.heading, group.count]))
  const ledger = new Map(rows.map((row) => [row.heading, row.count]))
  const headings = [...new Set([...bullets.keys(), ...ledger.keys()])]

  return headings
    .map((heading) => ({
      heading,
      bullets: bullets.get(heading) ?? 0,
      rows: ledger.get(heading) ?? 0,
    }))
    .filter((entry) => entry.bullets !== entry.rows)
}

/** Where a rule's ledger lives, or nothing when its folder carries none. */
function ledgerPath(file: string): string | undefined {
  const prefix = `${SHIPPED_RULES}${sep}`
  if (!file.startsWith(prefix)) return undefined
  const rest = file.slice(prefix.length)
  const folder = rest.split(sep)[0]
  if (!PRACTICE_FOLDERS.includes(folder)) return undefined
  return join(LEDGERS, rest)
}

async function readLedger(
  root: string,
  file: string,
  groups: readonly HeadingCount[],
): Promise<LedgerReading> {
  const path = ledgerPath(file)
  if (path === undefined) return { status: 'not-required' }

  let text: string
  try {
    text = await readFile(resolve(root, path), 'utf8')
  } catch {
    return { status: 'missing', path }
  }

  return {
    status: 'present',
    path,
    mismatches: compareLedger(groups, countLedgerRows(text)),
  }
}

/**
 * Measures every rule this tree authors, or the files named.
 *
 * A tree holding `governance/rules/` is a canon checkout, read across both
 * authored corpora with a ledger asked of each outside-practice rule. Any
 * other tree is a target, read at `.claude/rules/project/` alone with no
 * ledger asked, since ledgers never ship.
 */
export async function readRuleAudit(
  root: string,
  paths: readonly string[] = [],
): Promise<RuleAuditReport> {
  const scope = existsSync(resolve(root, SHIPPED_RULES)) ? 'canon' : 'target'
  const corpus = scope === 'canon' ? CANON_CORPUS : TARGET_CORPUS

  let files: string[]
  if (paths.length > 0) {
    const missing = paths.filter((path) => !existsSync(resolve(root, path)))
    if (missing.length > 0) {
      return {
        kind: 'unreadable',
        reason: 'no-path',
        message: `No rule at ${missing.join(', ')}.`,
      }
    }
    // A path outside the root takes a `../` file name, which no gated prefix
    // and no ledger path can match, so it would pass `--gate` unread.
    const outside = paths.filter((path) =>
      relative(root, resolve(root, path)).startsWith('..'),
    )
    if (outside.length > 0) {
      return {
        kind: 'unreadable',
        reason: 'outside-root',
        message: `${outside.join(', ')} sits outside ${root}. Pass --root at the tree that holds it.`,
      }
    }
    const expanded: string[] = []
    for (const path of paths) {
      const abs = resolve(root, path)
      if (!statSync(abs).isDirectory()) {
        expanded.push(abs)
        continue
      }
      const found = listRuleFiles(abs)
      if (found.length === 0) {
        return {
          kind: 'unreadable',
          reason: 'no-rules',
          message: `No rule under ${path}, and a folder with no rules passes each of its zero rules, so it refuses rather than reporting clean.`,
        }
      }
      expanded.push(...found)
    }
    files = expanded
  } else {
    const dirs = corpus
      .map((rel) => resolve(root, rel))
      .filter((dir) => existsSync(dir))
    if (dirs.length === 0) {
      return {
        kind: 'unreadable',
        reason: 'no-rules',
        message: `No rule corpus under ${root}. Looked for ${corpus.join(', ')}, and a tree with no rules passes each of its zero rules, so it refuses rather than reporting clean.`,
      }
    }
    files = dirs.flatMap((dir) => listRuleFiles(dir))
  }

  const rules: RuleReading[] = []
  for (const abs of files) {
    const file = relative(root, abs)
    const { groups, ...shape } = measureRule(await readFile(abs, 'utf8'))
    rules.push({ file, ...shape, ledger: await readLedger(root, file, groups) })
  }

  return { kind: 'measured', scope, corpus, rules }
}

export function hasFinding(reading: RuleReading): boolean {
  if (reading.findings.length > 0) return true
  if (reading.ledger.status === 'missing') return true
  return (
    reading.ledger.status === 'present' && reading.ledger.mismatches.length > 0
  )
}

/**
 * Exit code for a measured report.
 *
 * Without `gate`, any finding sets 2, which is what a session fixing its own
 * rule reads. With it, only a finding in a gated folder does, so the push
 * stage reports the whole corpus and fails on the folders already at zero.
 */
export function auditExit(
  report: Extract<RuleAuditReport, { kind: 'measured' }>,
  options: { readonly gate: boolean; readonly gated: readonly string[] },
): number {
  const failing = report.rules.filter(
    (reading) =>
      hasFinding(reading) &&
      (!options.gate ||
        options.gated.some((prefix) => reading.file.startsWith(prefix))),
  )
  return failing.length > 0 ? 2 : 0
}
