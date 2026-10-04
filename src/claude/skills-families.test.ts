import { describe, expect, it } from 'vitest'
import { SKILL_FAMILIES, familyKeys } from '@/claude/skills-families'

describe('SKILL_FAMILIES', () => {
  it('should hold the ten skill map groups', () => {
    expect(SKILL_FAMILIES).toHaveLength(10)
  })

  it('should spell every key in kebab case', () => {
    expect(
      SKILL_FAMILIES.filter(
        (family) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(family.key),
      ),
    ).toEqual([])
  })

  it('should never repeat a key', () => {
    expect(new Set(familyKeys()).size).toBe(SKILL_FAMILIES.length)
  })

  it('should never repeat a group heading', () => {
    expect(new Set(SKILL_FAMILIES.map((family) => family.group)).size).toBe(
      SKILL_FAMILIES.length,
    )
  })
})
