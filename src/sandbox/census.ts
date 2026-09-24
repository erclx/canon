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
   * Each armed arm as `<category>:<command>/<arm>`. Qualified rather than bare,
   * because a skill two scenarios drive can hold two arms of the same name and
   * a bare list renders them as one label twice. Deduplicating instead would
   * read as one arm where two assert, which understates in the one direction
   * this report exists to keep honest.
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
 * Maps a scenario to the skill it drives, trying two spellings in order.
 *
 * `<category>-<command>` is the rule `canon/context/sandbox/coverage/census.md` states, and it
 * alone pairs 29 of 54 skills. The bare `<command>` fallback is what reaches the
 * rest: `claude/target-setup.sh` drives the `target-setup` skill, not a `claude-target-setup` that
 * does not exist. Stating one spelling and shipping two is what let the audit
 * report a paired skill as unpaired.
 *
 * Returns undefined for a scenario driving no skill at all, which is every
 * `infra/` and `tooling/` scenario. Those exercise a CLI domain rather than a
 * skill and belong to the scenario count, not to this one.
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
 * Reads the exemption declarations, keyed by skill with a `reason` each.
 *
 * The reason cannot live in the arm's `manual` array, which is where `#723` put
 * prose a checker could not assert. `resolveVerdict` fails any declaration
 * carrying zero mechanical assertions, so an `expect.toml` holding only an
 * exempt reason goes red at the moment it is written. An exempt skill has no
 * assertion to pair the prose with, which is what makes it exempt, so the two
 * cases cannot share a home.
 *
 * Throws on a malformed file and on a table carrying no usable `reason`, rather
 * than reporting a smaller set. Both losses are invisible downstream: the skill
 * reclassifies to should-be-asserted and rejoins a work queue someone already
 * ruled it out of, with nothing naming the entry that stopped counting. This is
 * the stray-key rule `contentArray` applies in `expect.ts` for the same reason,
 * where the declaration is well-formed and silently lost a key it appears to
 * carry. `runCoverage` catches both and frames them.
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
  const path = join(root, 'scripts', 'sandbox', EXEMPT_FILE)
  if (!existsSync(path)) return new Map()

  return parseExemptions(readFileSync(path, 'utf8'))
}

/**
 * Gives every shipped skill an asserted, should-be-asserted, or exempt verdict
 * against declared expectations rather than against a scenario existing.
 *
 * A paired scenario is not an asserted skill. A scenario with no `expect.toml`
 * provisions a state and prints a human-readable `Expect:` line, so a run over
 * it exits zero having proved nothing. Counting pairs would report coverage the
 * suite does not have, which is the measure this report exists to replace.
 *
 * An armed arm outranks an exemption. A skill listed exempt that acquired an arm
 * is asserted in fact, and reporting the stale claim instead would hide the one
 * direction the verdict decays in.
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

    // Accumulate rather than assign. Dropping a second scenario would report a
    // skill unarmed while an arm under the other spelling asserts it.
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

  // An exemption outranked by an arm is as wrong as one naming no skill, and it
  // is the case the armed-wins rule creates rather than one the tree arrives
  // with. Reading `entries` rather than recomputing keeps the two in step, so a
  // change to the precedence cannot leave the report contradicting the verdict.
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
