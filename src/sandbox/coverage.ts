import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The arm a scenario declares when it carries no named arm. `expectFilePath`
 * joins an empty arm away, so the declaration lands at the command root and has
 * no name to print.
 */
export const DEFAULT_ARM = '(default)'

/** Holds fixture content rather than scenarios. Twin of the filter in `sandbox.ts`. */
const FIXTURES_DIR = 'fixtures'

export interface ScenarioCoverage {
  readonly category: string
  readonly command: string
  readonly armed: readonly string[]
}

export interface CoverageReport {
  readonly scenarios: readonly ScenarioCoverage[]
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
function listScenarios(sandboxDir: string): ScenarioCoverage[] {
  const scenarios: ScenarioCoverage[] = []

  for (const category of directories(sandboxDir)) {
    if (category === FIXTURES_DIR) continue

    const commands = readdirSync(join(sandboxDir, category), {
      withFileTypes: true,
    })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.sh'))
      .map((entry) => entry.name.replace(/\.sh$/, ''))
      .sort()

    for (const command of commands) {
      scenarios.push({ category, command, armed: [] })
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
  category: string,
  command: string,
): string[] {
  const commandDir = join(fixturesDir, category, command)
  if (!existsSync(commandDir)) return []

  const armed: string[] = []
  if (existsSync(join(commandDir, 'expect.toml'))) armed.push(DEFAULT_ARM)

  for (const arm of directories(commandDir)) {
    if (existsSync(join(commandDir, arm, 'expect.toml'))) armed.push(arm)
  }

  return armed
}

/**
 * Reports which scenarios declare expectations and which only provision a state.
 * The undeclared ones exit zero today, so the count is the only thing separating
 * a suite that proves something from one that runs.
 */
export function collectCoverage(root: string): CoverageReport {
  const sandboxDir = join(root, 'sandbox')
  const fixturesDir = join(sandboxDir, FIXTURES_DIR)

  const scenarios = listScenarios(sandboxDir).map((scenario) => ({
    ...scenario,
    armed: armsFor(fixturesDir, scenario.category, scenario.command),
  }))

  return {
    scenarios,
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
