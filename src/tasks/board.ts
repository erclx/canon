import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import {
  linkTo,
  readPlanTargets,
  resolveLivePlan,
  tasksDir,
} from '@/tasks/archive'
import { readDeclarations } from '@/tasks/reach'
import { BOARD_GROUPS, type BoardGroup } from '@/tasks/validate'

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

/** How many declared paths a `Touches` cell spells out before it counts the rest. */
const TOUCHES_SHOWN = 3

/**
 * The widest a `Waiting on` cell may render. The live board's cells measured 14
 * to 131 characters on 2026-10-18 with one table outlier set aside, and the
 * cap sits where all but the longest fit.
 */
export const WAITING_LIMIT = 120

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
    .replace(/\|$/, '')
    .split('|')
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
 * Reads the `Waiting on` cell out of a row. The table's own header places it
 * when the row matches that header's width, and the last cell stands in when it
 * does not, since every owned shape puts `Waiting on` last. That fallback is
 * what lets a row stranded behind a short header or a closed table keep its
 * blocker through a render.
 */
function waitingCell(
  cells: readonly string[],
  header: readonly string[] | undefined,
): string | undefined {
  const at = header?.findIndex((cell) => cell.toLowerCase() === 'waiting on')
  if (header && at !== undefined && at >= 0 && cells.length === header.length) {
    return cells[at]
  }

  return cells.length >= 2 ? cells.at(-1) : undefined
}

/**
 * Parses `priority.md` into the model. The parse is lenient where `readBoard`
 * is strict: a row after a closed table, under a header short a column, or
 * past a blank line inside a table is still a row of the group it sits under,
 * since the render exists to repair exactly those boards. A pipe line naming no
 * task is the one thing it refuses, since rendering it would drop it.
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
    groups[section].push({
      stem: link.stem,
      label: link.label,
      waiting: owned ? waitingCell(cells, header) : undefined,
    })
  }

  return { ok: true, board: { head, groups, notes, trailing } }
}

/** The cells a row renders that the task and its plans decide. */
export interface DerivedCells {
  readonly task: string
  readonly touches: string
  readonly plan: string
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
 * The first `TOUCHES_SHOWN` declared paths, then a count of the rest. A task
 * sliced over several plans reads their union, so the tail names the plans in
 * the plural.
 */
export function touchesCell(paths: readonly string[], plans: number): string {
  const shown = paths.slice(0, TOUCHES_SHOWN).map((path) => `\`${path}\``)
  const rest = paths.length - shown.length
  if (rest === 0) return shown.join(', ')

  const lists = plans > 1 ? 'the plans list' : 'the plan lists'
  return `${shown.join(', ')}, and ${rest} more files ${lists}`
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
    }
  }

  const text = await readFile(file, 'utf8')
  const plans = await livePlans(text, root)
  const declared = await Promise.all(
    plans.map(async (plan) => readDeclarations(await readFile(plan, 'utf8'))),
  )
  const dir = tasksDir(root)

  return {
    task: `[${titleOf(text) ?? (row.label || row.stem)}](${row.stem}.md)`,
    touches: touchesCell([...new Set(declared.flat())], plans.length),
    plan: plans
      .map((plan) => `[${planLabel(plan)}](${linkTo(dir, plan)})`)
      .join(', '),
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
