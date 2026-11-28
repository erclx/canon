import { globSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  E2E_GROUPS,
  groupFiles,
  groupOutput,
} from '../../scripts/ci/e2e-groups'
import e2eConfig from '../../vitest.e2e.config'

interface SuiteProject {
  readonly test: { readonly name: string; readonly include: string[] }
}

const REPO_ROOT = join(import.meta.dirname, '../..')

const projects = e2eConfig.test?.projects as SuiteProject[]

const suitesOf = (project: SuiteProject): string[] =>
  project.test.include.flatMap((glob) => globSync(glob, { cwd: REPO_ROOT }))

const timedProject = projects.find(({ test }) => test.name === 'timed')

describe('E2E_GROUPS', () => {
  it('should hold every suite the e2e config includes in exactly one group', () => {
    const included = [...new Set(projects.flatMap(suitesOf))].sort()

    expect(Object.values(E2E_GROUPS).flat().sort()).toEqual(included)
  })

  it('should hold the timed suites alone in the timed group', () => {
    expect(E2E_GROUPS.timed.toSorted()).toEqual(
      timedProject?.test.include.toSorted(),
    )
  })
})

describe('groupFiles', () => {
  it('should give the whole group when no scope is passed', () => {
    expect(groupFiles('reel', [])).toEqual([
      'src/commands/take.e2e.test.ts',
      'src/take/reel.e2e.test.ts',
    ])
  })

  it('should keep only the scoped suites the group holds', () => {
    const scoped = [
      'src/take/film-drag.e2e.test.ts',
      'src/take/reel.e2e.test.ts',
    ]

    expect(groupFiles('timed', scoped)).toEqual([
      'src/take/film-drag.e2e.test.ts',
    ])
  })

  it('should give nothing when the scope reaches no suite in the group', () => {
    expect(groupFiles('timed', ['src/take/reel.e2e.test.ts'])).toEqual([])
  })

  it('should refuse a group it does not hold', () => {
    expect(() => groupFiles('toString', [])).toThrow('unknown group')
  })
})

describe('groupOutput', () => {
  it('should tell the leg to run when its group holds a scoped suite', () => {
    expect(groupOutput('reel', [])).toEqual({
      run: 'true',
      files: 'src/commands/take.e2e.test.ts src/take/reel.e2e.test.ts',
    })
  })

  it('should tell the leg not to run when the scope reaches none of it', () => {
    expect(groupOutput('reel', ['src/take/motion.e2e.test.ts'])).toEqual({
      run: 'false',
      files: '',
    })
  })
})
