import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Mints a short per-run identifier the first time it is asked for and holds it
 * in `CANON_SANDBOX_RUN_ID` for the rest of this process, so a script that
 * spawns a child inheriting `process.env` — `canon sandbox run` calling
 * `canon sandbox` to provision and then `canon sandbox check` — resolves the same tree in every one
 * of them, as do the hook and installer children provisioning spawns. A process
 * that already carries the variable, inherited from such a parent, reuses it
 * rather than minting a new one.
 *
 * Twin of `mint_sandbox_run_id` in `scripts/lib/sandbox-path.sh`.
 */
export function mintSandboxRunId(): string {
  const existing = process.env.CANON_SANDBOX_RUN_ID
  if (existing !== undefined && existing !== '') return existing

  const id = randomBytes(4).toString('hex')
  process.env.CANON_SANDBOX_RUN_ID = id
  return id
}

/**
 * The provisioned tree's path, split out of `src/commands/sandbox.ts` so the
 * per-run default is unit-testable on its own rather than only through the
 * command's registration.
 *
 * Twin of `resolve_sandbox_dir` in `scripts/lib/sandbox-path.sh`. The exec
 * boundary rules out a shared constant, so a change to the default lands on
 * both sides. The fall-through used to be one path per machine, so two
 * sessions each resolving the default at once provisioned over each other
 * with neither told; `mintSandboxRunId` gives the path a per-run component
 * instead, which is what makes two such sessions land on two different trees.
 */
export function sandboxTree(): string {
  const override = process.env.CANON_SANDBOX_DIR
  if (override !== undefined && override !== '') return override

  const state = process.env.XDG_STATE_HOME
  const base =
    state !== undefined && state !== ''
      ? state
      : join(homedir(), '.local', 'state')

  return join(base, 'canon', `sandbox-${mintSandboxRunId()}`)
}

/**
 * Lexical rather than `realpath`, since the guard runs before the tree exists,
 * so nothing here follows a symlink.
 */
export function normalizeSandboxPath(path: string): string {
  if (path === '') return ''

  const isAbsolute = path.startsWith('/')
  const resolved: string[] = []
  let climbed = ''

  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment !== '..') resolved.push(segment)
    else if (resolved.length > 0) resolved.pop()
    else if (!isAbsolute) climbed += '../'
  }

  if (isAbsolute) return `/${resolved.join('/')}`

  const relative = `${climbed}${resolved.join('/')}`.replace(/\/+$/, '')

  return relative === '' ? '.' : relative
}

/** Whether `candidate` is `target` or a directory containing it. */
function isAtOrAbove(candidate: string, target: string): boolean {
  return candidate === target || target.startsWith(`${candidate}/`)
}

export interface SandboxRoots {
  readonly home: string
  readonly temp: string
  readonly mainRoot: string
}

/**
 * The roots the guard measures against. The repository test reads the main
 * worktree rather than `PROJECT_ROOT`, since a linked worktree sits inside it.
 */
export function sandboxRoots(projectRoot: string): SandboxRoots {
  const listing = spawnSync('git', ['worktree', 'list', '--porcelain'], {
    cwd: projectRoot,
    encoding: 'utf8',
  })
  const line = (listing.stdout ?? '')
    .split('\n')
    .find((l) => l.startsWith('worktree '))

  return {
    home: process.env.HOME || '/root',
    temp: process.env.TMPDIR || '/tmp',
    mainRoot: line === undefined ? projectRoot : line.slice('worktree '.length),
  }
}

/**
 * Returns the reason a location cannot hold the tree, or undefined when it can.
 * Provisioning removes the tree before staging, so the test is an allowlist: a
 * strict descendant of the home folder or the temp root, outside the main
 * worktree in both directions.
 */
export function assertSandboxDirSafe(
  raw: string,
  roots: SandboxRoots,
): string | undefined {
  if (!raw.startsWith('/'))
    return `CANON_SANDBOX_DIR must be an absolute path, got: ${raw || '<empty>'}`

  if (raw.length > 4096)
    return `Refusing the sandbox path. It is ${raw.length} characters, past the longest path any filesystem here accepts.`

  const dir = normalizeSandboxPath(raw)
  const home = normalizeSandboxPath(roots.home)
  const temp = normalizeSandboxPath(roots.temp)
  const mainRoot = normalizeSandboxPath(roots.mainRoot)
  const resolution = dir === raw ? '' : ` It resolves to ${dir}.`

  if (!isAtOrAbove(home, dir) && !isAtOrAbove(temp, dir))
    return `Refusing ${raw} as the sandbox. Provisioning removes the tree first, so the path has to sit under ${home} or ${temp}.${resolution}`

  if (dir === home || dir === temp)
    return `Refusing ${raw} as the sandbox. Provisioning removes the tree first, so the path has to sit under ${dir} rather than be it.`

  if (isAtOrAbove(dir, mainRoot))
    return `Refusing ${raw} as the sandbox. Provisioning removes the tree first, and that path contains ${mainRoot}.${resolution}`

  if (dir.startsWith(`${mainRoot}/`))
    return `Sandbox at ${raw} sits inside ${mainRoot}, which puts the toolkit CLAUDE.md back on the session ancestor chain.${resolution} Point CANON_SANDBOX_DIR outside the repository.`

  return undefined
}
