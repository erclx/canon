import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { execa, type Options } from 'execa'
import { isStackExcluded, loadManifest } from '@/tooling/manifest'
import { intro, logError, logInfo, logStep, logWarn, outro } from '@/ui'

const SCREENSHOT_TIMEOUT_MS = 60_000
const TAIL_LINES = 20

export interface VerifyOptions {
  readonly root: string
  readonly stack: string
  readonly keep?: boolean
}

export interface PhaseResult {
  readonly name: string
  readonly passed: boolean
}

export interface VerifyOutcome {
  readonly results: readonly PhaseResult[]
  readonly exitCode: number
}

interface Run {
  readonly dir: string
  readonly results: PhaseResult[]
  isFailed: boolean
}

/**
 * Scaffolds a stack into `.canon/tmp/runs/verify-<stack>/`, syncs its chain
 * from the checkout at `root`, and runs the scaffold's own `lint:fix`,
 * `check`, `test:e2e`, and `screenshot` scripts. Every line goes to stderr.
 *
 * A failed phase is recorded and the run carries on, so the Results block
 * reports every phase rather than the first failure. The tmp dir is removed
 * only on a clean run without `keep`.
 */
export async function verifyStack(opts: VerifyOptions): Promise<VerifyOutcome> {
  intro(`canon tooling verify ${opts.stack}`)
  // A signal skips the `finally` below, so the handler closes the frame on
  // that path and leaves the tmp dir in place for inspection.
  let isOpen = true
  const close = (): void => {
    if (isOpen) outro()
    isOpen = false
  }
  const handleSignal = (): void => {
    close()
    process.exit(130)
  }
  process.once('SIGINT', handleSignal)
  process.once('SIGTERM', handleSignal)

  try {
    return await run(opts)
  } finally {
    process.off('SIGINT', handleSignal)
    process.off('SIGTERM', handleSignal)
    close()
  }
}

async function run({
  root,
  stack,
  keep = false,
}: VerifyOptions): Promise<VerifyOutcome> {
  const refuse = (message: string): VerifyOutcome => {
    logError(message)
    return { results: [], exitCode: 1 }
  }

  if (isStackExcluded(stack)) {
    return refuse(`Stack '${stack}' is excluded from tooling.`)
  }
  const manifest = loadManifest(root, stack)
  if (manifest === undefined) {
    return refuse(`No manifest at tooling/${stack}/manifest.toml`)
  }
  if (manifest.scaffold === undefined) {
    return refuse(`Stack '${stack}' has no scaffold command in manifest.`)
  }

  const runsDir = join(root, '.canon/tmp/runs')
  const name = `verify-${stack}`
  const state: Run = { dir: join(runsDir, name), results: [], isFailed: false }

  mkdirSync(runsDir, { recursive: true })
  rmSync(state.dir, { recursive: true, force: true })

  logStep(`Scaffolding ${stack}`)
  // Manifests carry shell syntax (`&&`, `cd`, quoted globs), so the command
  // runs under a shell rather than as a split argv.
  const scaffold = await shell(
    manifest.scaffold.replaceAll('{{name}}', name),
    runsDir,
  )
  if (scaffold.failed) {
    logWarn('Scaffold failed')
    writeTail(scaffold.all)
    state.isFailed = true
  }

  if (!existsSync(state.dir)) {
    return refuse(`Scaffold did not produce ${state.dir}`)
  }

  await shell(
    'git init -q && git add . && git commit -m "chore: verify scaffold" -q --no-verify --allow-empty',
    state.dir,
  )

  const { prepare } = manifest
  if (prepare !== undefined) {
    await phase(state, 'Prepare', () => shell(prepare, state.dir))
  }

  const cli = join(root, 'src/cli.ts')
  logInfo(`Sync resolves via bun ${cli}, not PATH canon`)
  await phase(state, 'Sync', () =>
    execa('bun', [cli, 'tooling', 'sync', stack, '.', '--write'], {
      ...captured(state.dir),
      env: { CI: '1', CANON_NON_INTERACTIVE: '1' },
    }),
  )

  const packagePath = join(state.dir, 'package.json')
  if (existsSync(packagePath)) {
    await runScripts(state, readScriptKeys(packagePath))
  } else {
    logError(
      `No package.json after Sync for ${stack}, so no phase past Sync can run.`,
    )
    state.isFailed = true
  }

  logStep('Results')
  for (const result of state.results) {
    if (result.passed) logInfo(result.name)
    else logWarn(result.name)
  }

  if (!keep && !state.isFailed) {
    rmSync(state.dir, { recursive: true, force: true })
  } else {
    logInfo(`Kept ${state.dir}`)
  }

  return { results: state.results, exitCode: state.isFailed ? 1 : 0 }
}

/**
 * `lint:fix` runs first and reformats the scaffold, so `check` reads the
 * reformatted tree.
 */
async function runScripts(state: Run, scripts: Set<string>): Promise<void> {
  await phase(state, 'lint:fix', () => bunRun('lint:fix', state.dir))
  await phase(state, 'check', () => bunRun('check', state.dir))

  if (scripts.has('test:e2e')) {
    await phase(state, 'test:e2e', () => bunRun('test:e2e', state.dir))
  }

  if (!scripts.has('screenshot')) return
  const isShot = await phase(state, 'screenshot', () =>
    bunRun('screenshot', state.dir, SCREENSHOT_TIMEOUT_MS),
  )
  // A killed or failed screenshot run is already a failure, and its partial
  // output says nothing about the artifacts.
  if (!isShot) return

  const shots = countScreenshots(join(state.dir, 'screenshots'))
  if (shots === 0) logWarn('screenshot produced no png files')
  record(state, 'screenshot-artifacts', shots > 0)
}

type Spawned = Awaited<ReturnType<typeof execa>>

async function phase(
  state: Run,
  name: string,
  spawn: () => Promise<Spawned>,
): Promise<boolean> {
  logStep(name)
  const result = await spawn()
  if (!result.failed) {
    logInfo(`${name} passed`)
    record(state, name, true)
    return true
  }
  logWarn(result.timedOut ? `${name} timed out` : `${name} failed`)
  writeTail(result.all)
  record(state, name, false)
  return false
}

function record(state: Run, name: string, passed: boolean): void {
  state.results.push({ name, passed })
  if (!passed) state.isFailed = true
}

function captured(cwd: string): Options {
  return { cwd, all: true, reject: false, stdin: 'ignore' }
}

function shell(command: string, cwd: string): Promise<Spawned> {
  return execa(command, {
    ...captured(cwd),
    shell: 'bash',
    env: { CI: '1' },
  })
}

function bunRun(
  script: string,
  cwd: string,
  timeout?: number,
): Promise<Spawned> {
  return execa('bun', ['run', script], {
    ...captured(cwd),
    env: { CI: '1' },
    ...(timeout !== undefined ? { timeout } : {}),
  })
}

function writeTail(output: unknown): void {
  if (typeof output !== 'string' || output === '') return
  const lines = output.replace(/\n$/, '').split('\n').slice(-TAIL_LINES)
  process.stderr.write(`${lines.join('\n')}\n`)
}

function readScriptKeys(packagePath: string): Set<string> {
  try {
    const parsed = JSON.parse(readFileSync(packagePath, 'utf8')) as {
      scripts?: Record<string, unknown>
    }
    return new Set(Object.keys(parsed.scripts ?? {}))
  } catch {
    return new Set()
  }
}

function countScreenshots(dir: string): number {
  if (!existsSync(dir)) return 0
  return [...new Bun.Glob('**/*.png').scanSync({ cwd: dir, dot: true })].length
}
