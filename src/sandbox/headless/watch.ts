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
 * The roots a run must not write shared session scratch to. `snapshotTree`
 * reads the sandbox alone, so before this a session that resolved that scratch
 * against a toolkit root wrote where no manifest looked: the run reported
 * success, the write list came back empty, and `write_scope` had nothing to
 * assert against.
 *
 * It makes an escape visible rather than impossible. A session can write to a
 * home directory, to a sibling worktree, or to any path outside these roots, and
 * none of that is watched. `canon/context/development/sandbox.md` names the four
 * directories the watch reads.
 *
 * A linked worktree is the normal place to develop this repository, and the
 * rule an escaping session follows sends scratch to the main root rather than to
 * the worktree it was launched from, so the main root joins the list whenever it
 * differs.
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
 * where an escape lands. A session that resolves that rule against a toolkit
 * root writes here and nowhere else, so watching these rather than the whole
 * root costs no detection.
 *
 * It buys the difference between a signal and noise. Nothing distinguishes the
 * spawned session's writes from the operator's own, so a watch over the whole
 * root reports ordinary editing during a run as an escape. Measured 2026-08-02:
 * three runs against the relocated sandbox all wrote their report to the right
 * place, and two of the three still reported an escape under the wide watch,
 * naming a context entry being edited in the session that launched them.
 *
 * The scope stated for an arm author: `escapeRoots` times two, these times four.
 * This watch reaches nothing past those eight destinations, so a nested run's
 * own escape is invisible here whether or not an arm declares `escape_scope`. A
 * nested background dispatch reports through `sessions` instead, from
 * `dispatch.ts`, so the key defined against this file-write watch keeps one
 * meaning. An arm whose skill is meant to reach past the sandbox tree declares
 * `escape_scope` in its `expect.toml`, which bounds a legitimate write rather
 * than the run. Read `canon/context/development/sandbox.md` before writing a claim past
 * that.
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
 * those none does, so a parallel session's board write stops failing an arm.
 * A diffed path ties when a file-writing call targeted it, when a `Bash` command
 * spells it, or when a `Bash` command spells its scratch directory behind some
 * prefix, such as `"$main/.canon/plans"`.
 *
 * A bare relative `.canon/plans` or `./.canon/plans` ties nothing on its own,
 * since the session runs from the sandbox, which sits outside every watched
 * root. It ties once some command also spells the path's root, which is how a
 * `cd` into that root followed by a relative write reads, in one call or two.
 *
 * A stream carrying no call at all ties every path, so a dead or unparsable
 * stream keeps the verdict the watch gave before attribution. The one gap is a
 * shell write whose destination is computed in full, such as a path read from
 * `git worktree list` into a variable with no scratch directory spelled, which
 * ties nothing and reads as foreign.
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

  return (
    root !== '' &&
    commands.some((command) => command.includes(root)) &&
    commands.some((command) => command.includes(dir))
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
