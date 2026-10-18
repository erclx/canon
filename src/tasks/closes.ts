import { readFile } from 'node:fs/promises'
import {
  fenceMask,
  readOutcomes,
  readPendingBranches,
  readPullRequest,
} from '@/tasks/archive'
import {
  openTask,
  type RecordRefused,
  type RecordSelector,
} from '@/tasks/record'

/**
 * Why a task does or does not close its issues. `last-slice` is the only
 * reason that closes. The rest mirror the conditions `archiveTask` applies at
 * merge time, so an issue closes exactly when the task archives.
 */
export type ClosingReason =
  | 'earlier-slice'
  | 'last-slice'
  | 'lookup-failed'
  | 'no-issues'
  | 'no-outcomes'
  | 'open-outcomes'
  | 'pending-branch'

export interface Closure {
  readonly issues: readonly number[]
  readonly closing: boolean
  readonly reason: ClosingReason
}

export interface TaskClosure extends Closure {
  readonly ok: true
  readonly stem: string
  readonly path: string
}

export type ClosureOutcome = TaskClosure | RecordRefused

const ISSUE_LINE = /^Issue:[ \t]*(#\d+(?:[ \t]*,[ \t]*#\d+)*)[ \t]*$/

/**
 * Reads every `Issue:` line outside a fence, each a bare `#NNN` or a comma
 * list of them. A line carrying anything else, such as the older bare-path
 * form, names no issue rather than the numbers that happened to parse, since a
 * wrong number would close an unrelated issue.
 */
export function readIssues(text: string): readonly number[] {
  const lines = text.split('\n')
  const fenced = fenceMask(lines)
  const issues = new Set<number>()

  for (const [index, line] of lines.entries()) {
    if (fenced[index]) continue

    const match = ISSUE_LINE.exec(line)
    if (!match) continue

    for (const entry of match[1].split(',')) {
      issues.add(Number(entry.trim().slice(1)))
    }
  }

  return [...issues]
}

/**
 * Decides whether the pull request for `branches` closes the task's issues.
 * `branches` is the working branch and every name it carried, since a rename
 * leaves the `Pending branch:` marker under the old one. Any other pending
 * branch is a slice still to ship, so the task stays open behind it.
 */
export function decideClosing(
  text: string,
  branches: readonly string[],
  pulls: readonly number[] | null = [],
): Closure {
  const issues = readIssues(text)
  if (issues.length === 0) {
    return { issues, closing: false, reason: 'no-issues' }
  }

  const listed = readPullRequest(text)
  const last = listed.at(-1)

  // A failed lookup cannot rule out that this branch is an earlier slice, and
  // closing early is the unsafe direction. With nothing recorded yet there is
  // no earlier slice to confuse it with, so that case still closes.
  if (pulls === null && listed.length > 0) {
    return { issues, closing: false, reason: 'lookup-failed' }
  }

  if (
    last !== undefined &&
    pulls !== null &&
    !pulls.includes(last) &&
    pulls.some((number) => listed.includes(number))
  ) {
    return { issues, closing: false, reason: 'earlier-slice' }
  }

  const others = readPendingBranches(text).filter(
    (branch) => !branches.includes(branch),
  )
  if (others.length > 0) {
    return { issues, closing: false, reason: 'pending-branch' }
  }

  const { open, closed, cut } = readOutcomes(text)
  if (open.length > 0) {
    return { issues, closing: false, reason: 'open-outcomes' }
  }

  if (closed.length === 0 && cut.length === 0) {
    return { issues, closing: false, reason: 'no-outcomes' }
  }

  return { issues, closing: true, reason: 'last-slice' }
}

/** Resolves the task through the same selector `pull-request` takes. */
export async function readClosure(
  root: string,
  selector: RecordSelector,
  branches: readonly string[],
  pulls: readonly number[] | null = [],
): Promise<ClosureOutcome> {
  const opened = await openTask(root, selector)
  if ('ok' in opened) return opened

  const text = await readFile(opened.path, 'utf8')

  return { ok: true, ...opened, ...decideClosing(text, branches, pulls) }
}
