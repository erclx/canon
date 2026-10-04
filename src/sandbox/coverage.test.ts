import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  collectCoverage,
  coveragePercent,
  DEFAULT_ARM,
} from '@/sandbox/coverage'

let root: string

function write(path: string, body: string): void {
  const full = join(root, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, body)
}

function scenario(category: string, command: string): void {
  write(`sandbox/${category}/${command}.sh`, 'stage_setup() { :; }\n')
}

function declaration(category: string, command: string, arm: string): void {
  const armSegment = arm === '' ? '' : `/${arm}`
  write(
    `sandbox/fixtures/${category}/${command}${armSegment}/expect.toml`,
    "paths = ['README.md']\n",
  )
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-coverage-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('collectCoverage', () => {
  it('should report a scenario with no declaration as unarmed', () => {
    scenario('git', 'commit')

    const report = collectCoverage(root)

    expect(report.totalScenarios).toBe(1)
    expect(report.armedScenarios).toBe(0)
    expect(report.armedArms).toBe(0)
  })

  it('should count a TypeScript scenario beside a bash one', () => {
    scenario('git', 'commit')
    write('sandbox/git/pr.ts', 'export default { arms: {} }\n')

    const report = collectCoverage(root)

    expect(report.scenarios.map((s) => s.command)).toEqual(['commit', 'pr'])
  })

  it('should name each arm that carries a declaration', () => {
    scenario('claude', 'docs')
    declaration('claude', 'docs', 'drift')
    declaration('claude', 'docs', 'board-sweep')

    const report = collectCoverage(root)

    expect(report.scenarios[0]?.armed).toEqual(['board-sweep', 'drift'])
    expect(report.armedArms).toBe(2)
  })

  it('should report a declaration at the command root as the default arm', () => {
    scenario('infra', 'wiki')
    declaration('infra', 'wiki', '')

    const report = collectCoverage(root)

    expect(report.scenarios[0]?.armed).toEqual([DEFAULT_ARM])
  })

  it('should ignore an arm directory holding no declaration', () => {
    scenario('claude', 'docs')
    write('sandbox/fixtures/claude/docs/drift/01-initial/a.md', 'x\n')

    const report = collectCoverage(root)

    expect(report.scenarios[0]?.armed).toEqual([])
    expect(report.armedScenarios).toBe(0)
  })

  it('should exclude the fixtures directory from the scenario count', () => {
    scenario('git', 'commit')
    write('sandbox/fixtures/anchor/create/utils.js', 'x\n')

    const report = collectCoverage(root)

    expect(report.totalScenarios).toBe(1)
    expect(report.scenarios.map((s) => s.category)).toEqual(['git'])
  })

  it('should count a partially armed catalog by scenario and by arm', () => {
    scenario('claude', 'docs')
    scenario('git', 'commit')
    scenario('git', 'pr')
    declaration('claude', 'docs', 'drift')

    const report = collectCoverage(root)

    expect(report.totalScenarios).toBe(3)
    expect(report.armedScenarios).toBe(1)
    expect(report.armedArms).toBe(1)
  })
})

describe('coveragePercent', () => {
  it('should floor a partial rollout rather than rounding it up', () => {
    scenario('a', 'one')
    scenario('a', 'two')
    scenario('a', 'three')
    declaration('a', 'one', 'x')

    expect(coveragePercent(collectCoverage(root))).toBe(33)
  })

  it('should report zero for an empty catalog rather than dividing by zero', () => {
    mkdirSync(join(root, 'sandbox'), { recursive: true })

    expect(coveragePercent(collectCoverage(root))).toBe(0)
  })
})
