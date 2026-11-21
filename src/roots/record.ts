import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The roots a session record folder is read at, in precedence order. `.canon/` wins because a tree
 * carrying it has been migrated, and `.claude/` is what an unmigrated project resolves through.
 */
// canon-keep-record-root
export const RECORD_ROOTS = ['.canon', '.claude'] as const

export type RecordRoot = (typeof RECORD_ROOTS)[number]

/**
 * The root a record folder is created at when no root carries it yet, which agrees with the
 * head of the read precedence. An unmigrated project keeps resolving its own through the fallback.
 */
export const CREATION_ROOT: RecordRoot = '.canon'

/**
 * The deletable scratch folder, named at the spelling `.claude/` gave it. Scratch resolves at
 * `.canon/tmp` only, and `.claude/.tmp` is a migration source named through `LEGACY_SCRATCH_REL`.
 */
export const SCRATCH = '.tmp'

/** The retired scratch location, read only as the source of a migration. */
export const LEGACY_SCRATCH_REL = '.claude/.tmp' // canon-keep-record-root

/** The scratch folder's name under `.canon/`. */
const CANON_SCRATCH = 'tmp'

/**
 * Every entry that lives under the record root, at the name `.claude/` gave it. `worktrees` is
 * absent since the harness requires it under `.claude/`, and so is everything committed:
 * `rules`, `skills`, `hooks`, and `context`, which resolves under `canon/` through `surface.ts`.
 */
export const RECORD_ENTRIES: readonly string[] = [
  '.records.git',
  SCRATCH,
  'README.md',
  'canvas',
  'diagrams',
  'evidence',
  'feedback',
  'groundwork',
  'intake',
  'memory',
  'picks',
  'plans',
  'proposals',
  'ready',
  'review',
  'slides',
  'tasks',
  'teach',
  'transcripts',
  'upstream',
  'walkthroughs',
]

/** Whether a name under `.claude/` is one the record root owns. */
export function isRecordEntry(name: string): boolean {
  return RECORD_ENTRIES.includes(name)
}

/**
 * How a root spells a folder name. Only the scratch folder differs, and exporting this keeps
 * the migration verb from stating the one naming variant in a second place.
 */
export function spell(root: RecordRoot, folder: string): string {
  return root === '.canon' && folder === SCRATCH ? CANON_SCRATCH : folder
}

/**
 * The root a folder resolves at: the first that carries it, and the creation default when
 * neither does. Presence is read on the record folder itself rather than the full path.
 */
function rootOf(root: string, folder: string): RecordRoot {
  if (folder === SCRATCH) return CREATION_ROOT

  return (
    RECORD_ROOTS.find((candidate) =>
      existsSync(join(root, candidate, spell(candidate, folder))),
    ) ?? CREATION_ROOT
  )
}

/**
 * Where a record folder is read. `folder` is the record folder itself and `rest` is whatever
 * sits inside it, so a caller spells no root and no folder-name variant of its own.
 */
export function recordDir(
  root: string,
  folder: string,
  ...rest: string[]
): string {
  const at = rootOf(root, folder)

  return join(root, at, spell(at, folder), ...rest)
}

/**
 * Every root a record folder would be read at, in precedence order, whether or not it is on disk.
 * Containment tests take this rather than `recordDir`, since a path under a root the tree no
 * longer uses is still a path into that folder.
 */
export function recordDirs(
  root: string,
  folder: string,
  ...rest: string[]
): string[] {
  const candidates = folder === SCRATCH ? [CREATION_ROOT] : RECORD_ROOTS

  return candidates.map((candidate) =>
    join(root, candidate, spell(candidate, folder), ...rest),
  )
}

/**
 * The creation destination relative to the project root, the form a message displays.
 * It resolves the root the way a read does, since pinning the creation default would split a
 * `.claude/` project's records across two roots.
 */
export function creationRel(
  root: string,
  folder: string,
  ...rest: string[]
): string {
  const at = rootOf(root, folder)

  return join(at, spell(at, folder), ...rest)
}

/** Whether a root holds the backup history or a record folder, at its spelling. */
function holdsRecords(root: string, candidate: RecordRoot): boolean {
  return RECORD_ENTRIES.some(
    (entry) =>
      entry !== 'README.md' &&
      entry !== SCRATCH &&
      existsSync(join(root, candidate, spell(candidate, entry))),
  )
}

/**
 * The record root itself, for a caller whose subject is the root rather than a folder inside it.
 * A root counts when it holds a `.records.git` or a record folder, since `.claude/` exists in
 * every installed project, and `README.md` and the scratch folder are left out.
 */
export function recordRoot(root: string): string {
  return join(
    root,
    RECORD_ROOTS.find((candidate) => holdsRecords(root, candidate)) ??
      CREATION_ROOT,
  )
}
