import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The roots a session record folder is read at, in precedence order.
 *
 * `.canon/` wins because a tree that carries it has been migrated, and reading
 * `.claude/` there would answer from the copy the move left behind. The second
 * spelling is what an unmigrated project still resolves through, so it stays
 * until no target reaches one, which nothing measures.
 *
 * The shape is `readStamp`'s: order the spellings, take the first that exists,
 * and stand the creation default in when none does.
 */
// canon-keep-record-root
export const RECORD_ROOTS = ['.canon', '.claude'] as const

export type RecordRoot = (typeof RECORD_ROOTS)[number]

/**
 * The root a record folder is created at when no root carries it yet.
 *
 * It agrees with the head of the read precedence, which is what the move
 * changed. While the two disagreed, creation stayed at `.claude/` so a record
 * could not land under a root whose ignore line had yet to reach the project.
 * The ignore line ships now, so a fresh project scaffolds one root and an
 * unmigrated one keeps resolving its own through the fallback above.
 */
export const CREATION_ROOT: RecordRoot = '.canon'

/**
 * The deletable scratch folder, named at the spelling `.claude/` gave it.
 *
 * Scratch resolves at `.canon/tmp` only. The `.claude/.tmp` spelling is a
 * migration source, named through `LEGACY_SCRATCH_REL` by the verbs that move
 * it, and no lookup falls back to it. Callers still name the folder at this
 * spelling because `spell` is the only place the variant is decided. Inside a
 * dotted root the leading dot hides nothing already hidden and costs a bare
 * `ls` that omits the folder, so the move dropped it. Every other record
 * folder keeps its name, `.records.git` included, where the dot marks the
 * mechanism apart from a payload rather than hiding it.
 */
export const SCRATCH = '.tmp'

/** The retired scratch location, read only as the source of a migration. */
export const LEGACY_SCRATCH_REL = '.claude/.tmp' // canon-keep-record-root

/** The scratch folder's name under `.canon/`. */
const CANON_SCRATCH = 'tmp'

/**
 * Every entry that lives under the record root, at the name `.claude/` gave it.
 *
 * These are the ignore patterns the move to `.canon/` collapsed into one, plus
 * every record folder since, so the list counts entries, with `.records.git`
 * the backup history and `README.md` a file a records pull writes back.
 * `worktrees` is absent, since the harness requires it under `.claude/`.
 * Everything absent is committed and never lands under the record root, so
 * `rules`, `skills`, and `hooks` stay where the vendor reads them, and
 * `context` and the loose documents resolve under `canon/` through
 * `surface.ts`.
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
 * How a root spells a folder name. Only the scratch folder differs.
 *
 * Exported because the migration verb has to name a folder's destination and
 * deriving it there would state the one naming variant in a second place, where
 * a tree half-moved by one rule and read by the other resolves nothing.
 */
export function spell(root: RecordRoot, folder: string): string {
  return root === '.canon' && folder === SCRATCH ? CANON_SCRATCH : folder
}

/**
 * The root a folder resolves at: the first that carries it, and the creation
 * default when neither does.
 *
 * Presence is read on the record folder itself rather than on the full path, so
 * an archive or a payload that does not exist yet still resolves beside the
 * records it belongs to rather than at the creation default.
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
 * Where a record folder is read.
 *
 * `folder` is the record folder itself and `rest` is whatever sits inside it,
 * so a caller spells no root and no folder-name variant of its own. A caller
 * that spells `.claude` by hand is the one thing the move has to find, and one
 * that calls this is one the move never has to open again.
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
 * Every root a record folder would be read at, in precedence order, whether or
 * not it is on disk.
 *
 * Containment tests take this rather than `recordDir`, since a path written
 * against the root a tree no longer uses is still a path into that folder and
 * reading it as outside would report a shipped plan as still live.
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
 * The creation destination relative to the project root, which is the form a
 * message displays and an option default carries.
 *
 * It resolves the root the way a read does rather than pinning the creation
 * default, since pinning would write a new record to `.canon/` in a project
 * whose board is still `.claude/`, splitting its records across two roots. The
 * root is a parameter, since two callers join the result onto a target root.
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
 * The record root itself, for a caller whose subject is the root rather than a
 * folder inside it.
 *
 * A half-migrated tree resolves on the root that exists, so a push never reads
 * history at one root and stages a work tree at the other. A root counts when
 * it holds a `.records.git` or a record folder, since `.claude/` exists in
 * every installed project. `README.md` and the scratch folder are left out,
 * since a records pull writes the first back and the second is deletable.
 */
export function recordRoot(root: string): string {
  return join(
    root,
    RECORD_ROOTS.find((candidate) => holdsRecords(root, candidate)) ??
      CREATION_ROOT,
  )
}
