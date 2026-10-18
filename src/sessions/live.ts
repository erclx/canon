import { existsSync, readFileSync, readlinkSync } from 'node:fs'
import type { SessionRecord } from '@/sessions/registry'

/**
 * How far the liveness answer can be trusted.
 *
 * `confirmed` means the running process was matched against the start time the
 * record stamped, so the pid belongs to the session that wrote the file.
 * `unverified` means the pid answers a signal probe and nothing more, which
 * cannot separate the original session from whatever inherited its pid, or,
 * for a `foreign` row, that its messaging socket still exists.
 */
export type Confidence = 'confirmed' | 'unverified'

export interface Liveness {
  readonly alive: boolean
  readonly confidence: Confidence
  /**
   * Set only when the record belongs to another pid namespace, so the pid was
   * never probed. Absent rather than false on every other path.
   */
  readonly foreign?: true
}

export interface LivenessProbes {
  /** The start time of a running process, or null where it cannot be read. */
  readonly procStartOf: (pid: number) => string | null
  /** Whether the pid answers at all, ignoring which process holds it. */
  readonly responds: (pid: number) => boolean
  /**
   * The reader's own pid namespace in `pid:[inode]` form, or null where it
   * cannot be read. Optional so a caller with no use for the foreign branch,
   * such as the gate's lock, states nothing and takes the pid path.
   */
  readonly ownDomain?: () => string | null
  /** Whether the messaging socket a foreign record names still exists. */
  readonly socketExists?: (path: string) => boolean
}

/**
 * Reads a running process's start time from the process filesystem.
 *
 * The comm field is parenthesised and may itself contain spaces, so the split
 * runs from the last `)` rather than over the whole line. Fields resume at the
 * third, which puts the twenty-second at offset nineteen.
 */
function procStartOf(pid: number): string | null {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8')
    const tail = stat.slice(stat.lastIndexOf(')') + 1).trim()
    return tail.split(/\s+/)[19] ?? null
  } catch {
    return null
  }
}

/** Signal zero performs the permission and existence checks and delivers nothing. */
function responds(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    // A live process owned by another user answers EPERM, which is an answer.
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/** The link target reads `pid:[inode]`, which a record's `pidDomain` ends with. */
function ownDomain(): string | null {
  try {
    return readlinkSync('/proc/self/ns/pid')
  } catch {
    return null
  }
}

export const SYSTEM_PROBES: LivenessProbes = {
  procStartOf,
  responds,
  ownDomain,
  socketExists: existsSync,
}

/**
 * Decides whether a record describes a session that is still running.
 *
 * The two paths are not interchangeable and the caller is told which one ran.
 * Where the process filesystem answers, a start-time mismatch is a dead session
 * whose pid was reused and the record is discarded. Where it does not, the
 * probe alone stands, and every surviving row is marked so a caller never reads
 * a recycled pid as a confirmed identity.
 *
 * A record from another pid namespace is judged first, on its messaging
 * socket, because its pid names nothing in this namespace and either probe
 * would read an unrelated process or none. That answer is always `unverified`,
 * since a crashed session leaves its socket behind.
 *
 * The pid and start time are the only fields the rest needs, so a record that
 * is not a session, such as the gate's machine lock, carries the same proof and
 * takes the pid path for want of a `pidDomain`.
 */
export function liveness(
  record: Pick<SessionRecord, 'pid' | 'procStart'> &
    Partial<Pick<SessionRecord, 'pidDomain' | 'messagingSocketPath'>>,
  probes: LivenessProbes = SYSTEM_PROBES,
): Liveness {
  const own = probes.ownDomain?.() ?? null
  if (
    own !== null &&
    record.pidDomain !== undefined &&
    !record.pidDomain.endsWith(own)
  ) {
    const socket = record.messagingSocketPath
    const alive =
      socket !== undefined && (probes.socketExists?.(socket) ?? false)
    return { alive, confidence: 'unverified', foreign: true }
  }

  const started = record.procStart

  if (started !== undefined && started.length > 0) {
    const running = probes.procStartOf(record.pid)
    if (running !== null) {
      return { alive: running === started, confidence: 'confirmed' }
    }
  }

  return { alive: probes.responds(record.pid), confidence: 'unverified' }
}
