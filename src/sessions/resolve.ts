import { basename, join } from 'node:path'
import { $ } from 'bun'
import { gitEnv } from '@/git/env'
import { lastBoot, machineId } from '@/sessions/boot'
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
  /**
   * What decided the row was live. `pid` is a start time matched or a pid that
   * answered, `socket` means another pid namespace where only a socket file
   * existed, possibly a crash's leftover, and `listener` means the socket accepted.
   */
  readonly via: 'pid' | 'socket' | 'listener'
  /**
   * How this row alone was decided, so a caller scoping the roster derives its
   * confidence over the rows it keeps rather than over the whole machine.
   */
  readonly confidence: Confidence
  readonly startedAt: string | null
  /**
   * The stamp the record carries beside `status`, kept alongside the dwell it
   * computes below for a caller comparing two sessions rather than reading the
   * age of one.
   */
  readonly statusUpdatedAt: string | null
  /**
   * Elapsed milliseconds since `statusUpdatedAt`, falling back to the coarser
   * `updatedAt` when the record predates it, computed once so no caller gets the
   * clock skew wrong. Clamped at zero, since a record from a clock ahead is skew.
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

/**
 * A foreign-namespace record whose socket is gone, named so a caller can scope
 * its doubt to the records that could matter and tell an operator which file to
 * look at. `path` assumes the client's `<pid>.json` naming, the one it writes.
 */
export interface ForeignRecord {
  readonly sessionId: string | null
  readonly pid: number
  readonly cwd: string
  readonly path: string
  readonly startedAt: string | null
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
      /**
       * Foreign records with no socket, less those in `foreignPreBoot`. Their pid
       * could not be checked, so an empty roster beside a count above zero is a
       * roster that could not be checked rather than one that ended.
       */
      readonly foreignDead: number
      /**
       * Each record `foreignDead` counts. Optional so a report built by hand
       * still types, and a caller reads its absence as every record unplaced.
       */
      readonly foreign?: readonly ForeignRecord[]
      /**
       * Foreign records from this machine whose every stamp predates its boot,
       * ended since no process outlives a reboot. Optional as `foreign` is, and
       * a caller reads its absence as none set aside.
       */
      readonly foreignPreBoot?: readonly ForeignRecord[]
      readonly sessions: readonly ResolvedSession[]
    }

/**
 * The weakest confidence among the rows, so one read tells a caller whether
 * every row it holds is an identity. A caller scoping the roster calls this on
 * the rows it keeps, since one unrelated row it dropped must not weaken it.
 */
export function confidenceOf(
  sessions: readonly Pick<ResolvedSession, 'confidence'>[],
): Confidence {
  return sessions.every((session) => session.confidence === 'confirmed')
    ? 'confirmed'
    : 'unverified'
}

/** A live socket here accepted in 2 ms, and every probe runs in parallel. */
const LISTEN_TIMEOUT_MS = 250

export interface ResolveOptions {
  readonly dir?: string
  readonly probes?: LivenessProbes
  readonly locate?: (cwd: string) => Promise<Located>
  /** The instant the dwell is computed against. Defaults to `Date.now`. */
  readonly now?: () => number
  /** Undefined keeps every foreign record counted. Defaults to `lastBoot`. */
  readonly bootTime?: () => number | undefined
  /** Undefined keeps every foreign record counted. Defaults to `machineId`. */
  readonly machineId?: () => string | undefined
}

export interface Located {
  readonly repository: string | null
  readonly worktree: string | null
  readonly branch: string | null
  readonly unresolved: Unresolved | null
}

/**
 * Asks git what a directory is checked out to. A detached HEAD and a directory
 * outside any repository are separated rather than collapsed, since the first
 * has a worktree and no branch and the second has neither.
 */
async function locate(cwd: string): Promise<Located> {
  const top = await $`git -C ${cwd} rev-parse --show-toplevel`
    .env(gitEnv())
    .quiet()
    .nothrow()

  if (top.exitCode !== 0) {
    // Git absent and git refusing the directory both exit non-zero, so test whether git ran at all.
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
 * Resolves the shared git directory a working directory belongs to. The common
 * directory is what a linked worktree and its main checkout agree on, while the
 * toplevel would place every worktree in a repository of its own.
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
 * Falls back to `updatedAt` when `statusUpdatedAt` is absent, since the narrower
 * field is the newer and a record predating it carries the coarser one, as the
 * one record measured with `status: "waiting"` does.
 */
function dwellMs(record: SessionRecord, now: number): number | null {
  const stamp = record.statusUpdatedAt ?? record.updatedAt
  return stamp === undefined ? null : Math.max(0, now - stamp)
}

/**
 * An absent field is rendered as an absence rather than as a value, since a
 * missing start time formatted from zero reads as launched in 1970. Null says
 * the record did not carry it, as the registry's absent-versus-empty folder does.
 */
function present(
  record: SessionRecord,
  located: Located,
  now: number,
  via: ResolvedSession['via'],
  confidence: Confidence,
): ResolvedSession {
  return {
    name: record.name,
    pid: record.pid,
    sessionId: record.sessionId ?? null,
    cwd: record.cwd,
    kind: record.kind ?? 'unknown',
    status: record.status ?? 'unknown',
    via,
    confidence,
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
 * Resolves every live session to the worktree and branch it holds. The registry
 * is the whole source, each session writing its working directory beside its
 * name. A row whose branch cannot be read is kept and marked, never dropped.
 */
export async function resolveSessions(
  opts: ResolveOptions = {},
): Promise<SessionReport> {
  const probes = opts.probes ?? SYSTEM_PROBES
  const find = opts.locate ?? locate
  const now = opts.now?.() ?? Date.now()
  const registry = readRegistry(opts.dir)

  if (registry.kind === 'absent') return { kind: 'absent', dir: registry.dir }

  const live: {
    record: SessionRecord
    via: ResolvedSession['via']
    confidence: Confidence
  }[] = []
  const unanswered: SessionRecord[] = []

  for (const record of registry.records) {
    const state = liveness(record, probes)
    if (!state.alive) {
      if (state.foreign) unanswered.push(record)
      continue
    }
    live.push({
      record,
      via: state.foreign ? 'socket' : 'pid',
      confidence: state.confidence,
    })
  }

  // Only a row the start time left unverified is probed, since an accept proves the session runs.
  const upgraded = await Promise.all(
    live.map(async (row) => {
      const socket = row.record.messagingSocketPath
      if (
        row.confidence === 'confirmed' ||
        socket === undefined ||
        probes.listens === undefined
      ) {
        return row
      }
      const accepted = await probes.listens(socket, LISTEN_TIMEOUT_MS)
      return accepted
        ? { ...row, via: 'listener' as const, confidence: 'confirmed' as const }
        : row
    }),
  )

  const sessions = await Promise.all(
    upgraded.map(async ({ record, via, confidence }) =>
      present(record, await find(record.cwd), now, via, confidence),
    ),
  )

  const boot = (opts.bootTime ?? lastBoot)()
  const machine = (opts.machineId ?? machineId)()
  const foreign: ForeignRecord[] = []
  const foreignPreBoot: ForeignRecord[] = []
  for (const record of unanswered) {
    const list = predates(record, boot, machine) ? foreignPreBoot : foreign
    list.push(foreignOf(record, registry.dir))
  }

  return {
    kind: 'resolved',
    dir: registry.dir,
    confidence: confidenceOf(sessions),
    foreignDead: foreign.length,
    foreign,
    foreignPreBoot,
    sessions,
  }
}

/**
 * Another kernel's boot says nothing about this record, so it must carry this
 * machine's identifier. A stamp at or after the boot is a write by a live
 * session, so it disproves a boot time that a clock step moved.
 */
function predates(
  record: SessionRecord,
  boot: number | undefined,
  machine: string | undefined,
): boolean {
  if (boot === undefined || machine === undefined) return false
  if (!record.pidDomain?.startsWith(`linux:${machine}:`)) return false
  if (!isStamp(record.startedAt)) return false
  return [record.startedAt, record.updatedAt, record.statusUpdatedAt]
    .filter(isStamp)
    .every((stamp) => stamp < boot)
}

/** The registry checks no type on a stamp, and a null or zero compares as 1970. */
function isStamp(value: unknown): value is number {
  return typeof value === 'number' && value > 0
}

function foreignOf(record: SessionRecord, dir: string): ForeignRecord {
  return {
    sessionId: record.sessionId ?? null,
    pid: record.pid,
    cwd: record.cwd,
    path: join(dir, `${record.pid}.json`),
    startedAt:
      record.startedAt === undefined
        ? null
        : new Date(record.startedAt).toISOString(),
  }
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
 * `CLAUDE_CODE_SESSION_ID` is the roster's own `sessionId` and survives a rename,
 * so it comes first. `CLAUDE_CODE_HOST_SESSION_ID` matches no row and is never read.
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
 * Names which row of a roster belongs to the caller, by a join rather than a new
 * source. An identity the environment lacks and one no row matches are separate:
 * a Remote Control session is addressable on the message channel with no local record.
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
