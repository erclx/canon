import { describe, expect, it } from 'vitest'
import { SKILL_CASES } from '@/claude/cases/all'
import { loadCatalog } from '@/claude/skills-rank'
import { PROJECT_ROOT } from '@/roots/project'

describe('SKILL_CASES', () => {
  it('should cover every shipped skill with at least one case', () => {
    const catalog = loadCatalog(PROJECT_ROOT)
    const covered = new Set(SKILL_CASES.map((skillCase) => skillCase.expect))
    const uncovered = catalog
      .map((skill) => skill.name)
      .filter((name) => !covered.has(name))

    expect(uncovered).toEqual([])
  })

  it('should name only skills the catalog actually ships', () => {
    const catalog = loadCatalog(PROJECT_ROOT)
    const names = new Set(catalog.map((skill) => skill.name))
    const unknown = SKILL_CASES.map((skillCase) => skillCase.expect).filter(
      (name) => !names.has(name),
    )

    expect(unknown).toEqual([])
  })
})
