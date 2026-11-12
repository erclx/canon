import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  armNames,
  DEFAULT_ARM_NAME,
  FIXTURES_DIR,
  listCategories,
  listScenarioFiles,
  loadScenario,
} from '@/sandbox/scenario'

/**
 * The arm a scenario declares when it carries no named arm. `expectFilePath`
 * joins an empty arm away, so the declaration lands at the command root and has
 * no name to print.
 */
export const DEFAULT_ARM = '(default)'

export interface ScenarioCoverage {
  readonly category: string
  readonly command: string
  readonly armed: readonly string[]
}

export interface CoverageReport {
  readonly scenarios: readonly ScenarioCoverage[]
  /** `category:command` of each scenario holding a `default/expect.toml` its runner never reads. */
  readonly misplaced: readonly string[]
  readonly totalScenarios: number
  readonly armedScenarios: number
  readonly armedArms: number
}

function directories(path: string): string[] {
  if (!existsSync(path)) return []

  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

/**
 * Enumerates from the scenario scripts rather than from the fixture tree. A
 * scenario with no fixtures has no directory to find, and counting only what
 * fixtures exist would hide exactly the arms this report exists to surface.
 */
function listScenarios(
  sandboxDir: string,
): Array<ScenarioCoverage & { readonly file: string }> {
  const scenarios: Array<ScenarioCoverage & { readonly file: string }> = []

  for (const category of listCategories(sandboxDir)) {
    const { scenarios: files } = listScenarioFiles(join(sandboxDir, category))

    for (const { command, file } of files) {
      scenarios.push({ category, command, armed: [], file })
    }
  }

  return scenarios
}

/**
 * Names every arm of a scenario carrying an `expect.toml`. A declaration at the
 * command root belongs to the unnamed arm and reports under `DEFAULT_ARM`, since
 * an empty string in a report reads as a bug rather than as the default.
 */
function armsFor(
  fixturesDir: string,
  scenario: ScenarioCoverage & { readonly file: string },
): { armed: string[]; isMisplaced: boolean } {
  const commandDir = join(fixturesDir, scenario.category, scenario.command)
  if (!existsSync(commandDir)) return { armed: [], isMisplaced: false }

  const isMisplaced =
    existsSync(join(commandDir, DEFAULT_ARM_NAME, 'expect.toml')) &&
    !routesDefault(scenario.file)
  const armed: string[] = []
  if (existsSync(join(commandDir, 'expect.toml'))) armed.push(DEFAULT_ARM)

  for (const arm of directories(commandDir)) {
    if (isMisplaced && arm === DEFAULT_ARM_NAME) continue
    if (existsSync(join(commandDir, arm, 'expect.toml'))) armed.push(arm)
  }

  return { armed, isMisplaced }
}

/**
 * Whether the runner reads a `default/` arm folder. It does only for a scenario
 * naming `default` beside another arm, since a sole-default scenario reads its
 * declaration at the command root. A file that fails to load counts as routing
 * it, so the report neither crashes on a scenario it cannot read nor flags it.
 */
function routesDefault(file: string): boolean {
  try {
    return armNames(loadScenario(file)).includes(DEFAULT_ARM_NAME)
  } catch {
    return true
  }
}

/**
 * Reports which scenarios declare expectations and which only provision a state.
 * The undeclared ones exit zero today, so the count is the only thing separating
 * a suite that proves something from one that runs.
 */
export function collectCoverage(root: string): CoverageReport {
  const sandboxDir = join(root, 'sandbox')
  const fixturesDir = join(sandboxDir, FIXTURES_DIR)

  const misplaced: string[] = []
  const scenarios = listScenarios(sandboxDir).map((scenario) => {
    const { armed, isMisplaced } = armsFor(fixturesDir, scenario)
    if (isMisplaced) misplaced.push(`${scenario.category}:${scenario.command}`)

    return { category: scenario.category, command: scenario.command, armed }
  })

  return {
    scenarios,
    misplaced,
    totalScenarios: scenarios.length,
    armedScenarios: scenarios.filter((s) => s.armed.length > 0).length,
    armedArms: scenarios.reduce((total, s) => total + s.armed.length, 0),
  }
}

/**
 * Whole percent, floored. A rollout at 13 percent should not round to 13 from
 * above, since the number exists to look worse than a wall of green does.
 */
export function coveragePercent(report: CoverageReport): number {
  if (report.totalScenarios === 0) return 0

  return Math.floor((report.armedScenarios / report.totalScenarios) * 100)
}
