import { existsSync, readFileSync, readlinkSync } from 'node:fs'
import { createConnection } from 'node:net'
import type { SessionRecord } from '@/sessions/registry'

/**
 * How far the liveness answer can be trusted. `confirmed` means the process was
 * matched against the start time the record stamped. `unverified` means the pid
 * answers a probe only, or for a `foreign` row that its socket still exists.
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
  /**
   * Whether something accepts a connection on the socket within the timeout.
   * Async, so `liveness()` never calls it and a caller with no use for it, such
   * as the gate's lock, states nothing.
   */
  readonly listens?: (path: string, timeoutMs: number) => Promise<boolean>
}

/**
 * Reads a running process's start time from the process filesystem. The comm
 * field is parenthesised and may hold spaces, so the split runs from the last
 * `)`, and fields resume at the third, putting the twenty-second at offset nineteen.
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

/**
 * Connects and closes without writing, so the peer sees no bytes. The socket is
 * destroyed on connect rather than waited on, since a listener that accepts and
 * never closes would otherwise hold the probe open past its timeout.
 */
function listens(path: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection(path)
    const settle = (accepted: boolean): void => {
      socket.destroy()
      resolve(accepted)
    }
    socket.setTimeout(timeoutMs, () => settle(false))
    socket.once('connect', () => settle(true))
    socket.once('error', () => settle(false))
  })
}

export const SYSTEM_PROBES: LivenessProbes = {
  procStartOf,
  responds,
  ownDomain,
  socketExists: existsSync,
  listens,
}

/**
 * Decides whether a record describes a session still running. Where the process
 * filesystem answers, a start-time mismatch is a reused pid and is discarded;
 * otherwise the probe stands, `unverified`. A foreign-namespace record is judged on its socket.
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
