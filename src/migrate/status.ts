import type { RunCommand } from '@/gate/measures'
import { type RetiredCaller, scanRetiredCallers } from '@/migrate/callers'

interface Migration {
  readonly name: string
  readonly flags: readonly string[]
}

/**
 * Every `canon migrate` subcommand in the order a project runs them, records
 * first. This is the source for that order, and `docs/target/migrations.md`
 * cites the verb rather than keeping a second list. A new migration joins by
 * one line here.
 */
export const MIGRATIONS: readonly Migration[] = [
  { name: 'records', flags: [] },
  { name: 'record-tree', flags: [] },
  { name: 'scratch-evidence', flags: [] },
  { name: 'record-layout', flags: [] },
  { name: 'rule-layout', flags: [] },
  { name: 'rename', flags: ['--scope', 'target'] },
  { name: 'skill-names', flags: [] },
  { name: 'surface-roots', flags: [] },
  { name: 'session-defaults', flags: [] },
]

export type MigrationState = 'pending' | 'clean' | 'refused'

export interface MigrationStatus {
  readonly name: string
  readonly verb: string
  readonly state: MigrationState
  /** The subcommand's own `--json` record, carried through unread. */
  readonly record?: unknown
  readonly reason?: string
}

export interface StatusReport {
  readonly migrations: readonly MigrationStatus[]
  readonly pending: number
  readonly refused: number
  /** Project calls to a retired verb. Reported only, since no `--write` fixes one. */
  readonly retiredCallers: readonly RetiredCaller[]
}

function parseRecord(stdout: string): unknown {
  try {
    return JSON.parse(stdout)
  } catch {
    return undefined
  }
}

const FRAME = /^[\s│├┌└]+/

/**
 * A refusing subcommand writes its stderr inside the CLI's frame, so the raw
 * text would carry the glyphs into a record a skill reads as data. The error
 * lines are the reason, and a stderr without a marker keeps every line.
 */
function refusalReason(stderr: string): string {
  const lines = stderr.split('\n').map((line) => line.replace(FRAME, '').trim())
  const errors = lines
    .filter((line) => line.startsWith('✗'))
    .map((line) => line.replace(/^✗\s*/, ''))
  const kept = errors.length > 0 ? errors : lines.filter(Boolean)
  return kept.map((line) => line.replace(/\.+$/, '')).join('. ')
}

async function readOne(
  run: RunCommand,
  migration: Migration,
): Promise<MigrationStatus> {
  // The flags ride in the verb, since a caller appending --write to a bare
  // name would apply a different plan than the one this dry run read.
  const verb = ['canon', 'migrate', migration.name, ...migration.flags].join(
    ' ',
  )
  const result = await run([
    'migrate',
    migration.name,
    ...migration.flags,
    '--json',
  ])

  if (result.exitCode === 0) {
    return { name: migration.name, verb, state: 'clean' }
  }

  if (result.exitCode === 2) {
    return {
      name: migration.name,
      verb,
      state: 'pending',
      record: parseRecord(result.stdout),
    }
  }

  const reason =
    result.spawnError ??
    (refusalReason(result.stderr) ||
      `exited ${result.exitCode} with no message`)
  return {
    name: migration.name,
    verb,
    state: 'refused',
    record: parseRecord(result.stdout),
    reason,
  }
}

/**
 * Runs each migration's own dry run and sorts it by the exit contract every
 * subcommand shares: 0 with nothing to move, 2 with a plan and no `--write`,
 * anything else a refusal. It never passes `--write`, and it reads no count,
 * since the records share no field to count from.
 * A retired caller is listed beside them and never changes the exit, since
 * exit 2 means the pending verbs can be run.
 */
export async function readMigrationStatus(
  run: RunCommand,
  root: string,
): Promise<StatusReport> {
  const [migrations, retiredCallers] = await Promise.all([
    Promise.all(MIGRATIONS.map((migration) => readOne(run, migration))),
    scanRetiredCallers(root),
  ])
  return {
    retiredCallers,
    migrations,
    pending: migrations.filter((m) => m.state === 'pending').length,
    refused: migrations.filter((m) => m.state === 'refused').length,
  }
}

/** A refusal outranks a pending plan, since a refused read measured nothing. */
export function statusExitCode(report: StatusReport): 0 | 1 | 2 {
  if (report.refused > 0) return 1
  return report.pending > 0 ? 2 : 0
}
