import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, normalize, relative } from 'node:path'

/** Path to content hash, one entry per regular file. */
export type Manifest = ReadonlyMap<string, string>

/**
 * Hashes every regular file under `base`, keyed by its path relative to it, for
 * the top-level entries `keep` admits. A symlink is neither followed nor
 * hashed, matching `find -type f`.
 */
function hashFiles(base: string, keep: (name: string) => boolean): Manifest {
  const manifest = new Map<string, string>()
  const pending = readdirSync(base, { withFileTypes: true })
    .filter((entry) => keep(entry.name))
    .map((entry) => ({ entry, dir: base }))

  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    const path = join(next.dir, next.entry.name)
    if (next.entry.isDirectory()) {
      for (const entry of readdirSync(path, { withFileTypes: true }))
        pending.push({ entry, dir: path })
    } else if (next.entry.isFile()) {
      const hash = createHash('sha1').update(readFileSync(path)).digest('hex')
      manifest.set(relative(base, path), hash)
    }
  }

  return new Map([...manifest].sort(([a], [b]) => (a < b ? -1 : 1)))
}

/**
 * Records a hash per file so the post-run comparison can name what the session
 * wrote. A diff against `refs/sandbox/baseline` cannot stand in for this: an arm
 * that sets SANDBOX_SKIP_AUTO_COMMIT leaves its last stage uncommitted, so the
 * fixtures the harness staged would read as session writes.
 */
export function snapshotTree(dir: string): Manifest {
  return hashFiles(dir, (name) => name !== '.git')
}

/**
 * Reports both sides of a change, so a deletion is a write. Reporting only the
 * after side would let a file removed outside the declared scope produce no
 * assertion at all, which is the one way this check stayed weaker than the
 * permission scoping it replaced. A modified file differs on both sides and
 * reports once.
 */
export function writesBetween(before: Manifest, after: Manifest): string[] {
  const paths = new Set([...before.keys(), ...after.keys()])

  return [...paths]
    .filter((path) => before.get(path) !== after.get(path))
    .sort()
}

/**
 * The roots a run must not write shared session scratch to, since
 * `snapshotTree` reads the sandbox alone and a write resolved against a
 * toolkit root would otherwise go unseen. It makes an escape visible, not
 * impossible: a write to a home directory or a sibling worktree is not watched.
 * The main root joins the list whenever it differs from the launch root, since
 * the scratch rule sends a session there from a linked worktree.
 */
export function escapeRoots(projectRoot: string): string[] {
  const listing = spawnSync('git', ['worktree', 'list', '--porcelain'], {
    cwd: projectRoot,
    encoding: 'utf8',
  })
  const line = (listing.stdout ?? '')
    .split('\n')
    .find((l) => l.startsWith('worktree '))
  const mainRoot = line?.slice('worktree '.length)

  return mainRoot === undefined || mainRoot === '' || mainRoot === projectRoot
    ? [projectRoot]
    : [projectRoot, mainRoot]
}

/**
 * The four directories the seed's shared-scratch rule names, and the whole of
 * where an escape lands, so watching only these costs no detection. A watch
 * over the whole root would report the operator's own editing as an escape.
 *
 * The watch reaches `escapeRoots` times these four and nothing past them, so a
 * nested run's escape is invisible here and a nested background dispatch
 * reports through `sessions` instead. An arm meant to write past the sandbox
 * declares `escape_scope` in its `expect.toml`. Read
 * `canon/context/development/sandbox.md` before claiming more.
 */
export const ESCAPE_SCRATCH_DIRS = [
  '.canon/plans',
  '.canon/review',
  '.canon/memory',
  '.canon/tasks',
] as const

export interface RootSnapshot {
  readonly manifest: Manifest
  /**
   * The root held at least one of the four directories. A root with none of
   * them contributes no manifest and no diff, which reads identically to a watch
   * that ran clean, so `checkEscapeScope` needs this to tell "watched and clean"
   * from "nothing to watch" apart.
   */
  readonly isWatched: boolean
}

export function snapshotRoot(dir: string): RootSnapshot {
  const targets = ESCAPE_SCRATCH_DIRS.filter((sub) =>
    existsSync(join(dir, sub)),
  )
  if (targets.length === 0) return { manifest: new Map(), isWatched: false }

  const manifest = new Map<string, string>()
  for (const sub of targets)
    for (const [path, hash] of hashFiles(join(dir, sub), () => true))
      manifest.set(`${sub}/${path}`, hash)

  return { manifest, isWatched: true }
}

export interface AttributedEscapes {
  readonly tied: readonly string[]
  readonly untied: readonly string[]
}

/**
 * Splits the watched writes into those a tool call of this session names and
 * those none does, so a parallel session's write stops failing an arm.
 *
 * A path ties when a file-writing call targeted it or a `Bash` command spells
 * it or its scratch directory behind a prefix. A bare relative path ties only
 * once commands also spell the path's root and the `.canon` segment. A stream
 * with no call ties every path. A shell write that never spells the root nor
 * the prefixed directory ties nothing and reads as foreign.
 */
export function attributeEscapes(
  escapes: readonly string[],
  calls: {
    readonly writeTargets?: readonly string[]
    readonly commands?: readonly string[]
  },
): AttributedEscapes {
  const targets = new Set(
    (calls.writeTargets ?? []).map((path) => normalize(path)),
  )
  const commands = calls.commands ?? []
  if (targets.size === 0 && commands.length === 0)
    return { tied: [...escapes], untied: [] }

  const tied: string[] = []
  const untied: string[] = []
  for (const path of escapes) {
    const isTied =
      targets.has(normalize(path)) ||
      commands.some(
        (command) =>
          command.includes(path) ||
          namesScratchDir(command, scratchDirOf(path)),
      ) ||
      entersRootOf(path, commands)
    ;(isTied ? tied : untied).push(path)
  }

  return { tied, untied }
}

function scratchDirOf(path: string): string | undefined {
  return ESCAPE_SCRATCH_DIRS.find((dir) => path.includes(`/${dir}/`))
}

function entersRootOf(path: string, commands: readonly string[]): boolean {
  const dir = scratchDirOf(path)
  if (dir === undefined) return false
  const root = path.slice(0, path.indexOf(`/${dir}/`))
  const top = dir.split('/')[0] ?? dir

  return (
    root !== '' &&
    commands.some((command) => command.includes(root)) &&
    commands.some((command) => command.includes(top))
  )
}

/**
 * True when `command` spells `/<dir>` behind a prefix that could resolve to a
 * watched root. A prefix of dots, slashes, or a tilde alone resolves against the
 * sandbox, the filesystem root, or the home directory, none of them a root the
 * watch reads.
 */
function namesScratchDir(command: string, dir: string | undefined): boolean {
  if (dir === undefined) return false
  const needle = `/${dir}`

  for (
    let at = command.indexOf(needle);
    at !== -1;
    at = command.indexOf(needle, at + 1)
  ) {
    const next = command[at + needle.length]
    if (next !== undefined && !/[/\s'"`;)|&>]/.test(next)) continue
    const prefix = /[^\s'"`=;(|&<>]*$/.exec(command.slice(0, at))?.[0] ?? ''
    if (!/^[./~]*$/.test(prefix)) return true
  }

  return false
}
