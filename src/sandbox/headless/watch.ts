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
 * wrote. A diff against `refs/sandbox/baseline` cannot stand in, since an arm
 * setting SANDBOX_SKIP_AUTO_COMMIT leaves staged fixtures that would read as writes.
 */
export function snapshotTree(dir: string): Manifest {
  return hashFiles(dir, (name) => name !== '.git')
}

/**
 * Reports both sides of a change, so a deletion is a write. Reporting only the
 * after side would let a file removed outside the declared scope produce no
 * assertion. A modified file differs on both sides and reports once.
 */
export function writesBetween(before: Manifest, after: Manifest): string[] {
  const paths = new Set([...before.keys(), ...after.keys()])

  return [...paths]
    .filter((path) => before.get(path) !== after.get(path))
    .sort()
}

/**
 * The roots a run must not write shared session scratch to, since `snapshotTree`
 * reads the sandbox alone. It makes an escape visible, not impossible. The main
 * root joins whenever it differs from the launch root, as the scratch rule sends a session there.
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
 * The four directories the seed's shared-scratch rule names, the whole of where
 * an escape lands. A nested run's escape is invisible here and a nested background
 * dispatch reports through `sessions`. Read `canon/context/development/sandbox.md` before claiming more.
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
   * The root held at least one of the four directories. A root with none reads
   * like a clean watch, so `checkEscapeScope` needs this to tell "watched and
   * clean" from "nothing to watch".
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
 * those none does, so a parallel session's write stops failing an arm. A bare
 * relative path ties only once commands also spell its root, and a stream with no call ties every path.
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
 * watched root. A prefix of dots, slashes, or a tilde alone resolves elsewhere.
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
