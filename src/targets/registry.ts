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
 * One project the toolkit has installed into, as the install recorded it. The path is the target root
 * rather than its git directory, and whether two entries are one project is `src/targets/sweep.ts`'s.
 */
export interface TargetRecord {
  readonly path: string
  /** ISO stamp of the most recent sync that recorded this target. */
  readonly stampedAt: string
}

/**
 * An absent file and an empty one are separate answers, as in `src/sessions/registry.ts`. Absent means
 * no sync has recorded a target here, so the sweep is the only reading, and empty means a read with no row.
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
 * Resolves the folder holding this machine's toolkit state. Twin of `sandboxTree` in
 * `src/commands/sandbox.ts`, and the override keeps a test out of the runner's home directory.
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
 * The registry this machine uses, current path first and the retired one behind it. Nothing migrates the
 * folder, so without the fallback a machine with months of targets would answer empty.
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
 * The folders whose contents are never a project, resolved at call time so a test's `CANON_STATE_DIR`
 * override moves the state root. Each passes through a stamping sync and would leave a dead row behind.
 */
export function scratchRoots(): readonly string[] {
  return [tmpdir(), stateDir(), join(homedir(), '.claude', 'jobs')]
}

/**
 * Whether a path sits under a scratch root or inside any `.canon/tmp/` folder, compared in the given and
 * the real form, since macOS temp folders resolve through a symlink. A `.claude/worktrees/` checkout
 * is a real checkout and is not scratch.
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
 * Reads every recorded target that is still live, sorted by path. A malformed row, a row whose folder is
 * gone, and a row under a scratch root are left out, so the list is right before any sync rewrites it.
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
 * Records one target, keyed by its resolved path and replacing any row already held, and refuses a path
 * under a scratch root. A temp file plus a rename keeps a reader off a half-written file, and concurrent
 * syncs resolve last-writer-wins, which the stamp inside each target recovers.
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
 * Seeds one row from a checkout's own stamp rather than a sync, for a target a sweep found that the
 * record never held. A caller of `recordTarget`, not a second file format.
 */
export function backfillTarget(
  target: BackfillTarget,
  path: string = registryPath(),
  roots: readonly string[] = scratchRoots(),
): BackfillOutcome {
  if (target.stampedAt === null) return 'no-stamp'
  return recordTarget(target.path, new Date(target.stampedAt), path, roots)
}
