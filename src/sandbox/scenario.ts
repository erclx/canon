import { spawnSync, type StdioOptions } from 'node:child_process'
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative } from 'node:path'
import { logError, logInfo, logStep, logWarn, palette, select } from '@/cli/ui'

/**
 * The TypeScript form of a sandbox scenario: `sandbox/<category>/<command>.ts`,
 * whose default export declares what the bash form split across `use_config`,
 * `use_anchor`, and `stage_setup`. Provisioning, the catalog, coverage, census,
 * and equivalence all read a scenario through this module, so a stem holding
 * either extension reads the same everywhere.
 *
 * Arms run in the harness process rather than a bash child, so nothing here
 * spawns without the tree as its `cwd`. A scenario reaches the tree through the
 * context alone.
 */

/** Holds fixture content rather than scenarios, so no listing reads it as a category. */
export const FIXTURES_DIR = 'fixtures'

export const FIXTURE_SUFFIX = '.fixture'

/** A scenario whose only arm carries this name routes none, as a bash file with no picker did. */
export const DEFAULT_ARM_NAME = 'default'

/** Every bash scenario passed this prompt to `select_or_route_scenario`. */
const ROUTE_PROMPT = 'Which scenario?'

/** Every scenario that sets the anchor pushes to this one throwaway repository. */
export const SANDBOX_ANCHOR_REPO = 'canon-sandbox'

const EXTENSIONS = ['.ts', '.sh'] as const

export type ScenarioKind = 'ts' | 'sh'

export type ArmSetup = (ctx: StageContext) => void | Promise<void>

export interface ScenarioDefinition {
  /** The `use_config` exports: presence flags such as `SANDBOX_SKIP_AUTO_COMMIT`. */
  readonly config?: Readonly<Record<string, string>>
  /** Stages the tree from the anchor fixture and names the throwaway remote. */
  readonly anchor?: boolean
  /** In routing order, so the first arm is the one a headless caller gets. */
  readonly arms: Readonly<Record<string, ArmSetup>>
}

export function scenario(definition: ScenarioDefinition): ScenarioDefinition {
  return definition
}

export interface ScenarioFile {
  readonly command: string
  readonly file: string
  readonly kind: ScenarioKind
}

/**
 * Lists the scenarios in one category folder, one per stem. A stem present in
 * both forms is reported apart rather than listed twice, since picking one
 * without saying so is the failure the refusal exists to prevent.
 */
export function listScenarioFiles(categoryDir: string): {
  scenarios: ScenarioFile[]
  ambiguous: string[]
} {
  const byStem = new Map<string, ScenarioFile[]>()
  for (const entry of readdirSync(categoryDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue
    const kind = EXTENSIONS.find((ext) => entry.name.endsWith(ext))
    if (kind === undefined) continue
    const command = entry.name.slice(0, -kind.length)
    const found = byStem.get(command) ?? []
    found.push({
      command,
      file: join(categoryDir, entry.name),
      kind: kind === '.ts' ? 'ts' : 'sh',
    })
    byStem.set(command, found)
  }

  const scenarios: ScenarioFile[] = []
  const ambiguous: string[] = []
  for (const [command, found] of [...byStem].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (found.length > 1) ambiguous.push(command)
    else if (found[0] !== undefined) scenarios.push(found[0])
  }

  return { scenarios, ambiguous }
}

/** Every category folder under `sandbox/`, fixtures excluded. */
export function listCategories(sandboxDir: string): string[] {
  if (!existsSync(sandboxDir)) return []

  return readdirSync(sandboxDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== FIXTURES_DIR)
    .map((entry) => entry.name)
    .sort()
}

export type ResolvedScenario =
  | ({ readonly ok: true } & ScenarioFile)
  | { readonly ok: false; readonly reason: 'missing' | 'ambiguous' }

export function resolveScenarioFile(
  sandboxDir: string,
  category: string,
  command: string,
): ResolvedScenario {
  const found = EXTENSIONS.map((ext) =>
    join(sandboxDir, category, `${command}${ext}`),
  ).filter((path) => existsSync(path) && statSync(path).isFile())
  if (found.length > 1) return { ok: false, reason: 'ambiguous' }
  const file = found[0]
  if (file === undefined) return { ok: false, reason: 'missing' }

  return { ok: true, command, file, kind: file.endsWith('.ts') ? 'ts' : 'sh' }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Imports a scenario module and checks its shape, throwing on one that would
 * provision something other than what it declares. Synchronous, since the
 * catalog readers that call it are.
 */
export function loadScenario(file: string): ScenarioDefinition {
  const module: unknown = createRequire(import.meta.url)(file)
  const definition = isRecord(module) ? module.default : undefined
  if (!isRecord(definition))
    throw new Error(`${file} has no default export from scenario()`)

  const { arms, config, anchor } = definition
  if (!isRecord(arms) || Object.keys(arms).length === 0)
    throw new Error(`${file} declares no arms`)
  for (const [name, setup] of Object.entries(arms))
    if (typeof setup !== 'function')
      throw new Error(`${file} arm "${name}" is not a function`)
  if (
    config !== undefined &&
    (!isRecord(config) ||
      Object.values(config).some((v) => typeof v !== 'string'))
  )
    throw new Error(`${file} config holds a value that is not a string`)
  if (anchor !== undefined && typeof anchor !== 'boolean')
    throw new Error(`${file} anchor is not a boolean`)

  return definition as unknown as ScenarioDefinition
}

/** The arm names a caller routes to, empty for a scenario that routes none. */
export function armNames(definition: ScenarioDefinition): string[] {
  const names = Object.keys(definition.arms)

  return names.length === 1 && names[0] === DEFAULT_ARM_NAME ? [] : names
}

/** Twin of `scripts/config.sh`, which derives the organization from the toolkit's own remote. */
function deriveGithubOrg(root: string, env: NodeJS.ProcessEnv): string {
  if ((env.GITHUB_ORG ?? '') !== '') return env.GITHUB_ORG ?? ''

  const origin = spawnSync('git', ['config', '--get', 'remote.origin.url'], {
    cwd: root,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  const url = origin.status === 0 ? origin.stdout.trim() : ''

  return (
    /^(?:git@github\.com:|https:\/\/github\.com\/)([^/]+)\/.+/.exec(url)?.[1] ??
    ''
  )
}

/**
 * What the bash probe reported for a scenario: its config, the organization
 * `config.sh` derives, and the anchor's repository name. These land in the one
 * environment provisioning passes to every child, the seed and gov installs
 * included.
 */
export function scenarioExports(
  definition: ScenarioDefinition,
  root: string,
  env: NodeJS.ProcessEnv,
): Record<string, string> {
  const exports: Record<string, string> = {
    GITHUB_ORG: deriveGithubOrg(root, env),
    ...definition.config,
  }
  if (definition.anchor === true) exports.ANCHOR_REPO = SANDBOX_ANCHOR_REPO

  return exports
}

/**
 * Ends an arm early. `exited` is a `stage_setup` that failed or called `exit`,
 * and `replaced` is one that handed the run to a verb through `exec`.
 */
export class ScenarioStop extends Error {
  constructor(
    readonly status: number,
    readonly ending: 'exited' | 'replaced',
  ) {
    super(`scenario stopped with ${status}`)
  }
}

export interface RunOptions {
  readonly stdout?: 'inherit' | 'ignore'
  readonly stderr?: 'inherit' | 'ignore'
  /** Returns a failing status rather than stopping the arm, the `|| true` of the bash form. */
  readonly allowFailure?: boolean
}

export interface StageContext {
  /** The sandbox tree, which every command the context runs takes as its `cwd`. */
  readonly dir: string
  readonly root: string
  /** Passed to every command, and read back by provisioning once the arm returns. */
  readonly env: NodeJS.ProcessEnv
  readonly arm: string | undefined
  readonly log: {
    info(message: string): void
    step(message: string): void
    warn(message: string): void
    /** A bare frame line, the `echo -e "${GREY}│${NC}"` of the bash form. */
    bar(): void
  }
  fixtures(category: string, command: string, arm: string, stage: string): void
  git(...args: string[]): void
  /** `git commit -m <subject> --no-verify -q`, over whatever is staged. */
  commit(subject: string): void
  run(command: string, args: readonly string[], options?: RunOptions): number
  /** Runs a command and returns its stdout, stopping the arm on a failure. */
  read(command: string, args: readonly string[], options?: RunOptions): string
  write(path: string, content: string): void
  append(path: string, content: string): void
  mkdir(path: string): void
  readFile(path: string): string
  /** Sets the author `configure_sandbox_git_identity` did. */
  identity(): void
  /** Probes the anchor, sets the author, and points `origin` at it. */
  anchorRemote(): void
  fail(message: string): never
  /** Hands the run to a verb whose own frame closes it. */
  exec(command: string, args: readonly string[]): never
}

/** Every file under a folder, sorted, the order `find | sort` gave the bash form. */
export function listFixtureFiles(dir: string): string[] {
  if (!existsSync(dir)) return []

  return (readdirSync(dir, { recursive: true, encoding: 'utf8' }) as string[])
    .map((path) => join(dir, path))
    .filter((path) => statSync(path).isFile())
    .sort()
}

interface ContextOptions {
  readonly root: string
  readonly dir: string
  readonly env: NodeJS.ProcessEnv
  readonly arm: string | undefined
}

export function createStageContext(options: ContextOptions): StageContext {
  const { root, dir, env } = options

  const fail = (message: string): never => {
    logError(message)
    throw new ScenarioStop(1, 'exited')
  }

  const spawn = (
    command: string,
    args: readonly string[],
    stdout: 'inherit' | 'ignore' | 'pipe',
    stderr: 'inherit' | 'ignore' | 'pipe',
  ) => {
    const stdio: StdioOptions = ['ignore', stdout, stderr]

    return spawnSync(command, [...args], {
      cwd: dir,
      env,
      encoding: 'utf8',
      stdio,
    })
  }

  const run = (
    command: string,
    args: readonly string[],
    runOptions: RunOptions = {},
  ): number => {
    const result = spawn(
      command,
      args,
      runOptions.stdout ?? 'inherit',
      runOptions.stderr ?? 'inherit',
    )
    const status = result.status ?? 1
    if (status !== 0 && runOptions.allowFailure !== true)
      throw new ScenarioStop(status, 'exited')

    return status
  }

  const read = (
    command: string,
    args: readonly string[],
    runOptions: RunOptions = {},
  ): string => {
    const result = spawn(command, args, 'pipe', runOptions.stderr ?? 'inherit')
    const status = result.status ?? 1
    if (status !== 0 && runOptions.allowFailure !== true)
      throw new ScenarioStop(status, 'exited')

    return status === 0 ? result.stdout : ''
  }

  const git = (...args: string[]): void => {
    run('git', args)
  }

  const inTree = (path: string): string => join(dir, path)

  const identity = (): void => {
    const globalValue = (key: string): string =>
      read('git', ['config', '--global', key], {
        stderr: 'ignore',
        allowFailure: true,
      }).trim()
    env.SANDBOX_GIT_NAME =
      env.SANDBOX_GIT_NAME || globalValue('user.name') || 'canon-sandbox'
    env.SANDBOX_GIT_EMAIL =
      env.SANDBOX_GIT_EMAIL ||
      globalValue('user.email') ||
      'sandbox@example.com'
    git('config', 'user.name', env.SANDBOX_GIT_NAME)
    git('config', 'user.email', env.SANDBOX_GIT_EMAIL)
  }

  /**
   * `gh` answers an absent repository and an unreachable host with one status,
   * so the 404 alone separates them. Creating is the opt-in, for the reason
   * `ensure_sandbox_anchor_repo` in `scripts/lib/sandbox-git.sh` records.
   */
  const ensureAnchorRepo = (org: string, repo: string): void => {
    const probe = spawn(
      'gh',
      ['api', `repos/${org}/${repo}`, '--silent'],
      'pipe',
      'pipe',
    )
    if (probe.status === 0) return

    const output = `${probe.stdout ?? ''}${probe.stderr ?? ''}`.trim()
    if (!output.includes('HTTP 404'))
      fail(`Cannot reach ${org}/${repo}: ${output}`)
    if (!['1', 'true'].includes(env.SANDBOX_ANCHOR_CREATE ?? ''))
      fail(
        `${org}/${repo} does not exist. Check GITHUB_ORG and whether a rename is pending, then create it with 'gh repo create ${org}/${repo} --private' or re-run with SANDBOX_ANCHOR_CREATE=true.`,
      )

    logWarn(
      `${org}/${repo} does not exist and SANDBOX_ANCHOR_CREATE is set. Creating it as private.`,
    )
    const created = spawn(
      'gh',
      ['repo', 'create', `${org}/${repo}`, '--private'],
      'pipe',
      'pipe',
    )
    if (created.status !== 0)
      fail(
        `Could not create ${org}/${repo}: ${`${created.stdout ?? ''}${created.stderr ?? ''}`.trim()}`,
      )
    logInfo(`Created ${org}/${repo} as a private repository.`)
  }

  const anchorRemote = (): void => {
    const org = env.GITHUB_ORG ?? ''
    const repo = env.ANCHOR_REPO ?? ''
    if (org === '')
      fail(
        'GITHUB_ORG is empty. Export GITHUB_ORG=<org>, or run from a clone whose remote.origin.url points at GitHub.',
      )
    if (repo === '')
      fail(
        'The anchor remote needs a repository name. Set anchor: true on the scenario.',
      )
    ensureAnchorRepo(org, repo)
    identity()
    run('git', ['remote', 'remove', 'origin'], {
      stderr: 'ignore',
      allowFailure: true,
    })
    git('remote', 'add', 'origin', `https://github.com/${org}/${repo}.git`)
  }

  /** Twin of `stage_fixtures` in `scripts/lib/sandbox-fixtures.sh`. */
  const fixtures = (
    category: string,
    command: string,
    arm: string,
    stage: string,
  ): void => {
    const stageDir = join(
      root,
      'sandbox',
      FIXTURES_DIR,
      category,
      command,
      arm,
      stage,
    )
    if (!existsSync(stageDir))
      fail(`Fixture stage not found: ${category}/${command}/${arm}/${stage}`)

    const createFiles = listFixtureFiles(join(stageDir, 'create'))
    const appendFiles = listFixtureFiles(join(stageDir, 'append'))
    for (const files of [createFiles, appendFiles]) {
      const stray = files.filter((path) => !path.endsWith(FIXTURE_SUFFIX))
      if (stray.length > 0)
        fail(
          `Fixture missing the ${FIXTURE_SUFFIX} suffix: ${stray.join(' ')} `,
        )
    }
    if (createFiles.length + appendFiles.length === 0)
      fail(
        `Fixture stage provisions nothing: ${category}/${command}/${arm}/${stage}`,
      )

    const target = (base: string, file: string): string =>
      relative(base, file).slice(0, -FIXTURE_SUFFIX.length)

    for (const file of createFiles) {
      const path = inTree(target(join(stageDir, 'create'), file))
      mkdirSync(dirname(path), { recursive: true })
      copyFileSync(file, path)
    }
    // An append extends a file the anchor or the seeds provide, so a missing
    // target means that upstream shape changed rather than a file to create.
    for (const file of appendFiles) {
      const rel = target(join(stageDir, 'append'), file)
      if (!existsSync(inTree(rel))) fail(`Append fixture has no target: ${rel}`)
      appendFileSync(inTree(rel), readFileSync(file))
    }
  }

  return {
    dir,
    root,
    env,
    arm: options.arm,
    log: {
      info: logInfo,
      step: logStep,
      warn: logWarn,
      bar: () => {
        const { GREY, NC } = palette(process.stderr)
        process.stderr.write(`${GREY}│${NC}\n`)
      },
    },
    fixtures,
    git,
    commit: (subject) => git('commit', '-m', subject, '--no-verify', '-q'),
    run,
    read,
    write: (path, content) => {
      mkdirSync(dirname(inTree(path)), { recursive: true })
      writeFileSync(inTree(path), content)
    },
    append: (path, content) => appendFileSync(inTree(path), content),
    mkdir: (path) => mkdirSync(inTree(path), { recursive: true }),
    readFile: (path) => readFileSync(inTree(path), 'utf8'),
    identity,
    anchorRemote,
    fail,
    exec: (command, args) => {
      const result = spawnSync(command, [...args], {
        cwd: dir,
        env,
        stdio: 'inherit',
      })
      throw new ScenarioStop(result.status ?? 1, 'replaced')
    },
  }
}

/**
 * Picks the arm the way `select_or_route_scenario` did: a routed name first,
 * echoed on the frame, then the first arm for a headless caller, then a prompt.
 */
async function routeArm(
  names: readonly string[],
  env: NodeJS.ProcessEnv,
): Promise<string> {
  const echo = (name: string): string => {
    const { GREY, NC, WHITE } = palette(process.stderr)
    process.stderr.write(
      `${GREY}│${NC}\n${GREY}◇${NC} ${ROUTE_PROMPT} ${WHITE}${name}${NC}\n`,
    )

    return name
  }

  const routed = env.SANDBOX_SCENARIO ?? ''
  if (routed !== '') return echo(routed)

  // Read off the scenario's environment rather than this process's, as
  // `is_non_interactive` read the shell it ran in.
  const isHeadless =
    env.CANON_NON_INTERACTIVE === '1' ||
    // canon-keep-retired
    env.AITK_NON_INTERACTIVE === '1'
  if (isHeadless) return echo(names[0] ?? DEFAULT_ARM_NAME)

  if (!process.stdin.isTTY) {
    logError(
      `${ROUTE_PROMPT} requires a TTY. Pass an argument or set CANON_NON_INTERACTIVE=1.`,
    )
    throw new ScenarioStop(1, 'exited')
  }

  return select({
    message: ROUTE_PROMPT,
    options: names.map((name) => ({ value: name, label: name })),
  })
}

export interface StageOutcome {
  readonly status: number
  readonly ending: 'returned' | 'exited' | 'replaced'
}

/**
 * Routes and runs one arm in process. Any throw ends the arm the way a failing
 * command ended `stage_setup` under `set -e`, so provisioning stops before the
 * baseline refs are written.
 */
export async function stageScenarioInProcess(
  definition: ScenarioDefinition,
  options: ContextOptions,
): Promise<StageOutcome> {
  try {
    const names = armNames(definition)
    const name =
      names.length === 0 ? DEFAULT_ARM_NAME : await routeArm(names, options.env)
    const setup = Object.hasOwn(definition.arms, name)
      ? definition.arms[name]
      : undefined
    if (setup === undefined) {
      logError(`Unknown scenario: ${name}`)
      return { status: 1, ending: 'exited' }
    }

    await setup(
      createStageContext({
        ...options,
        arm: names.length === 0 ? undefined : name,
      }),
    )

    return { status: 0, ending: 'returned' }
  } catch (error) {
    if (error instanceof ScenarioStop)
      return { status: error.status, ending: error.ending }
    logError(error instanceof Error ? error.message : String(error))

    return { status: 1, ending: 'exited' }
  }
}
