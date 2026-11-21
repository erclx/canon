import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { collectCoverage, type CoverageReport } from '@/sandbox/coverage'

/**
 * Holds the exemption declarations, beside the scenario categories rather than
 * inside one. `listScenarios` in `coverage.ts` walks directories only, so a file
 * at that level joins no category and never reads as a scenario.
 */
const EXEMPT_FILE = 'exempt.toml'

export type SkillVerdict = 'asserted' | 'should-be-asserted' | 'exempt'

export interface SkillCensusEntry {
  readonly skill: string
  readonly verdict: SkillVerdict
  /**
   * Every `<category>:<command>` pairing to this skill, empty when none does.
   * Plural because the mapping is many-to-one: two scenarios can drive one
   * skill, and naming only the first would credit its arms to the wrong file.
   */
  readonly scenarios: readonly string[]
  /**
   * Each armed arm as `<category>:<command>/<arm>`, qualified since a skill two
   * scenarios drive can hold two arms of one name, and deduplicating would read
   * two asserting arms as one.
   */
  readonly armed: readonly string[]
  /** Why no arm asserts this skill. Present only on `exempt`. */
  readonly reason?: string
}

export interface CensusReport {
  readonly skills: readonly SkillCensusEntry[]
  readonly totalSkills: number
  readonly asserted: number
  readonly shouldBeAsserted: number
  readonly exempt: number
  /** Exemptions naming a skill the tree does not carry. */
  readonly staleExemptions: readonly string[]
  /**
   * Exemptions on a skill an arm now asserts. The claim is wrong in the one
   * direction a verdict decays, and the entry outranks nothing, so dropping it
   * silently leaves committed data nobody is told to delete.
   */
  readonly supersededExemptions: readonly string[]
}

function directories(path: string): string[] {
  if (!existsSync(path)) return []

  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

/**
 * Every skill the plugin ships, which is the census denominator. Reads the
 * authoring root rather than `.claude/skills/`, since the latter holds
 * toolkit-internal skills that reach no target and would inflate the count.
 */
export function listSkills(root: string): string[] {
  return directories(join(root, 'claude', 'skills'))
}

/**
 * Maps a scenario to the skill it drives, trying `<category>-<command>` as
 * `canon/context/development/sandbox.md` states, then the bare `<command>`.
 * Returns undefined for a scenario driving no skill, as every `infra/` and `tooling/` one.
 */
export function skillForScenario(
  category: string,
  command: string,
  skills: ReadonlySet<string>,
): string | undefined {
  const prefixed = `${category}-${command}`
  if (skills.has(prefixed)) return prefixed
  if (skills.has(command)) return command

  return undefined
}

/**
 * Reads the exemption declarations, keyed by skill with a `reason` each. The
 * reason cannot live in the arm's `manual` array, since `resolveVerdict` fails a
 * declaration with no mechanical assertion. A malformed file or a table with no usable `reason` throws, since either would silently reclassify the skill.
 */
export function parseExemptions(source: string): Map<string, string> {
  const parsed = Bun.TOML.parse(source) as Record<string, unknown>
  const exemptions = new Map<string, string>()

  for (const [skill, value] of Object.entries(parsed)) {
    if (typeof value !== 'object' || value === null) {
      throw new Error(
        `exemption ${skill} is not a table. Write [${skill}] with a reason below it.`,
      )
    }

    const reason = (value as Record<string, unknown>).reason
    if (typeof reason !== 'string' || reason === '') {
      throw new Error(
        `exemption ${skill} declares no reason. An exemption without one cannot be checked or overturned.`,
      )
    }

    exemptions.set(skill, reason)
  }

  return exemptions
}

function readExemptions(root: string): Map<string, string> {
  const path = join(root, 'sandbox', EXEMPT_FILE)
  if (!existsSync(path)) return new Map()

  return parseExemptions(readFileSync(path, 'utf8'))
}

/**
 * Gives every shipped skill an asserted, should-be-asserted, or exempt verdict
 * against declared expectations. A scenario with no `expect.toml` proves nothing,
 * and an armed arm outranks an exemption, so a stale claim cannot hide.
 */
export function collectCensus(
  root: string,
  coverage: CoverageReport = collectCoverage(root),
): CensusReport {
  const skills = listSkills(root)
  const known = new Set(skills)
  const exemptions = readExemptions(root)

  const pairings = new Map<string, { scenarios: string[]; armed: string[] }>()
  for (const scenario of coverage.scenarios) {
    const skill = skillForScenario(scenario.category, scenario.command, known)
    if (skill === undefined) continue

    // Accumulate rather than assign, since dropping a second scenario would report the skill unarmed.
    const pair = `${scenario.category}:${scenario.command}`
    const existing = pairings.get(skill) ?? { scenarios: [], armed: [] }
    existing.scenarios.push(pair)
    existing.armed.push(...scenario.armed.map((arm) => `${pair}/${arm}`))
    pairings.set(skill, existing)
  }

  const entries = skills.map((skill): SkillCensusEntry => {
    const pairing = pairings.get(skill)
    const scenarios = pairing?.scenarios ?? []
    const armed = pairing?.armed ?? []
    const reason = exemptions.get(skill)

    if (armed.length > 0) {
      return { skill, verdict: 'asserted', scenarios, armed }
    }

    if (reason !== undefined) {
      return { skill, verdict: 'exempt', scenarios, armed, reason }
    }

    return { skill, verdict: 'should-be-asserted', scenarios, armed }
  })

  // An exemption outranked by an arm is reported as wrong, read from `entries` to stay in step with the verdict.
  const assertedSkills = new Set(
    entries.filter((e) => e.verdict === 'asserted').map((e) => e.skill),
  )

  return {
    skills: entries,
    totalSkills: entries.length,
    asserted: assertedSkills.size,
    shouldBeAsserted: entries.filter((e) => e.verdict === 'should-be-asserted')
      .length,
    exempt: entries.filter((e) => e.verdict === 'exempt').length,
    staleExemptions: [...exemptions.keys()]
      .filter((skill) => !known.has(skill))
      .sort(),
    supersededExemptions: [...exemptions.keys()]
      .filter((skill) => assertedSkills.has(skill))
      .sort(),
  }
}

/**
 * Whole percent, floored, over skills rather than scenarios. Floored for the
 * reason `coveragePercent` is: the number exists to look worse than a wall of
 * green does.
 */
export function assertedPercent(report: CensusReport): number {
  if (report.totalSkills === 0) return 0

  return Math.floor((report.asserted / report.totalSkills) * 100)
}
