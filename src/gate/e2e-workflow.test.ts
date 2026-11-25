import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { E2E_GROUPS, groupOutput } from '../../scripts/ci/e2e-groups'

interface Step {
  readonly id?: string
  readonly if?: string
  readonly run?: string
  readonly env?: Record<string, string>
}

interface Job {
  readonly name: string
  readonly if?: string
  readonly steps: readonly Step[]
}

interface MatrixJob extends Job {
  readonly strategy: { readonly matrix: { readonly group: string[] } }
}

interface Verify {
  readonly jobs: {
    readonly 'e2e-groups': MatrixJob
    readonly 'e2e-suites': Job
  }
}

const { jobs } = Bun.YAML.parse(
  readFileSync(
    join(import.meta.dirname, '../../.github/workflows/verify.yml'),
    'utf8',
  ),
) as Verify

// Runs the summary step as the runner does, so the decision under test is the
// one the workflow ships
const summaryExit = (changes: string, suites: string, reached: string) =>
  Bun.spawnSync(['bash', '-e', '-c', jobs['e2e-suites'].steps[0]?.run ?? ''], {
    env: {
      PATH: process.env.PATH ?? '',
      CHANGES: changes,
      SUITES: suites,
      REACHED: reached,
    },
  }).exitCode

const legSteps = jobs['e2e-groups'].steps

const readAt = legSteps.findIndex((step) =>
  step.run?.includes('scripts/ci/e2e-groups.ts'),
)

const readId = legSteps[readAt]?.id

const [runKey, filesKey] = Object.keys(groupOutput('reel', []))

describe('the e2e matrix', () => {
  it('should run every group as one leg', () => {
    expect(jobs['e2e-groups'].strategy.matrix.group.toSorted()).toEqual(
      Object.keys(E2E_GROUPS).toSorted(),
    )
  })

  // Skipping on a missing output would pass a leg that ran nothing
  it('should skip a later step only on an explicit answer not to run', () => {
    const gate = `steps.${readId}.outputs.${runKey} != 'false'`
    const ungated = legSteps
      .slice(readAt + 1)
      .filter((step) => step.if?.split(' && ')[0] !== gate)

    expect(readAt).toBeGreaterThan(0)
    expect(ungated).toEqual([])
  })

  it('should run the files the group step wrote', () => {
    const suites = legSteps.find((step) => step.run?.includes('test:e2e'))

    expect(suites?.env?.FILES).toBe(
      `\${{ steps.${readId}.outputs.${filesKey} }}`,
    )
  })
})

describe('the e2e summary job', () => {
  it('should report under the name a ruleset requires', () => {
    expect(jobs['e2e-suites'].name).toBe('🎬 E2E Suites')
  })

  it('should run whatever its legs returned', () => {
    expect(jobs['e2e-suites'].if).toMatch(/^always\(\)/)
  })

  it.each([
    ['every leg passed on a pull request', 'success', 'success', 'true'],
    ['every leg passed on a push', 'skipped', 'success', 'true'],
    ['the change reaches no suite', 'success', 'skipped', 'false'],
  ])('should pass when %s', (_case, changes, suites, reached) => {
    expect(summaryExit(changes, suites, reached)).toBe(0)
  })

  it.each([
    ['a leg failed', 'success', 'failure', 'true'],
    ['a leg was cancelled', 'success', 'cancelled', 'true'],
    ['the run was cancelled before a leg', 'success', 'skipped', 'true'],
    ['the scope read failed', 'failure', 'success', 'true'],
    ['a failed scope read skipped every leg', 'failure', 'skipped', 'true'],
    ['a push skipped every leg', 'skipped', 'skipped', 'true'],
  ])('should fail when %s', (_case, changes, suites, reached) => {
    expect(summaryExit(changes, suites, reached)).not.toBe(0)
  })
})
