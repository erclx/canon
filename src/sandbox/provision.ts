import { spawnSync, type StdioOptions } from 'node:child_process'
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'
import { probeScenario, stageScenario } from '@/sandbox/hooks'
import { assertSandboxDirSafe, sandboxRoots, sandboxTree } from '@/sandbox/tree'
import {
  intro,
  logError,
  logInfo,
  logRemove,
  logStep,
  logWarn,
  outro,
  palette,
  select,
} from '@/ui'

/**
 * Provisions one scenario into the sandbox tree, and resets or cleans that tree.
 * Each scenario's hooks run in bash through `sandbox-hook.sh`, and everything
 * between them runs here, in the order the retired bash dispatcher held.
 *
 * Narration is part of the contract. `canon sandbox equivalence` compares the
 * log line for line against the bash harness, so every message, its frame
 * glyph, and its position in the order stays as that harness wrote it.
 */

const ANCHOR_FIXTURE_PARTS = ['sandbox', 'fixtures', 'anchor', 'create']
const FIXTURE_SUFFIX = '.fixture'
const SKILL_PATHSPEC = 'claude/skills/**/SKILL.md'

/**
 * Ends the run with a status. The frame closes once, at the top, for every
 * stop, which is what the bash harness's `trap close_timeline EXIT` did.
 */
class Halt extends Error {
  constructor(readonly status: number) {
    super(`halted with ${status}`)
  }
}

function fail(message: string): never {
  logError(message)
  throw new Halt(1)
}

function must(status: number): void {
  if (status !== 0) throw new Halt(status)
}

interface RunOptions {
  readonly cwd?: string
  readonly env?: NodeJS.ProcessEnv
  readonly stdout?: 'ignore' | 'inherit'
  readonly stderr?: 'ignore' | 'inherit'
}

function run(command: string, args: string[], options: RunOptions): number {
  const stdio: StdioOptions = [
    'ignore',
    options.stdout ?? 'inherit',
    options.stderr ?? 'inherit',
  ]
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio,
  })

  return result.status ?? 1
}

function readGit(cwd: string, args: string[]): string | undefined {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })

  return result.status === 0 ? result.stdout : undefined
}

function finish(message: string): void {
  const { GREEN, NC } = palette(process.stderr)
  outro()
  process.stderr.write(`\n${GREEN}${message}${NC}\n`)
}

function listFixtureFiles(dir: string): string[] {
  if (!existsSync(dir)) return []

  return (readdirSync(dir, { recursive: true, encoding: 'utf8' }) as string[])
    .map((path) => join(dir, path))
    .filter((path) => statSync(path).isFile())
    .sort()
}

function stageAnchorTree(
  root: string,
  sandbox: string,
  env: NodeJS.ProcessEnv,
): void {
  // The anchor scenarios build their remote URL inside a command substitution,
  // where a failure would leave an empty remote, so the guard fires here first.
  if ((env.GITHUB_ORG ?? '') === '')
    fail(
      'GITHUB_ORG is empty. Export GITHUB_ORG=<org>, or run from a clone whose remote.origin.url points at GitHub.',
    )

  logStep('Staging anchor tree from fixture')

  const fixtureDir = join(root, ...ANCHOR_FIXTURE_PARTS)
  const files = listFixtureFiles(fixtureDir)
  const stray = files.filter((path) => !path.endsWith(FIXTURE_SUFFIX))
  if (stray.length > 0)
    fail(`Fixture missing the ${FIXTURE_SUFFIX} suffix: ${stray.join(' ')} `)
  if (files.length === 0)
    fail(`Anchor fixture provisions nothing: ${fixtureDir}`)

  rmSync(sandbox, { recursive: true, force: true })
  mkdirSync(sandbox, { recursive: true })
  for (const file of files) {
    const target = join(
      sandbox,
      relative(fixtureDir, file).slice(0, -FIXTURE_SUFFIX.length),
    )
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(file, target)
  }

  must(run('git', ['init'], { cwd: sandbox, env, stdout: 'ignore' }))
  must(run('git', ['add', '.'], { cwd: sandbox, env }))
  must(
    run(
      'git',
      [
        'commit',
        '-m',
        'feat(sandbox): initial sandbox setup from anchor',
        '--no-verify',
      ],
      { cwd: sandbox, env, stdout: 'ignore' },
    ),
  )
  logInfo(`Anchor tree staged from fixture, remote stays ${env.ANCHOR_REPO}`)
}

function initEmptyTree(sandbox: string, env: NodeJS.ProcessEnv): void {
  rmSync(sandbox, { recursive: true, force: true })
  mkdirSync(sandbox, { recursive: true })
  writeFileSync(join(sandbox, '.gitignore'), '.canon/tmp/\nnode_modules\n')

  must(run('git', ['init'], { cwd: sandbox, env, stdout: 'ignore' }))
  must(
    run('git', ['add', '.gitignore'], {
      cwd: sandbox,
      env,
      stdout: 'ignore',
      stderr: 'ignore',
    }),
  )
  must(
    run(
      'git',
      [
        'commit',
        '-m',
        'feat(sandbox): initial empty sandbox setup',
        '--no-verify',
      ],
      { cwd: sandbox, env, stdout: 'ignore' },
    ),
  )
}

/**
 * Scoped to the throwaway tree so the operator's global config is never
 * written. The empty value resets the helper list git concatenates across
 * scopes, so an operator's stale helper cannot win ahead of `gh`.
 */
function configureCredentials(sandbox: string, env: NodeJS.ProcessEnv): void {
  must(run('git', ['config', 'credential.helper', ''], { cwd: sandbox, env }))
  must(
    run(
      'git',
      ['config', '--add', 'credential.helper', '!gh auth git-credential'],
      { cwd: sandbox, env },
    ),
  )
}

/**
 * Runs the real installer rather than copying the source tree, so a change to
 * what install produces reaches the sandbox. Its own frame stays captured
 * unless it fails, where it is the only thing naming the cause.
 */
function install(
  root: string,
  label: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): void {
  const result = spawnSync('bun', [join(root, 'src', 'cli.ts'), ...args], {
    env: { ...env, CANON_NON_INTERACTIVE: '1' },
    encoding: 'utf8',
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  if (result.status === 0) return

  process.stderr.write(result.stderr ?? '')
  fail(`Could not install ${label} into the sandbox.`)
}

/**
 * No standards install. The corpus installs into no target, so a scenario
 * driving a skill that reads one takes the `canon standards <name>` path a real
 * project takes.
 */
function setupAssets(
  root: string,
  sandbox: string,
  env: NodeJS.ProcessEnv,
): void {
  if (
    (env.SANDBOX_INJECT_SEEDS ?? '') !== '' &&
    existsSync(join(root, 'tooling', 'claude', 'seeds'))
  )
    install(root, 'seeds', ['claude', 'init', sandbox], env)

  if (
    (env.SANDBOX_INJECT_GOV ?? '') !== '' &&
    existsSync(join(root, 'governance', 'rules'))
  )
    install(
      root,
      'gov rules',
      ['gov', 'install', env.SANDBOX_GOV_STACK || 'base', sandbox],
      env,
    )

  must(run('git', ['add', '.'], { cwd: sandbox, env }))
  const isStaged =
    run('git', ['diff', '--cached', '--quiet'], { cwd: sandbox, env }) !== 0
  if (isStaged)
    must(
      run(
        'git',
        [
          'commit',
          '-m',
          'chore(sandbox): initial environment setup',
          '--no-verify',
        ],
        { cwd: sandbox, env, stdout: 'ignore' },
      ),
    )
}

/**
 * Copies every skill body this checkout changed against the merge base into the
 * tree, so a scenario exercises the branch's skill rather than the installed
 * plugin's. The merge base against `origin/main` comes first, so a local `main`
 * trailing the remote does not pull in skills other merged branches changed.
 */
export function injectChangedSkills(
  root: string,
  sandbox: string,
  isSkipAutoCommit: boolean,
): string[] {
  const base = (
    readGit(root, ['merge-base', 'HEAD', 'origin/main']) ??
    readGit(root, ['merge-base', 'HEAD', 'main']) ??
    'main'
  ).trim()

  const changed =
    readGit(root, ['diff', base, '--name-only', '--', SKILL_PATHSPEC]) ?? ''
  const untracked =
    readGit(root, [
      'ls-files',
      '--others',
      '--exclude-standard',
      '--',
      SKILL_PATHSPEC,
    ]) ?? ''
  const paths = [
    ...new Set(
      `${changed}\n${untracked}`.split('\n').filter((p) => p.trim() !== ''),
    ),
  ]

  const injected: string[] = []
  for (const path of paths) {
    // A deleted skill lists beside a changed one, and nothing is left to inject.
    if (!existsSync(join(root, path))) continue

    const name = basename(dirname(path))
    const target = join(sandbox, '.claude', 'skills', name)
    mkdirSync(target, { recursive: true })
    copyFileSync(join(root, path), join(target, 'SKILL.md'))
    if (isSkipAutoCommit)
      appendFileSync(
        join(sandbox, '.git', 'info', 'exclude'),
        `.claude/skills/${name}/SKILL.md\n`,
      )
    logInfo(`Injected dev skill: ${name}`)
    injected.push(name)
  }

  return injected
}

/**
 * Commits what the scenario staged, unless it asked to stay uncommitted. A
 * scenario that staged nothing fails the commit, and the status passes through
 * as the bash harness's did.
 */
export function commitScenarioChanges(
  sandbox: string,
  isSkipAutoCommit: boolean,
  env: NodeJS.ProcessEnv,
): number {
  if (isSkipAutoCommit) {
    logInfo('Skipping auto-commit')
    return 0
  }

  logStep('Staging environment changes')
  const quiet = {
    cwd: sandbox,
    env,
    stdout: 'ignore',
    stderr: 'ignore',
  } as const
  const added = run('git', ['add', '.'], quiet)
  if (added !== 0) return added
  const committed = run(
    'git',
    [
      'commit',
      '-m',
      'chore(sandbox): apply scenario specific setup',
      '--no-verify',
    ],
    { cwd: sandbox, env, stdout: 'ignore' },
  )
  if (committed !== 0) return committed
  logInfo('Git state clean after setup')

  return 0
}

function tagBaseline(sandbox: string, env: NodeJS.ProcessEnv): void {
  const quiet = {
    cwd: sandbox,
    env,
    stdout: 'ignore',
    stderr: 'ignore',
  } as const
  must(run('git', ['update-ref', 'refs/sandbox/baseline', 'HEAD'], quiet))
  const tree = spawnSync('git', ['write-tree'], {
    cwd: sandbox,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  must(tree.status ?? 1)
  must(
    run(
      'git',
      ['update-ref', 'refs/sandbox/baseline-index', tree.stdout.trim()],
      quiet,
    ),
  )
}

interface Scenario {
  readonly category: string
  readonly command: string
  readonly arm: string | undefined
}

function provisionScenario(
  root: string,
  sandbox: string,
  scenario: Scenario,
  baseEnv: NodeJS.ProcessEnv,
): void {
  const env: NodeJS.ProcessEnv = { ...baseEnv }
  if (scenario.arm !== undefined) {
    env.SANDBOX_SCENARIO = scenario.arm
    env.CANON_NON_INTERACTIVE = '1'
  }

  const sandboxDir = join(root, 'sandbox')
  const file = join(sandboxDir, scenario.category, `${scenario.command}.sh`)
  if (!existsSync(file) || !statSync(file).isFile())
    fail(`Sandbox script not found: ${scenario.category}/${scenario.command}`)

  const probe = probeScenario(file, env)
  if (!probe.ok) throw new Halt(probe.status)
  Object.assign(env, probe.exports)

  if (!existsSync(sandboxDir))
    fail(`Sandbox directory not found at: ${sandboxDir}`)

  const cwd = process.cwd()
  if (cwd === sandbox || cwd.startsWith(`${sandbox}/`)) {
    logWarn(
      'Detected execution inside the sandbox. Switching to project root...',
    )
    process.chdir(root)
  }

  logStep(`Provisioning ${scenario.category}:${scenario.command}`)
  if (probe.isAnchor) stageAnchorTree(root, sandbox, env)
  else initEmptyTree(sandbox, env)
  configureCredentials(sandbox, env)
  setupAssets(root, sandbox, env)

  const staged = stageScenario(file, env)
  if (staged.status !== 0) throw new Halt(staged.status)
  Object.assign(env, staged.exports)

  const isSkipAutoCommit = (env.SANDBOX_SKIP_AUTO_COMMIT ?? '') !== ''
  injectChangedSkills(root, sandbox, isSkipAutoCommit)
  must(commitScenarioChanges(sandbox, isSkipAutoCommit, env))
  tagBaseline(sandbox, env)

  finish('✓ Sandbox Ready')
}

function cleanSandbox(sandbox: string): void {
  logStep('Removing sandbox')
  rmSync(sandbox, { recursive: true, force: true })
  logRemove(sandbox)
  finish('✓ Sandbox clean')
}

function isAtBaseline(sandbox: string): boolean {
  const head = readGit(sandbox, ['rev-parse', 'HEAD'])
  const baseline = readGit(sandbox, ['rev-parse', 'refs/sandbox/baseline'])
  if (head === undefined || head !== baseline) return false

  const baselineIndex = readGit(sandbox, [
    'rev-parse',
    'refs/sandbox/baseline-index',
  ])
  const index = readGit(sandbox, ['write-tree'])
  if (baselineIndex !== undefined && index !== baselineIndex) return false

  const quiet = { cwd: sandbox, stdout: 'ignore', stderr: 'ignore' } as const
  if (run('git', ['diff', '--quiet'], quiet) !== 0) return false

  const untracked = readGit(sandbox, [
    'ls-files',
    '--others',
    '--exclude-standard',
  ])

  return untracked === undefined || untracked === ''
}

async function resetSandbox(sandbox: string): Promise<void> {
  if (!existsSync(join(sandbox, '.git')))
    fail('No sandbox found. Run `canon sandbox` first.')

  logStep('Sandbox state')

  if (readGit(sandbox, ['rev-parse', 'refs/sandbox/baseline']) === undefined)
    fail('No baseline found. Re-provision with `canon sandbox <cat>:<cmd>`.')

  if (isAtBaseline(sandbox)) {
    logInfo('At baseline')
    finish('✓ Sandbox at baseline')
    return
  }

  logWarn('Uncommitted changes detected')

  const isConfirmed = await select({
    message: 'Reset sandbox to initial state?',
    options: [
      { value: true, label: 'Yes' },
      { value: false, label: 'No' },
    ],
    nonInteractiveDefault: true,
  })
  if (!isConfirmed) {
    logWarn('Reset cancelled')
    outro()
    return
  }

  logStep('Resetting sandbox')
  const quiet = { cwd: sandbox } as const
  must(
    run('git', ['reset', '--hard', 'refs/sandbox/baseline', '--quiet'], quiet),
  )
  must(run('git', ['clean', '-fd', '--quiet'], quiet))
  const baselineIndex = readGit(sandbox, [
    'rev-parse',
    'refs/sandbox/baseline-index',
  ])?.trim()
  const index = readGit(sandbox, ['write-tree'])?.trim()
  if (baselineIndex !== undefined && baselineIndex !== index) {
    must(run('git', ['read-tree', baselineIndex], quiet))
    must(run('git', ['checkout-index', '-a', '-f'], quiet))
  }
  logInfo('Sandbox reset to baseline')
  finish('✓ Sandbox reset complete')
}

/**
 * Splits `<category>:<command>` at the first colon, as `IFS=: read` did, so a
 * command name holding a colon keeps the rest.
 */
function parseTarget(target: string): { category: string; command: string } {
  const split = target.indexOf(':')
  if (split < 0)
    fail(
      "Invalid format. Use <category>:<command>, 'reset', 'clean', or --help",
    )

  return { category: target.slice(0, split), command: target.slice(split + 1) }
}

export interface SandboxRequest {
  /** False where a caller already opened the frame, as `run.sh` and the picker do. */
  readonly isHeader: boolean
  /** `<category>:<command>`, `reset`, or `clean`. */
  readonly target: string
  readonly arm: string | undefined
}

/**
 * Runs one `canon sandbox` request and returns its exit status. Every stop
 * closes the frame on the way out, success or not.
 */
export async function runSandbox(
  root: string,
  request: SandboxRequest,
): Promise<number> {
  if (request.isHeader) intro('canon sandbox')

  try {
    if (!process.cwd().startsWith(root))
      fail(
        'Context error: you must run this command from inside the toolkit repository.',
      )

    const sandbox = sandboxTree()
    const unsafe = assertSandboxDirSafe(sandbox, sandboxRoots(root))
    if (unsafe !== undefined) fail(unsafe)

    if (request.target === 'reset') {
      await resetSandbox(sandbox)
      return 0
    }

    if (request.target === 'clean') {
      cleanSandbox(sandbox)
      return 0
    }

    const { category, command } = parseTarget(request.target)
    provisionScenario(
      root,
      sandbox,
      { category, command, arm: request.arm },
      { ...process.env, PROJECT_ROOT: root, GIT_TERMINAL_PROMPT: '0' },
    )

    return 0
  } catch (error) {
    if (!(error instanceof Halt)) throw error
    outro()

    return error.status
  }
}
