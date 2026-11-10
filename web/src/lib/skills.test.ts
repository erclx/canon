import { describe, expect, it } from 'vitest'

import { firstSentence, readSkills } from './skills'

describe('firstSentence', () => {
  it('should end at the first sentence break', () => {
    expect(firstSentence('Plans a feature. Use before implementing.')).toBe(
      'Plans a feature.',
    )
  })

  it('should keep a dotted file name whole', () => {
    expect(
      firstSentence('Writes index.md files for a folder. Use when asked.'),
    ).toBe('Writes index.md files for a folder.')
  })

  it('should return a description with no break as it stands', () => {
    expect(firstSentence('Carries the rules')).toBe('Carries the rules')
  })
})

describe('readSkills', () => {
  it('should list the catalog this checkout ships, each with a line', () => {
    const skills = readSkills()

    expect(skills.map((skill) => skill.name)).toContain('plan-feature')
    expect(skills.every((skill) => skill.line.length > 0)).toBe(true)
  })
})
