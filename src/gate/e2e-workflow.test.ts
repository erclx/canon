import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { E2E_GROUPS } from '../../scripts/ci/e2e-groups'

interface Job {
  readonly name: string
  readonly steps: readonly { readonly name?: string; readonly run?: string }[]
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

describe('the e2e matrix', () => {
  it('should run every group as one leg', () => {
    expect(jobs['e2e-groups'].strategy.matrix.group.toSorted()).toEqual(
      Object.keys(E2E_GROUPS).toSorted(),
    )
  })
})

describe('the e2e summary job', () => {
  it('should report under the name a ruleset requires', () => {
    expect(jobs['e2e-suites'].name).toBe('🎬 E2E Suites')
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
