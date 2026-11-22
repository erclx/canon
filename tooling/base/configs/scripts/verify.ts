// Runs this folder's verify phases in the order scripts/verify.json names.
// Only node: modules, since a target's linter and tsc read it with no Bun
// types.
import { spawnSync } from 'node:child_process'
import {
  accessSync,
  constants,
  existsSync,
  readFileSync,
  realpathSync,
} from 'node:fs'
import { delimiter, dirname, join } from 'node:path'

interface Tool {
  readonly name: string
  readonly hint?: string
}

interface Precondition {
  readonly path: string
  readonly hint: string
}

interface PhaseList {
  readonly require: readonly string[]
  readonly tools: readonly Tool[]
  readonly preconditions: readonly Precondition[]
}

interface Phase {
  readonly script: string
  readonly title: string
  readonly failed: string
  readonly passed: string
  readonly tools?: readonly Tool[]
}

const SHELL_TOOLS_HINT =
  "Install it with 'sudo apt-get install shfmt shellcheck' or 'brew install shfmt shellcheck'"

const PHASES: readonly Phase[] = [
  {
    script: 'typecheck',
    title: 'Typecheck',
    failed: 'Typecheck failed',
    passed: 'Typecheck passed',
  },
  {
    script: 'lint',
    title: 'Lint',
    failed: 'Lint failed',
    passed: 'Lint passed',
  },
  {
    script: 'check:format',
    title: 'Format check',
    failed: "Format check failed. Run 'bun run format' to fix it",
    passed: 'Format check passed',
  },
  {
    script: 'check:shell',
    title: 'Shell',
    failed: 'Shell check failed',
    passed: 'Shell check passed',
    tools: [
      { name: 'shfmt', hint: SHELL_TOOLS_HINT },
      { name: 'shellcheck', hint: SHELL_TOOLS_HINT },
    ],
  },
  {
    script: 'test:run',
    title: 'Unit tests',
    failed: 'Unit tests failed',
    passed: 'Unit tests passed',
  },
  {
    script: 'build',
    title: 'Build',
    failed: 'Build failed',
    passed: 'Build passed',
  },
]

// A subfolder synced with --skip base declares none of these, since the
// repository root owns them, so a list that does not require one runs it only
// where the folder declares it.
const BASE_PHASES = new Set(['check:format'])

// An add-on stack declares these, keyed to the stack that ships each, so a
// folder that never synced the add-on skips the phase rather than failing it.
const ADD_ON_PHASES = new Map([['check:shell', 'shell']])

const PHASE_LIST = 'scripts/verify.json'
const CARD_EXCLUSION = 'scripts/check-card-exclusion.sh'
const HEAD_META = 'scripts/check-head-meta.sh'

const GREEN = '\x1b[0;32m'
const RED = '\x1b[0;31m'
const WHITE = '\x1b[1;37m'
const GREY = '\x1b[0;90m'
const NC = '\x1b[0m'

const isNested = (process.env.VERIFY_NESTED || 'false') !== 'false'
let hasStepped = false

class VerifyFailure extends Error {}

function print(line: string): void {
  process.stdout.write(`${line}\n`)
}

function logInfo(message: string): void {
  print(`${GREY}│${NC} ${GREEN}✓${NC} ${message}`)
}

function logSkip(message: string): void {
  print(`${GREY}│ - ${message}${NC}`)
}

function fail(message: string): never {
  print(`${GREY}│${NC} ${RED}✗${NC} ${message}`)
  throw new VerifyFailure(message)
}

function logStep(title: string): void {
  if (hasStepped) print(`${GREY}│${NC}`)
  print(`${GREY}├${NC} ${WHITE}${title}${NC}`)
  hasStepped = true
}

function pipeOutput(output: string): void {
  for (const line of output.replace(/\n+$/, '').split('\n')) {
    print(`${GREY}│${NC}  ${line}`)
  }
}

function isExecutable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

function onPath(name: string): boolean {
  return (process.env.PATH ?? '')
    .split(delimiter)
    .some((dir) => dir !== '' && isExecutable(join(dir, name)))
}

// Runs through sh so stderr interleaves with stdout the way 2>&1 does.
function capture(
  command: string,
  args: readonly string[] = [],
): {
  readonly code: number
  readonly output: string
} {
  const result = spawnSync(
    '/bin/sh',
    ['-c', `${command} 2>&1`, 'sh', ...args],
    {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    },
  )
  return { code: result.status ?? 1, output: result.stdout ?? '' }
}

function runCheck(command: string, failed: string): void {
  const { code, output } = capture(command)
  pipeOutput(output)
  if (code !== 0) fail(failed)
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return undefined
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function readPhaseList(): PhaseList {
  if (!existsSync(PHASE_LIST)) {
    fail(
      `No ${PHASE_LIST} here. Run 'canon tooling sync <stack>' so the stack ships its phase list`,
    )
  }
  const parsed = readJson(PHASE_LIST)
  if (parsed === undefined) fail(`${PHASE_LIST} is not valid JSON`)

  const table = asRecord(parsed)
  return {
    require: asArray(table.require).filter(
      (entry): entry is string => typeof entry === 'string',
    ),
    tools: asArray(table.tools).flatMap((entry) => {
      const tool = asRecord(entry)
      if (typeof tool.name !== 'string') return []
      return [
        {
          name: tool.name,
          hint: typeof tool.hint === 'string' ? tool.hint : undefined,
        },
      ]
    }),
    preconditions: asArray(table.preconditions).flatMap((entry) => {
      const precondition = asRecord(entry)
      if (typeof precondition.path !== 'string') return []
      return [
        {
          path: precondition.path,
          hint: typeof precondition.hint === 'string' ? precondition.hint : '',
        },
      ]
    }),
  }
}

function readDeclaredScripts(): Set<string> {
  if (!existsSync('package.json')) {
    fail('No package.json here. Sync the stack to write one')
  }
  return new Set(
    Object.keys(asRecord(asRecord(readJson('package.json')).scripts)),
  )
}

function checkTools(tools: readonly Tool[]): void {
  for (const tool of tools) {
    if (onPath(tool.name)) continue
    fail(
      tool.hint === undefined
        ? `${tool.name} is not installed`
        : `${tool.name} is not installed. ${tool.hint}`,
    )
  }
}

function checkPreconditions(list: PhaseList): void {
  for (const precondition of list.preconditions) {
    if (isExecutable(precondition.path)) continue
    fail(`No ${precondition.path} here. ${precondition.hint}`.trimEnd())
  }
}

function runPhase(
  phase: Phase,
  required: boolean,
  declared: Set<string>,
): void {
  const isBase = BASE_PHASES.has(phase.script)
  const addOn = ADD_ON_PHASES.get(phase.script)
  if (!required && !isBase && addOn === undefined) return

  logStep(phase.title)
  if (!declared.has(phase.script)) {
    if (required) {
      fail(
        `${phase.script} is required by ${PHASE_LIST}, but package.json declares no such script`,
      )
    }
    logSkip(
      addOn === undefined
        ? `Skipped: ${phase.script} is not declared here, so the repository root runs it`
        : `Skipped: ${phase.script} is not declared here. Run 'canon tooling sync ${addOn} . --write' to add it`,
    )
    return
  }
  checkTools(phase.tools ?? [])
  runCheck(`bun run ${phase.script}`, phase.failed)
  logInfo(phase.passed)
}

// A canon on PATH wins. Under CI, bunx fetches the release the last sync
// stamped, and a local run with neither skips rather than stalling a hook on
// a fetch. CI reads as the literal 'true' only.
const STAMP = 'canon/config/config.json'
const INSTALL_HINT = 'Install with `bun install --global @erclx/canon`.'
const isCi = process.env.CI === 'true'

type Canon =
  | { readonly kind: 'run'; readonly command: string }
  | { readonly kind: 'skip' }

function readStampVersion(): string | undefined {
  const tooling = asRecord(asRecord(asRecord(readJson(STAMP)).domains).tooling)
  const version = tooling.version
  // The version reaches a shell string, so only a release number passes.
  return typeof version === 'string' &&
    /^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/.test(version)
    ? version
    : undefined
}

function resolveCanon(): Canon {
  if (onPath('canon')) return { kind: 'run', command: 'canon' }
  if (!isCi) return { kind: 'skip' }
  const version = readStampVersion()
  if (version === undefined) {
    fail(
      `No canon on PATH and no tooling version in ${STAMP} to pin bunx to, so CI cannot run this stage. Run 'canon tooling sync <stack>' to stamp one`,
    )
  }
  return { kind: 'run', command: `bunx -y @erclx/canon@${version}` }
}

function skipNoCanon(): void {
  logSkip(`Skipped: no canon binary on PATH. ${INSTALL_HINT}`)
}

// Exit 1 is a refusal that measured nothing, and through bunx a failed fetch
// too. Locally that skips. Under CI the stage fails, since a skip there is
// the gate passing on nothing.
function refused(reason: string, output: string): void {
  if (!isCi) {
    logSkip(`Skipped: ${reason}, and measured nothing.`)
    return
  }
  pipeOutput(output)
  fail(`${reason}, and measured nothing. Under CI that fails the stage`)
}

interface GateStage {
  readonly label: string
  readonly status: string
  readonly failure?: string
  readonly output?: string
}

interface GateRecord {
  readonly ok: boolean
  readonly root: string
  readonly stages: readonly GateStage[]
}

function parseGateRecord(stdout: string): GateRecord | undefined {
  const lines = stdout.trim().split('\n')
  const record = asRecord(readJsonText(lines[lines.length - 1] ?? ''))
  if (typeof record.ok !== 'boolean' || typeof record.root !== 'string') {
    return undefined
  }
  return {
    ok: record.ok,
    root: record.root,
    stages: asArray(record.stages).flatMap((entry) => {
      const stage = asRecord(entry)
      if (typeof stage.label !== 'string' || typeof stage.status !== 'string') {
        return []
      }
      return [
        {
          label: stage.label,
          status: stage.status,
          failure:
            typeof stage.failure === 'string' ? stage.failure : undefined,
          output: typeof stage.output === 'string' ? stage.output : undefined,
        },
      ]
    }),
  }
}

function readJsonText(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function sameDirectory(a: string, b: string): boolean {
  try {
    return realpathSync(a) === realpathSync(b)
  } catch {
    return false
  }
}

// canon gate run prints one JSON record, exiting 1 when a stage failed. No
// record means an old canon or a failed fetch, and a record naming another
// root means a gate that checked its own install.
function checkCanonGate(): void {
  const canon = resolveCanon()
  if (canon.kind === 'skip') {
    skipNoCanon()
    return
  }

  const result = spawnSync(
    '/bin/sh',
    ['-c', `${canon.command} gate run --nested --json`],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
  )
  const stdout = result.stdout ?? ''
  const output = `${stdout}${result.stderr ?? ''}`
  const record = parseGateRecord(stdout)
  if (record === undefined) {
    refused(
      'canon gate run refused, is missing from this canon, or could not be fetched',
      output,
    )
    return
  }
  if (!sameDirectory(record.root, process.cwd())) {
    refused(
      `canon gate run checked ${record.root} rather than this project, so this canon predates the shared check set. ${INSTALL_HINT}`,
      output,
    )
    return
  }

  for (const stage of record.stages) {
    if (stage.status === 'passed') logInfo(stage.label)
    else if (stage.status === 'skipped') logSkip(`${stage.label}: skipped`)
    else if (stage.status === 'unmeasured') {
      logSkip(`${stage.label}: measured nothing`)
    } else if (stage.status === 'failed') {
      if (stage.output !== undefined) pipeOutput(stage.output)
      fail(
        `${stage.label}: ${stage.failure ?? 'failed'}. Run 'canon gate run' to read each finding`,
      )
    }
  }

  if (result.status !== 0 || !record.ok) {
    fail(
      `canon gate run exited ${result.status ?? 1} with no failed stage named`,
    )
  }
}

// Found from tracked files, since verify.json is golden and a list kept in it
// is lost on sync. An untracked folder never runs, and a tracked one runs
// whatever .gitignore says. Outside a git repository none are found.
function findNestedRoots(): string[] {
  const result = spawnSync(
    'git',
    ['ls-files', '-z', '--', ':(glob)**/scripts/verify.json'],
    { encoding: 'utf8' },
  )
  if (result.status !== 0) return []
  return (result.stdout ?? '')
    .split('\0')
    .filter((path) => path !== '' && path !== PHASE_LIST)
    .map((path) => dirname(dirname(path)))
}

function runNestedRoot(root: string): void {
  logStep(`Nested root ${root}`)
  const runner = join(root, 'scripts/verify.ts')
  if (!existsSync(runner)) {
    fail(
      `No ${runner} here, though git tracks ${root}/${PHASE_LIST}. Sync the stack into ${root} or stage its removal`,
    )
  }
  const result = spawnSync(process.execPath, ['scripts/verify.ts'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, VERIFY_NESTED: 'true' },
    maxBuffer: 256 * 1024 * 1024,
  })
  pipeOutput(`${result.stdout ?? ''}${result.stderr ?? ''}`)
  if (result.error !== undefined) {
    fail(`Nested root ${root} could not start: ${result.error.message}`)
  }
  if (result.status !== 0) fail(`Nested root ${root} failed`)
  logInfo(`Nested root ${root} passed`)
}

function main(): void {
  const declared = readDeclaredScripts()
  const list = readPhaseList()
  checkTools(list.tools)
  checkPreconditions(list)

  if (!isNested) print(`${GREY}┌${NC}`)

  const required = new Set(list.require)
  for (const phase of PHASES) {
    runPhase(phase, required.has(phase.script), declared)
  }

  logStep('Canon checks')
  checkCanonGate()

  // The card check reads the build, so it runs last, where its stack shipped it.
  if (existsSync(CARD_EXCLUSION)) {
    logStep('Card exclusion')
    runCheck(`bash ${CARD_EXCLUSION}`, 'Card exclusion check failed')
    logInfo('Card exclusion passed')
  }

  // The head tag check reads the build too, where its stack shipped it.
  if (existsSync(HEAD_META)) {
    logStep('Head tags')
    runCheck(`bash ${HEAD_META}`, 'Head tag check failed')
    logInfo('Head tags passed')
  }

  // A nested run never discovers, so a subfolder's own subfolders run once.
  if (!isNested) {
    for (const root of findNestedRoots()) runNestedRoot(root)
  }

  if (!isNested) {
    print(`${GREY}└${NC}\n`)
    print(`${GREEN}✓ Verification passed${NC}`)
  }
}

try {
  main()
} catch (error) {
  if (!(error instanceof VerifyFailure)) throw error
  process.exitCode = 1
}
