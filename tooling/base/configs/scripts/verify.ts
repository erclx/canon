// Runs this folder's verify phases in a fixed order. The phases a stack
// requires come from scripts/verify.json, which each stack ships and the
// nearest one wins. Only node: modules, since a target's own eslint and
// tsc --noEmit read this file with no Bun types.
import { spawnSync } from 'node:child_process'
import { accessSync, constants, existsSync, readFileSync } from 'node:fs'
import { delimiter, join } from 'node:path'

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
}

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
    script: 'format',
    title: 'Formatting',
    failed: 'Format failed',
    passed: 'Format applied',
  },
  {
    script: 'check:format',
    title: 'Format check',
    failed: 'Format check failed',
    passed: 'Format check passed',
  },
  {
    script: 'check:spell',
    title: 'Spelling',
    failed: 'Spell check failed',
    passed: 'Spell check passed',
  },
  {
    script: 'check:shell',
    title: 'Shell',
    failed: 'Shell check failed',
    passed: 'Shell check passed',
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
const BASE_PHASES = new Set([
  'format',
  'check:format',
  'check:spell',
  'check:shell',
])

const PHASE_LIST = 'scripts/verify.json'
const CARD_EXCLUSION = 'scripts/check-card-exclusion.sh'

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
    fail("No package.json here. Run 'bun init', then sync the stack again")
  }
  return new Set(
    Object.keys(asRecord(asRecord(readJson('package.json')).scripts)),
  )
}

function checkTools(list: PhaseList): void {
  for (const tool of list.tools) {
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
  if (!required && !isBase) return

  logStep(phase.title)
  if (!declared.has(phase.script)) {
    if (required) {
      fail(
        `${phase.script} is required by ${PHASE_LIST}, but package.json declares no such script`,
      )
    }
    logSkip(
      `Skipped: ${phase.script} is not declared here, so the repository root runs it`,
    )
    return
  }
  runCheck(`bun run ${phase.script}`, phase.failed)
  logInfo(phase.passed)
}

function listMarkdown(): string[] {
  const result = spawnSync(
    'git',
    [
      'ls-files',
      '--cached',
      '--others',
      '--exclude-standard',
      '--',
      '*.md',
      ':(exclude)CHANGELOG.md',
      ':(exclude)**/CHANGELOG.md',
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  )
  return (result.stdout ?? '').split('\n').filter((line) => line !== '')
}

// canon markdown audit exits 0 on a pass, 1 on a refusal that measured
// nothing, 2 on a finding, and 3 when it shipped an empty ban set.
function checkMarkdownBans(): void {
  if (!onPath('canon')) {
    logInfo(
      'Skipped: no canon binary on PATH. Install with `bun install --global @erclx/canon`.',
    )
    return
  }

  const files = listMarkdown()
  if (files.length === 0) {
    logInfo('No markdown file to check outside the exclusion set.')
    return
  }

  const { code, output } = capture('canon markdown audit "$@"', files)
  switch (code) {
    case 0:
      logInfo('No banned character')
      return
    case 1:
      logInfo('Skipped: canon markdown audit refused and measured nothing.')
      return
    case 2:
      pipeOutput(output)
      fail(
        'Markdown prose carries a banned character, or a relative link resolves to nothing on disk',
      )
      break
    case 3:
      pipeOutput(output)
      fail(
        'The markdown audit shipped an empty ban set, so the corpus was walked and nothing was looked for',
      )
      break
    default:
      fail(
        `canon markdown audit exited ${code}, which is neither a pass nor a finding`,
      )
  }
}

function main(): void {
  const declared = readDeclaredScripts()
  const list = readPhaseList()
  checkTools(list)
  checkPreconditions(list)

  if (!isNested) print(`${GREY}┌${NC}`)

  const required = new Set(list.require)
  for (const phase of PHASES) {
    runPhase(phase, required.has(phase.script), declared)
  }

  logStep('Markdown bans')
  checkMarkdownBans()

  // The card exclusion check reads the build, so it runs last, and only where
  // the stack that owns the card route shipped it.
  if (existsSync(CARD_EXCLUSION)) {
    logStep('Card exclusion')
    runCheck(`bash ${CARD_EXCLUSION}`, 'Card exclusion check failed')
    logInfo('Card exclusion passed')
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
