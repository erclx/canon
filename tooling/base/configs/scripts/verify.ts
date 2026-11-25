// Runs this folder's verify phases in the order scripts/verify.json names.
// Only node: modules, since a target's linter and tsc read it with no Bun
// types.
import { spawnSync } from 'node:child_process'
import {
  accessSync,
  constants,
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
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

// CI runs these whole, so changed mode leaves them out and runs the tied tests.
const CI_PHASES = new Set(['test:run', 'build'])
const TIED_TESTS = 'test:changed'
// Past this a change is a sweep, and its run is the suite CI runs anyway.
const MAX_TIED_TESTS = 40

const PHASE_LIST = 'scripts/verify.json'
const CARD_EXCLUSION = 'scripts/check-card-exclusion.sh'
const HEAD_META = 'scripts/check-head-meta.sh'

const GREEN = '\x1b[0;32m'
const RED = '\x1b[0;31m'
const WHITE = '\x1b[1;37m'
const GREY = '\x1b[0;90m'
const NC = '\x1b[0m'

const USAGE = 'Usage: bun scripts/verify.ts [--changed [--force]]'

const isNested = (process.env.VERIFY_NESTED || 'false') !== 'false'
let hasStepped = false
// False once a check skipped for a reason no pass key holds.
let isMeasured = true

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

function runCheck(
  command: string,
  failed: string,
  args: readonly string[] = [],
): void {
  const { code, output } = capture(command, args)
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

// The root reads this phrase off a nested run's output, its one channel.
const UNMEASURED = 'measured nothing'

// Exit 1 is a refusal that measured nothing, and through bunx a failed fetch
// too. Locally that skips. Under CI the stage fails, since a skip there is
// the gate passing on nothing.
function refused(reason: string, output: string): void {
  if (!isCi) {
    isMeasured = false
    logSkip(`Skipped: ${reason}, and ${UNMEASURED}.`)
    return
  }
  pipeOutput(output)
  fail(`${reason}, and ${UNMEASURED}. Under CI that fails the stage`)
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
      isMeasured = false
      logSkip(`${stage.label}: ${UNMEASURED}`)
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

// A hook exports these, and each would point a call at the hook's repository
// and root rather than at the folder it runs in.
const HOOK_GIT_ENV = new Set([
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_PREFIX',
  'GIT_COMMON_DIR',
  'GIT_OBJECT_DIRECTORY',
])

// Undefined where the call failed, since each caller decides what that means.
function git(
  args: readonly string[],
  env: Readonly<Record<string, string>> = {},
): string | undefined {
  const inherited = Object.entries(process.env).filter(
    ([name]) => !HOOK_GIT_ENV.has(name),
  )
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    env: { ...Object.fromEntries(inherited), ...env },
    maxBuffer: 256 * 1024 * 1024,
  })
  return result.status === 0 ? result.stdout : undefined
}

function splitPaths(output: string): string[] {
  return output.split('\0').filter((path) => path !== '')
}

const TRUNKS = ['origin/main', 'origin/master']

// The one trunk the web workflow starts on, and a pull request is what starts it.
const CI_TRUNK = 'main'

type Trunk =
  | { readonly kind: 'base'; readonly ref: string; readonly base: string }
  | { readonly kind: 'unpushed' }
  | { readonly kind: 'none'; readonly hint: string }

function readTrunk(): Trunk {
  const named = git(['rev-parse', '--abbrev-ref', 'origin/HEAD'])?.trim()
  const ref = [named ?? 'origin/HEAD', ...TRUNKS].find(
    (name) =>
      git([
        'rev-parse',
        '--verify',
        '--quiet',
        `refs/remotes/${name}^{commit}`,
      ]) !== undefined,
  )
  if (ref !== undefined) {
    const base = git(['merge-base', 'HEAD', `refs/remotes/${ref}`])?.trim()
    if (base !== undefined) return { kind: 'base', ref, base }
    return {
      kind: 'none',
      hint: `No merge base with ${ref}. Run 'git fetch origin', adding --unshallow in a shallow clone`,
    }
  }
  if (git(['remote', 'get-url', 'origin']) === undefined) {
    return {
      kind: 'none',
      hint: "No remote is named origin. Name the one this project pushes to with 'git remote rename <name> origin'",
    }
  }
  if (git(['for-each-ref', '--count=1', 'refs/remotes/origin']) === '') {
    return { kind: 'unpushed' }
  }
  return {
    kind: 'none',
    hint: `None of ${TRUNKS.join(', ')} resolves. Run 'git fetch origin', then 'git remote set-head origin --auto' for a trunk under another name`,
  }
}

// Why a changed run leaves nothing to CI, and undefined when it may. Only the
// web phase list requires a build, and a sync into a subfolder ships no CI.
function reasonUnscoped(
  trunk: Trunk,
  list: PhaseList,
  declared: Set<string>,
): string | undefined {
  if (git(['rev-parse', '--show-prefix'])?.trim() !== '') {
    return 'This folder is not the repository root'
  }
  if (!list.require.includes('build') || !declared.has(TIED_TESTS)) {
    return `This is not a web project declaring ${TIED_TESTS}`
  }
  if (trunk.kind === 'unpushed') {
    return 'origin holds no branch to compare with yet'
  }
  if (trunk.kind === 'none') {
    fail(`Nothing says what changed. ${trunk.hint}`)
  }
  if (trunk.ref !== `origin/${CI_TRUNK}`) {
    return `The trunk here is ${trunk.ref}, which no shipped workflow starts on`
  }
  if (git(['symbolic-ref', '--short', 'HEAD'])?.trim() === CI_TRUNK) {
    return `${CI_TRUNK} is checked out, and a push to it starts no workflow`
  }
  return undefined
}

function listPaths(args: readonly string[]): string[] {
  const listed = git(args)
  if (listed === undefined) fail(`git ${args[0]} failed, so no test was tied`)
  return splitPaths(listed)
}

const TEST_FILE = /(?:\.(?:test|spec)|_test)\.(?:[cm]?[jt]sx?|py|go)$/

// The folder and the name up to its first dot, so a.module.css shares one with
// a.test.tsx beside it.
function subjectOf(path: string): string {
  const dot = path.indexOf('.', path.lastIndexOf('/') + 2)
  return dot === -1 ? path : path.slice(0, dot)
}

// Ties by name and follows no import, since a shared module's imports reach
// most of a suite CI runs whole.
function tieTests(
  changed: readonly string[],
  files: readonly string[],
): string[] {
  const paths = new Set(changed)
  const subjects = new Set(changed.map(subjectOf))
  return files.filter(
    (file) =>
      TEST_FILE.test(file) &&
      (paths.has(file) || subjects.has(subjectOf(file).replace(/_test$/, ''))),
  )
}

// Outside each nested root, whose own run takes its tests.
function findTiedTests(base: string): string[] {
  const untracked = ['--others', '--exclude-standard']
  const nested = findNestedRoots()
  const isOwn = (path: string): boolean =>
    !nested.some((root) => path.startsWith(`${root}/`))

  const changed = [
    ...listPaths(['diff', '--name-only', '-z', '--no-renames', base]),
    ...listPaths(['ls-files', '-z', ...untracked]),
  ]
  const present = listPaths(['ls-files', '-z', '--cached', ...untracked])
  const files = new Set(present.filter((path) => existsSync(path)))
  return tieTests(changed, [...files].filter(isOwn))
}

function runTiedTests(base: string): void {
  logStep('Tied tests')
  logSkip('Skipped: the full suites and the build, which CI runs')
  const tests = findTiedTests(base)
  if (tests.length === 0) {
    logSkip('Skipped: no test is tied to the change')
    return
  }
  if (tests.length > MAX_TIED_TESTS) {
    logSkip(
      `Skipped: ${tests.length} test files are tied to the change, past the ${MAX_TIED_TESTS} run here, so CI runs them`,
    )
    return
  }
  runCheck(`bun run ${TIED_TESTS} "$@"`, 'Tied tests failed', tests)
  logInfo('Tied tests passed')
}

// Found from tracked files, since verify.json is golden and a list kept in it
// is lost on sync. An untracked folder never runs, and a tracked one runs
// whatever .gitignore says. Outside a git repository none are found.
function findNestedRoots(): string[] {
  const listed = git(['ls-files', '-z', '--', ':(glob)**/scripts/verify.json'])
  return splitPaths(listed ?? '')
    .filter((path) => path !== PHASE_LIST)
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
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  pipeOutput(output)
  if (output.includes(UNMEASURED)) isMeasured = false
  if (result.error !== undefined) {
    fail(`Nested root ${root} could not start: ${result.error.message}`)
  }
  if (result.status !== 0) fail(`Nested root ${root} failed`)
  logInfo(`Nested root ${root} passed`)
}

type PassKey =
  | { readonly kind: 'key'; readonly text: string }
  | { readonly kind: 'none'; readonly reason: string }

// Git reads a file again when its time is no older than the index's, so a copy
// stamped now would hide an edit made in the second the index was written.
function copyIndex(from: string, to: string): void {
  copyFileSync(from, to)
  const seconds = Math.floor(statSync(from).mtimeMs / 1000) - 1
  utimesSync(to, seconds, seconds)
}

// The tree of every file git would track here, untracked ones included, and
// undefined where git cannot hold the content, as in a nested repository.
function writeTree(): string | undefined {
  const real = git(['rev-parse', '--git-path', 'index'])?.trimEnd()
  if (real === undefined) return undefined
  const scratch = mkdtempSync(join(tmpdir(), 'verify-index-'))
  const env = { GIT_INDEX_FILE: join(scratch, 'index') }
  try {
    if (existsSync(real)) copyIndex(real, env.GIT_INDEX_FILE)
    if (git(['add', '--all'], env) === undefined) return undefined
    const entries = git(['ls-files', '--stage', '--full-name', ':/'], env)
    if (entries === undefined || /^160000 /m.test(entries)) return undefined
    return git(['write-tree'], env)?.trim()
  } finally {
    rmSync(scratch, { force: true, recursive: true })
  }
}

// Bun stands in as node where none is installed, and answers no --version there.
const VERSION_ARGS = new Map([['node', [['-p', 'process.version']]]])

// The whole output, since shellcheck prints its version on its second line.
function readVersion(tool: string): string | undefined {
  if (!onPath(tool)) return 'absent'
  for (const args of VERSION_ARGS.get(tool) ?? [['--version'], ['version']]) {
    const result = spawnSync(tool, args, {
      encoding: 'utf8',
      timeout: 30_000,
    })
    if (result.status === 0) return result.stdout.trim()
  }
  return undefined
}

// Every tool a run here reaches from outside the tree, in each nested root too.
function listTools(): string[] {
  const roots = ['.', ...findNestedRoots()]
  const probed = roots.flatMap((root) => {
    const list = asRecord(readJson(join(root, PHASE_LIST)))
    const manifest = asRecord(readJson(join(root, 'package.json')))
    const declared = new Set(Object.keys(asRecord(manifest.scripts)))
    return [
      ...asArray(list.tools).map((entry) => asRecord(entry).name),
      ...PHASES.filter((phase) => declared.has(phase.script)).flatMap((phase) =>
        (phase.tools ?? []).map((tool) => tool.name),
      ),
    ]
  })
  const named = probed.filter((name) => typeof name === 'string')
  return [...new Set(['canon', 'bun', 'node', ...named])]
}

interface Basis {
  readonly base: string
  readonly isScoped: boolean
}

// What git tracks is a fact of its own, since a nested root and several gate
// checks read tracked files and the tree holds untracked ones the same way.
function readPassKey(basis: Basis): PassKey {
  const tree = writeTree()
  if (tree === undefined) {
    return {
      kind: 'none',
      reason: 'git could not write this content as a tree',
    }
  }
  const versions: [string, string][] = []
  for (const tool of listTools()) {
    const version = readVersion(tool)
    if (version === undefined) {
      return { kind: 'none', reason: `${tool} reported no version` }
    }
    versions.push([tool, version])
  }
  const folder = git(['rev-parse', '--show-prefix'])?.trim()
  const untracked = git([
    'ls-files',
    '-z',
    '--others',
    '--exclude-standard',
    ':/',
  ])
  return {
    kind: 'key',
    text: JSON.stringify({
      tree,
      untracked,
      ...basis,
      folder,
      isCi,
      versions,
    }),
  }
}

// In the git directory, so each linked worktree keeps its own and none is tracked.
function passPath(): string | undefined {
  const directory = git(['rev-parse', '--absolute-git-dir'])?.trimEnd()
  return directory === undefined ? undefined : join(directory, 'canon-verify')
}

interface Pass {
  readonly hasPassed: boolean
  readonly keep: () => void
}

function logForgotten(reason: string): void {
  logSkip(`This pass is not remembered, since ${reason}`)
}

// Drops the last pass unless it holds, so a run that fails leaves none.
function openPass(basis: Basis, isForced: boolean): Pass {
  const path = passPath()
  const key = readPassKey(basis)
  if (path === undefined) return { hasPassed: false, keep: () => {} }
  const hasPassed =
    !isForced &&
    key.kind === 'key' &&
    existsSync(path) &&
    readFileSync(path, 'utf8') === key.text
  if (!hasPassed) rmSync(path, { force: true })

  return {
    hasPassed,
    keep: () => {
      if (key.kind === 'none') {
        logForgotten(key.reason)
        return
      }
      if (!isMeasured) {
        logForgotten(`a check ${UNMEASURED}`)
        return
      }
      const after = readPassKey(basis)
      if (after.kind === 'none' || after.text !== key.text) {
        logForgotten('its content or a tool changed while it ran')
        return
      }
      writeFileSync(path, key.text)
    },
  }
}

interface Flags {
  readonly isChanged: boolean
  readonly isForced: boolean
}

function readFlags(args: readonly string[]): Flags | undefined {
  const isChanged = args.includes('--changed')
  const isForced = args.includes('--force')
  const isKnown = args.every((arg) => arg === '--changed' || arg === '--force')
  if (!isKnown || (isForced && !isChanged)) return undefined
  return { isChanged, isForced }
}

function main(flags: Flags): void {
  const declared = readDeclaredScripts()
  const list = readPhaseList()
  checkTools(list.tools)
  checkPreconditions(list)

  if (!isNested) print(`${GREY}┌${NC}`)

  const required = new Set(list.require)
  const trunk = flags.isChanged ? readTrunk() : undefined
  const unscoped =
    trunk === undefined ? undefined : reasonUnscoped(trunk, list, declared)
  if (unscoped !== undefined) logSkip(`${unscoped}, so every phase runs`)

  const base = trunk?.kind === 'base' ? trunk.base : undefined
  const scopedBase = unscoped === undefined ? base : undefined
  const isScoped = scopedBase !== undefined

  // A nested run discovers no root, so its pass would cover roots it never ran.
  const pass =
    base === undefined || isNested
      ? undefined
      : openPass({ base, isScoped }, flags.isForced)
  if (pass?.hasPassed) {
    logSkip(
      'Skipped: this content already passed. Run with --force to check it again',
    )
    print(`${GREY}└${NC}`)
    return
  }

  for (const phase of PHASES) {
    if (isScoped && CI_PHASES.has(phase.script)) continue
    runPhase(phase, required.has(phase.script), declared)
  }
  if (scopedBase !== undefined) runTiedTests(scopedBase)

  logStep('Canon checks')
  checkCanonGate()

  // The card check reads the build, so it runs last, where its stack shipped it.
  if (!isScoped && existsSync(CARD_EXCLUSION)) {
    logStep('Card exclusion')
    runCheck(`bash ${CARD_EXCLUSION}`, 'Card exclusion check failed')
    logInfo('Card exclusion passed')
  }

  // The head tag check reads the build too, where its stack shipped it.
  if (!isScoped && existsSync(HEAD_META)) {
    logStep('Head tags')
    runCheck(`bash ${HEAD_META}`, 'Head tag check failed')
    logInfo('Head tags passed')
  }

  // A nested run never discovers, so a subfolder's own subfolders run once.
  if (!isNested) {
    for (const root of findNestedRoots()) runNestedRoot(root)
  }

  pass?.keep()

  if (!isNested) {
    print(`${GREY}└${NC}\n`)
    print(
      flags.isChanged
        ? `${GREEN}✓ Changed check passed${NC}`
        : `${GREEN}✓ Verification passed${NC}`,
    )
  }
}

const flags = readFlags(process.argv.slice(2))
if (flags === undefined) {
  process.stderr.write(`${USAGE}\n`)
  process.exitCode = 2
} else {
  try {
    main(flags)
  } catch (error) {
    if (!(error instanceof VerifyFailure)) throw error
    process.exitCode = 1
  }
}
