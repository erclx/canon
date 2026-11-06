import { execa } from 'execa'
import { gitEnv } from '@/git/env'
import {
  repositoryOf,
  resolveSessions,
  type SessionReport,
} from '@/sessions/resolve'

/**
 * Bounds the one network read `canon tasks validate --live` takes, shorter than
 * the archive's own, since the sweep waits on it and a slow answer reads the
 * same as no answer.
 */
const GH_TIMEOUT_MS = 5_000

/** `gh pr list` caps at 30 by default, and a truncated list would read as clean. */
const PULL_LIMIT = 1_000

/**
 * Who holds each branch, named for a person reading the report. `undefined`
 * means the source could not be read, which has to stay apart from an empty map:
 * an unreachable source that degraded to "nobody holds it" would report a held
 * row as clean.
 */
export type HolderReader = () => Promise<
  ReadonlyMap<string, string> | undefined
>

/** Whether a merged pull request names a branch, `undefined` when GitHub could not say. */
export type MergedReader = (branch: string) => Promise<boolean | undefined>

export interface LiveReaders {
  readonly sessions: HolderReader
  readonly pulls: HolderReader
  readonly merged: MergedReader
}

export interface SessionHolderOptions {
  readonly resolve?: () => Promise<SessionReport>
  readonly repository?: (root: string) => Promise<string | null>
}

/**
 * Reads the roster scoped to `root`'s repository, since a branch name says
 * nothing across a machine and another project's worker on the same name holds
 * nothing here. Two rows leave the liveness undecided, a foreign record whose
 * socket is gone and a row resting only on a socket file a crash can leave, so
 * either reads the whole roster as unread rather than as a hold or as clear.
 */
export function sessionHolders(
  root: string,
  opts: SessionHolderOptions = {},
): HolderReader {
  const resolve = opts.resolve ?? resolveSessions
  const repository = opts.repository ?? repositoryOf

  return async () => {
    try {
      const [report, repo] = await Promise.all([resolve(), repository(root)])
      if (
        report.kind !== 'resolved' ||
        report.foreignDead > 0 ||
        report.sessions.some((session) => session.via === 'socket') ||
        !repo
      ) {
        return undefined
      }

      return new Map(
        report.sessions.flatMap((session) =>
          session.repository === repo && session.branch
            ? [[session.branch, `session ${session.name}`] as const]
            : [],
        ),
      )
    } catch {
      return undefined
    }
  }
}

export type GhRunner = (
  cwd: string,
  args: readonly string[],
) => Promise<string | undefined>

const runGh: GhRunner = async (cwd, args) => {
  if (Bun.which('gh') === null) return undefined

  try {
    // `gh` resolves its repository through git, so a hook's resolution
    // variables would point it at another repository than `cwd`.
    const result = await execa('gh', [...args], {
      cwd,
      timeout: GH_TIMEOUT_MS,
      env: gitEnv(),
      extendEnv: false,
    })
    return result.stdout
  } catch {
    return undefined
  }
}

interface ListedPull {
  readonly number: number
  readonly headRefName: string
  readonly isCrossRepository: boolean
}

function isListedPull(value: unknown): value is ListedPull {
  if (typeof value !== 'object' || value === null) return false
  const pull = value as Record<string, unknown>

  return (
    typeof pull.number === 'number' &&
    typeof pull.headRefName === 'string' &&
    typeof pull.isCrossRepository === 'boolean'
  )
}

function parsePulls(stdout: string): readonly ListedPull[] | undefined {
  try {
    const parsed: unknown = JSON.parse(stdout)
    return Array.isArray(parsed) && parsed.every(isListedPull)
      ? parsed
      : undefined
  } catch {
    return undefined
  }
}

/**
 * Reads open pull requests off GitHub. A list reaching the limit may have cut
 * off the one that holds a row, so it reads as unread. A fork's head names a
 * branch in another repository, which holds nothing here however it is spelled.
 */
export function pullHolders(root: string, run: GhRunner = runGh): HolderReader {
  return async () => {
    const stdout = await run(root, [
      'pr',
      'list',
      '--state',
      'open',
      '--limit',
      String(PULL_LIMIT),
      '--json',
      'number,headRefName,isCrossRepository',
    ])
    if (stdout === undefined) return undefined

    const pulls = parsePulls(stdout)
    if (!pulls || pulls.length >= PULL_LIMIT) return undefined

    return new Map(
      pulls
        .filter((pull) => !pull.isCrossRepository)
        .map((pull) => [pull.headRefName, `pull request #${pull.number}`]),
    )
  }
}

/**
 * Asks about one branch at a time rather than listing merged pull requests,
 * since a list long enough to reach an old merge costs every run, and only a
 * branch a session already holds against a row takes this read.
 */
export function mergedBranches(
  root: string,
  run: GhRunner = runGh,
): MergedReader {
  return async (branch) => {
    const stdout = await run(root, [
      'pr',
      'list',
      '--state',
      'merged',
      '--head',
      branch,
      '--limit',
      String(PULL_LIMIT),
      '--json',
      'number,headRefName,isCrossRepository',
    ])
    if (stdout === undefined) return undefined

    const pulls = parsePulls(stdout)
    return pulls?.some((pull) => !pull.isCrossRepository)
  }
}

export function liveReaders(root: string): LiveReaders {
  return {
    sessions: sessionHolders(root),
    pulls: pullHolders(root),
    merged: mergedBranches(root),
  }
}
