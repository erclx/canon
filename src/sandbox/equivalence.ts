import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { collectCoverage, DEFAULT_ARM } from '@/sandbox/coverage'

/** Holds fixture content rather than scenarios. Twin of the filter in `sandbox.ts`. */
const FIXTURES_DIR = 'fixtures'

/** One arm provisions inside this budget on each side, or reads as a failed run. */
const PROVISION_TIMEOUT_MS = 120_000

/** Arms run this many at a time, each in its own directory. */
const CONCURRENCY = 6

/** Pinned across both sides of every arm, so the run id cannot read as a difference. */
const PINNED_RUN_ID = 'equivalence'

/** Written for a process that timed out or was killed, the status `timeout(1)` uses. */
const TIMEOUT_STATUS = 124

const ROOT_PLACEHOLDER = '<root>'

export interface Arm {
  readonly category: string
  readonly command: string
  /** Undefined for a scenario that routes no arm, which carries one provision. */
  readonly arm?: string
  readonly anchor: boolean
}

export type ArmState =
  | 'identical'
  | 'differs'
  | 'red-on-base'
  | 'skipped-anchor'

export interface Mask {
  /** Scopes the entry to one arm key, or every arm when absent. */
  readonly arm?: string
  readonly key: RegExp
  /** When set, matches are rewritten before the comparison and the key stays compared. */
  readonly replace?: RegExp
  readonly reason: string
}

/**
 * Every difference two provisions of one commit are known to produce and that
 * says nothing about the change under test. A mask outside this list does not
 * exist, and each entry carries the measurement that put it here, so one that
 * stops matching can be deleted rather than left to hide something later.
 */
export const MASKS: readonly Mask[] = [
  {
    key: /^file:canon\/config\/config\.json$/,
    reason:
      'the install stamp carries a `syncedAt` wall-clock time, so two provisions of one commit differ',
  },
  {
    arm: 'claude:read-frames/resolved',
    key: /^file:demos\/cold-open\.webm$/,
    reason: 'ffmpeg output carries an encoder timestamp, so two runs differ',
  },
  {
    key: /^log$/,
    replace: /sandbox-occupant-\d+|\(pid \d+\)/g,
    reason:
      'the narration names the fake occupant session by its process id, which differs per run',
  },
  {
    key: /^log$/,
    replace: /Resolved, downloaded and extracted \[\d+\]/g,
    reason:
      'a package fetch reports how many packages it downloaded, and the base side runs first and warms the cache the head side then reads',
  },
  {
    key: /^git:.*:index$/,
    replace: /^160000 [0-9a-f]+/gm,
    reason:
      'a submodule entry holds the nested commit id, which a commit timestamp changes, while the nested log is compared on its own',
  },
]

const MASKED_TOKEN = '<masked>'

export type Manifest = ReadonlyMap<string, string>

export interface ArmRecord {
  readonly arm: string
  readonly state: ArmState
  readonly differs: readonly string[]
  readonly masked: readonly string[]
  readonly baseExit?: number
  readonly headExit?: number
  readonly check?: CheckRecord
}

export interface CheckRecord {
  readonly asserted?: number
  readonly state?: string
  readonly error?: string
}

export interface EquivalenceRecord {
  readonly base: string
  readonly baseCommit: string
  readonly canonVersion: string
  readonly masksApplied: readonly string[]
  readonly arms: readonly ArmRecord[]
  readonly errors: readonly string[]
  readonly counts: Readonly<Record<ArmState, number>>
}

export interface EquivalenceOptions {
  readonly root: string
  readonly targets: readonly string[]
  readonly base: string
  readonly includeAnchor: boolean
  readonly useMasks: boolean
  readonly out?: string
}

export function armKey(arm: Arm): string {
  const scenario = `${arm.category}:${arm.command}`

  return arm.arm === undefined ? scenario : `${scenario}/${arm.arm}`
}

function directories(path: string): string[] {
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

/**
 * Reads the quoted arguments of `select_or_route_scenario`, joining a call that
 * continues across backslash-newline pairs. The first argument is the prompt and
 * the rest are arm names. A call this cannot see returns no arms, which the
 * coverage cross-check in `enumerateArms` turns into an error rather than a
 * smaller list.
 */
export function parseArmNames(source: string): string[] {
  const start = source.search(/select_or_route_scenario\b/)
  if (start === -1) return []

  const call = source
    .slice(start)
    .replace(/\\\n/g, ' ')
    .split('\n')[0]
    ?.replace(/^select_or_route_scenario/, '')

  return [...(call ?? '').matchAll(/"([^"]*)"/g)]
    .map((match) => match[1] ?? '')
    .slice(1)
}

function matchesTarget(
  category: string,
  command: string,
  targets: readonly string[],
): boolean {
  if (targets.length === 0) return true

  return targets.some((t) => {
    const scenario = t.split('/')[0]

    return scenario === category || scenario === `${category}:${command}`
  })
}

function matchesArm(arm: Arm, targets: readonly string[]): boolean {
  const named = targets.filter((t) => t.includes('/'))
  const scenario = `${arm.category}:${arm.command}`
  const scoped = named.filter((t) => t.startsWith(`${scenario}/`))
  if (scoped.length === 0) return true

  return scoped.includes(armKey(arm))
}

/**
 * Lists every provision a target names, from the scenario source. An armed arm
 * that `canon sandbox coverage` reports and this list lacks is returned as an
 * error, so a scenario whose call this reader cannot parse cannot shrink the
 * check unannounced.
 */
export function enumerateArms(
  root: string,
  targets: readonly string[],
): { arms: Arm[]; errors: string[] } {
  const sandboxDir = join(root, 'sandbox')
  const arms: Arm[] = []
  const errors: string[] = []
  const coverage = collectCoverage(root)

  for (const category of directories(sandboxDir)) {
    if (category === FIXTURES_DIR) continue

    const commands = readdirSync(join(sandboxDir, category), {
      withFileTypes: true,
    })
      .filter((f) => f.isFile() && f.name.endsWith('.sh'))
      .map((f) => f.name.replace(/\.sh$/, ''))
      .sort()

    for (const command of commands) {
      if (!matchesTarget(category, command, targets)) continue

      const source = readFileSync(
        join(sandboxDir, category, `${command}.sh`),
        'utf8',
      )
      const anchor = /^use_anchor\s*\(\)/m.test(source)
      const names = parseArmNames(source)

      const found: Arm[] =
        names.length === 0
          ? [{ category, command, anchor }]
          : names.map((name) => ({ category, command, arm: name, anchor }))
      arms.push(...found.filter((a) => matchesArm(a, targets)))

      const armed = coverage.scenarios.find(
        (s) => s.category === category && s.command === command,
      )?.armed
      for (const declared of armed ?? []) {
        if (declared === DEFAULT_ARM || names.includes(declared)) continue
        errors.push(
          `${category}:${command} declares arm "${declared}" that enumeration lacks`,
        )
      }
    }
  }

  return { arms, errors }
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function git(cwd: string, args: string[]): string {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trimEnd()
  } catch (error) {
    return `error: ${error instanceof Error ? error.message : String(error)}`
  }
}

function isBare(dir: string): boolean {
  return (
    existsSync(join(dir, 'HEAD')) &&
    existsSync(join(dir, 'objects')) &&
    !existsSync(join(dir, '.git'))
  )
}

function isRepository(dir: string): boolean {
  return existsSync(join(dir, '.git'))
}

/**
 * Walks a provisioned tree into flat `key -> value` entries. A file is its mode
 * and sha256, a symlink its target. The outer repository and every nested one
 * contribute commit subjects, the staged index, and the branch, and never their
 * object files, which differ between two runs of one commit.
 */
export function buildManifest(dir: string): Manifest {
  const manifest = new Map<string, string>()

  function walk(relative: string): void {
    const absolute = join(dir, relative)

    // A bare repository holds objects whose bytes differ between two runs of one
    // commit, so it contributes its commit subjects and head and its files stay out.
    if (isBare(absolute)) {
      manifest.set(
        `git:${relative}:log`,
        git(absolute, ['log', '--format=%s', '--reverse', '--all']),
      )
      manifest.set(
        `git:${relative}:head`,
        git(absolute, ['symbolic-ref', 'HEAD']),
      )

      return
    }

    if (isRepository(absolute)) {
      const label = relative === '' ? '.' : relative
      manifest.set(
        `git:${label}:log`,
        git(absolute, ['log', '--format=%s', '--reverse']),
      )
      manifest.set(`git:${label}:index`, git(absolute, ['ls-files', '-s']))
      manifest.set(
        `git:${label}:branch`,
        git(absolute, ['branch', '--show-current']),
      )
    }

    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      if (entry.name === '.git') continue

      const child = relative === '' ? entry.name : join(relative, entry.name)
      const stat = lstatSync(join(dir, child))

      if (stat.isSymbolicLink()) {
        manifest.set(`link:${child}`, readlinkSync(join(dir, child)))
      } else if (stat.isDirectory()) {
        walk(child)
      } else if (stat.isFile()) {
        const mode = (stat.mode & 0o777).toString(8)
        manifest.set(`file:${child}`, `${mode} ${sha256(join(dir, child))}`)
      }
    }
  }

  if (existsSync(dir)) walk('')

  return manifest
}

/**
 * Compares two manifests and names every key that differs, with a key present
 * on one side only counting as a difference. Keys matching a mask for this arm
 * drop out of both sides first and come back as `masked`, so the caller can
 * report each mask that fired.
 */
export function diffManifests(
  arm: string,
  a: Manifest,
  b: Manifest,
  masks: readonly Mask[],
): { differs: string[]; masked: string[] } {
  const differs: string[] = []
  const masked: string[] = []

  const applies = (m: Mask, key: string): boolean =>
    (m.arm === undefined || m.arm === arm) && m.key.test(key)
  const isMasked = (key: string): boolean =>
    masks.some((m) => m.replace === undefined && applies(m, key))

  // A rewriting mask changes the value before the comparison and fires only when
  // its pattern matched, so one that stops matching leaves no trace to lie with.
  const rewrite = (
    key: string,
    value: string | undefined,
  ): string | undefined => {
    let next = value
    for (const m of masks) {
      if (m.replace === undefined || !applies(m, key) || next === undefined)
        continue
      const hit = next.replace(m.replace, MASKED_TOKEN)
      if (hit !== next) {
        if (!masked.includes(key)) masked.push(key)
        next = hit
      }
    }

    return next
  }

  const keys = [...new Set([...a.keys(), ...b.keys()])].sort()
  const maskedPaths = new Set(
    keys
      .filter((k) => k.startsWith('file:') && isMasked(k))
      .map((k) => k.slice(5)),
  )

  // A staged blob's hash is the masked file's content again, so its index line
  // leaves the comparison with the file itself.
  const comparable = (
    key: string,
    value: string | undefined,
  ): string | undefined => {
    const rewritten = rewrite(key, value)
    const repo = /^git:(.*):index$/.exec(key)?.[1]
    if (repo === undefined || rewritten === undefined) return rewritten

    return rewritten
      .split('\n')
      .filter((line) => {
        const path = line.split('\t')[1] ?? ''

        return !maskedPaths.has(repo === '.' ? path : `${repo}/${path}`)
      })
      .join('\n')
  }

  for (const key of keys) {
    if (isMasked(key)) {
      masked.push(key)
      continue
    }
    if (comparable(key, a.get(key)) !== comparable(key, b.get(key)))
      differs.push(key)
  }

  return { differs, masked }
}

/**
 * Classifies one arm from its two exits and its manifest difference. A pair of
 * exits that disagree is a difference whatever the trees hold, since a side that
 * fails and a side that succeeds are not the same behavior.
 */
export function classifyArm(
  baseExit: number,
  headExit: number,
  differs: readonly string[],
): { state: ArmState; differs: string[] } {
  const keys = [...differs]
  if (baseExit !== headExit) keys.push('exit')
  if (keys.length > 0) return { state: 'differs', differs: keys }
  if (baseExit !== 0) return { state: 'red-on-base', differs: [] }

  return { state: 'identical', differs: [] }
}

interface Provisioned {
  readonly exit: number
  readonly log: string
}

/**
 * Provisions run in their own process group so an interrupted run can end each
 * one with its scenario scripts. A child left alive would recreate a tree inside
 * a folder this run just removed.
 */
const running = new Set<number>()

function killGroup(pid: number): void {
  try {
    process.kill(-pid, 'SIGKILL')
  } catch {
    // The group already exited.
  }
}

function killRunning(): void {
  for (const pid of running) killGroup(pid)
  running.clear()
}

function runProcess(
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; logPath: string },
): Promise<number> {
  return new Promise((resolve) => {
    const fd = openSync(options.logPath, 'w')
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', fd, fd],
      timeout: PROVISION_TIMEOUT_MS,
      detached: true,
    })
    if (child.pid !== undefined) running.add(child.pid)
    const finish = (status: number): void => {
      // A scenario can leave a background process in the group, such as the fake
      // occupant `git-worktree` starts, and nothing else ends it when the tree goes.
      if (child.pid !== undefined) killGroup(child.pid)
      if (child.pid !== undefined) running.delete(child.pid)
      closeSync(fd)
      resolve(status)
    }
    child.on('error', () => finish(TIMEOUT_STATUS))
    child.on('close', (code) => finish(code ?? TIMEOUT_STATUS))
  })
}

function provisionEnv(arm: Arm, dir: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CANON_NON_INTERACTIVE: '1',
    CANON_SANDBOX_DIR: dir,
    CANON_SANDBOX_RUN_ID: PINNED_RUN_ID,
  }
  if (arm.arm === undefined) delete env.SANDBOX_SCENARIO
  else env.SANDBOX_SCENARIO = arm.arm

  return env
}

/**
 * Provisions through the public `canon sandbox` entry on one side, treating the
 * harness as a black box so the check survives the harness being replaced. The
 * log carries the checkout root as a placeholder, since the two sides differ in
 * exactly that.
 */
async function provision(
  root: string,
  arm: Arm,
  dir: string,
  logPath: string,
): Promise<Provisioned> {
  rmSync(dir, { recursive: true, force: true })
  const exit = await runProcess(
    'bun',
    [join(root, 'src', 'cli.ts'), 'sandbox', `${arm.category}:${arm.command}`],
    { cwd: root, env: provisionEnv(arm, dir), logPath },
  )
  const log = readFileSync(logPath, 'utf8').split(root).join(ROOT_PLACEHOLDER)

  return { exit, log }
}

async function checkHead(
  root: string,
  arm: Arm,
  dir: string,
  logPath: string,
): Promise<CheckRecord> {
  const args = [join(root, 'src', 'cli.ts'), 'sandbox', 'check']
  args.push(`${arm.category}:${arm.command}`)
  if (arm.arm !== undefined) args.push(arm.arm)
  args.push('--json')

  await runProcess('bun', args, {
    cwd: root,
    env: provisionEnv(arm, dir),
    logPath,
  })

  const line = readFileSync(logPath, 'utf8')
    .split('\n')
    .reverse()
    .find((l) => l.startsWith('{'))
  if (line === undefined) return { error: 'check printed no record' }

  try {
    const verdict = JSON.parse(line) as {
      asserted?: number
      state?: string
      note?: string
    }
    if (typeof verdict.asserted !== 'number')
      return { error: verdict.note ?? 'record carries no asserted count' }

    return { asserted: verdict.asserted, state: verdict.state }
  } catch {
    return { error: 'check record did not parse' }
  }
}

function withExit(manifest: Manifest, run: Provisioned): Manifest {
  const next = new Map(manifest)
  next.set('exit', String(run.exit))
  next.set('log', run.log)

  return next
}

async function runArm(
  arm: Arm,
  workDir: string,
  index: number,
  baseRoot: string,
  headRoot: string,
  masks: readonly Mask[],
  declared: boolean,
): Promise<ArmRecord> {
  const key = armKey(arm)
  const dir = join(workDir, 'arms', `arm-${index}`)
  const logPath = join(workDir, 'logs', `arm-${index}.log`)

  const base = await provision(baseRoot, arm, dir, logPath)
  const baseManifest = withExit(buildManifest(dir), base)

  const head = await provision(headRoot, arm, dir, logPath)
  const headManifest = withExit(buildManifest(dir), head)

  // Kept beside the logs, so a reader of an `--out` folder can see what a
  // difference was rather than only that one exists.
  for (const [side, manifest] of [
    ['base', baseManifest],
    ['head', headManifest],
  ] as const)
    writeFileSync(
      join(workDir, 'manifests', `arm-${index}.${side}.json`),
      JSON.stringify(Object.fromEntries(manifest), null, 2),
    )

  const diff = diffManifests(key, baseManifest, headManifest, masks)
  const classified = classifyArm(base.exit, head.exit, diff.differs)

  const check = declared
    ? await checkHead(
        headRoot,
        arm,
        dir,
        join(workDir, 'logs', `check-${index}.log`),
      )
    : undefined

  return {
    arm: key,
    state: classified.state,
    differs: classified.differs,
    masked: diff.masked,
    baseExit: base.exit,
    headExit: head.exit,
    check,
  }
}

async function pool<T, R>(
  items: readonly T[],
  size: number,
  work: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0

  async function lane(): Promise<void> {
    while (next < items.length) {
      const index = next++
      results[index] = await work(items[index] as T, index)
    }
  }

  await Promise.all(Array.from({ length: Math.min(size, items.length) }, lane))

  return results
}

function canonVersion(): string {
  try {
    return execFileSync('canon', ['--version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return 'unavailable'
  }
}

/**
 * Adds the baseline as a detached worktree of the base ref, so it carries full
 * history for the scenarios that read it, and returns a remover that is safe to
 * call twice. `node_modules` is linked from the working checkout, since the
 * baseline runs the same CLI and carries no install of its own.
 */
function addBaseline(root: string, workDir: string, ref: string): () => void {
  const path = join(workDir, 'base')
  execFileSync('git', ['worktree', 'add', '--detach', path, ref], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'pipe'],
  })

  const modules = join(root, 'node_modules')
  if (existsSync(modules)) symlinkSync(modules, join(path, 'node_modules'))

  let removed = false

  return () => {
    if (removed) return
    removed = true
    try {
      execFileSync('git', ['worktree', 'remove', '--force', path], {
        cwd: root,
        stdio: 'ignore',
      })
    } catch {
      rmSync(path, { recursive: true, force: true })
    }
    try {
      execFileSync('git', ['worktree', 'prune'], { cwd: root, stdio: 'ignore' })
    } catch {
      // The entry is already gone, or the repository is.
    }
  }
}

export async function runEquivalence(
  options: EquivalenceOptions,
): Promise<EquivalenceRecord> {
  const { arms, errors } = enumerateArms(options.root, options.targets)
  const masks = options.useMasks ? MASKS : []
  const coverage = collectCoverage(options.root)
  const declaredKeys = new Set(
    coverage.scenarios.flatMap((s) =>
      s.armed.map((a) =>
        a === DEFAULT_ARM
          ? `${s.category}:${s.command}`
          : `${s.category}:${s.command}/${a}`,
      ),
    ),
  )

  const workDir =
    options.out ?? mkdtempSync(join(tmpdir(), 'canon-equivalence-'))
  mkdirSync(join(workDir, 'arms'), { recursive: true })
  mkdirSync(join(workDir, 'logs'), { recursive: true })
  mkdirSync(join(workDir, 'manifests'), { recursive: true })

  let removeBaseline: () => void
  try {
    removeBaseline = addBaseline(options.root, workDir, options.base)
  } catch (error) {
    // An unknown ref must not leave an empty scratch folder behind.
    if (options.out === undefined)
      rmSync(workDir, { recursive: true, force: true })
    throw error
  }
  const cleanup = (): void => {
    killRunning()
    removeBaseline()
    if (options.out === undefined)
      rmSync(workDir, { recursive: true, force: true })
  }
  const onSignal = (signal: NodeJS.Signals): void => {
    cleanup()
    process.exit(signal === 'SIGINT' ? 130 : 143)
  }
  process.on('SIGINT', onSignal)
  process.on('SIGTERM', onSignal)

  try {
    const baseRoot = join(workDir, 'base')
    const baseCommit = git(options.root, ['rev-parse', options.base])
    const runnable = arms.filter((a) => !a.anchor || options.includeAnchor)
    const skipped = arms.filter((a) => a.anchor && !options.includeAnchor)

    const indexed = new Map(arms.map((a, i) => [armKey(a), i]))
    const run = (arm: Arm): Promise<ArmRecord> =>
      runArm(
        arm,
        workDir,
        indexed.get(armKey(arm)) ?? 0,
        baseRoot,
        options.root,
        masks,
        declaredKeys.has(armKey(arm)),
      )

    // Anchor arms force-push `main` and recreate a pull request on one shared
    // remote, so they run strictly one at a time.
    const offline = await pool(
      runnable.filter((a) => !a.anchor),
      CONCURRENCY,
      (arm) => run(arm),
    )
    const anchored: ArmRecord[] = []
    for (const arm of runnable.filter((a) => a.anchor))
      anchored.push(await run(arm))

    const records: ArmRecord[] = [
      ...offline,
      ...anchored,
      ...skipped.map(
        (arm): ArmRecord => ({
          arm: armKey(arm),
          state: 'skipped-anchor',
          differs: [],
          masked: [],
        }),
      ),
    ].sort((x, y) => x.arm.localeCompare(y.arm))

    const counts: Record<ArmState, number> = {
      identical: 0,
      differs: 0,
      'red-on-base': 0,
      'skipped-anchor': 0,
    }
    for (const record of records) counts[record.state] += 1

    const masksApplied = [
      ...new Set(
        records.flatMap((r) =>
          r.masked.map((key) => {
            const mask = masks.find(
              (m) =>
                (m.arm === undefined || m.arm === r.arm) && m.key.test(key),
            )

            return `${r.arm} ${key}: ${mask?.reason ?? ''}`
          }),
        ),
      ),
    ]

    return {
      base: options.base,
      baseCommit,
      canonVersion: canonVersion(),
      masksApplied,
      arms: records,
      errors,
      counts,
    }
  } finally {
    process.off('SIGINT', onSignal)
    process.off('SIGTERM', onSignal)
    cleanup()
  }
}

/** Exit 1 on any difference or enumeration error. A red-on-both arm is reported only. */
export function equivalenceExitCode(record: EquivalenceRecord): number {
  return record.counts.differs > 0 || record.errors.length > 0 ? 1 : 0
}
