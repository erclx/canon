import { basename } from 'node:path'
import { $ } from 'bun'
import { gitEnv } from '@/git/env'
import {
  type Confidence,
  liveness,
  type LivenessProbes,
  SYSTEM_PROBES,
} from '@/sessions/live'
import { readRegistry, type SessionRecord } from '@/sessions/registry'

/** Why a row carries no branch, stated rather than left as an absent key. */
export type Unresolved =
  | 'not-a-repository'
  | 'detached-head'
  | 'git-unavailable'

export interface ResolvedSession {
  readonly name: string
  readonly pid: number
  readonly sessionId: string | null
  readonly cwd: string
  readonly kind: string
  readonly status: string
  readonly startedAt: string | null
  /**
   * The stamp the record carries beside `status`, kept alongside the dwell it
   * computes below for a caller comparing two sessions rather than reading the
   * age of one.
   */
  readonly statusUpdatedAt: string | null
  /**
   * Elapsed milliseconds since `statusUpdatedAt`, falling back to the coarser
   * `updatedAt` when the record predates the narrower field, computed once at
   * read time so three callers do not each convert the raw stamp and each get
   * the clock-skew case wrong. The one record ever measured carrying
   * `status: "waiting"` has exactly this shape: no `statusUpdatedAt`, an
   * `updatedAt` beside it, so a caller reading this field alone would report
   * the single real instance as unmeasured rather than as stalled.
   * Clamped at zero rather than reported negative: a record stamped
   * by a clock running ahead of this one is a skew to absorb, not a session
   * that has not started waiting yet.
   */
  readonly statusDwellMs: number | null
  /**
   * The shared git directory every worktree of one repository resolves to,
   * which is what identifies the repository a row belongs to. A branch name is
   * unique inside one and says nothing across a machine.
   */
  readonly repository: string | null
  readonly worktree: string | null
  readonly branch: string | null
  /** Null exactly when `branch` is set. The two are written together. */
  readonly unresolved: Unresolved | null
}

export type SessionReport =
  | { readonly kind: 'absent'; readonly dir: string }
  | {
      readonly kind: 'resolved'
      readonly dir: string
      /**
       * The weakest confidence any surviving row was decided at, so one read
       * tells a caller whether the roster can be trusted as an identity.
       */
      readonly confidence: Confidence
      readonly sessions: readonly ResolvedSession[]
    }

export interface ResolveOptions {
  readonly dir?: string
  readonly probes?: LivenessProbes
  readonly locate?: (cwd: string) => Promise<Located>
  /** The instant the dwell is computed against. Defaults to `Date.now`. */
  readonly now?: () => number
}

export interface Located {
  readonly repository: string | null
  readonly worktree: string | null
  readonly branch: string | null
  readonly unresolved: Unresolved | null
}

/**
 * Asks git what a directory is checked out to.
 *
 * A detached HEAD and a directory outside any repository are separated here
 * rather than collapsed into one empty answer, because the first is a session
 * that has a worktree and no branch and the second has neither.
 */
async function locate(cwd: string): Promise<Located> {
  const top = await $`git -C ${cwd} rev-parse --show-toplevel`
    .env(gitEnv())
    .quiet()
    .nothrow()

  if (top.exitCode !== 0) {
    // git absent and git refusing the directory are both non-zero here. The
    // first is the platform report the plan asked for and the second is an
    // ordinary answer, so the distinguishing read is whether git ran at all.
    const version = await $`git --version`.quiet().nothrow()
    return {
      repository: null,
      worktree: null,
      branch: null,
      unresolved:
        version.exitCode === 0 ? 'not-a-repository' : 'git-unavailable',
    }
  }

  const worktree = top.stdout.toString().trim()
  const repository = await repositoryOf(cwd)
  const head = await $`git -C ${cwd} branch --show-current`
    .env(gitEnv())
    .quiet()
    .nothrow()
  const branch = head.stdout.toString().trim()

  if (head.exitCode !== 0 || branch.length === 0) {
    return { repository, worktree, branch: null, unresolved: 'detached-head' }
  }

  return { repository, worktree, branch, unresolved: null }
}

/**
 * Resolves the shared git directory a working directory belongs to.
 *
 * The common directory is what a linked worktree and its main checkout agree
 * on, so two rows in one repository match here while the toplevel would place
 * every worktree in a repository of its own.
 */
export async function repositoryOf(cwd: string): Promise<string | null> {
  const dir =
    await $`git -C ${cwd} rev-parse --path-format=absolute --git-common-dir`
      .env(gitEnv())
      .quiet()
      .nothrow()

  if (dir.exitCode !== 0) return null

  const resolved = dir.stdout.toString().trim()
  return resolved.length > 0 ? resolved : null
}

/**
 * Falls back to `updatedAt` when `statusUpdatedAt` is absent, since the
 * narrower field is the newer of the two and a record predating it still
 * carries the coarser one. The one record measured with `status: "waiting"`
 * takes exactly this path: no `statusUpdatedAt`, an `updatedAt` beside it.
 */
function dwellMs(record: SessionRecord, now: number): number | null {
  const stamp = record.statusUpdatedAt ?? record.updatedAt
  return stamp === undefined ? null : Math.max(0, now - stamp)
}

/**
 * An absent field is rendered as an absence rather than as a value.
 *
 * A missing start time formatted from zero reads as a session launched in 1970
 * and a missing identifier as an empty one, both of which a caller would take
 * for data. Null says the record did not carry it, which is the same
 * distinction the registry draws between an absent folder and an empty one.
 */
function present(
  record: SessionRecord,
  located: Located,
  now: number,
): ResolvedSession {
  return {
    name: record.name,
    pid: record.pid,
    sessionId: record.sessionId ?? null,
    cwd: record.cwd,
    kind: record.kind ?? 'unknown',
    status: record.status ?? 'unknown',
    startedAt:
      record.startedAt === undefined
        ? null
        : new Date(record.startedAt).toISOString(),
    statusUpdatedAt:
      record.statusUpdatedAt === undefined
        ? null
        : new Date(record.statusUpdatedAt).toISOString(),
    statusDwellMs: dwellMs(record, now),
    repository: located.repository,
    worktree: located.worktree,
    branch: located.branch,
    unresolved: located.unresolved,
  }
}

/**
 * Resolves every live session to the worktree and branch it holds.
 *
 * The registry is the whole source. Each session writes its own working
 * directory beside its own name, so a caller matching a listing row to a branch
 * reads both from one record instead of ordering the roster by start time and
 * hoping the order holds.
 *
 * A row whose branch cannot be read is kept and marked. Dropping it would leave
 * a caller unable to tell a session that holds no branch from one the resolver
 * never saw, and the second is the failure this replaces.
 */
export async function resolveSessions(
  opts: ResolveOptions = {},
): Promise<SessionReport> {
  const probes = opts.probes ?? SYSTEM_PROBES
  const find = opts.locate ?? locate
  const now = opts.now?.() ?? Date.now()
  const registry = readRegistry(opts.dir)

  if (registry.kind === 'absent') return { kind: 'absent', dir: registry.dir }

  const live: SessionRecord[] = []
  let confidence: Confidence = 'confirmed'

  for (const record of registry.records) {
    const state = liveness(record, probes)
    if (!state.alive) continue
    if (state.confidence === 'unverified') confidence = 'unverified'
    live.push(record)
  }

  const sessions = await Promise.all(
    live.map(async (record) => present(record, await find(record.cwd), now)),
  )

  return { kind: 'resolved', dir: registry.dir, confidence, sessions }
}

/** The environment slice the caller's own identity is read from. */
export type Env = Record<string, string | undefined>

/** Why the caller's own row could not be named, rather than an empty result. */
export type SelfUnresolved = 'no-identity' | 'no-row'

/**
 * What the environment offers about the session making the call.
 *
 * Both fields are candidates rather than a pair, since a client sets them
 * independently and a caller can arrive carrying either one alone.
 */
export interface SelfIdentity {
  readonly sessionId: string | null
  readonly pid: number | null
}

export type SelfReport =
  | { readonly kind: 'self'; readonly session: ResolvedSession }
  | {
      readonly kind: 'unresolved'
      readonly reason: SelfUnresolved
      readonly identity: SelfIdentity
    }

/**
 * A positive integer, which is what separates a pid from a socket named for
 * something else. Signal zero addresses the caller's own process group, so a
 * zero would match a row rather than failing to.
 */
function pidOf(value: string | undefined): number | null {
  if (value === undefined) return null
  const pid = Number(value.trim())
  return Number.isInteger(pid) && pid > 0 ? pid : null
}

/**
 * Reads whatever the environment states about the calling session.
 *
 * Three identifier namespaces are in play and only two of them join to a
 * roster row. `CLAUDE_CODE_SESSION_ID` is the roster's own `sessionId` and is
 * read first because it survives a rename, where the name a session carries is
 * derived from what it turned out to be doing and rotates while a build runs.
 * `CLAUDE_CODE_HOST_SESSION_ID` is deliberately never read: it holds a
 * `local_`-prefixed value from the harness namespace that matches no row, and
 * it is the variable a reader searching the environment for a session id finds
 * first.
 *
 * The socket path is the last rung because its basename is the caller's pid by
 * a client convention rather than a published interface, so a client that
 * moves it drops this rung while leaving the two above it standing.
 */
export function callerIdentity(env: Env = process.env): SelfIdentity {
  const stated = env.CLAUDE_CODE_SESSION_ID?.trim()
  const socket = env.CLAUDE_CODE_MESSAGING_SOCKET

  return {
    sessionId: stated !== undefined && stated.length > 0 ? stated : null,
    pid:
      pidOf(env.CLAUDE_PID) ??
      pidOf(
        socket === undefined
          ? undefined
          : basename(socket).replace(/\.sock$/, ''),
      ),
  }
}

/**
 * Names which row of a roster belongs to the caller.
 *
 * The read that already returns every field marks none of them as the caller,
 * so this performs the join rather than adding a source. An identity the
 * environment does not carry and an identity no row matches are separated,
 * because the first is a client that states nothing and the second is a
 * session the roster cannot see. A session driving from Remote Control is the
 * measured instance of the second: it is addressable on the message channel
 * and holds no local process record for the roster to report.
 */
export function selfOf(
  sessions: readonly ResolvedSession[],
  identity: SelfIdentity,
): SelfReport {
  if (identity.sessionId === null && identity.pid === null) {
    return { kind: 'unresolved', reason: 'no-identity', identity }
  }

  const byId =
    identity.sessionId === null
      ? undefined
      : sessions.find((session) => session.sessionId === identity.sessionId)
  const byPid =
    identity.pid === null
      ? undefined
      : sessions.find((session) => session.pid === identity.pid)
  const match = byId ?? byPid

  return match === undefined
    ? { kind: 'unresolved', reason: 'no-row', identity }
    : { kind: 'self', session: match }
}
