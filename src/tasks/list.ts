import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { listTaskStems, tasksDir } from '@/tasks/archive'
import {
  BOARD_GROUPS,
  type BoardGroup,
  backlogPath,
  orderingPath,
  readBacklog,
  readBoard,
} from '@/tasks/validate'

/**
 * The three board group names plus the states outside them. A file named on
 * both surfaces is `validate`'s finding, so it reports as `both` rather than
 * being judged here.
 */
export const READINESS_VALUES = [
  ...BOARD_GROUPS,
  'backlog',
  'unplaced',
  'both',
] as const

export type Readiness = (typeof READINESS_VALUES)[number]

export interface ListedTask {
  readonly stem: string
  readonly readiness: Readiness
}

export interface TaskList {
  readonly ok: true
  readonly tasks: readonly ListedTask[]
}

export interface ListRefused {
  readonly ok: false
  readonly reason: 'no-board'
  readonly message: string
}

export type ListOutcome = TaskList | ListRefused

/**
 * Reports each live task file's readiness from the board and the backlog. It
 * reads through the parsers `validate` exports rather than reading either file
 * a second time, so the two verbs cannot disagree on what a surface names. An
 * absent ordering file or backlog reads as empty, since a file in neither
 * surface is reported `unplaced` rather than refused.
 */
export async function listTasks(root: string): Promise<ListOutcome> {
  const dir = tasksDir(root)
  if (!existsSync(dir)) {
    return {
      ok: false,
      reason: 'no-board',
      message: `No task board at ${dir}.`,
    }
  }

  const ordering = orderingPath(root)
  const { rows } = existsSync(ordering)
    ? readBoard(await readFile(ordering, 'utf8'))
    : { rows: [] }

  const backlogFile = backlogPath(root)
  const backlog = existsSync(backlogFile)
    ? readBacklog(await readFile(backlogFile, 'utf8'))
    : []

  const groupOf = new Map<string, BoardGroup>()
  for (const row of rows) {
    if (row.stem) groupOf.set(row.stem, row.group)
  }
  const parked = new Set(backlog.flatMap((row) => (row.stem ? [row.stem] : [])))

  const stems = await listTaskStems(dir)

  return {
    ok: true,
    tasks: stems.map((stem) => ({
      stem,
      readiness: readinessOf(groupOf.get(stem), parked.has(stem)),
    })),
  }
}

function readinessOf(
  group: BoardGroup | undefined,
  isParked: boolean,
): Readiness {
  if (group && isParked) return 'both'
  if (group) return group
  if (isParked) return 'backlog'

  return 'unplaced'
}
