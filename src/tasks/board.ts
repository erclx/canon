import { existsSync } from 'node:fs'
import { open, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import {
  linkTo,
  readPlanTargets,
  removeBacklogRow,
  resolveLivePlan,
  tasksDir,
} from '@/tasks/archive'
import { readDeclarations } from '@/tasks/reach'
import {
  BOARD_GROUPS,
  type BoardGroup,
  backlogPath,
  declaredRows,
  type FindingKind,
  groupRuleFindings,
  orderingPath,
  readBoard,
} from '@/tasks/validate'

/**
 * The columns each group owns, fixed by the operator on 2026-10-18. Every
 * cell but `Waiting on` is derived from the task and its plan, so the render
 * is the only writer of the other three.
 */
export const GROUP_COLUMNS: Readonly<Record<BoardGroup, readonly string[]>> = {
  'Run now': ['Task', 'Touches', 'Plan'],
  'Up next': ['Task', 'Touches', 'Waiting on'],
  'Needs a plan': ['Task', 'Waiting on'],
}

/**
 * How many folders a `Touches` cell names. A backticked path never wraps, so
 * three of them pushed a table past an editor preview, and two short folders
 * fit beside the count.
 */
const TOUCHES_FOLDERS = 2

/** How deep a `Touches` folder reads, as in `src/tasks/` or `claude/skills/`. */
const FOLDER_DEPTH = 2

/**
 * The widest a `Waiting on` cell may render. The live board's cells measured 14
 * to 131 characters on 2026-10-18 with one table outlier set aside, and the
 * cap sits where all but the longest fit.
 */
export const WAITING_LIMIT = 120

/** How long a verb waits on another verb's lock before refusing as busy. */
const LOCK_WAIT_MS = 5_000

/** A lock older than this was left by a call that died, since a render takes well under a second. */
const LOCK_STALE_MS = 30_000

const LOCK_POLL_MS = 20

/** One row as the board holds it: the task it points at and the one typed cell. */
export interface PlacedRow {
  readonly stem: string
  /** The label the row's Task cell carried, used when the task file is gone. */
  readonly label: string
  readonly waiting: string | undefined
}

/**
 * The board as a model. Rows are kept per group in order, and everything the
 * model does not own, being the frontmatter and title above the first group,
 * prose under a group heading, and any section that is not a group, is kept as
 * written.
 */
export interface Board {
  readonly head: readonly string[]
  readonly groups: Readonly<Record<BoardGroup, readonly PlacedRow[]>>
  readonly notes: Readonly<Record<BoardGroup, readonly string[]>>
  readonly trailing: readonly string[]
}

export type BoardParse =
  | { readonly ok: true; readonly board: Board }
  | { readonly ok: false; readonly line: string }

function emptyGroups<T>(): Record<BoardGroup, T[]> {
  return { 'Run now': [], 'Up next': [], 'Needs a plan': [] }
}

function isGroup(heading: string): heading is BoardGroup {
  return (BOARD_GROUPS as readonly string[]).includes(heading)
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

/** The task a Task cell links, a bare sibling filename the way every row spells one. */
function taskLink(
  cell: string,
): { readonly stem: string; readonly label: string } | undefined {
  const match = /\[([^\]]*)\]\(([^)]+)\)/.exec(cell)
  if (!match) return undefined

  const target = match[2].trim().split('#')[0] ?? ''
  if (target.includes('/') || !target.endsWith('.md')) return undefined

  return { stem: target.slice(0, -'.md'.length), label: match[1].trim() }
}

/**
 * Reads the `Waiting on` cell out of a row through the header above it, which
 * still applies to a row stranded behind a closed table. A row one cell short
 * of a header ending in `Waiting on` is read as missing its `Touches` cell, so
 * its last cell stands in. Any other shape answers `undefined`, since guessing
 * would write a path or a plan link into the blocker on the next render.
 */
function waitingCell(
  cells: readonly string[],
  header: readonly string[] | undefined,
): string | undefined {
  if (!header) return undefined
  const at = header.findIndex((cell) => cell.toLowerCase() === 'waiting on')
  if (at === -1) return undefined

  if (cells.length === header.length) return cells[at]

  const missingTouches = header.some((cell) => cell.toLowerCase() === 'touches')
  if (
    missingTouches &&
    at === header.length - 1 &&
    cells.length === header.length - 1
  ) {
    return cells.at(-1)
  }

  return undefined
}

/**
 * Parses `priority.md` into the model. The parse is lenient where `readBoard`
 * is strict: a row after a closed table, under a header short a column, or
 * past a blank line inside a table is still a row of the group it sits under,
 * since the render exists to repair exactly those boards. It refuses a pipe line
 * naming no task, which a render would drop, and a row whose blocker the header
 * cannot place, which a render would rewrite to the wrong cell.
 */
export function parseBoard(text: string): BoardParse {
  const lines = text.split('\n')
  const head: string[] = []
  const groups = emptyGroups<PlacedRow>()
  const notes = emptyGroups<string>()
  const trailing: string[] = []

  let section: BoardGroup | 'head' | 'other' = 'head'
  let header: string[] | undefined

  for (const line of lines) {
    const heading = /^##\s+(.+?)\s*$/.exec(line)
    if (heading) {
      section = isGroup(heading[1]) ? heading[1] : 'other'
      header = undefined
      if (section === 'other') trailing.push(line)
      continue
    }

    if (section === 'head') {
      head.push(line)
      continue
    }

    if (section === 'other') {
      trailing.push(line)
      continue
    }

    if (!line.trimStart().startsWith('|')) {
      if (line.trim() !== '') notes[section].push(line)
      continue
    }

    const cells = splitCells(line)
    if (isSeparator(cells)) continue

    const link = taskLink(cells[0] ?? '')
    if (!link) {
      if ((cells[0] ?? '').toLowerCase() === 'task') {
        header = cells
        continue
      }
      return { ok: false, line: line.trim() }
    }

    const owned = GROUP_COLUMNS[section].includes('Waiting on')
    const waiting = owned ? waitingCell(cells, header) : undefined
    if (owned && waiting === undefined) return { ok: false, line: line.trim() }

    groups[section].push({ stem: link.stem, label: link.label, waiting })
  }

  return { ok: true, board: { head, groups, notes, trailing } }
}

/** The cells a row renders that the task and its plans decide. */
export interface DerivedCells {
  readonly task: string
  readonly touches: string
  readonly plan: string
  /** The declared paths the Touches cell counts, which the overlap checks read in its place. */
  readonly paths: readonly string[]
}

function titleOf(text: string): string | undefined {
  const lines = text.split('\n')
  let at = 0
  if (lines[0]?.trim() === '---') {
    const close = lines.findIndex(
      (line, index) => index > 0 && line.trim() === '---',
    )
    at = close === -1 ? 0 : close + 1
  }

  const heading = lines.slice(at).find((line) => line.startsWith('# '))
  return heading?.slice(2).trim()
}

function planLabel(path: string): string {
  const stem = basename(path, '.md')
  return stem.startsWith('feature-') ? stem.slice('feature-'.length) : stem
}

/**
 * The folder a path sits under, `FOLDER_DEPTH` segments deep at most and with a
 * trailing slash, or undefined for a file at the root.
 */
function folderOf(path: string): string | undefined {
  const segments = path.split('/').slice(0, -1).slice(0, FOLDER_DEPTH)
  return segments.length === 0 ? undefined : `${segments.join('/')}/`
}

/**
 * A count of the declared paths and the folders holding most of them, at most
 * `TOUCHES_FOLDERS`, with ties going to the folder declared first. The file
 * list lives in the plan the row links, so the cell only says where a row
 * works. Root files count and name no folder.
 */
export function touchesCell(paths: readonly string[]): string {
  if (paths.length === 0) return ''

  const counts = new Map<string, number>()
  for (const path of paths) {
    const folder = folderOf(path)
    if (folder !== undefined) counts.set(folder, (counts.get(folder) ?? 0) + 1)
  }

  const folders = [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([folder]) => folder)
  const shown = folders
    .slice(0, TOUCHES_FOLDERS)
    .map((folder) => `\`${folder}\``)
  const files = paths.length === 1 ? '1 file' : `${paths.length} files`
  if (shown.length === 0) return files

  const rest = folders.length - shown.length
  const tail = rest === 0 ? '' : `, and ${rest} more`
  return `${files} under ${shown.join(', ')}${tail}`
}

/**
 * The live plans a task's `Plan:` line resolves to, in line order and once
 * each. An archived plan or a dead link drops out, so a cell never links a plan
 * nobody can open and a Touches cell never counts files a shipped plan listed.
 */
async function livePlans(text: string, root: string): Promise<string[]> {
  const dir = tasksDir(root)
  const paths = readPlanTargets(text)
    .map((target) => resolveLivePlan(target.split('#')[0] ?? '', dir, root))
    .filter((path): path is string => path !== undefined && existsSync(path))

  return [...new Set(paths)]
}

/**
 * Derives the Task, Touches, and Plan cells from the task file and the plans
 * its `Plan:` line links. A task file that is gone keeps the label its row
 * carried and derives nothing else, since `validate` reports the dead row and a
 * render has no business dropping it.
 */
export async function deriveCells(
  root: string,
  row: Pick<PlacedRow, 'stem' | 'label'>,
): Promise<DerivedCells> {
  const file = join(tasksDir(root), `${row.stem}.md`)
  if (!existsSync(file)) {
    return {
      task: `[${row.label || row.stem}](${row.stem}.md)`,
      touches: '',
      plan: '',
      paths: [],
    }
  }

  const text = await readFile(file, 'utf8')
  const plans = await livePlans(text, root)
  const declared = await Promise.all(
    plans.map(async (plan) => readDeclarations(await readFile(plan, 'utf8'))),
  )
  const dir = tasksDir(root)
  const paths = [...new Set(declared.flat())]

  return {
    task: `[${titleOf(text) ?? (row.label || row.stem)}](${row.stem}.md)`,
    touches: touchesCell(paths),
    plan: plans
      .map((plan) => `[${planLabel(plan)}](${linkTo(dir, plan)})`)
      .join(', '),
    paths,
  }
}

function tableLine(cells: readonly string[]): string {
  return `| ${cells.join(' | ')} |`
}

function cellFor(
  column: string,
  derived: DerivedCells,
  row: PlacedRow,
): string {
  if (column === 'Task') return derived.task
  if (column === 'Touches') return derived.touches
  if (column === 'Plan') return derived.plan
  return row.waiting ?? ''
}

/**
 * Renders the whole board from the model, one clean table per group under its
 * owned header, in the order `BOARD_GROUPS` fixes. A group with no rows keeps
 * its heading and header so the next placement has a table to land in.
 */
export async function renderBoard(root: string, board: Board): Promise<string> {
  const head = [...board.head]
  while (head.length > 0 && head.at(-1)?.trim() === '') head.pop()

  const out = [...head]

  for (const group of BOARD_GROUPS) {
    const columns = GROUP_COLUMNS[group]
    const rows = await Promise.all(
      board.groups[group].map(async (row) => {
        const derived = await deriveCells(root, row)
        return tableLine(columns.map((column) => cellFor(column, derived, row)))
      }),
    )

    out.push('', `## ${group}`, '')
    if (board.notes[group].length > 0) out.push(...board.notes[group], '')
    out.push(
      tableLine(columns),
      tableLine(columns.map((column) => '-'.repeat(column.length))),
      ...rows,
    )
  }

  const trailing = [...board.trailing]
  while (trailing.length > 0 && trailing.at(-1)?.trim() === '') trailing.pop()
  if (trailing.length > 0) out.push('', ...trailing)

  return `${out.join('\n')}\n`
}

export const BOARD_REFUSALS = [
  'no-board',
  'no-ordering',
  'no-match',
  'no-row',
  'unreadable-row',
  'board-busy',
  'board-changed',
  'group-rule',
  'no-column',
  'top-group',
  'cell-long',
  'bad-input',
] as const

export type BoardRefusal = (typeof BOARD_REFUSALS)[number]

export interface BoardRefused {
  readonly ok: false
  readonly reason: BoardRefusal
  readonly message: string
  readonly detail: readonly string[]
}

/** Where a row lands in its group. A named sibling must already sit in that group. */
export type Position =
  | { readonly at: 'top' }
  | { readonly at: 'bottom' }
  | { readonly before: string }
  | { readonly after: string }

export interface BoardWritten {
  readonly ok: true
  readonly stem: string
  readonly group: BoardGroup
  /** Where the row sat before the write, `backlog` for a backlog line, undefined for neither. */
  readonly from: BoardGroup | 'backlog' | undefined
  /** The row's 1-based position in its group after the write. */
  readonly position: number
  readonly path: string
  /** Whether the call also removed the task's backlog line. */
  readonly backlog: boolean
}

export type BoardOutcome = BoardWritten | BoardRefused

/** The `Waiting on` a row promoted out of `## Needs a plan` carries when the caller names none. */
export const PLANNED_WAITING = 'Planned, not dispatched yet'

/**
 * The finding kinds each group's rule forbids, read off the same predicates
 * `canon tasks validate` reports through `groupRuleFindings`.
 */
const GROUP_RULES: Readonly<Record<BoardGroup, readonly FindingKind[]>> = {
  'Run now': ['plan-unstated', 'touches-unstated'],
  'Up next': ['plan-absent'],
  'Needs a plan': ['plan-parked'],
}

/** The group one step closer to `## Run now`, which is where `promote` sends a row. */
const PROMOTES_TO: Readonly<Record<BoardGroup, BoardGroup | undefined>> = {
  'Run now': undefined,
  'Up next': 'Run now',
  'Needs a plan': 'Up next',
}

function refuse(
  reason: BoardRefusal,
  message: string,
  detail: readonly string[] = [],
): BoardRefused {
  return { ok: false, reason, message, detail }
}

/** The width a cell renders at, a link counting as its label alone. */
export function renderedLength(cell: string): number {
  return cell.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').length
}

export function checkWaiting(text: string): BoardRefused | undefined {
  if (text.trim() === '' || /[|\n]/.test(text)) {
    return refuse(
      'bad-input',
      'A Waiting on cell is one line of text carrying no pipe.',
      [text],
    )
  }

  const width = renderedLength(text.trim())
  if (width > WAITING_LIMIT) {
    return refuse(
      'cell-long',
      `The Waiting on cell renders ${width} characters, past the ${WAITING_LIMIT} a board cell holds. Name the blocker and drop the history.`,
      [text],
    )
  }

  return undefined
}

function findRow(
  board: Board,
  stem: string,
): { readonly group: BoardGroup; readonly row: PlacedRow } | undefined {
  for (const group of BOARD_GROUPS) {
    const row = board.groups[group].find((entry) => entry.stem === stem)
    if (row) return { group, row }
  }

  return undefined
}

function anchorOf(position: Position): string | undefined {
  if ('before' in position) return position.before
  if ('after' in position) return position.after
  return undefined
}

/**
 * Takes the row out of every group and puts it back at a position in one, so a
 * row that sat anywhere lands once. A sibling the position names but the group
 * does not hold is refused rather than read as the bottom.
 */
function placed(
  board: Board,
  group: BoardGroup,
  row: PlacedRow,
  position: Position,
): Board | BoardRefused {
  const groups = emptyGroups<PlacedRow>()
  for (const each of BOARD_GROUPS) {
    groups[each] = board.groups[each].filter((entry) => entry.stem !== row.stem)
  }

  const rows = groups[group]
  if ('at' in position) {
    groups[group] = position.at === 'top' ? [row, ...rows] : [...rows, row]
    return { ...board, groups }
  }

  const anchor = anchorOf(position) ?? ''
  const at = rows.findIndex((entry) => entry.stem === anchor)
  if (at === -1) {
    return refuse(
      'bad-input',
      `${anchor} has no row under ${group}, so ${row.stem} has nothing to sit beside.`,
      [anchor],
    )
  }

  const index = 'before' in position ? at : at + 1
  groups[group] = [...rows.slice(0, index), row, ...rows.slice(index)]
  return { ...board, groups }
}

interface Edited {
  readonly board: Board
  readonly group: BoardGroup
  readonly from: BoardGroup | undefined
  /** The group whose rule the write must pass, undefined when the row kept its group. */
  readonly ruled: BoardGroup | undefined
}

/**
 * Runs one verb as one read, one render, and one write of `priority.md`, so a
 * call never leaves a partial table behind. A row changing group is checked
 * against the target group's rule on the rendered board before anything is
 * written, which reads the board exactly as `validate` will.
 */
async function writeBoard(
  root: string,
  stem: string,
  edit: (board: Board) => Edited | BoardRefused,
): Promise<BoardOutcome> {
  const dir = tasksDir(root)
  if (!existsSync(dir)) return refuse('no-board', `No task board at ${dir}.`)

  const path = orderingPath(root)
  if (!existsSync(path)) {
    return refuse('no-ordering', `No ordering file at ${path}.`)
  }

  const file = join(dir, `${stem}.md`)
  if (!existsSync(file)) {
    return refuse('no-match', `No task file at ${file}.`, [stem])
  }

  return withBoardLock(path, () => writeLocked(root, stem, path, edit))
}

/**
 * Holds an exclusive lock file beside the board for one read, render, and
 * write, so two verbs in two sessions cannot each replace the file with an
 * edit that drops the other's. The render reads every task and plan, which is
 * why the stale age sits well above any one call.
 */
async function withBoardLock(
  path: string,
  run: () => Promise<BoardOutcome>,
): Promise<BoardOutcome> {
  const lock = `${path}.lock`
  const deadline = Date.now() + LOCK_WAIT_MS

  for (;;) {
    try {
      await (await open(lock, 'wx')).close()
      break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      const modified = (await stat(lock).catch(() => undefined))?.mtimeMs
      if (modified !== undefined && Date.now() - modified > LOCK_STALE_MS) {
        await rm(lock, { force: true })
        continue
      }
      if (Date.now() >= deadline) {
        return refuse(
          'board-busy',
          `Another board verb holds ${lock}. Run this one again once it finishes.`,
        )
      }
      await new Promise((settle) => setTimeout(settle, LOCK_POLL_MS))
    }
  }

  try {
    return await run()
  } finally {
    await rm(lock, { force: true })
  }
}

async function writeLocked(
  root: string,
  stem: string,
  path: string,
  edit: (board: Board) => Edited | BoardRefused,
): Promise<BoardOutcome> {
  const before = await readFile(path, 'utf8')
  const parse = parseBoard(before)
  if (!parse.ok) {
    return refuse(
      'unreadable-row',
      `${path} holds a row naming no task or carrying a Waiting on cell its header cannot place, so a render would drop or rewrite it. Fix that row by hand first.`,
      [parse.line],
    )
  }

  const edited = edit(parse.board)
  if ('ok' in edited) return edited

  const text = await renderBoard(root, edited.board)

  if (edited.ruled) {
    const forbidden = GROUP_RULES[edited.ruled]
    const rows = await declaredRows(readBoard(text).rows, root)
    const broken = (await groupRuleFindings(rows, root)).filter(
      (finding) => finding.subject === stem && forbidden.includes(finding.kind),
    )
    if (broken.length > 0) {
      return refuse(
        'group-rule',
        `${stem} cannot sit under ${edited.ruled}. ${broken.map((finding) => `${finding.kind}: ${finding.message}`).join(' ')}`,
        broken.map((finding) => finding.kind),
      )
    }
  }

  // The lock holds off other verbs and nothing else, so a hand edit landing
  // while the render awaited its reads is caught by comparing the file again.
  if ((await readFile(path, 'utf8')) !== before) {
    return refuse(
      'board-changed',
      `${path} changed while this call rendered it, so nothing was written. Run the verb again.`,
    )
  }

  await writeFile(path, text)

  return {
    ok: true,
    stem,
    group: edited.group,
    from: edited.from,
    position:
      edited.board.groups[edited.group].findIndex((row) => row.stem === stem) +
      1,
    path,
    backlog: false,
  }
}

export interface PlaceOptions {
  readonly waiting?: string
  readonly position?: Position
}

/**
 * Puts a task under a group from anywhere: another group, the backlog, or no
 * surface at all. A backlog line is removed in the same call, since a task on
 * both surfaces is the `row-duplicated` finding and a two-step move strands it
 * between them.
 */
export async function placeTask(
  root: string,
  stem: string,
  group: BoardGroup,
  options: PlaceOptions = {},
): Promise<BoardOutcome> {
  if (options.waiting !== undefined) {
    const bad = checkWaiting(options.waiting)
    if (bad) return bad
  }

  const written = await writeBoard(root, stem, (board) => {
    const found = findRow(board, stem)
    const owns = GROUP_COLUMNS[group].includes('Waiting on')
    const waiting = owns
      ? (options.waiting?.trim() ?? found?.row.waiting)
      : undefined

    if (owns && waiting === undefined) {
      return refuse(
        'bad-input',
        `${group} carries a Waiting on cell and ${stem} has none to keep. Pass --waiting.`,
      )
    }

    const next = placed(
      board,
      group,
      { stem, label: found?.row.label ?? stem, waiting },
      options.position ?? { at: 'bottom' },
    )
    if ('ok' in next) return next

    return {
      board: next,
      group,
      from: found?.group,
      ruled: found?.group === group ? undefined : group,
    }
  })
  if (!written.ok) return written

  const removed = await removeFromBacklog(root, stem)
  return {
    ...written,
    from: written.from ?? (removed ? 'backlog' : undefined),
    backlog: removed,
  }
}

async function removeFromBacklog(root: string, stem: string): Promise<boolean> {
  const path = backlogPath(root)
  if (!existsSync(path)) return false

  const { text, removed } = removeBacklogRow(await readFile(path, 'utf8'), stem)
  if (removed) await writeFile(path, text)
  return removed
}

export interface PromoteOptions {
  readonly waiting?: string
}

/**
 * Moves a row one group closer to `## Run now`, to the bottom of that group.
 * Dispatch runs it once a launch succeeds, so `## Run now` reads as
 * dispatched, and `plan-link` runs it on a `## Needs a plan` row once the plan
 * is linked.
 */
export async function promoteTask(
  root: string,
  stem: string,
  options: PromoteOptions = {},
): Promise<BoardOutcome> {
  if (options.waiting !== undefined) {
    const bad = checkWaiting(options.waiting)
    if (bad) return bad
  }

  return writeBoard(root, stem, (board) => {
    const found = findRow(board, stem)
    if (!found) return refuse('no-row', `${stem} has no row on the board.`)

    const target = PROMOTES_TO[found.group]
    if (!target) {
      return refuse(
        'top-group',
        `${stem} already sits under Run now, the top group.`,
      )
    }

    const waiting = GROUP_COLUMNS[target].includes('Waiting on')
      ? (options.waiting?.trim() ?? PLANNED_WAITING)
      : undefined
    const next = placed(
      board,
      target,
      { ...found.row, waiting },
      {
        at: 'bottom',
      },
    )
    if ('ok' in next) return next

    return { board: next, group: target, from: found.group, ruled: target }
  })
}

/** What linking a plan did to the task's row, and why when it did nothing. */
export interface LinkPromotion {
  readonly moved: boolean
  /** The group the row sat in before, undefined when it has no row. */
  readonly from: BoardGroup | undefined
  readonly note: string
}

/**
 * Promotes a task's row out of `## Needs a plan` once its plan is linked, and
 * leaves every other row where it is. A row already under `## Up next` or
 * `## Run now` is past the planning a link records, and a task with no row was
 * never placed, which is the controller's call rather than the link's.
 */
export async function promoteOnLink(
  root: string,
  stem: string,
  options: PromoteOptions = {},
): Promise<LinkPromotion> {
  const path = orderingPath(root)
  if (!existsSync(path)) {
    return { moved: false, from: undefined, note: 'no ordering file' }
  }

  const parse = parseBoard(await readFile(path, 'utf8'))
  const found = parse.ok ? findRow(parse.board, stem) : undefined
  if (!found) {
    return { moved: false, from: undefined, note: 'no row on the board' }
  }

  if (found.group !== 'Needs a plan') {
    return {
      moved: false,
      from: found.group,
      note: `already under ${found.group}`,
    }
  }

  const outcome = await promoteTask(root, stem, options)
  return outcome.ok
    ? { moved: true, from: found.group, note: `moved to ${outcome.group}` }
    : { moved: false, from: found.group, note: outcome.message }
}

/**
 * Rewrites the board with a task's row where it sits, so its derived cells
 * catch up with a plan that moved under it. A merged slice archives its plan
 * from the post-merge hook, where no other board verb runs.
 */
export async function rerenderRow(
  root: string,
  stem: string,
): Promise<BoardOutcome> {
  return writeBoard(root, stem, (board) => {
    const found = findRow(board, stem)
    if (!found) return refuse('no-row', `${stem} has no row on the board.`)

    return { board, group: found.group, from: found.group, ruled: undefined }
  })
}

/** Repositions a row inside the group it already sits in. */
export async function moveTask(
  root: string,
  stem: string,
  position: Position,
): Promise<BoardOutcome> {
  if (anchorOf(position) === stem) {
    return refuse('bad-input', `${stem} cannot sit beside itself.`, [stem])
  }

  return writeBoard(root, stem, (board) => {
    const found = findRow(board, stem)
    if (!found) return refuse('no-row', `${stem} has no row on the board.`)

    const next = placed(board, found.group, found.row, position)
    if ('ok' in next) return next

    return {
      board: next,
      group: found.group,
      from: found.group,
      ruled: undefined,
    }
  })
}

/** Rewrites the `Waiting on` cell of a row in place. */
export async function blockTask(
  root: string,
  stem: string,
  waiting: string,
): Promise<BoardOutcome> {
  const bad = checkWaiting(waiting)
  if (bad) return bad

  return writeBoard(root, stem, (board) => {
    const found = findRow(board, stem)
    if (!found) return refuse('no-row', `${stem} has no row on the board.`)

    if (!GROUP_COLUMNS[found.group].includes('Waiting on')) {
      return refuse(
        'no-column',
        `${stem} sits under ${found.group}, which carries no Waiting on cell.`,
      )
    }

    const groups = { ...board.groups }
    groups[found.group] = board.groups[found.group].map((row) =>
      row.stem === stem ? { ...row, waiting: waiting.trim() } : row,
    )

    return {
      board: { ...board, groups },
      group: found.group,
      from: found.group,
      ruled: undefined,
    }
  })
}
