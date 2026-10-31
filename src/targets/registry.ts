import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

/**
 * One project the toolkit has installed into, as the install recorded it.
 *
 * The path is the target root rather than its git directory, because the
 * record is written by a sync that knows where it wrote and not by anything
 * that resolved a repository. Whether two entries are one project is a
 * question about their origins, which `src/targets/sweep.ts` answers.
 */
export interface TargetRecord {
  readonly path: string
  /** ISO stamp of the most recent sync that recorded this target. */
  readonly stampedAt: string
}

/**
 * An absent file and an empty one are separate answers, the same split
 * `src/sessions/registry.ts` draws.
 *
 * The first means no sync has ever recorded a target on this machine, so the
 * population is unknown and the sweep is the only reading available. The
 * second means the file was read and holds no usable row, which a caller
 * should be able to tell apart from a lookup that never ran.
 */
export type TargetRegistry =
  | { readonly kind: 'absent'; readonly path: string }
  | {
      readonly kind: 'read'
      readonly path: string
      readonly targets: readonly TargetRecord[]
    }

interface StoredRegistry {
  readonly version: number
  readonly targets: readonly TargetRecord[]
}

const VERSION = 1

/**
 * Resolves the folder holding this machine's toolkit state.
 *
 * Twin of `sandboxTree` in `src/commands/sandbox.ts`, which resolves the same
 * three sources in the same order. The override exists so a test never writes
 * into the home directory of whoever runs it.
 */
export function stateDir(): string {
  return stateDirNamed('canon')
}

/**
 * Where this machine's state sat before the rename. Read below when the
 * current folder holds no registry, and never written to by anything here.
 */
export function retiredStateDir(): string {
  // canon-keep-retired
  return stateDirNamed('aitk')
}

/**
 * The override honors the retired variable too, since an operator who exported
 * it is the same operator whose registry sits under the retired folder.
 */
function stateDirNamed(folder: string): string {
  // canon-keep-retired
  const override = process.env.CANON_STATE_DIR ?? process.env.AITK_STATE_DIR
  if (override !== undefined && override !== '') return override

  const state = process.env.XDG_STATE_HOME
  const base =
    state !== undefined && state !== ''
      ? state
      : join(homedir(), '.local', 'state')

  return join(base, folder)
}

/**
 * The registry this machine uses, current path first and the retired one
 * behind it.
 *
 * The rename moved the folder and nothing migrates it, so a machine that has
 * been recording targets for months would otherwise answer with an empty
 * registry the first time it ran the renamed binary. Empty is
 * indistinguishable from a machine that never installed anything, which is
 * exactly the confident wrong answer this record exists to prevent.
 *
 * Resolving one path for both the read and the write is deliberate. A machine
 * already holding the retired file keeps using it rather than being migrated
 * underneath, which mirrors how `readStamp` treats a target's retired config.
 */
export function registryPath(): string {
  const current = join(stateDir(), 'targets.json')
  if (existsSync(current)) return current

  const retired = join(retiredStateDir(), 'targets.json')
  return existsSync(retired) ? retired : current
}

function isRecord(value: Partial<TargetRecord>): value is TargetRecord {
  return (
    typeof value.path === 'string' &&
    value.path.length > 0 &&
    typeof value.stampedAt === 'string' &&
    value.stampedAt.length > 0
  )
}

/**
 * The folders whose contents are never a project, resolved at call time so a
 * test's `CANON_STATE_DIR` override moves the state root with it.
 *
 * Sandbox runs and replays live under the state folder, background jobs keep
 * their scratch under `~/.claude/jobs/`, and unit tests stamp into the OS temp
 * folder. Each one passes through a stamping sync, so without this list every
 * run leaves a row behind for a folder that is gone a minute later.
 */
export function scratchRoots(): readonly string[] {
  return [tmpdir(), stateDir(), join(homedir(), '.claude', 'jobs')]
}

/**
 * Whether a path sits under a scratch root or inside any `.canon/tmp/` folder.
 *
 * Both sides are compared in their given and their real form, since macOS
 * hands out its temp folder as `/var/folders/...` while a path that went
 * through a symlink resolution reads `/private/var/folders/...`. A
 * `.claude/worktrees/` checkout is not scratch: it is a real checkout of a real
 * project, and only a root on the list or a `.canon/tmp/` segment refuses it.
 */
export function isScratchPath(
  target: string,
  roots: readonly string[] = scratchRoots(),
): boolean {
  const forms = bothForms(resolve(target))
  const rootForms = roots.flatMap((root) => bothForms(resolve(root)))

  return forms.some(
    (form) =>
      hasCanonTmpSegment(form) ||
      rootForms.some((root) => isWithin(form, root)),
  )
}

function bothForms(path: string): readonly string[] {
  try {
    const real = realpathSync(path)
    return real === path ? [path] : [path, real]
  } catch {
    return [path]
  }
}

function hasCanonTmpSegment(path: string): boolean {
  const segments = path.split(sep)
  return segments.some(
    (segment, index) => segment === '.canon' && segments[index + 1] === 'tmp',
  )
}

function isWithin(path: string, root: string): boolean {
  const rel = relative(root, path)
  return (
    rel === '' ||
    (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
  )
}

/**
 * Whether a row still names a project worth listing: a folder that exists and
 * sits under no scratch root. The read filter and the write prune both call
 * this, so the two can never disagree on a row.
 */
function isLive(row: TargetRecord, roots: readonly string[]): boolean {
  return existsSync(row.path) && !isScratchPath(row.path, roots)
}

/**
 * Reads every recorded target that is still live, sorted by path.
 *
 * A row missing either field is dropped rather than reported. This module is
 * the file's only writer, so a malformed row is a hand edit or a truncated
 * write and neither is a finding the caller can act on. What a caller can act
 * on is the file being absent, which is its own kind above.
 *
 * A row whose folder is gone or under a scratch root is left out too, so the
 * list is right on a machine whose file predates the prune, before any sync
 * rewrites it. A target on a drive that is unmounted reads as gone here, and
 * its next sync records it again.
 */
export function readTargetRegistry(
  path: string = registryPath(),
  roots: readonly string[] = scratchRoots(),
): TargetRegistry {
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    return { kind: 'absent', path }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { kind: 'read', path, targets: [] }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { kind: 'read', path, targets: [] }
  }

  const stored = parsed as Partial<StoredRegistry>
  const rows = Array.isArray(stored.targets) ? stored.targets : []
  const targets = rows
    .filter((row): row is TargetRecord =>
      isRecord(row as Partial<TargetRecord>),
    )
    .filter((row) => isLive(row, roots))
    .sort((a, b) => a.path.localeCompare(b.path))

  return { kind: 'read', path, targets }
}

/**
 * Why a record attempt did not land, so a caller can say so rather than assume
 * it did. `scratch` is a deliberate refusal of a path under a scratch root,
 * not a failure.
 */
export type RecordOutcome = 'recorded' | 'unwritten' | 'scratch'

/**
 * Records one target, keyed by its resolved path and replacing any row already
 * held for it, and refuses a path under a scratch root.
 *
 * The write is a temp file plus a rename, so a reader never meets a half
 * written file. Two syncs finishing together still resolve last-writer-wins on
 * the merged set, which can drop the row the loser added. That is left rather
 * than locked: the authoritative record of an install is the stamp inside the
 * target, this index is a cache over those, and the next sync of the dropped
 * target restores its row. The prune reads the same merged set the write
 * already reads, so it adds no second read and does not widen that window.
 *
 * Every write also drops the rows `readTargetRegistry` leaves out, being a
 * folder that is gone or one under a scratch root, so the file shrinks back to
 * the live projects rather than growing with every sandbox run. A target on a
 * drive that is unmounted drops with them, and its next sync restores it.
 */
export function recordTarget(
  target: string,
  now: Date,
  path: string = registryPath(),
  roots: readonly string[] = scratchRoots(),
): RecordOutcome {
  const resolved = resolve(target)
  if (isScratchPath(resolved, roots)) return 'scratch'

  const current = readTargetRegistry(path, roots)
  const existing = current.kind === 'read' ? current.targets : []

  const targets = [
    ...existing.filter((row) => row.path !== resolved),
    { path: resolved, stampedAt: now.toISOString() },
  ].sort((a, b) => a.path.localeCompare(b.path))

  const payload: StoredRegistry = { version: VERSION, targets }
  const temp = `${path}.${process.pid}.tmp`

  try {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(temp, `${JSON.stringify(payload, null, 2)}\n`)
    renameSync(temp, path)
    return 'recorded'
  } catch {
    return 'unwritten'
  }
}

/** One checkout a backfill is seeding, dated by its own on-disk stamp. */
export interface BackfillTarget {
  readonly path: string
  /** From that checkout's `readStamp`. Null skips the row rather than dating it by the backfill itself. */
  readonly stampedAt: string | null
}

export type BackfillOutcome = RecordOutcome | 'no-stamp'

/**
 * Seeds one row from a checkout's own stamp rather than from a sync, for a
 * target a sweep found that the record never held. Loops `recordTarget`,
 * which already replaces a row by resolved path, so this is a caller of it
 * rather than a second file format.
 */
export function backfillTarget(
  target: BackfillTarget,
  path: string = registryPath(),
  roots: readonly string[] = scratchRoots(),
): BackfillOutcome {
  if (target.stampedAt === null) return 'no-stamp'
  return recordTarget(target.path, new Date(target.stampedAt), path, roots)
}
