import { existsSync } from 'node:fs'
import { open, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import {
  linkTo,
  readPlanTargets,
  readSessions,
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
  groupOfHeading,
  groupRuleFindings,
  orderingPath,
  readBoard,
} from '@/tasks/validate'

/**
 * The columns each group owns. `Waiting on` and `Launch` are typed through a
 * verb, and every other cell is derived, so the render is their only writer.
 */
export const GROUP_COLUMNS: Readonly<Record<BoardGroup, readonly string[]>> = {
  'In flight': ['Task', 'Touches', 'Session'],
  'Up next': ['Task', 'Touches', 'Launch', 'Waiting on'],
  'Needs a plan': ['Task', 'Waiting on'],
}

/** The columns each group carried before the Launch and Session cells, read and never written. */
export const RETIRED_COLUMNS: Readonly<Record<BoardGroup, readonly string[]>> =
  {
    'In flight': ['Task', 'Touches', 'Plan'],
    'Up next': ['Task', 'Touches', 'Waiting on'],
    'Needs a plan': ['Task', 'Waiting on'],
  }

export const LAUNCH_ROLES = ['worker', 'planner'] as const
export const LAUNCH_MODELS = ['opus', 'sonnet', 'fable'] as const
export const LAUNCH_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
/** `background` is a `claude --bg` dispatch, and `hand` a prompt the operator pastes. */
export const LAUNCH_ROUTES = ['background', 'hand'] as const

export type LaunchRole = (typeof LAUNCH_ROLES)[number]
export type LaunchModel = (typeof LAUNCH_MODELS)[number]
export type LaunchEffort = (typeof LAUNCH_EFFORTS)[number]
export type LaunchRoute = (typeof LAUNCH_ROUTES)[number]

/** How a queued row will launch, as the dispatcher picked it or the operator overrode it. */
export interface LaunchPick {
  readonly role: LaunchRole
  readonly model: LaunchModel
  readonly effort: LaunchEffort
  readonly route: LaunchRoute
  readonly override: boolean
}

/** The part of a pick an in-flight row keeps, since its role and route were spent at launch. */
export interface FlightPick {
  readonly model: LaunchModel
  readonly effort: LaunchEffort
}

export function oneOf<T extends string>(
  values: readonly T[],
  value: string | undefined,
): T | undefined {
  return values.find((entry) => entry === value)
}

const OVERRIDE_MARK = ' (operator)'

export function formatLaunch(pick: LaunchPick): string {
  const cell = [pick.role, pick.model, pick.effort, pick.route].join(', ')
  return pick.override ? `${cell}${OVERRIDE_MARK}` : cell
}

/** Reads a Launch cell back, undefined for any text `formatLaunch` would not write. */
export function readLaunch(cell: string): LaunchPick | undefined {
  const trimmed = cell.trim()
  const override = trimmed.endsWith(OVERRIDE_MARK)
  const body = override ? trimmed.slice(0, -OVERRIDE_MARK.length) : trimmed
  const parts = body.split(', ')
  if (parts.length !== 4) return undefined

  const role = oneOf(LAUNCH_ROLES, parts[0])
  const model = oneOf(LAUNCH_MODELS, parts[1])
  const effort = oneOf(LAUNCH_EFFORTS, parts[2])
  const route = oneOf(LAUNCH_ROUTES, parts[3])
  if (!role || !model || !effort || !route) return undefined

  return { role, model, effort, route, override }
}

/** What a Session cell reads when the task's `Sessions:` line names nobody. */
export const NO_SESSION = 'no session recorded'

const FLIGHT_PICK = /^(.*) \((\w+), (\w+)\)$/

export function formatSession(
  session: string | undefined,
  pick: FlightPick | undefined,
): string {
  const name = session ?? NO_SESSION
  return pick ? `${name} (${pick.model}, ${pick.effort})` : name
}

/**
 * Reads the stored pick off a Session cell. The session name is derived on
 * every render, so only a trailing model and effort pair survives the read,
 * and a name ending in parentheses of its own reads as carrying none.
 */
export function readFlightPick(cell: string): FlightPick | undefined {
  const match = FLIGHT_PICK.exec(cell.trim())
  const model = oneOf(LAUNCH_MODELS, match?.[2])
  const effort = oneOf(LAUNCH_EFFORTS, match?.[3])
  return model && effort ? { model, effort } : undefined
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
 * The widest a `Waiting on` cell may render, set where all but the longest
 * measured cells on the live board fit.
 */
export const WAITING_LIMIT = 120

/** How long a verb waits on another verb's lock before refusing as busy. */
const LOCK_WAIT_MS = 5_000

/** A lock older than this was left by a call that died, since a render takes well under a second. */
const LOCK_STALE_MS = 30_000

const LOCK_POLL_MS = 20

/** One row as the board holds it: the task it points at and the cells no derivation recovers. */
export interface PlacedRow {
  readonly stem: string
  /** The label the row's Task cell carried, used when the task file is gone. */
  readonly label: string
  readonly waiting: string | undefined
  /** The Launch cell under `## Up next`, absent until a pick is written. */
  readonly launch?: LaunchPick
  /** The model and effort an `## In flight` row launched on, carried from its Launch cell. */
  readonly pick?: FlightPick
}

/**
 * The board as a model. Rows are kept per group in order, and everything the
 * model does not own, being the frontmatter, title, prose under a group heading,
 * and any non-group section, is kept as written.
 */
export interface Board {
  readonly head: readonly string[]
  readonly groups: Readonly<Record<BoardGroup, readonly PlacedRow[]>>
  readonly notes: Readonly<Record<BoardGroup, readonly string[]>>
  readonly trailing: readonly string[]
}

export type BoardParse =
  | { readonly ok: true; readonly board: Board }
  | {
      readonly ok: false
      readonly line: string
      /** `doubled` when the line reopens a group already read, under either heading. */
      readonly kind: 'row' | 'doubled'
    }

function emptyGroups<T>(): Record<BoardGroup, T[]> {
  return { 'In flight': [], 'Up next': [], 'Needs a plan': [] }
}

function namedCell(
  cells: readonly string[],
  header: readonly string[] | undefined,
  name: string,
): string | undefined {
  if (!header || cells.length !== header.length) return undefined
  const at = header.findIndex((cell) => cell.toLowerCase() === name)
  return at === -1 ? undefined : cells[at]
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
 * Reads the `Waiting on` cell out of a row through the header above it. A row
 * one cell short of a header ending in `Waiting on` is read as missing `Touches`,
 * so its last cell stands in. Any other shape answers `undefined`, never a guess.
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
 * Parses `priority.md` into the model, leniently where `readBoard` is strict,
 * since a render exists to repair a row after a closed table or under a short
 * header. It refuses a pipe line naming no task and a blocker the header cannot place.
 */
export function parseBoard(text: string): BoardParse {
  const lines = text.split('\n')
  const head: string[] = []
  const groups = emptyGroups<PlacedRow>()
  const notes = emptyGroups<string>()
  const trailing: string[] = []

  let section: BoardGroup | 'head' | 'other' = 'head'
  let header: string[] | undefined
  const seen = new Set<BoardGroup>()

  for (const line of lines) {
    const heading = /^##\s+(.+?)\s*$/.exec(line)
    if (heading) {
      const group = groupOfHeading(heading[1])
      // A render folding two tables would rank rows nobody ranked together.
      if (group && seen.has(group)) {
        return { ok: false, line: line.trim(), kind: 'doubled' }
      }
      if (group) seen.add(group)
      section = group ?? 'other'
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
      return { ok: false, line: line.trim(), kind: 'row' }
    }

    const owned = GROUP_COLUMNS[section].includes('Waiting on')
    const waiting = owned ? waitingCell(cells, header) : undefined
    if (owned && waiting === undefined) {
      return { ok: false, line: line.trim(), kind: 'row' }
    }

    const launchCell = namedCell(cells, header, 'launch')
    const launch = launchCell ? readLaunch(launchCell) : undefined
    if (launchCell && !launch) {
      return { ok: false, line: line.trim(), kind: 'row' }
    }

    const sessionCell = namedCell(cells, header, 'session')
    const pick = sessionCell ? readFlightPick(sessionCell) : undefined

    groups[section].push({
      stem: link.stem,
      label: link.label,
      waiting,
      ...(launch && section === 'Up next' ? { launch } : {}),
      ...(pick && section === 'In flight' ? { pick } : {}),
    })
  }

  return { ok: true, board: { head, groups, notes, trailing } }
}

/** The cells a row renders that the task and its plans decide. */
export interface DerivedCells {
  readonly task: string
  readonly touches: string
  readonly plan: string
  /** The last session the task's `Sessions:` line names, undefined when it names none. */
  readonly session: string | undefined
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
 * `TOUCHES_FOLDERS`, ties going to the folder declared first. The file list lives
 * in the linked plan, so the cell says only where a row works.
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
 * its `Plan:` line links. A gone task file keeps the label its row carried and
 * derives nothing else, since `validate` reports the dead row.
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
      session: undefined,
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
    session: readSessions(text).at(-1)?.name,
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
  if (column === 'Launch') return row.launch ? formatLaunch(row.launch) : ''
  if (column === 'Session') return formatSession(derived.session, row.pick)
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
  'group-doubled',
  'board-busy',
  'board-changed',
  'group-rule',
  'no-column',
  'top-group',
  'cell-long',
  'bad-input',
  'effort-floor',
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
  /** Set when a same-group call left the row at its position. */
  readonly kept?: boolean
  /** Set when a row entered Up next, `derived` for a built Launch cell and `none` for no cell. */
  readonly launch?: 'derived' | 'none'
}

export type BoardOutcome = BoardWritten | BoardRefused

/** The `Waiting on` a row promoted out of `## Needs a plan` carries when the caller names none. */
export const PLANNED_WAITING = 'Planned, not dispatched yet'

/**
 * The finding kinds each group's rule forbids, read off the same predicates
 * `canon tasks validate` reports through `groupRuleFindings`.
 */
const GROUP_RULES: Readonly<Record<BoardGroup, readonly FindingKind[]>> = {
  'In flight': ['plan-unstated', 'touches-unstated'],
  'Up next': ['plan-absent'],
  'Needs a plan': ['plan-parked'],
}

/** The group one step closer to `## In flight`, which is where `promote` sends a row. */
const PROMOTES_TO: Readonly<Record<BoardGroup, BoardGroup | undefined>> = {
  'In flight': undefined,
  'Up next': 'In flight',
  'Needs a plan': 'Up next',
}

/**
 * The row as it enters a group. A row reaching `## In flight` keeps the model
 * and effort its Launch cell picked, and the Launch cell itself stays behind,
 * since the pick it records is spent once the row launched.
 */
function entering(
  row: PlacedRow,
  group: BoardGroup,
  session?: string,
): PlacedRow {
  const { launch, pick, ...rest } = row
  if (group === 'Up next') {
    const built = launch ?? derivedLaunch(pick, session)
    return built ? { ...rest, launch: built } : rest
  }
  if (group !== 'In flight') return rest

  const carried =
    pick ??
    (launch ? { model: launch.model, effort: launch.effort } : undefined)
  return carried ? { ...rest, pick: carried } : rest
}

/**
 * The Launch cell a row leaving In flight gets back. The `Sessions:` line holds
 * a name and an id and no route, so only a `worker-` name is read as a
 * dispatched worker, which `claude --bg` launches. Any other name builds none.
 */
function derivedLaunch(
  pick: FlightPick | undefined,
  session: string | undefined,
): LaunchPick | undefined {
  if (!pick || !session?.startsWith('worker-')) return undefined
  return { role: 'worker', ...pick, route: 'background', override: false }
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

export function findRow(
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

export interface Edited {
  readonly board: Board
  readonly group: BoardGroup
  readonly from: BoardGroup | undefined
  /** The group whose rule the write must pass, undefined when the row kept its group. */
  readonly ruled: BoardGroup | undefined
  readonly kept?: boolean
  readonly launch?: 'derived' | 'none'
}

/**
 * Runs one verb as one read, one render, and one write of `priority.md`, so a
 * call never leaves a partial table. A group change is checked against the
 * target group's rule on the rendered board, as `validate` will read it.
 */
export async function writeBoard(
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
 * write, so two sessions cannot each replace the file with an edit that drops
 * the other's. The render reads every task and plan, so the stale age is long.
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
    return parse.kind === 'doubled'
      ? refuse(
          'group-doubled',
          `${path} opens one group twice, as ## Run now beside ## In flight after a bad merge, so a render would rank rows nobody ranked. Merge the two tables by hand first.`,
          [parse.line],
        )
      : refuse(
          'unreadable-row',
          `${path} holds a row naming no task, or carrying a Waiting on or Launch cell its header cannot place or read, so a render would drop or rewrite it. Fix that row by hand first.`,
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

  // The lock holds off other verbs only, so a hand edit during the render is caught by recompare.
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
    ...(edited.kept ? { kept: true } : {}),
    ...(edited.launch ? { launch: edited.launch } : {}),
  }
}

export interface PlaceOptions {
  readonly waiting?: string
  readonly position?: Position
}

/**
 * Puts a task under a group from anywhere: another group, the backlog, or no
 * surface. A backlog line is removed in the same call, since a task on both
 * surfaces is the `row-duplicated` finding and a two-step move strands it.
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

  const session = await latestSessionName(root, stem)

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

    const row = entering(
      { ...found?.row, stem, label: found?.row.label ?? stem, waiting },
      group,
      session,
    )
    const sameGroup = found?.group === group
    const kept = sameGroup && options.position === undefined

    const next = kept
      ? {
          ...board,
          groups: {
            ...board.groups,
            [group]: board.groups[group].map((entry) =>
              entry.stem === stem ? row : entry,
            ),
          },
        }
      : placed(board, group, row, options.position ?? { at: 'bottom' })
    if ('ok' in next) return next

    return {
      board: next,
      group,
      from: found?.group,
      ruled: sameGroup ? undefined : group,
      ...(kept ? { kept: true } : {}),
      ...(group === 'Up next' && !sameGroup
        ? { launch: row.launch ? ('derived' as const) : ('none' as const) }
        : {}),
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

async function latestSessionName(
  root: string,
  stem: string,
): Promise<string | undefined> {
  const file = join(tasksDir(root), `${stem}.md`)
  if (!existsSync(file)) return undefined
  return readSessions(await readFile(file, 'utf8')).at(-1)?.name
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
 * Moves a row one group closer to `## In flight`, to its bottom. Dispatch runs
 * it after a launch, and `plan-link` once a parked row's plan is linked.
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
        `${stem} already sits under In flight, the top group.`,
      )
    }

    const waiting = GROUP_COLUMNS[target].includes('Waiting on')
      ? (options.waiting?.trim() ?? PLANNED_WAITING)
      : undefined
    const next = placed(
      board,
      target,
      entering({ ...found.row, waiting }, target),
      { at: 'bottom' },
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
  /** The command that places a task with no row, absent for any other case. */
  readonly next?: string
}

/**
 * Promotes a row out of `## Needs a plan` once its plan is linked. Any other
 * row is past that planning, and a task with no row is the controller's call.
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
    return {
      moved: false,
      from: undefined,
      note: 'no row on the board',
      next: `canon tasks place ${stem} --group up-next`,
    }
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

/**
 * Re-renders a task's row when it sits under `## In flight`, so a session
 * recorded after the promote shows in its Session cell. Every other row
 * renders no session, so nothing is written for it.
 */
export async function rerenderFlight(
  root: string,
  stem: string,
): Promise<BoardOutcome | undefined> {
  const path = orderingPath(root)
  if (!existsSync(path)) return undefined

  const parse = parseBoard(await readFile(path, 'utf8'))
  if (!parse.ok || findRow(parse.board, stem)?.group !== 'In flight') {
    return undefined
  }

  return rerenderRow(root, stem)
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
