import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  cellHolder,
  readPullRequest,
  readSessions,
  tasksDir,
} from '@/tasks/archive'
import { parseBoard } from '@/tasks/board'
import { orderingPath } from '@/tasks/validate'

/** Where an in-flight row stands, each stated in `canon tasks flight --help`. */
export const FLIGHT_STAGES = [
  'building',
  'stopped',
  'unrecorded',
  'reviewing',
  'checks',
  'rebase',
  'mergeable',
  'closed',
  'unread',
] as const

export type FlightStage = (typeof FLIGHT_STAGES)[number]

export interface FlightRow {
  readonly task: string
  readonly session: { readonly name: string; readonly sessionId: string } | null
  /** Whether the session is on the roster, null when the roster was not read or no session is recorded. */
  readonly live: boolean | null
  readonly pullRequest: number | null
  readonly stage: FlightStage
  /** The `canon pr lift --check` reason behind a stage read off the pull request, null otherwise. */
  readonly reason: string | null
}

export interface FlightReaders {
  /** The live session ids, undefined when the roster could not be read. */
  readonly roster: () => Promise<ReadonlySet<string> | undefined>
  /** The `canon pr lift --check` reading, undefined when it could not be taken. */
  readonly pull: (
    number: number,
  ) => Promise<{ readonly reason: string } | undefined>
}

export type FlightOutcome =
  | { readonly ok: true; readonly rows: readonly FlightRow[] }
  | {
      readonly ok: false
      readonly reason:
        | 'no-board'
        | 'no-ordering'
        | 'unreadable-row'
        | 'group-doubled'
      readonly message: string
    }

const STAGE_OF_REASON: Readonly<Record<string, FlightStage>> = {
  clear: 'mergeable',
  'already-ready': 'mergeable',
  'pull-closed': 'closed',
  'standing-stale': 'rebase',
  'standing-conflict': 'rebase',
  'ci-pending': 'checks',
  'ci-failing': 'checks',
  'ci-conflicted': 'rebase',
  'ci-stalled': 'checks',
  'ci-timeout': 'checks',
  'measurement-pending': 'checks',
}

const REVIEW_PREFIXES = ['review-', 'ui-', 'evidence-', 'painted-', 'reel-']

/** The stage a lift reading names. A reason no stage owns reads as unread rather than guessed. */
export function stageOfLift(reason: string): FlightStage {
  const named = STAGE_OF_REASON[reason]
  if (named) return named
  return REVIEW_PREFIXES.some((prefix) => reason.startsWith(prefix))
    ? 'reviewing'
    : 'unread'
}

async function readRow(
  dir: string,
  stem: string,
  roster: ReadonlySet<string> | undefined,
  readers: FlightReaders,
): Promise<FlightRow> {
  const file = join(dir, `${stem}.md`)
  const text = existsSync(file) ? await readFile(file, 'utf8') : ''
  const session = cellHolder(readSessions(text)) ?? null
  const live = session && roster ? roster.has(session.sessionId) : null
  const pullRequest = readPullRequest(text).at(-1) ?? null
  const row = { task: stem, session, live, pullRequest }

  if (pullRequest !== null) {
    const reading = await readers.pull(pullRequest)
    return reading === undefined
      ? { ...row, stage: 'unread', reason: null }
      : { ...row, stage: stageOfLift(reading.reason), reason: reading.reason }
  }

  if (session === null) return { ...row, stage: 'unrecorded', reason: null }
  if (live === null) return { ...row, stage: 'unread', reason: null }
  return { ...row, stage: live ? 'building' : 'stopped', reason: null }
}

/**
 * Reads the stage of every `## In flight` row in board order. It writes
 * nothing, so the board never holds a stage that has since moved.
 */
export async function readFlight(
  root: string,
  readers: FlightReaders,
): Promise<FlightOutcome> {
  const dir = tasksDir(root)
  if (!existsSync(dir)) {
    return {
      ok: false,
      reason: 'no-board',
      message: `No task board at ${dir}.`,
    }
  }

  const path = orderingPath(root)
  if (!existsSync(path)) {
    return {
      ok: false,
      reason: 'no-ordering',
      message: `No ordering file at ${path}.`,
    }
  }

  const parse = parseBoard(await readFile(path, 'utf8'))
  if (!parse.ok) {
    return parse.kind === 'doubled'
      ? {
          ok: false,
          reason: 'group-doubled',
          message: `${path} opens one group twice, at ${parse.line}, so its In flight rows cannot be told apart.`,
        }
      : {
          ok: false,
          reason: 'unreadable-row',
          message: `${path} carries a row no board verb can place: ${parse.line}`,
        }
  }

  const stems = parse.board.groups['In flight'].map((row) => row.stem)
  const roster = stems.length > 0 ? await readers.roster() : undefined

  return {
    ok: true,
    rows: await Promise.all(
      stems.map((stem) => readRow(dir, stem, roster, readers)),
    ),
  }
}
