import {
  type BoardOutcome,
  type BoardRefused,
  findRow,
  type LaunchPick,
  writeBoard,
} from '@/tasks/board'

/** The models whose lowest launchable effort is above `low`, by the runbook's mapping. */
const FLOORED_MODELS: readonly LaunchPick['model'][] = ['opus', 'sonnet']

/**
 * Whether a pick sits below its model's floor, being `low` on `opus` or
 * `sonnet` that the operator did not choose. Only a write is held to it, so a
 * cell already on the board still reads.
 */
export function belowEffortFloor(
  pick: Pick<LaunchPick, 'model' | 'effort' | 'override'>,
): boolean {
  return (
    !pick.override &&
    pick.effort === 'low' &&
    FLOORED_MODELS.includes(pick.model)
  )
}

/** The one group carrying a Launch cell, since only a queued row has a launch still to make. */
const LAUNCH_GROUP = 'Up next'

function refused(
  reason: BoardRefused['reason'],
  message: string,
): BoardRefused {
  return { ok: false, reason, message, detail: [] }
}

/**
 * Writes, replaces, or clears the Launch cell of a row under `## Up next`,
 * passing `undefined` to clear. The pick is the dispatcher's call, made from
 * its runbook, so this stores it and computes nothing.
 */
export async function writeLaunch(
  root: string,
  stem: string,
  pick: LaunchPick | undefined,
): Promise<BoardOutcome> {
  return writeBoard(root, stem, (board) => {
    const found = findRow(board, stem)
    if (!found) return refused('no-row', `${stem} has no row on the board.`)

    if (found.group !== LAUNCH_GROUP) {
      return refused(
        'no-column',
        `${stem} sits under ${found.group}, and only an Up next row carries a Launch cell.`,
      )
    }

    const groups = { ...board.groups }
    groups[LAUNCH_GROUP] = board.groups[LAUNCH_GROUP].map((row) =>
      row.stem === stem
        ? {
            stem: row.stem,
            label: row.label,
            waiting: row.waiting,
            ...(pick ? { launch: pick } : {}),
          }
        : row,
    )

    return {
      board: { ...board, groups },
      group: LAUNCH_GROUP,
      from: LAUNCH_GROUP,
      ruled: undefined,
    }
  })
}
