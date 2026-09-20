import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  assertedPercent,
  collectCensus,
  listSkills,
  parseExemptions,
  skillForScenario,
} from '@/sandbox/census'
import { DEFAULT_ARM } from '@/sandbox/coverage'

let root: string

function write(path: string, body: string): void {
  const full = join(root, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, body)
}

function skill(name: string): void {
  write(`claude/skills/${name}/SKILL.md`, '# skill\n')
}

function scenario(category: string, command: string): void {
  write(`scripts/sandbox/${category}/${command}.sh`, 'stage_setup() { :; }\n')
}

function declaration(category: string, command: string, arm: string): void {
  const armSegment = arm === '' ? '' : `/${arm}`
  write(
    `scripts/sandbox/fixtures/${category}/${command}${armSegment}/expect.toml`,
    "paths = ['README.md']\n",
  )
}

function exempt(name: string, reason: string): void {
  write('scripts/sandbox/exempt.toml', `[${name}]\nreason = "${reason}"\n`)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-census-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('listSkills', () => {
  it('should enumerate the shipped skills rather than the internal ones', () => {
    skill('git-commit')
    skill('docs-fold')
    write('.claude/skills/internal-scripts/SKILL.md', '# internal\n')

    expect(listSkills(root)).toEqual(['docs-fold', 'git-commit'])
  })

  it('should report no skills when the plugin tree is absent', () => {
    expect(listSkills(root)).toEqual([])
  })
})

describe('skillForScenario', () => {
  it('should pair a scenario to the category-prefixed skill name', () => {
    const skills = new Set(['git-commit', 'commit'])

    expect(skillForScenario('git', 'commit', skills)).toBe('git-commit')
  })

  it('should fall back to the bare command when no prefixed skill exists', () => {
    const skills = new Set(['target-setup'])

    expect(skillForScenario('claude', 'target-setup', skills)).toBe(
      'target-setup',
    )
  })

  it('should pair no skill for a scenario exercising a CLI domain', () => {
    const skills = new Set(['docs-fold'])

    expect(skillForScenario('infra', 'gov', skills)).toBeUndefined()
  })
})

describe('parseExemptions', () => {
  it('should read a reason keyed by skill', () => {
    const parsed = parseExemptions('[canon-cli]\nreason = "writes nothing"\n')

    expect(parsed.get('canon-cli')).toBe('writes nothing')
  })

  it('should throw on an entry carrying no reason rather than dropping it', () => {
    expect(() =>
      parseExemptions('[canon-cli]\nnote = "writes nothing"\n'),
    ).toThrow(/canon-cli declares no reason/)
  })

  it('should throw on an entry whose reason is empty', () => {
    expect(() => parseExemptions('[canon-cli]\nreason = ""\n')).toThrow(
      /declares no reason/,
    )
  })

  it('should throw on a top-level key that is not a table', () => {
    expect(() => parseExemptions('canon-cli = "writes nothing"\n')).toThrow(
      /is not a table/,
    )
  })

  it('should throw on malformed TOML rather than losing the exemption set', () => {
    expect(() => parseExemptions('[canon-cli]\nreason = = 1\n')).toThrow()
  })
})

describe('collectCensus', () => {
  it('should report a skill whose paired scenario declares an expectation as asserted', () => {
    skill('git-commit')
    scenario('git', 'commit')
    declaration('git', 'commit', 'drift')

    const report = collectCensus(root)

    expect(report.skills[0]).toMatchObject({
      skill: 'git-commit',
      verdict: 'asserted',
      scenarios: ['git:commit'],
      armed: ['git:commit/drift'],
    })
    expect(report.asserted).toBe(1)
  })

  it('should report a paired scenario that declares nothing as should-be-asserted', () => {
    skill('git-commit')
    scenario('git', 'commit')

    const report = collectCensus(root)

    expect(report.skills[0]).toMatchObject({
      verdict: 'should-be-asserted',
      scenarios: ['git:commit'],
      armed: [],
    })
    expect(report.shouldBeAsserted).toBe(1)
  })

  it('should report a skill with no scenario as should-be-asserted', () => {
    skill('bash-script')

    const report = collectCensus(root)

    expect(report.skills[0]?.verdict).toBe('should-be-asserted')
    expect(report.skills[0]?.scenarios).toEqual([])
  })

  it('should report a declared exemption with its reason', () => {
    skill('canon-cli')
    exempt('canon-cli', 'writes nothing')

    const report = collectCensus(root)

    expect(report.skills[0]).toMatchObject({
      verdict: 'exempt',
      reason: 'writes nothing',
    })
    expect(report.exempt).toBe(1)
  })

  it('should rank an armed arm above a stale exemption', () => {
    skill('canon-cli')
    scenario('infra', 'canon-cli')
    declaration('infra', 'canon-cli', '')
    exempt('canon-cli', 'writes nothing')

    const report = collectCensus(root)

    expect(report.skills[0]?.verdict).toBe('asserted')
    expect(report.exempt).toBe(0)
  })

  it('should report an exemption an arm now asserts rather than dropping it', () => {
    skill('canon-cli')
    scenario('infra', 'canon-cli')
    declaration('infra', 'canon-cli', '')
    exempt('canon-cli', 'writes nothing')

    const report = collectCensus(root)

    expect(report.supersededExemptions).toEqual(['canon-cli'])
    expect(report.staleExemptions).toEqual([])
  })

  it('should not report a superseded exemption for a skill no arm asserts', () => {
    skill('canon-cli')
    exempt('canon-cli', 'writes nothing')

    const report = collectCensus(root)

    expect(report.supersededExemptions).toEqual([])
    expect(report.exempt).toBe(1)
  })

  it('should name an exemption pointing at a skill the tree does not carry', () => {
    skill('git-commit')
    exempt('claude-retired', 'gone')

    const report = collectCensus(root)

    expect(report.staleExemptions).toEqual(['claude-retired'])
  })

  it('should merge arms when two scenarios pair to one skill', () => {
    skill('review')
    scenario('claude', 'review')
    scenario('dev', 'review')
    declaration('claude', 'review', 'drift')
    declaration('dev', 'review', 'stale')

    const report = collectCensus(root)

    expect(report.skills[0]?.armed).toEqual([
      'claude:review/drift',
      'dev:review/stale',
    ])
    expect(report.skills[0]?.scenarios).toEqual(['claude:review', 'dev:review'])
    expect(report.asserted).toBe(1)
  })

  it('should keep two same-named arms distinct rather than collapsing them', () => {
    skill('review')
    scenario('claude', 'review')
    scenario('dev', 'review')
    declaration('claude', 'review', '')
    declaration('dev', 'review', '')

    const report = collectCensus(root)

    expect(report.skills[0]?.armed).toEqual([
      `claude:review/${DEFAULT_ARM}`,
      `dev:review/${DEFAULT_ARM}`,
    ])
  })

  it('should exclude a scenario driving no skill from the census', () => {
    skill('docs-fold')
    scenario('infra', 'gov')
    declaration('infra', 'gov', '')

    const report = collectCensus(root)

    expect(report.totalSkills).toBe(1)
    expect(report.asserted).toBe(0)
  })

  it('should count a partially armed catalog across the three verdicts', () => {
    skill('git-commit')
    skill('bash-script')
    skill('canon-cli')
    scenario('git', 'commit')
    declaration('git', 'commit', 'drift')
    exempt('canon-cli', 'writes nothing')

    const report = collectCensus(root)

    expect(report.totalSkills).toBe(3)
    expect(report.asserted).toBe(1)
    expect(report.shouldBeAsserted).toBe(1)
    expect(report.exempt).toBe(1)
  })
})

describe('assertedPercent', () => {
  it('should floor a partial rollout rather than rounding it up', () => {
    skill('a')
    skill('b')
    skill('c')
    scenario('x', 'a')
    declaration('x', 'a', 'one')

    expect(assertedPercent(collectCensus(root))).toBe(33)
  })

  it('should report zero for an empty catalog rather than dividing by zero', () => {
    mkdirSync(join(root, 'claude', 'skills'), { recursive: true })

    expect(assertedPercent(collectCensus(root))).toBe(0)
  })
})
