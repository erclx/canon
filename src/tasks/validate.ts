import { existsSync, statSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { readFrontmatterSource } from '@/indexes/frontmatter'
import { codeSpans, unbrokenRun } from '@/markdown/tables'
import {
  archiveDir,
  declinedDir,
  isReservedStem,
  readOutcomes,
  readPendingBranches,
  readPlanTargets,
  readPullRequest,
  readSessions,
  resolveLivePlan,
  SESSIONS_PREFIX,
  tasksDir,
} from '@/tasks/archive'
import {
  deriveCells,
  GROUP_COLUMNS,
  readLaunch,
  renderedLength,
  RETIRED_COLUMNS,
  WAITING_LIMIT,
} from '@/tasks/board'
import { branchOfPlan } from '@/tasks/branch'
import type { HolderReader, LiveReaders, MergedReader } from '@/tasks/holders'
import { gitTrunkReader, type TrunkReader } from '@/tasks/trunk'

const ORDERING_FILE = 'priority.md'
const BACKLOG_FILE = 'backlog.md'

/** The opening `touchesCell` writes, as in `12 files under` or a bare `2 files`. */
const DERIVED_COUNT = /^\d+ files?(?: under |$)/

/**
 * The readiness headings `claude/skills/task-board/references/board.md` fixes.
 * The names are the contract, so a board grouping under its own names reads as
 * carrying no group, and the run refuses instead of reporting it clean.
 */
export const BOARD_GROUPS = ['In flight', 'Up next', 'Needs a plan'] as const

export type BoardGroup = (typeof BOARD_GROUPS)[number]

/**
 * Headings a board written before a rename still carries, read as the group
 * they became. No verb writes one, so the first board write migrates the file.
 */
export const RETIRED_HEADINGS: Readonly<Record<string, BoardGroup>> = {
  'Run now': 'In flight',
}

/**
 * The value a `group` or `from` field carries in a JSON record. Scripts parse
 * those values, so the group renamed `In flight` still reports as `Run now`.
 */
export function groupToken(group: BoardGroup): string {
  return group === 'In flight' ? 'Run now' : group
}

/** A `JSON.stringify` replacer writing every `group` and `from` field through `groupToken`. */
export function groupTokens(key: string, value: unknown): unknown {
  return (key === 'group' || key === 'from') && value === 'In flight'
    ? groupToken(value)
    : value
}

/** The group a `##` heading names under either spelling, undefined for any other section. */
export function groupOfHeading(heading: string): BoardGroup | undefined {
  if ((BOARD_GROUPS as readonly string[]).includes(heading)) {
    return heading as BoardGroup
  }
  return RETIRED_HEADINGS[heading]
}

export const VALIDATE_REFUSALS = [
  'no-board',
  'no-ordering',
  'no-groups',
] as const

export type ValidateRefusal = (typeof VALIDATE_REFUSALS)[number]

export const FINDING_KINDS = [
  'plan-unstated',
  'plan-unresolved',
  'plan-uncited',
  'plan-mismatched',
  'plan-parked',
  'plan-absent',
  'plan-several',
  'task-unresolved',
  'row-duplicated',
  'row-misshapen',
  'row-untabled',
  'row-misordered',
  'row-unranked',
  'row-held',
  'touches-unstated',
  'touches-stale',
  'columns-mismatched',
  'group-doubled',
  'launch-misshapen',
  'launch-unstated',
  'cell-long',
  'blocker-settled',
  'blocker-unresolved',
  'blocker-declined',
  'sessions-misshapen',
  'frontmatter-invalid',
] as const

export type FindingKind = (typeof FINDING_KINDS)[number]

export interface Finding {
  readonly kind: FindingKind
  readonly group: BoardGroup | undefined
  readonly subject: string
  readonly message: string
}

/**
 * A parked row neither half of the blocker check reached. Three of the five
 * blocker kinds put no fact on disk, so a run reporting findings alone would
 * read as a board with nothing stale on it.
 */
export interface Untested {
  readonly group: BoardGroup
  readonly subject: string
  readonly message: string
}

/**
 * A `Touches` cell naming a bare folder, which claims every file under it and
 * so collides with every row a later session writes there. The claim is often
 * correct, so it reports beside the findings and moves no exit code.
 */
export interface FolderClaim {
  readonly group: BoardGroup
  readonly subject: string
  readonly message: string
}

/**
 * A path two `## In flight` rows both name. It is no hold and moves no exit
 * code, and stays listed for merge order and the dispatcher's conflict check.
 */
export interface SharedFiles {
  readonly group: BoardGroup
  readonly subject: string
  readonly message: string
}

/**
 * A code span in a board cell that the preview cannot break, pushing the table
 * past the pane: a whitespace-free run wider than `WIDE_LIMIT`, or a brace-glob,
 * which is written out as separate paths. It reports beside the findings only.
 */
export interface WideToken {
  readonly group: BoardGroup
  readonly subject: string
  readonly message: string
}

/**
 * A task file neither surface names, the normal state between a session filing
 * it and an orchestrator placing it, so it moves no exit code. It is still the
 * only local detector for a row lost to a hand-edit or an ended orchestrator.
 */
export interface Unplaced {
  readonly subject: string
  readonly message: string
}

/**
 * A backlog line, which carries a pointer and nothing else. The backlog is
 * explicitly unordered, so a line has no position to read and no columns to
 * resolve.
 */
export interface BacklogRow {
  readonly label: string
  readonly stem: string | undefined
}

export interface BoardRow {
  readonly group: BoardGroup
  readonly label: string
  readonly stem: string | undefined
  /** The Plan cell's target on a board still carrying one, which the task's own `Plan:` line replaced. */
  readonly plan: string | undefined
  readonly hasPlanCell: boolean
  /**
   * Absent when the group fixes no `Touches` column, empty when it read none.
   * `readBoard` reads the written cell, and `declaredRows` replaces it with the
   * paths the task's plans declare.
   */
  readonly touches: readonly string[] | undefined
  /** The `Touches` cell as written, which the stale check compares against the derivation. */
  readonly touchesText: string | undefined
  /** Absent when the group fixes no `Waiting on` column, which is `## In flight`. */
  readonly waiting: string | undefined
  /** The ordinal phrase a `Waiting on` cell states about its own position, undefined when the cell carries none. */
  readonly ordinal: OrdinalWord | 'last' | undefined
  /** Whether a `Waiting on` cell ranks its row against a sibling row or a class of rows, false when the group fixes no such column. */
  readonly ranked: boolean
  /** The `Launch` cell as written, absent when the group fixes no such column. */
  readonly launch: string | undefined
  /** Every cell of the row as `splitCells` read it, which the wide-token scan walks. */
  readonly cells: readonly string[]
}

/**
 * What each source behind the held-row check answered. `unread` is a source the
 * run asked and could not read, so a board carrying no `row-held` finding beside
 * it is untested rather than clean. `not-asked` is a run without the live read.
 */
export type LiveState = 'read' | 'unread' | 'not-asked'

export interface LiveReading {
  readonly sessions: LiveState
  readonly pulls: LiveState
}

export interface ValidateReport {
  readonly ok: true
  readonly rows: number
  readonly backlog: number
  readonly tasks: number
  readonly declined: number
  readonly findings: readonly Finding[]
  readonly untested: readonly Untested[]
  readonly claims: readonly FolderClaim[]
  readonly shared: readonly SharedFiles[]
  readonly wide: readonly WideToken[]
  readonly unplaced: readonly Unplaced[]
  readonly live: LiveReading
}

export interface ValidateRefused {
  readonly ok: false
  readonly reason: ValidateRefusal
  readonly message: string
}

export type ValidateOutcome = ValidateReport | ValidateRefused

export function orderingPath(root: string): string {
  return join(tasksDir(root), ORDERING_FILE)
}

export function backlogPath(root: string): string {
  return join(tasksDir(root), BACKLOG_FILE)
}

/**
 * Every link target in a cell, in order. `linkTarget` reads only the first,
 * which is what the single-link `Task` and `Plan` columns need; `citedStem`
 * walks the rest to find a blocker cell's bare sibling pointer.
 */
function linkTargets(cell: string): string[] {
  return [...cell.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)].map((match) =>
    match[1].trim(),
  )
}

/**
 * Pulls the target out of a markdown link, which is how both the `Task` and the
 * `Plan` column spell their pointer. A cell carrying prose instead of a link
 * yields nothing, and that absence is the finding rather than a parse failure.
 */
function linkTarget(cell: string): string | undefined {
  return linkTargets(cell)[0]
}

function linkText(cell: string): string {
  const match = /\[([^\]]*)\]\([^)]+\)/.exec(cell)
  return (match ? match[1] : cell).trim()
}

function stemOf(target: string): string | undefined {
  const name = target.split('/').pop()
  if (!name || !name.endsWith('.md')) return undefined
  return name.slice(0, -'.md'.length)
}

/**
 * Reads the file set out of a `Touches` cell written as prose: the backticked
 * spans minus skills and commands, an extension opening with a letter to tell
 * `commands.md` from a version. A cell a verb derived yields nothing.
 */
export function readPaths(cell: string): string[] {
  if (DERIVED_COUNT.test(cell.trim())) return []

  const spans = cell.match(/`[^`]+`/g) ?? []
  const paths = spans
    .map((span) => span.slice(1, -1).trim())
    .filter(
      (span) => span.includes('/') || /\.[A-Za-z][A-Za-z0-9]*$/.test(span),
    )
    .map((span) => span.replace(/^\.\//, '').replace(/\/+$/, ''))

  return [...new Set(paths)]
}

/**
 * Two paths touch the same work when they are equal or one contains the other.
 * A row naming a directory and a row naming a file inside it collide, which a
 * set intersection on the written strings alone would miss.
 */
function sharesPath(left: string, right: string): boolean {
  return (
    left === right ||
    left.startsWith(`${right}/`) ||
    right.startsWith(`${left}/`)
  )
}

/**
 * Whether a `Touches` path names a directory. The tree answers for a path that
 * resolves, and the name decides for one the row has yet to create, where a span
 * surviving `readPaths` with no extension was let through by a slash.
 */
function isFolder(path: string, root: string): boolean {
  const target = resolve(root, path)
  if (existsSync(target)) return statSync(target).isDirectory()

  return !/\.[A-Za-z][A-Za-z0-9]*$/.test(path)
}

function splitCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/(?<!\\)\|$/, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim())
}

function isSeparator(cells: readonly string[]): boolean {
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

function columnIndex(header: readonly string[], name: string): number {
  return header.findIndex((cell) => cell.toLowerCase() === name)
}

/**
 * Whether a header is the set of columns its group owns now or owned before,
 * in any order, since the reader resolves every column by name.
 */
function ownsColumns(group: BoardGroup, header: readonly string[]): boolean {
  const named = header.map((cell) => cell.toLowerCase())

  return [GROUP_COLUMNS[group], RETIRED_COLUMNS[group]].some((columns) => {
    const owned = columns.map((column) => column.toLowerCase())
    return (
      named.length === owned.length &&
      owned.every((column) => named.includes(column))
    )
  })
}

const ORDINAL_WORDS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
  'eleventh',
  'twelfth',
  'thirteenth',
  'fourteenth',
  'fifteenth',
  'sixteenth',
  'seventeenth',
  'eighteenth',
  'nineteenth',
  'twentieth',
] as const

type OrdinalWord = (typeof ORDINAL_WORDS)[number]

const ORDINAL_HERE = new RegExp(
  `\\b(${ORDINAL_WORDS.join('|')})\\s+here\\b`,
  'i',
)
const LAST_AT_END = /\blast\.?\s*$/i

/**
 * Reads the ordinal phrase a `Waiting on` cell states about its own position.
 * `<ordinal> here` is found anywhere, but a bare `last` counts only at the end
 * of the cell, since the word is common in prose. A cell with neither is unordered.
 */
function readOrdinal(cell: string): OrdinalWord | 'last' | undefined {
  const here = ORDINAL_HERE.exec(cell)
  if (here?.[1]) return here[1].toLowerCase() as OrdinalWord

  return LAST_AT_END.test(cell) ? 'last' : undefined
}

const RANK_VERB =
  /\b(?:leads|heads|opens|closes|trails|precedes|follows|outranks|sits\s+(?:under|above|below))\b/i

/** A phase label, the group a row opens or closes, or the sibling rows it is ranked among. */
const RANK_OBJECT = /\bv\d+\.\d+\b|\bgroups?\b|\brows?\b/i

/**
 * A clause boundary: the three punctuation marks that end one plus the two
 * conjunctions live cells use to hang a reason off a position claim. The marks
 * are bounded away from digits so `v80.4` stays one token.
 */
const CLAUSE_BREAK = /(?<!\d)[.;,](?!\d)|\band\b|\bbecause\b/i

/**
 * Whether a `Waiting on` cell ranks its row against something rather than
 * arguing it matters. The test is a closed verb vocabulary in one clause with a
 * positional object, and unusual phrasing reads as unranked, the safe direction.
 */
function readRank(cell: string): boolean {
  return cell
    .split(CLAUSE_BREAK)
    .some((clause) => RANK_VERB.test(clause) && RANK_OBJECT.test(clause))
}

function isRowLine(line: string): boolean {
  return line.trimStart().startsWith('|')
}

/**
 * Whether a header candidate genuinely opens a table, meaning the line right
 * behind it is a separator with the same cell count, since a row landing after
 * a closed table looks identical to a fresh header until this read.
 */
function opensTable(
  header: readonly string[],
  next: string | undefined,
): boolean {
  if (next === undefined || !isRowLine(next)) return false
  const cells = splitCells(next)
  return isSeparator(cells) && cells.length === header.length
}

/**
 * Parses the ordering file into rows keyed by readiness group, reading columns
 * from each table's own header rather than by position. A blank or prose line
 * closes a table, so a row stranded behind it is checked as a candidate header.
 */
export function readBoard(text: string): {
  readonly rows: readonly BoardRow[]
  readonly groups: readonly BoardGroup[]
  readonly findings: readonly Finding[]
} {
  const rows: BoardRow[] = []
  const groups: BoardGroup[] = []
  const findings: Finding[] = []

  const lines = text.split('\n')

  let group: BoardGroup | undefined
  let header: string[] | undefined

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? ''
    const heading = /^##\s+(.+?)\s*$/.exec(line)
    if (heading) {
      group = groupOfHeading(heading[1])
      header = undefined
      if (group && groups.includes(group)) {
        findings.push({
          kind: 'group-doubled',
          group,
          subject: line.trim(),
          message: `opens ${group} a second time. Merge the two tables by hand, since a board verb refuses to pick which one holds the group.`,
        })
      }
      if (group && !groups.includes(group)) groups.push(group)
      continue
    }

    if (!group) continue

    if (!isRowLine(line)) {
      header = undefined
      continue
    }

    const cells = splitCells(line)
    if (isSeparator(cells)) continue

    if (!header) {
      if (!opensTable(cells, lines[i + 1])) {
        findings.push({
          kind: 'row-untabled',
          group,
          subject: line.trim(),
          message:
            'sits outside a table. The table above it already closed at the line before it.',
        })
        continue
      }

      header = cells
      if (!ownsColumns(group, cells)) {
        findings.push({
          kind: 'columns-mismatched',
          group,
          subject: line.trim(),
          message: `is not the ${GROUP_COLUMNS[group].join(', ')} header ${group} owns.`,
        })
      }
      continue
    }

    if (cells.length !== header.length) {
      findings.push({
        kind: 'row-misshapen',
        group,
        subject: line.trim(),
        message: `carries ${cells.length} cell(s) against the ${header.length}-cell header above it.`,
      })
      continue
    }

    const taskAt = columnIndex(header, 'task')
    const planAt = columnIndex(header, 'plan')
    const touchesAt = columnIndex(header, 'touches')
    const waitingAt = columnIndex(header, 'waiting on')
    const launchAt = columnIndex(header, 'launch')

    const task = taskAt >= 0 ? (cells[taskAt] ?? '') : ''
    const target = linkTarget(task)
    const plan = planAt >= 0 ? linkTarget(cells[planAt] ?? '') : undefined
    const waiting = waitingAt >= 0 ? (cells[waitingAt] ?? '') : undefined
    const launch = launchAt >= 0 ? (cells[launchAt] ?? '') : undefined

    if (launch && readLaunch(launch) === undefined) {
      findings.push({
        kind: 'launch-misshapen',
        group,
        subject: line.trim(),
        message: `carries the Launch cell "${launch}", which does not read as a role, model, effort, and route. Every board verb refuses the board until the cell is fixed or emptied by hand.`,
      })
    }

    rows.push({
      group,
      label: linkText(task) || task,
      stem: target ? stemOf(target) : undefined,
      plan,
      hasPlanCell: planAt >= 0,
      touches: touchesAt >= 0 ? readPaths(cells[touchesAt] ?? '') : undefined,
      touchesText: touchesAt >= 0 ? (cells[touchesAt] ?? '') : undefined,
      waiting,
      ordinal: waiting ? readOrdinal(waiting) : undefined,
      ranked: waiting ? readRank(waiting) : false,
      launch,
      cells,
    })
  }

  return { rows, groups, findings }
}

/**
 * Reports the two ways a `## Needs a plan` row's stated position fails, in one
 * walk: an ordinal checked against where the row sits, and a row with no
 * position claim, since arguing the task matters ranks it against nothing.
 */
function checkOrdering(rows: readonly BoardRow[]): Finding[] {
  const findings: Finding[] = []
  const parked = rows.filter((row) => row.group === 'Needs a plan')

  parked.forEach((row, index) => {
    const position = index + 1

    if (!row.ordinal) {
      if (row.ranked) return

      findings.push({
        kind: 'row-unranked',
        group: row.group,
        subject: subjectOf(row),
        message: `names no row or class it is ranked against, so its position ${position} of ${parked.length} in ${row.group} records only when it was filed.`,
      })

      return
    }

    const expected =
      row.ordinal === 'last'
        ? parked.length
        : ORDINAL_WORDS.indexOf(row.ordinal) + 1

    if (expected === position) return

    const phrase = row.ordinal === 'last' ? 'last' : `${row.ordinal} here`
    findings.push({
      kind: 'row-misordered',
      group: row.group,
      subject: subjectOf(row),
      message: `declares itself "${phrase}", but sits at position ${position} of ${parked.length} in ${row.group}.`,
    })
  })

  return findings
}

/**
 * Parses the backlog into one row per bullet carrying a link. It is a flat list,
 * so a bullet holding prose instead of a pointer is skipped, which keeps the
 * intro out of the findings, and `checkMapping` reports a stem no line reaches.
 */
export function readBacklog(text: string): readonly BacklogRow[] {
  const rows: BacklogRow[] = []

  for (const line of text.split('\n')) {
    if (!/^\s*[-*]\s/.test(line)) continue

    const target = linkTarget(line)
    if (!target) continue

    // A pointer carrying a directory names something other than a sibling task, as `citedStem` reads it.
    const path = target.split('#')[0] ?? ''
    if (path.includes('/')) continue

    const stem = stemOf(path)
    if (stem && isReservedStem(stem)) continue

    rows.push({ label: linkText(line) || line.trim(), stem })
  }

  return rows
}

async function listTaskStems(dir: string): Promise<string[]> {
  const entries = await readdir(dir)

  return entries
    .filter((entry) => entry.endsWith('.md'))
    .map((entry) => entry.slice(0, -'.md'.length))
    .filter((stem) => !isReservedStem(stem))
    .sort()
}

/**
 * Resolves a pointer against the board and against the project root both, the
 * way `task-complete` reads the same line. A fragment is dropped first, since an
 * anchor is part of the link and never part of the path.
 */
function resolves(target: string, dir: string, root: string): boolean {
  const path = target.split('#')[0]
  if (!path) return false

  return existsSync(resolve(dir, path)) || existsSync(resolve(root, path))
}

/**
 * Reports a task cited from two places on the board, which claims two
 * contradictory things about itself, since a task belongs to exactly one group.
 * A file neither surface names is not reported here, being the normal state.
 */
function checkMapping(
  rows: readonly BoardRow[],
  backlog: readonly BacklogRow[],
  dir: string,
): Finding[] {
  const findings: Finding[] = []
  const seen = new Map<string, number>()
  const listed = new Set<string>()

  for (const row of backlog) {
    if (!row.stem) {
      findings.push({
        kind: 'task-unresolved',
        group: undefined,
        subject: row.label,
        message: 'is a backlog line naming no task file.',
      })
      continue
    }

    listed.add(row.stem)

    if (!existsSync(join(dir, `${row.stem}.md`))) {
      findings.push({
        kind: 'task-unresolved',
        group: undefined,
        subject: row.stem,
        message: 'has a backlog line and no task file.',
      })
    }
  }

  for (const row of rows) {
    if (!row.stem) {
      findings.push({
        kind: 'task-unresolved',
        group: row.group,
        subject: row.label,
        message: 'names no task file, so the row points at nothing.',
      })
      continue
    }

    seen.set(row.stem, (seen.get(row.stem) ?? 0) + 1)

    if (!existsSync(join(dir, `${row.stem}.md`))) {
      findings.push({
        kind: 'task-unresolved',
        group: row.group,
        subject: row.stem,
        message: 'has a row and no task file.',
      })
    }
  }

  for (const [stem, count] of seen) {
    if (count > 1) {
      findings.push({
        kind: 'row-duplicated',
        group: undefined,
        subject: stem,
        message: `carries ${count} rows. A task belongs to exactly one group.`,
      })
    }

    if (listed.has(stem)) {
      findings.push({
        kind: 'row-duplicated',
        group: undefined,
        subject: stem,
        message:
          'carries a row on the board and a line on the backlog. A task sits on one surface.',
      })
    }
  }

  return findings
}

/**
 * An `## In flight` row's plan pointer, off a retired Plan cell or else the
 * task's `Plan:` line. A gone task file answers undefined for `task-unresolved`.
 */
export async function rowPlan(
  row: BoardRow,
  dir: string,
): Promise<{ readonly plan: string | undefined } | undefined> {
  if (row.hasPlanCell) return { plan: row.plan }
  if (!row.stem) return { plan: undefined }

  const file = join(dir, `${row.stem}.md`)
  if (!existsSync(file)) return undefined

  return { plan: readPlanTargets(await readFile(file, 'utf8'))[0] }
}

async function checkPlans(
  rows: readonly BoardRow[],
  dir: string,
  root: string,
): Promise<Finding[]> {
  const running = rows.filter((row) => row.group === 'In flight')

  const found = await Promise.all(
    running.map(async (row): Promise<Finding | undefined> => {
      const read = await rowPlan(row, dir)
      if (read === undefined) return undefined

      if (!read.plan) {
        return {
          kind: 'plan-unstated',
          group: row.group,
          subject: row.stem ?? row.label,
          message: row.hasPlanCell
            ? 'states no plan pointer, so the readiness claim cannot be checked.'
            : 'has a task carrying no Plan: line, so the readiness claim cannot be checked.',
        }
      }

      if (resolves(read.plan, dir, root)) return undefined

      return {
        kind: 'plan-unresolved',
        group: row.group,
        subject: row.stem ?? row.label,
        message: `points at ${read.plan}, which resolves to no file.`,
      }
    }),
  )

  return found.filter((finding): finding is Finding => finding !== undefined)
}

/**
 * Compares a retired Plan cell with the task's `Plan:` line, which the archive
 * reads, after resolving both, since two spellings can name one file.
 */
async function checkPlanAgreement(
  rows: readonly BoardRow[],
  dir: string,
  root: string,
): Promise<Finding[]> {
  const ready = rows.filter((row) => row.group === 'In flight' && row.plan)

  const found = await Promise.all(
    ready.map(async (row) => planDisagreement(row, dir, root)),
  )

  return found.filter((finding): finding is Finding => finding !== undefined)
}

async function planDisagreement(
  row: BoardRow,
  dir: string,
  root: string,
): Promise<Finding | undefined> {
  const subject = row.stem ?? row.label
  if (!row.stem || !row.plan) return undefined

  const file = join(dir, `${row.stem}.md`)
  if (!existsSync(file)) return undefined

  const text = await readFile(file, 'utf8')
  const targets = readPlanTargets(text)
  if (targets.length === 0) {
    return {
      kind: 'plan-uncited',
      group: 'In flight',
      subject,
      message: `is rowed against ${row.plan}, and the task file carries no Plan: line, so the archive settles no plan when it ships.`,
    }
  }

  const twice = duplicatePlans(targets, 'In flight', subject, dir, root)
  if (twice) return twice

  const rowed = planPath(row.plan, dir, root)
  if (targets.some((target) => planPath(target, dir, root) === rowed)) {
    return undefined
  }

  return {
    kind: 'plan-mismatched',
    group: 'In flight',
    subject,
    message:
      targets.length === 1
        ? `is rowed against ${row.plan} and cites ${targets[0]} in its own Plan: line. One task names one plan.`
        : `is rowed against ${row.plan}, which is none of the links on its own Plan: line (${targets.join(', ')}).`,
  }
}

/**
 * Reports a `Sessions:` line that does not parse as name and id pairs, since
 * the reader takes such a line as naming nobody and a retro would find the
 * sessions gone. A row whose task file is gone is left to `task-unresolved`.
 */
async function checkSessions(
  rows: readonly BoardRow[],
  dir: string,
): Promise<Finding[]> {
  const found = await Promise.all(
    rows.map(async (row): Promise<Finding | undefined> => {
      if (!row.stem) return undefined
      const file = join(dir, `${row.stem}.md`)
      if (!existsSync(file)) return undefined

      const text = await readFile(file, 'utf8')
      const line = text
        .split('\n')
        .find((entry) => entry.startsWith(SESSIONS_PREFIX))
      if (line === undefined || readSessions(text).length > 0) return undefined

      return {
        kind: 'sessions-misshapen',
        group: row.group,
        subject: row.stem,
        message: `carries "${line}", which does not read as name (sessionId) pairs, so no session it names can be recovered. Rewrite it through canon tasks session.`,
      }
    }),
  )

  return found.filter((finding): finding is Finding => finding !== undefined)
}

/**
 * Reports a task file whose frontmatter block will not parse, which the index
 * regeneration would otherwise surface only after the row was placed. A file
 * with no block is left alone, since the index walker owns that report.
 */
async function checkFrontmatter(
  stems: readonly string[],
  dir: string,
): Promise<Finding[]> {
  const found = await Promise.all(
    stems.map(async (stem): Promise<Finding | undefined> => {
      const reading = readFrontmatterSource(
        await readFile(join(dir, `${stem}.md`), 'utf8'),
      )
      if (reading.kind !== 'invalid') return undefined

      return {
        kind: 'frontmatter-invalid',
        group: undefined,
        subject: stem,
        message: `frontmatter is not valid YAML: ${reading.message}. Double any apostrophe inside the single-quoted title.`,
      }
    }),
  )

  return found.filter((finding): finding is Finding => finding !== undefined)
}

/**
 * Tests the claim a group name makes about a plan: `## Needs a plan` says none
 * is live and `## Up next` says one is written, read against the task's `Plan:`
 * line. A live plan is one the archive accepts and the disk holds.
 */
async function checkGroupClaims(
  rows: readonly BoardRow[],
  dir: string,
  root: string,
): Promise<Finding[]> {
  const parked = rows.filter(
    (row) => row.group === 'Needs a plan' || row.group === 'Up next',
  )

  const found = await Promise.all(
    parked.map(async (row) => groupClaimFinding(row, dir, root)),
  )

  return found.filter((finding): finding is Finding => finding !== undefined)
}

async function groupClaimFinding(
  row: BoardRow,
  dir: string,
  root: string,
): Promise<Finding | undefined> {
  if (!row.stem) return undefined

  const file = join(dir, `${row.stem}.md`)
  if (!existsSync(file)) return undefined

  const text = await readFile(file, 'utf8')
  const targets = readPlanTargets(text)
  const twice = duplicatePlans(targets, row.group, row.stem, dir, root)
  if (twice) return twice

  const target = targets.find((link) => {
    const live = resolveLivePlan(link, dir, root)
    return live !== undefined && existsSync(live)
  })
  const hasLivePlan = target !== undefined

  if (row.group === 'Needs a plan' && hasLivePlan) {
    return {
      kind: 'plan-parked',
      group: row.group,
      subject: row.stem,
      message: `sits under ${row.group} and its task cites ${target}, a live plan. A row with a plan belongs under Up next or In flight. When the plan no longer describes the work, keep the row under Up next, amend the plan in place, hold the row with canon tasks block until the amended plan lands, and record why under the task's Findings.`,
    }
  }

  if (
    row.group === 'Up next' &&
    hasLivePlan &&
    row.launch !== undefined &&
    row.launch.trim() === ''
  ) {
    return {
      kind: 'launch-unstated',
      group: row.group,
      subject: row.stem,
      message: `sits under ${row.group} with a live plan and no Launch cell. Pick one through canon tasks launch.`,
    }
  }

  if (row.group === 'Up next' && !hasLivePlan) {
    return {
      kind: 'plan-absent',
      group: row.group,
      subject: row.stem,
      message:
        targets.length > 1
          ? `sits under ${row.group}, which claims a written plan, and its task cites ${targets.join(', ')}, none of which is a live plan.`
          : targets.length === 1
            ? `sits under ${row.group}, which claims a written plan, and its task cites ${targets[0]}, which is not a live plan.`
            : `sits under ${row.group}, which claims a written plan, and its task carries no Plan: line.`,
    }
  }

  return undefined
}

/**
 * Reports a `Plan:` line linking one plan more than once. Links to distinct
 * plans are the shape a sliced task carries, so only a repeat is a finding, and
 * links compare by resolved file, so two spellings of one path repeat.
 */
function duplicatePlans(
  targets: readonly string[],
  group: Finding['group'],
  subject: string,
  dir: string,
  root: string,
): Finding | undefined {
  const paths = targets.map((target) => planPath(target, dir, root))
  if (new Set(paths).size === paths.length) return undefined

  return {
    kind: 'plan-several',
    group,
    subject,
    message: `lists the same plan twice on its Plan: line (${targets.join(', ')}). Drop the repeat, or link a distinct plan per slice.`,
  }
}

/**
 * Where a plan pointer lands, resolved against the board and the project root
 * the way the archive resolves the line. Neither base existing leaves the
 * board-relative reading, so two pointers at one absent file compare equal.
 */
function planPath(target: string, dir: string, root: string): string {
  const path = target.split('#')[0] || target
  const fromBoard = resolve(dir, path)
  if (existsSync(fromBoard)) return fromBoard

  const fromRoot = resolve(root, path)
  return existsSync(fromRoot) ? fromRoot : fromBoard
}

/**
 * Reports a `## In flight` row stating no file set. The `Touches` column is the
 * only place a row's set is written down, so a row stating none drops out of
 * every pair `checkSharedFiles` reads, and its merge order and reach go unread.
 */
function checkTouches(rows: readonly BoardRow[]): Finding[] {
  const findings: Finding[] = []

  for (const row of rows.filter(
    (candidate) => candidate.group === 'In flight',
  )) {
    // An absent column and an unreadable one both leave the row out of every pair, so both are reported.
    if (!row.touches || row.touches.length === 0) {
      findings.push({
        kind: 'touches-unstated',
        group: row.group,
        subject: row.stem ?? row.label,
        message: 'names no file, so its collisions cannot be read.',
      })
    }
  }

  return findings
}

/**
 * Lists every path two `## In flight` rows both name, one entry per pair of
 * rows. It reports rather than fails, since sharing a file holds nothing.
 */
function checkSharedFiles(rows: readonly BoardRow[]): SharedFiles[] {
  const pairs: SharedFiles[] = []
  const ready = rows.filter((row) => row.group === 'In flight')

  for (let i = 0; i < ready.length; i += 1) {
    for (let j = i + 1; j < ready.length; j += 1) {
      const left = ready[i]
      const right = ready[j]
      const shared = (left.touches ?? []).flatMap((path) => {
        const other = (right.touches ?? []).find((candidate) =>
          sharesPath(path, candidate),
        )
        return other === undefined
          ? []
          : [describeShared(path, other, left, right)]
      })

      if (shared.length === 0) continue

      pairs.push({
        group: 'In flight',
        subject: `${subjectOf(left)} and ${subjectOf(right)}`,
        message: `both touch ${joinShared(shared)}.`,
      })
    }
  }

  return pairs
}

function subjectOf(row: BoardRow): string {
  return row.stem ?? row.label
}

/**
 * Names one path two rows share, and the row that claimed it as a folder when
 * one side named a directory holding the other's file, since printing the
 * strings alone leaves an over-broad cell and a genuine overlap identical.
 */
function describeShared(
  path: string,
  other: string,
  left: BoardRow,
  right: BoardRow,
): string {
  if (path === other) return path

  const container = path.length < other.length ? path : other
  const owner = container === path ? left : right
  return `${container}, which ${subjectOf(owner)} claims as a folder`
}

/**
 * A folder clause carries a comma of its own, so a comma between clauses would
 * read as another path. The plain list keeps the comma it has always had.
 */
function joinShared(clauses: readonly string[]): string {
  const separator = clauses.some((clause) => clause.includes(',')) ? '; ' : ', '
  return clauses.join(separator)
}

/**
 * Reports an `## In flight` `Touches` cell naming a bare folder, as a reach
 * rather than a defect, since a row rewriting the folder claims it rightly.
 */
function checkFolderClaims(
  rows: readonly BoardRow[],
  root: string,
): FolderClaim[] {
  const claims: FolderClaim[] = []

  for (const row of rows.filter(
    (candidate) => candidate.group === 'In flight',
  )) {
    for (const path of row.touches ?? []) {
      if (!isFolder(path, root)) continue

      claims.push({
        group: row.group,
        subject: subjectOf(row),
        message: `claims the whole ${path} folder, so it collides with every row written under it.`,
      })
    }
  }

  return claims
}

/**
 * The widest the longest unbroken run in a code span may be before a table
 * scrolls in the preview pane. A 57-character span fit and a 78-character one
 * did not. Table cells read the same measure at 30, and the board keeps 60.
 */
const WIDE_LIMIT = 60

/**
 * Reports a code span a table cell cannot wrap, measured by `unbrokenRun`,
 * which `canon markdown audit` reads for a table too. Every group is scanned,
 * since the overflow happened under `## Up next`, and only a span is read.
 */
function checkWideTokens(rows: readonly BoardRow[]): WideToken[] {
  const wide: WideToken[] = []

  for (const row of rows) {
    for (const cell of row.cells) {
      for (const text of codeSpans(cell)) {
        const span = `\`${text}\``
        const run = unbrokenRun(text)

        if (/\{[^}]*,[^}]*\}/.test(text)) {
          wide.push({
            group: row.group,
            subject: subjectOf(row),
            message: `holds the brace-glob ${span}, which renders as one unbroken token. Write it out as separate paths.`,
          })
        } else if (run > WIDE_LIMIT) {
          wide.push({
            group: row.group,
            subject: subjectOf(row),
            message: `holds a ${run}-character token, ${span}, past the ${WIDE_LIMIT} a preview pane fits, so its table scrolls sideways.`,
          })
        }
      }
    }
  }

  return wide
}

/**
 * Reports a task file neither the board nor the backlog names. Filing a task
 * and placing its row are two acts a different session may perform, so this
 * moves no exit code, and it is the only local detector for a dropped row.
 */
function checkUnplaced(
  rows: readonly BoardRow[],
  backlog: readonly BacklogRow[],
  stems: readonly string[],
): Unplaced[] {
  const seen = new Set(rows.flatMap((row) => (row.stem ? [row.stem] : [])))
  const listed = new Set(backlog.flatMap((row) => (row.stem ? [row.stem] : [])))

  return stems
    .filter((stem) => !seen.has(stem) && !listed.has(stem))
    .map((stem) => ({
      subject: stem,
      message:
        'is a task file with no row on the board and no line on the backlog.',
    }))
}

/**
 * Reads the task a blocker cell cites. A task pointer is a bare sibling
 * filename, so a target carrying a directory names something else and yields
 * nothing. Every link is walked, and the walk stops at the first bare one.
 */
function citedStem(cell: string): string | undefined {
  const target = linkTargets(cell)
    .map((t) => t.split('#')[0])
    .find((t) => t && !t.includes('/'))
  return target ? stemOf(target) : undefined
}

/** The task stems in each folder a bare label can resolve through, live first. */
interface LabelFolders {
  readonly live: readonly string[]
  readonly archived: readonly string[]
  readonly declined: readonly string[]
}

type LabelCitation =
  | { readonly kind: 'stems'; readonly stems: readonly string[] }
  | { readonly kind: 'ambiguous'; readonly label: string }

/**
 * Reads every bare `vNNN.N` phase label a `Waiting on` cell names outside a
 * link, each resolved to one task, the live folder answering first. Two matches
 * leave the row untested, and a label no folder holds reads as prose.
 */
function bareLabels(cell: string, folders: LabelFolders): LabelCitation {
  const prose = cell.replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
  const stems: string[] = []

  for (const match of prose.matchAll(/\bv\d+\.\d+\b/g)) {
    const prefix = `${match[0]}-`
    for (const folder of [folders.live, folders.archived, folders.declined]) {
      const hits = folder.filter((stem) => stem.startsWith(prefix))
      if (hits.length > 1) return { kind: 'ambiguous', label: match[0] }
      if (hits.length === 1) {
        if (!stems.includes(hits[0])) stems.push(hits[0])
        break
      }
    }
  }

  return { kind: 'stems', stems }
}

/**
 * Tests every task a cell cites by bare label, and reports the row only when
 * none of them is still open. A cell naming settled history beside its live
 * blocker would otherwise read as settled on the history alone.
 */
async function checkCitedTasks(
  group: BoardGroup,
  subject: string,
  stems: readonly string[],
  root: string,
  trunk: TrunkReader,
): Promise<CitedResult> {
  const results = await Promise.all(
    stems.map((stem) => checkCitedTask(group, subject, stem, root, trunk)),
  )
  const open = results.some(
    (result) => result.findings.length === 0 && result.untested.length === 0,
  )
  if (open) return nothing()

  return {
    findings: results.flatMap((result) => result.findings),
    untested: results.flatMap((result) => result.untested),
  }
}

async function readLabelFolders(root: string): Promise<LabelFolders> {
  const read = async (dir: string): Promise<string[]> =>
    existsSync(dir) ? listTaskStems(dir) : []
  const [live, archived, declined] = await Promise.all([
    read(tasksDir(root)),
    read(archiveDir(root)),
    read(declinedDir(root)),
  ])

  return { live, archived, declined }
}

/**
 * The tasks a `Waiting on` cell cites, by a bare sibling pointer or a bare
 * phase label, the way the parked-row check reads them. A label naming more
 * than one task yields nothing, since a guess would order a row on the wrong one.
 */
export async function readCitedStems(
  cell: string,
  root: string,
): Promise<string[]> {
  const linked = citedStem(cell)
  if (linked) return [linked]

  const bare = bareLabels(cell, await readLabelFolders(root))
  return bare.kind === 'stems' ? [...bare.stems] : []
}

/** Where a blocker clause ends. A comma after a label ends it, a dot inside a filename does not, and `and` does not. */
const BLOCKER_BREAK = /\.(?=\s|$)|[;,]|\bbecause\b/i

/** The phrase a `Waiting on` cell carries to keep a row out of every automatic launch. */
const OPERATOR_HELD = /launch\s+on\s+the\s+operator['’]s\s+word/i

/** Whether a cell holds its row for the operator's word, so no wave launches it. */
export function isOperatorHeld(cell: string): boolean {
  return OPERATOR_HELD.test(cell)
}

/** A verb saying the row sits beside a task, never behind it. A bare `with` is one, since a blocker never opens on it. */
const BESIDE_VERB = new RegExp(
  `${RANK_VERB.source}|\\branked\\s+(?:above|below)\\b|\\bshares\\b|\\brebases\\b|\\bwith\\b`,
  'i',
)

/** A word saying the tasks after it gate the row, whatever placing verb came before it in the clause. */
const BLOCKER_VERB =
  /\b(?:after|behind|waits?\s+(?:on|for)|blocked\s+(?:by|on)|needs|once)\b/i

/** What a clause leaves once its citations, `and`, and punctuation go, which is nothing for a bare list of tasks. */
const CITATION_LIST_RESIDUE = /\uE000\d+\uE001|\bv\d+\.\d+\b|\band\b|[\s,&]/gi

/** One clause of a `Waiting on` cell as read, and the tasks it blocks on. */
export interface BlockerClause {
  readonly clause: string
  readonly stems: readonly string[]
}

/**
 * The part of a clause that can gate. A placing verb cuts what follows it up
 * to the next blocker verb, and a blocker verb ahead of it governs the rest.
 */
function gatingText(clause: string): string {
  const placing = clause.search(BESIDE_VERB)
  if (placing < 0) return clause

  const blocker = clause.search(BLOCKER_VERB)
  if (blocker >= 0 && blocker < placing) return clause

  return `${clause.slice(0, placing)} ${blocker < 0 ? '' : clause.slice(blocker)}`
}

/**
 * Reads each clause of a `Waiting on` cell. A placing verb never gates what it
 * governs, and a bare list of tasks after a placing clause joins it. Links are
 * masked so a filename's dot is no break.
 */
export async function readBlockerClauses(
  cell: string,
  root: string,
): Promise<BlockerClause[]> {
  const links: string[] = []
  const masked = cell.replace(/\[[^\]]*\]\([^)]*\)/g, (link) => {
    links.push(link)
    return `\uE000${links.length - 1}\uE001`
  })
  const restore = (text: string) =>
    text.replace(/\uE000(\d+)\uE001/g, (_, index) => links[Number(index)])
  const folders = await readLabelFolders(root)

  const read = (text: string): string[] => {
    const cited = linkTargets(text)
      .map((target) => target.split('#')[0])
      .filter((target) => target && !target.includes('/'))
      .map((target) => stemOf(target))
    const bare = bareLabels(text.replace(/\uE000\d+\uE001/g, ' '), folders)
    const labels = bare.kind === 'stems' ? bare.stems : []
    return [
      ...new Set([...cited, ...labels].filter((stem) => stem !== undefined)),
    ]
  }

  let placing: boolean = false
  const clauses: BlockerClause[] = []
  for (const raw of masked.split(BLOCKER_BREAK)) {
    const clause = raw.trim()
    if (!clause) continue

    const joins: boolean =
      placing && clause.replace(CITATION_LIST_RESIDUE, '') === ''
    placing =
      joins ||
      (clause.search(BESIDE_VERB) >= 0 && clause.search(BLOCKER_VERB) < 0)

    const stems = joins ? [] : read(restore(gatingText(clause)))
    clauses.push({ clause: restore(clause), stems })
  }

  return clauses
}

/** The tasks a `Waiting on` cell cites as blockers, across the clauses `readBlockerClauses` reads. */
export async function readBlockerStems(
  cell: string,
  root: string,
): Promise<string[]> {
  const clauses = await readBlockerClauses(cell, root)
  return [...new Set(clauses.flatMap((read) => read.stems))]
}

/** What one blocker citation produced, since a row can be neither settled nor open. */
interface CitedResult {
  readonly findings: readonly Finding[]
  readonly untested: readonly Untested[]
}

function nothing(): CitedResult {
  return { findings: [], untested: [] }
}

/**
 * Reports what a cited task does to the row waiting on it. An archived file
 * settles the row, and a live one only once its pull request is on the trunk,
 * since outcomes are ticked first. A citation in neither folder is a broken pointer.
 */
async function checkCitedTask(
  group: BoardGroup,
  subject: string,
  cited: string,
  root: string,
  trunk: TrunkReader,
): Promise<CitedResult> {
  const live = join(tasksDir(root), `${cited}.md`)

  if (!existsSync(live)) {
    if (existsSync(join(archiveDir(root), `${cited}.md`))) {
      return settled(group, subject, `waits on ${cited}, which is archived.`)
    }

    if (existsSync(join(declinedDir(root), `${cited}.md`))) {
      return {
        findings: [
          {
            kind: 'blocker-declined',
            group,
            subject,
            message: `waits on ${cited}, which was declined.`,
          },
        ],
        untested: [],
      }
    }

    return {
      findings: [
        {
          kind: 'blocker-unresolved',
          group,
          subject,
          message: `waits on ${cited}, which is neither on the board nor archived.`,
        },
      ],
      untested: [],
    }
  }

  const text = await readFile(live, 'utf8')
  const { open, closed, operator } = readOutcomes(text)
  if (open.length > 0 || closed.length + operator.length === 0) {
    return nothing()
  }

  const pending = readPendingBranches(text)
  if (pending.length > 0) {
    return untestedRow(
      group,
      subject,
      `waits on ${cited}, which closed every outcome but holds a pending branch (${pending.join(', ')}) that has yet to record its pull request.`,
    )
  }

  // Only the newest slice says whether the work reached trunk, since an earlier one closed unmerged.
  const pullRequest = readPullRequest(text).at(-1)
  if (pullRequest === undefined) {
    return untestedRow(
      group,
      subject,
      `waits on ${cited}, which closed every outcome but names no pull request, so nothing tests whether the work reached the trunk.`,
    )
  }

  const landed = await trunk(pullRequest)
  if (landed === undefined) {
    return untestedRow(
      group,
      subject,
      `waits on ${cited}, whose pull request #${pullRequest} could not be read against the trunk.`,
    )
  }

  if (!landed) return nothing()

  return settled(
    group,
    subject,
    `waits on ${cited}, whose pull request #${pullRequest} reached the trunk.`,
  )
}

function settled(
  group: BoardGroup,
  subject: string,
  message: string,
): CitedResult {
  return {
    findings: [{ kind: 'blocker-settled', group, subject, message }],
    untested: [],
  }
}

function untestedRow(
  group: BoardGroup,
  subject: string,
  message: string,
): CitedResult {
  return { findings: [], untested: [{ group, subject, message }] }
}

/**
 * Re-takes the cited-task and cited-path blockers outside `## In flight`, and
 * returns a row neither half reached as untested, so silence never reads clean.
 */
async function checkParked(
  rows: readonly BoardRow[],
  root: string,
  trunk: TrunkReader,
): Promise<{ findings: Finding[]; untested: Untested[] }> {
  const findings: Finding[] = []
  const untested: Untested[] = []
  const running = rows.filter((row) => row.group === 'In flight')
  const folders = await readLabelFolders(root)

  for (const row of rows) {
    if (row.group === 'In flight') continue

    const subject = row.stem ?? row.label
    const cell = row.waiting ?? ''
    const linked = citedStem(cell)
    const bare = linked ? undefined : bareLabels(cell, folders)
    const cited = linked ? [linked] : bare?.kind === 'stems' ? bare.stems : []
    const contested = readPaths(cell)

    if (bare?.kind === 'ambiguous') {
      untested.push({
        group: row.group,
        subject,
        message: `waits on ${bare.label}, which labels more than one task, so the blocker is not read.`,
      })
      continue
    }

    if (cited.length > 0) {
      const result = await checkCitedTasks(
        row.group,
        subject,
        cited,
        root,
        trunk,
      )
      findings.push(...result.findings)
      untested.push(...result.untested)
    }

    const held = contested.filter((path) =>
      running.some((run) =>
        (run.touches ?? []).some((other) => sharesPath(path, other)),
      ),
    )

    if (contested.length > 0 && held.length === 0) {
      findings.push({
        kind: 'blocker-settled',
        group: row.group,
        subject,
        message: `waits on ${contested.join(', ')}, which nothing under In flight holds.`,
      })
    }

    if (cited.length === 0 && contested.length === 0) {
      untested.push({
        group: row.group,
        subject,
        message:
          'cites no task and no file, so neither half of its blocker is mechanical.',
      })
    }
  }

  return { findings, untested }
}

/**
 * Reports a `Waiting on` cell rendering past the cap. A verb refuses to write
 * one, so a cell this long is a hand edit, which is why it moves the exit code.
 */
function checkCellWidth(rows: readonly BoardRow[]): Finding[] {
  return rows.flatMap((row) => {
    const width = row.waiting ? renderedLength(row.waiting) : 0
    if (width <= WAITING_LIMIT) return []

    return [
      {
        kind: 'cell-long' as const,
        group: row.group,
        subject: subjectOf(row),
        message: `carries a Waiting on cell rendering ${width} characters, past the ${WAITING_LIMIT} a board cell holds.`,
      },
    ]
  })
}

/**
 * Reports a `Touches` cell that differs from what the task's plans derive, a
 * hand edit or a changed plan. An empty derivation is left alone, since a row
 * with no live plan or declared file is `plan-absent` or the like, not stale.
 */
async function checkStaleTouches(
  rows: readonly BoardRow[],
  root: string,
): Promise<Finding[]> {
  const found = await Promise.all(
    rows.map(async (row): Promise<Finding | undefined> => {
      if (row.touchesText === undefined || !row.stem) return undefined

      const { touches } = await deriveCells(root, {
        stem: row.stem,
        label: row.label,
      })
      if (touches === '' || touches === row.touchesText) return undefined

      return {
        kind: 'touches-stale',
        group: row.group,
        subject: row.stem,
        message: `states ${row.touchesText || 'no file'}, and its plan derives ${touches}. A board verb rewrites the cell.`,
      }
    }),
  )

  return found.filter((finding): finding is Finding => finding !== undefined)
}

/**
 * Gives each row the paths its task's live plans declare in place of the ones
 * read off its `Touches` cell. A row whose task is gone, or whose plans declare
 * nothing, keeps what its cell named, so a hand-written cell still feeds overlap.
 */
export async function declaredRows(
  rows: readonly BoardRow[],
  root: string,
): Promise<BoardRow[]> {
  return Promise.all(
    rows.map(async (row) => {
      if (row.touches === undefined || !row.stem) return row

      const { paths } = await deriveCells(root, {
        stem: row.stem,
        label: row.label,
      })
      return paths.length === 0 ? row : { ...row, touches: paths }
    }),
  )
}

/**
 * The claims a group name makes about a row, which the board verbs read off
 * the board they are about to write, so placing and validating cannot disagree.
 */
export async function groupRuleFindings(
  rows: readonly BoardRow[],
  root: string,
): Promise<Finding[]> {
  const dir = tasksDir(root)

  return [
    ...(await checkPlans(rows, dir, root)),
    ...(await checkGroupClaims(rows, dir, root)),
    ...checkTouches(rows),
  ]
}

/**
 * Reports a row outside `## In flight` held by a live session or open pull
 * request on its plan's branch, skipping a session whose branch already merged.
 */
async function checkHeld(
  rows: readonly BoardRow[],
  live: LiveRead,
  dir: string,
  root: string,
): Promise<{ readonly findings: Finding[]; readonly mergedUnread: boolean }> {
  let mergedUnread = false

  const holdersOf = async (branch: string): Promise<string[]> => {
    const session = live.sessions?.get(branch)
    const merged = session ? await live.merged?.(branch) : false
    if (merged === undefined) mergedUnread = true

    return [session && !merged ? session : undefined, live.pulls?.get(branch)]
      .filter((name): name is string => name !== undefined)
      .map((name) => `${name} on ${branch}`)
  }

  const found = await Promise.all(
    rows.map(async (row): Promise<Finding | undefined> => {
      if (row.group === 'In flight' || !row.stem) return undefined
      const file = join(dir, `${row.stem}.md`)
      if (!existsSync(file)) return undefined

      const targets = readPlanTargets(await readFile(file, 'utf8'))
      const branches = targets.flatMap((target) => {
        const path = target.split('#')[0] || target
        return resolveLivePlan(path, dir, root) === undefined
          ? []
          : [branchOfPlan(path)]
      })
      const held = (await Promise.all(branches.map(holdersOf))).flat()
      if (held.length === 0) return undefined

      return {
        kind: 'row-held',
        group: row.group,
        subject: row.stem,
        message: `sits under ${row.group} and is held by ${held.join(' and ')}. A row with a worker belongs under In flight.`,
      }
    }),
  )

  return {
    findings: found.filter(
      (finding): finding is Finding => finding !== undefined,
    ),
    mergedUnread,
  }
}

/** What each source answered, `undefined` where it was not asked or failed. */
interface LiveRead {
  readonly reading: LiveReading
  readonly sessions?: Awaited<ReturnType<HolderReader>>
  readonly pulls?: Awaited<ReturnType<HolderReader>>
  readonly merged?: MergedReader
}

/** Takes each source once, since a failed read answers undefined rather than throws. */
async function readLive(live: LiveReaders | undefined): Promise<LiveRead> {
  if (!live) {
    return { reading: { sessions: 'not-asked', pulls: 'not-asked' } }
  }

  const stateOf = (read: Awaited<ReturnType<HolderReader>>): LiveState =>
    read ? 'read' : 'unread'
  const [sessions, pulls] = await Promise.all([live.sessions(), live.pulls()])

  return {
    reading: { sessions: stateOf(sessions), pulls: stateOf(pulls) },
    sessions,
    pulls,
    merged: live.merged,
  }
}

function refuse(reason: ValidateRefusal, message: string): ValidateRefused {
  return { ok: false, reason, message }
}

export interface ValidateOptions {
  /** Overridden by tests, which supply the trunk rather than reaching for git. */
  readonly trunk?: TrunkReader
  /**
   * The roster and GitHub reads behind the held-row check. Absent by default,
   * since the board's write hook runs this on every edit and a network read
   * there costs every write.
   */
  readonly live?: LiveReaders
}

/**
 * Reports what every board row claims against what the tree holds. It writes
 * nothing: a row is a session's claim about readiness, and a validator that
 * repaired one would be asserting the claim it exists to test.
 */
export async function validateBoard(
  root: string,
  options: ValidateOptions = {},
): Promise<ValidateOutcome> {
  const trunk = options.trunk ?? gitTrunkReader(root)
  const dir = tasksDir(root)
  if (!existsSync(dir)) {
    return refuse('no-board', `No task board at ${dir}.`)
  }

  const ordering = orderingPath(root)
  if (!existsSync(ordering)) {
    return refuse('no-ordering', `No ordering file at ${ordering}.`)
  }

  const {
    rows: written,
    groups,
    findings: shapeFindings,
  } = readBoard(await readFile(ordering, 'utf8'))
  const rows = await declaredRows(written, root)

  if (groups.length === 0) {
    return refuse(
      'no-groups',
      `No readiness group in ${ORDERING_FILE}. Expected one of: ${BOARD_GROUPS.join(', ')}.`,
    )
  }

  // An absent backlog reads as empty rather than refusing, for a project that never needed it.
  const backlogFile = backlogPath(root)
  const backlog = existsSync(backlogFile)
    ? readBacklog(await readFile(backlogFile, 'utf8'))
    : []

  const stems = await listTaskStems(dir)
  const declinedPath = declinedDir(root)
  const declined = existsSync(declinedPath)
    ? await listTaskStems(declinedPath)
    : []
  const parked = await checkParked(rows, root, trunk)
  const live = await readLive(options.live)
  const held = await checkHeld(rows, live, dir, root)

  const findings = [
    ...shapeFindings,
    ...checkMapping(rows, backlog, dir),
    ...(await groupRuleFindings(rows, root)),
    ...(await checkPlanAgreement(rows, dir, root)),
    ...(await checkSessions(rows, dir)),
    ...(await checkFrontmatter(stems, dir)),
    ...(await checkStaleTouches(rows, root)),
    ...checkCellWidth(rows),
    ...checkOrdering(rows),
    ...parked.findings,
    ...held.findings,
  ]

  return {
    ok: true,
    rows: rows.length,
    backlog: backlog.length,
    tasks: stems.length,
    declined: declined.length,
    findings,
    untested: parked.untested,
    claims: checkFolderClaims(rows, root),
    shared: checkSharedFiles(rows),
    wide: checkWideTokens(rows),
    unplaced: checkUnplaced(rows, backlog, stems),
    live: held.mergedUnread
      ? { ...live.reading, pulls: 'unread' }
      : live.reading,
  }
}
