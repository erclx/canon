import { readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * One session's own record of itself, as the client writes it. Only the fields
 * this domain reads are declared, since naming the rest would put a second copy
 * of the client's schema in a repository that does not own it.
 */
export interface SessionRecord {
  readonly pid: number
  readonly cwd: string
  readonly name: string
  /**
   * Optional because the guard admitting a record checks the three fields above
   * and no more. A client predating any of these writes a record the roster
   * still wants, so the type says what the guard actually proved.
   */
  readonly sessionId: string | undefined
  readonly kind: string | undefined
  readonly status: string | undefined
  /**
   * The epoch millisecond the client last changed `status`, carried by 23 of 341
   * usable records measured, so its absence tracks a client version. Declared
   * here, since an undeclared field read anyway is the drift this domain follows.
   */
  readonly statusUpdatedAt: number | undefined
  /**
   * The epoch millisecond the client last wrote the record at all, a coarser
   * stamp than `statusUpdatedAt`, declared as the fallback dwell source for a
   * record predating the narrower field.
   */
  readonly updatedAt: number | undefined
  readonly startedAt: number | undefined
  /**
   * The process start time the client stamped at launch, compared against the
   * running process to separate a live session from a record whose pid has
   * been handed to something else.
   */
  readonly procStart: string | undefined
  /**
   * The pid namespace the client stamped, ending in the `pid:[inode]` form that
   * `/proc/self/ns/pid` reads as. A reader in another namespace cannot see the
   * record's pid, so this is what tells a foreign row from a dead one.
   */
  readonly pidDomain: string | undefined
  /**
   * The socket the session listens on for messages. It is the only evidence of
   * life a foreign-namespace reader can reach, since the pid is out of sight.
   */
  readonly messagingSocketPath: string | undefined
}

/**
 * Resolves the client's configuration directory, which holds both the session
 * registry and the projects folder a transcript lives in. `CLAUDE_CONFIG_DIR`
 * comes first, since a read ignoring it would report an empty roster.
 */
export function claudeConfigDir(): string {
  const configured = process.env.CLAUDE_CONFIG_DIR
  return configured && configured.length > 0
    ? configured
    : join(homedir(), '.claude')
}

/** Resolves the folder holding one file per session. */
export function registryDir(): string {
  return join(claudeConfigDir(), 'sessions')
}

/**
 * Fields whose absence leaves a row unable to answer the question asked of it.
 * The pid has to be positive, since signal zero addresses the caller's own
 * process group and a zero record would enter the roster as a live session.
 */
function isUsable(value: Partial<SessionRecord>): value is SessionRecord {
  return (
    typeof value.pid === 'number' &&
    Number.isInteger(value.pid) &&
    value.pid > 0 &&
    typeof value.cwd === 'string' &&
    value.cwd.length > 0 &&
    typeof value.name === 'string' &&
    value.name.length > 0
  )
}

/**
 * An absent folder and an empty one are separate answers. The first means no
 * client ever wrote a record here, so a roster of none would report no sessions
 * when a lookup failed, and the second is a machine whose sessions all ended.
 */
export type Registry =
  | { readonly kind: 'absent'; readonly dir: string }
  | {
      readonly kind: 'read'
      readonly dir: string
      readonly records: SessionRecord[]
    }

/**
 * Reads every session record in the folder, newest first. A file that does not
 * parse or lacks the fields a row is built from is dropped rather than reported,
 * since the unpruned folder holds thousands of stale shapes that would bury live sessions.
 */
export function readRegistry(dir: string = registryDir()): Registry {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return { kind: 'absent', dir }
  }

  const records: SessionRecord[] = []

  for (const name of names) {
    if (!name.endsWith('.json')) continue

    try {
      const parsed: unknown = JSON.parse(readFileSync(join(dir, name), 'utf8'))
      if (typeof parsed !== 'object' || parsed === null) continue
      const record = parsed as Partial<SessionRecord>
      if (isUsable(record)) records.push(record)
    } catch {
      // Unreadable or malformed. See the note above.
    }
  }

  return {
    kind: 'read',
    dir,
    records: records.sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0)),
  }
}
