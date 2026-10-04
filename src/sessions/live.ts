import { readFileSync } from 'node:fs'
import type { SessionRecord } from '@/sessions/registry'

/**
 * How far the liveness answer can be trusted.
 *
 * `confirmed` means the running process was matched against the start time the
 * record stamped, so the pid belongs to the session that wrote the file.
 * `unverified` means the pid answers a signal probe and nothing more, which
 * cannot separate the original session from whatever inherited its pid.
 */
export type Confidence = 'confirmed' | 'unverified'

export interface Liveness {
  readonly alive: boolean
  readonly confidence: Confidence
}

export interface LivenessProbes {
  /** The start time of a running process, or null where it cannot be read. */
  readonly procStartOf: (pid: number) => string | null
  /** Whether the pid answers at all, ignoring which process holds it. */
  readonly responds: (pid: number) => boolean
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

export const SYSTEM_PROBES: LivenessProbes = { procStartOf, responds }

/**
 * Decides whether a record describes a session that is still running.
 *
 * The two paths are not interchangeable and the caller is told which one ran.
 * Where the process filesystem answers, a start-time mismatch is a dead session
 * whose pid was reused and the record is discarded. Where it does not, the
 * probe alone stands, and every surviving row is marked so a caller never reads
 * a recycled pid as a confirmed identity.
 *
 * It reads two fields and asks for no more, so a record that is not a session,
 * such as the gate's machine lock, carries the same proof.
 */
export function liveness(
  record: Pick<SessionRecord, 'pid' | 'procStart'>,
  probes: LivenessProbes = SYSTEM_PROBES,
): Liveness {
  const started = record.procStart

  if (started !== undefined && started.length > 0) {
    const running = probes.procStartOf(record.pid)
    if (running !== null) {
      return { alive: running === started, confidence: 'confirmed' }
    }
  }

  return { alive: probes.responds(record.pid), confidence: 'unverified' }
}
