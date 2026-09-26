import { existsSync, statSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import {
  archiveDir,
  declinedDir,
  isReservedStem,
  readOutcomes,
  readPlanTarget,
  readPlanTargets,
  readPullRequest,
  resolveLivePlan,
  tasksDir,
} from '@/tasks/archive'
import { gitTrunkReader, type TrunkReader } from '@/tasks/trunk'

const ORDERING_FILE = 'priority.md'
const BACKLOG_FILE = 'backlog.md'

/**
 * The readiness headings `standards/tasks.md` fixes. The names are the
 * contract rather than a suggestion, so a board grouping under names of its own
 * reads as carrying no group at all and the run refuses instead of reporting a
 * clean board it never parsed.
 */
export const BOARD_GROUPS = ['Run now', 'Up next', 'Needs a plan'] as const

export type BoardGroup = (typeof BOARD_GROUPS)[number]

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
  'touches-unstated',
  'touches-collided',
  'blocker-settled',
  'blocker-unresolved',
  'blocker-declined',
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
 * correct, since a row rewriting a whole directory has no other way to say so,
 * which is why it reports beside the findings rather than inside them and moves
 * no exit code.
 */
export interface FolderClaim {
  readonly group: BoardGroup
  readonly subject: string
  readonly message: string
}

/**
 * A task file neither surface names. That is the normal state between a
 * session filing it and a live orchestrator placing it, so it reports beside
 * the findings and moves no exit code. It is still the only local detector for
 * a row lost to a hand-edit, a handoff message that never arrived, or an
 * orchestrator that ended before placing it.
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
  readonly plan: string | undefined
  /** Absent when the group fixes no `Touches` column, empty when it read none. */
  readonly touches: readonly string[] | undefined
  /** Absent when the group fixes no `Waiting on` column, which is `## Run now`. */
  readonly waiting: string | undefined
  /** The ordinal phrase a `Waiting on` cell states about its own position, undefined when the cell carries none. */
  readonly ordinal: OrdinalWord | 'last' | undefined
  /** Whether a `Waiting on` cell ranks its row against a sibling row or a class of rows, false when the group fixes no such column. */
  readonly ranked: boolean
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
  readonly unplaced: readonly Unplaced[]
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
 * Reads the file set out of a `Touches` cell written as prose. Paths are the
 * backticked spans, which is the only marker the column carries, and a span
 * naming a skill or a command rather than a file is dropped by the same test.
 *
 * An extension opens with a letter, which is what separates `commands.md` from
 * a task version like `v40.2`. Reading the version as a path would collide two
 * rows that merely cite the same task.
 */
export function readPaths(cell: string): string[] {
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
 * resolves, which is the only reading that separates a folder from a file
 * carrying no extension, such as a hook script.
 *
 * A path the row has yet to create resolves to nothing, so the name decides
 * there. `readPaths` admits a span for one of two reasons, a slash or an
 * extension, so a span surviving without an extension is one a slash let
 * through and reads as a folder.
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
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function isSeparator(cells: readonly string[]): boolean {
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

function columnIndex(header: readonly string[], name: string): number {
  return header.findIndex((cell) => cell.toLowerCase() === name)
}

function isGroup(heading: string): heading is BoardGroup {
  return (BOARD_GROUPS as readonly string[]).includes(heading)
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
 * Reads the ordinal phrase a `Waiting on` cell states about its own position,
 * searching the whole cell for `<ordinal> here` or the bare word `last` rather
 * than anchoring to where the cell opens. The phrase sits at the end of the
 * sentence on every row that carries one, as in `nothing, cleared 2026-08-31
 * when it merged. Third here`. The two-word phrase is safe to find anywhere,
 * since it needs both a closed vocabulary word and `here` beside it, but a
 * bare `last` is one of the commonest words in English and this corpus writes
 * it constantly, as in `the last of the two instruments this rename needs`.
 * Anchoring it to the end of the cell is what keeps that prose out of the
 * findings, since every row that actually declares itself last puts the word
 * there and nowhere else. A cell carrying neither reads as unordered rather
 * than as an error, which keeps a legitimately-phrased row out of the
 * findings.
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
 * A clause boundary, which is any of the three punctuation marks that end one
 * plus the two conjunctions every live cell uses to hang its reason off its
 * position claim. All three marks are bounded away from digits on both sides,
 * which is what keeps a phase label one token, since `v80.4` is the commonest
 * positional object on the board and splitting it at its own period would
 * leave the verb holding nothing.
 */
const CLAUSE_BREAK = /(?<!\d)[.;,](?!\d)|\band\b|\bbecause\b/i

/**
 * Whether a `Waiting on` cell ranks its row against something rather than
 * arguing that the row matters. The two are indistinguishable to a reader
 * scanning the board, since a reason with no other row in it reads defensible
 * on every row at once, which is how insertion order became the ordering.
 *
 * The test is a closed verb vocabulary sitting in one clause with a positional
 * object, which mirrors `readOrdinal` bounding itself to a closed word list for
 * the same reason: a parser loose enough to grade prose reports a correctly
 * phrased row. Both halves are needed, since `closes` alone matches `it closes
 * a gap the reference gate leaves open`, which claims no position at all. The
 * clause bound is what keeps a verb in one half of the cell from pairing with
 * an object in the other.
 *
 * A cell phrased comparatively and unusually reads as unranked, which is a
 * false negative and the safe direction for a check over prose.
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
 * behind it is a separator carrying the same cell count. A row landing where a
 * blank line already closed the table above it looks identical to a fresh
 * header until this read, since both are the first pipe line the walk has
 * seen since the reset.
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
 * Parses the ordering file into rows keyed by readiness group. Columns are read
 * from each table's own header rather than by position, so a group whose shape
 * differs from this repository's is reported for what it lacks instead of
 * having its second cell read as something it never was.
 *
 * The walk carries one more piece of state than a header: whether the table
 * that header opened is still open. A blank or prose line closes it, so a row
 * stranded behind that close is read as one candidate header among many rather
 * than as a continuation of the table above, and each surviving row's cell
 * count is checked against the header it actually followed.
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
      const title = heading[1]
      group = isGroup(title) ? title : undefined
      header = undefined
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

    const task = taskAt >= 0 ? (cells[taskAt] ?? '') : ''
    const target = linkTarget(task)
    const plan = planAt >= 0 ? linkTarget(cells[planAt] ?? '') : undefined
    const waiting = waitingAt >= 0 ? (cells[waitingAt] ?? '') : undefined

    rows.push({
      group,
      label: linkText(task) || task,
      stem: target ? stemOf(target) : undefined,
      plan,
      touches: touchesAt >= 0 ? readPaths(cells[touchesAt] ?? '') : undefined,
      waiting,
      ordinal: waiting ? readOrdinal(waiting) : undefined,
      ranked: waiting ? readRank(waiting) : false,
    })
  }

  return { rows, groups, findings }
}

/**
 * Reports the two ways a `## Needs a plan` row's stated position fails. A row
 * carrying an ordinal is checked against where it actually sits, and reading
 * the sequence for gaps and duplicates on its own would detect less, since row
 * position is contiguous by construction and a hand-renumbered sequence is
 * exactly a case where the prose and the position have come apart. A row
 * carrying no position claim of either form is reported for that instead,
 * since a cell arguing only that the task matters ranks it against nothing and
 * leaves the position recording when the row was filed.
 *
 * Both are one question rather than two checks. An ordinal is already a
 * comparative claim, so it exempts the row from the second half, and the two
 * findings read off one walk over the same group.
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
 * Parses the backlog into one row per bullet carrying a link. The backlog is a
 * flat list rather than a table, so there is no header to resolve and no group
 * to sit under, and a bullet holding prose instead of a pointer is skipped.
 *
 * Skipping it rather than reporting it is what keeps the intro paragraph and
 * any explanatory bullet out of the findings. The task that bullet meant to
 * name is still accounted for, because a stem no line reaches is reported by
 * `checkMapping` as carrying no row on either surface.
 */
export function readBacklog(text: string): readonly BacklogRow[] {
  const rows: BacklogRow[] = []

  for (const line of text.split('\n')) {
    if (!/^\s*[-*]\s/.test(line)) continue

    const target = linkTarget(line)
    if (!target) continue

    // A pointer carrying a directory names something other than a sibling task,
    // the way `citedStem` reads the same shape on the board.
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
 * way `context-fold` reads the same line. A fragment is dropped first, since an
 * anchor is part of the link and never part of the path.
 */
function resolves(target: string, dir: string, root: string): boolean {
  const path = target.split('#')[0]
  if (!path) return false

  return existsSync(resolve(dir, path)) || existsSync(resolve(root, path))
}

/**
 * Reports a task cited from two places on the board, which claims two
 * contradictory things about itself: a task belongs to exactly one group,
 * board or backlog. A task file neither surface names is no longer reported
 * here, since that is the normal state between a session filing it and a live
 * orchestrator placing it.
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

function checkPlans(
  rows: readonly BoardRow[],
  dir: string,
  root: string,
): Finding[] {
  const findings: Finding[] = []

  for (const row of rows) {
    if (row.group !== 'Run now') continue

    if (!row.plan) {
      findings.push({
        kind: 'plan-unstated',
        group: row.group,
        subject: row.stem ?? row.label,
        message:
          'states no plan pointer, so the readiness claim cannot be checked.',
      })
      continue
    }

    if (!resolves(row.plan, dir, root)) {
      findings.push({
        kind: 'plan-unresolved',
        group: row.group,
        subject: row.stem ?? row.label,
        message: `points at ${row.plan}, which resolves to no file.`,
      })
    }
  }

  return findings
}

/**
 * Compares the two places one task's plan is written down. The `## Run now` row
 * carries a `Plan` column and the task file carries its own `Plan:` line, and
 * the archive reads the second while an operator reads the first, so a pair
 * that disagrees settles the wrong plan on the merge.
 *
 * Both sides resolve before they compare. A row writing `../plans/x.md` and a
 * task writing `.canon/plans/x.md` name one file, and comparing the strings
 * would report every such pair as a mismatch.
 */
async function checkPlanAgreement(
  rows: readonly BoardRow[],
  dir: string,
  root: string,
): Promise<Finding[]> {
  const ready = rows.filter((row) => row.group === 'Run now' && row.plan)

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
  const target = readPlanTarget(text)
  if (!target) {
    const several = severalPlans(text, 'Run now', subject)
    if (several) return several

    return {
      kind: 'plan-uncited',
      group: 'Run now',
      subject,
      message: `is rowed against ${row.plan}, and the task file carries no Plan: line, so the archive settles no plan when it ships.`,
    }
  }

  const rowed = planPath(row.plan, dir, root)
  const cited = planPath(target, dir, root)
  if (rowed === cited) return undefined

  return {
    kind: 'plan-mismatched',
    group: 'Run now',
    subject,
    message: `is rowed against ${row.plan} and cites ${target} in its own Plan: line. One task names one plan.`,
  }
}

/**
 * Tests the claim a group name makes about a plan. `## Needs a plan` says none
 * is live and `## Up next` says one is written, and neither group has a `Plan`
 * column, so the task file's own `Plan:` line is the only place either claim
 * can be read against.
 *
 * A live plan is one the archive's resolution accepts and the disk holds, so a
 * plan already archived reads as not live and a cited path with no file behind
 * it reads the same way. A row whose task file is gone is left to
 * `task-unresolved`, which owns that report.
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
  const target = readPlanTarget(text)
  if (!target) {
    const several = severalPlans(text, row.group, row.stem)
    if (several) return several
  }

  const live = target ? resolveLivePlan(target, dir, root) : undefined
  const hasLivePlan = live !== undefined && existsSync(live)

  if (row.group === 'Needs a plan' && hasLivePlan) {
    return {
      kind: 'plan-parked',
      group: row.group,
      subject: row.stem,
      message: `sits under ${row.group} and its task cites ${target}, a live plan. A row with a plan belongs under Up next or Run now, or the plan is stale and belongs in the archive.`,
    }
  }

  if (row.group === 'Up next' && !hasLivePlan) {
    return {
      kind: 'plan-absent',
      group: row.group,
      subject: row.stem,
      message: target
        ? `sits under ${row.group}, which claims a written plan, and its task cites ${target}, which is not a live plan.`
        : `sits under ${row.group}, which claims a written plan, and its task carries no Plan: line.`,
    }
  }

  return undefined
}

/**
 * Reports a `Plan:` line linking more than one plan. `readPlanTarget` reads
 * such a line as naming nothing, so without this a caller would report the
 * line as absent when it is there and breaks the one-plan rule instead.
 */
function severalPlans(
  text: string,
  group: Finding['group'],
  subject: string,
): Finding | undefined {
  const targets = readPlanTargets(text)
  if (targets.length < 2) return undefined

  return {
    kind: 'plan-several',
    group,
    subject,
    message: `cites ${targets.length} plans on its Plan: line (${targets.join(', ')}). One task names one plan, so split the task or drop the extra links.`,
  }
}

/**
 * Where a plan pointer lands, resolved against the board and against the
 * project root the way the archive resolves the same line. Neither base
 * existing leaves the board-relative reading, so two pointers at one absent
 * file still compare equal and the mismatch check reports nothing.
 */
function planPath(target: string, dir: string, root: string): string {
  const path = target.split('#')[0] || target
  const fromBoard = resolve(dir, path)
  if (existsSync(fromBoard)) return fromBoard

  const fromRoot = resolve(root, path)
  return existsSync(fromRoot) ? fromRoot : fromBoard
}

/**
 * The half of the `## Run now` test a person cannot check by eye. Two rows a
 * worker may be handed at once must touch disjoint files, and the `Touches`
 * column is the only place either set is written down.
 */
function checkCollisions(rows: readonly BoardRow[]): Finding[] {
  const findings: Finding[] = []
  const ready = rows.filter((row) => row.group === 'Run now')

  for (const row of ready) {
    // An absent column and an unreadable one both leave the row untested by
    // the loop below, so reporting only the second would pass a board whose
    // `## Run now` table declares no file set at all.
    if (!row.touches || row.touches.length === 0) {
      findings.push({
        kind: 'touches-unstated',
        group: row.group,
        subject: row.stem ?? row.label,
        message: 'names no file, so its collisions cannot be read.',
      })
    }
  }

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

      findings.push({
        kind: 'touches-collided',
        group: 'Run now',
        subject: `${subjectOf(left)} and ${subjectOf(right)}`,
        message: `both touch ${joinShared(shared)}.`,
      })
    }
  }

  return findings
}

function subjectOf(row: BoardRow): string {
  return row.stem ?? row.label
}

/**
 * Names one path two rows share, and the row that claimed it as a folder when
 * one side named a directory holding the other's file. Which side contributed
 * the containing path is the fact a reader acts on, and printing the shared
 * strings alone leaves an over-broad cell and a genuine overlap identical.
 *
 * The shorter path is the container, because `sharesPath` holds for an unequal
 * pair only when one is a prefix of the other up to a separator.
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
 * Reports a `Touches` cell naming a bare folder. The claim collides with every
 * row a later session writes under that folder, and it is legitimate whenever
 * the row does rewrite the directory, so this states the reach rather than
 * calling it a defect.
 *
 * The scan takes `## Run now` alone, where `checkCollisions` takes it. A cell in
 * another group describes work nobody has planned, so it is written as a
 * sentence and rewritten at planning time, and a claim read off one reports on
 * prose rather than on a file set. That is the shape that teaches a reader to
 * skip the report. A parked folder claim surfaces when the row is promoted,
 * which is also when its cell becomes a set anything can act on.
 */
function checkFolderClaims(
  rows: readonly BoardRow[],
  root: string,
): FolderClaim[] {
  const claims: FolderClaim[] = []

  for (const row of rows.filter((candidate) => candidate.group === 'Run now')) {
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
 * Reports a task file neither the board nor the backlog names. Under the
 * roster-checked hand-off, filing a task and placing its row are two acts a
 * different session each may perform, so this state is ordinary rather than
 * an error, and it moves no exit code. It still surfaces here rather than
 * nowhere, since it is the only local detector for a row a hand-edit dropped,
 * a handoff message that never arrived, or an orchestrator that ended before
 * placing it.
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
 * filename, the way every `Task` column spells one, so a target carrying a
 * directory names something else and yields nothing. A row waiting on a plan
 * links that plan, and reading its stem as a task would report the row settled
 * against a folder the plan does not sit in.
 *
 * A cell can carry more than one link, such as a `Waiting on` cell naming the
 * record answering the blocker before naming the sibling task it waits on, so
 * this walks every target rather than reading only the first. It stops at the
 * first bare one rather than trying a later link when that one fails to
 * resolve to a stem.
 */
function citedStem(cell: string): string | undefined {
  const target = linkTargets(cell)
    .map((t) => t.split('#')[0])
    .find((t) => t && !t.includes('/'))
  return target ? stemOf(target) : undefined
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
 * Reports what a cited task does to the row waiting on it. A file sitting in
 * the archive settles the row, and a live file settles it only once the work it
 * carries is on the trunk. A file carrying no outcome box settles nothing,
 * since a file the check could not parse is not evidence of a finished one.
 *
 * A citation resolving in neither folder is a broken pointer rather than a
 * closed task, and the two take different findings. Reading an absent file as
 * archived states a specific fact about a file nobody ever wrote, which is what
 * a renamed task or a typo produces.
 *
 * A closed outcome is not the same fact as landed work. The ship chain marks
 * outcomes as its first step and opens the pull request several steps later, so
 * a check reading the checkbox reports the row settled while the branch is
 * still in review. The pull request the task names is what the trunk is asked
 * about, and a task naming none leaves the row untested rather than settled,
 * because the only local signal left is the checkbox that produced the defect.
 *
 * The outcome list comes off `readOutcomes` rather than a pattern of its own,
 * so this check cannot disagree with the archive and outcome verbs about which
 * checkboxes are outcomes and which sit inside a block a task displays.
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
  const { open, closed } = readOutcomes(text)
  if (open.length > 0 || closed.length === 0) return nothing()

  // The last number is the newest slice, and an earlier one closed without
  // merging never lands, so only the last says whether the work reached trunk.
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
 * Re-takes the two blocker kinds a command can settle, over every row outside
 * `## Run now`. A cited task is settled by being archived or by closing every
 * outcome, and a cited path is settled by no `## Run now` row still holding it.
 *
 * Both halves gate on a citation the cell carries, never on a column beside it.
 * The board standard gives a collision cell the file held by the running task,
 * so a row whose cell names no file was parked by something else and its
 * `Touches` column says nothing about what holds it. Reading that column
 * instead reports a cleared collision on a row no collision ever parked, and
 * counts the row as re-tested, which is the more expensive half of that error.
 *
 * The cell is read for citations rather than parsed into fields, since the
 * standard fixes three forms for it and leaves it prose. A row neither half
 * reached is returned as untested, because the other three kinds are a person's
 * to judge and silence about them reads as a board with nothing stale on it.
 */
async function checkParked(
  rows: readonly BoardRow[],
  root: string,
  trunk: TrunkReader,
): Promise<{ findings: Finding[]; untested: Untested[] }> {
  const findings: Finding[] = []
  const untested: Untested[] = []
  const running = rows.filter((row) => row.group === 'Run now')

  for (const row of rows) {
    if (row.group === 'Run now') continue

    const subject = row.stem ?? row.label
    const cell = row.waiting ?? ''
    const cited = citedStem(cell)
    const contested = readPaths(cell)

    if (cited) {
      const result = await checkCitedTask(
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
        message: `waits on ${contested.join(', ')}, which nothing under Run now holds.`,
      })
    }

    if (!cited && contested.length === 0) {
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

function refuse(reason: ValidateRefusal, message: string): ValidateRefused {
  return { ok: false, reason, message }
}

export interface ValidateOptions {
  /** Overridden by tests, which supply the trunk rather than reaching for git. */
  readonly trunk?: TrunkReader
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
    rows,
    groups,
    findings: shapeFindings,
  } = readBoard(await readFile(ordering, 'utf8'))

  if (groups.length === 0) {
    return refuse(
      'no-groups',
      `No readiness group in ${ORDERING_FILE}. Expected one of: ${BOARD_GROUPS.join(', ')}.`,
    )
  }

  // An absent backlog reads as empty rather than refusing. A project that has
  // never needed the second surface keeps every task on the board, which is the
  // one-to-one mapping this check ran before the backlog existed.
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

  const findings = [
    ...shapeFindings,
    ...checkMapping(rows, backlog, dir),
    ...checkPlans(rows, dir, root),
    ...(await checkPlanAgreement(rows, dir, root)),
    ...(await checkGroupClaims(rows, dir, root)),
    ...checkCollisions(rows),
    ...checkOrdering(rows),
    ...parked.findings,
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
    unplaced: checkUnplaced(rows, backlog, stems),
  }
}
