import { describe, expect, it } from 'vitest'

import { scopeFor } from '../../scripts/ci/e2e-scope'

const none = (): readonly string[] => []

describe('scopeFor', () => {
  it('should scope to none a change outside every e2e import graph', () => {
    expect(scopeFor(['src/cli/help.ts'], [], none)).toEqual({
      e2e: false,
      full: false,
      files: [],
    })
  })

  it('should scope a shared helper to the suite importing it', () => {
    const affected = ['src/take/film-drag.e2e.test.ts']

    expect(scopeFor(['src/take/pointer.ts'], affected, none)).toEqual({
      e2e: true,
      full: false,
      files: ['src/take/film-drag.e2e.test.ts'],
    })
  })

  it.each([
    'package.json',
    'tsconfig.json',
    'vitest.config.ts',
    'vitest.e2e.config.ts',
  ])('should run the full suite when %s changes', (trigger) => {
    expect(scopeFor([trigger, 'src/a.ts'], [], none)).toEqual({
      e2e: true,
      full: true,
      files: [],
    })
  })

  it('should add the suite reading a changed corpus file without importing it', () => {
    const readers = (file: string): readonly string[] =>
      file === 'claude/skills/ui-film/SKILL.md'
        ? ['src/take/film-skill.e2e.test.ts']
        : []

    expect(scopeFor(['claude/skills/ui-film/SKILL.md'], [], readers)).toEqual({
      e2e: true,
      full: false,
      files: ['src/take/film-skill.e2e.test.ts'],
    })
  })

  it('should list a suite once when an import and a read both reach it', () => {
    const readers = (): readonly string[] => ['src/a.e2e.test.ts']

    expect(
      scopeFor(['docs/a.md'], ['src/a.e2e.test.ts'], readers).files,
    ).toEqual(['src/a.e2e.test.ts'])
  })

  it('should not look for readers of a typescript source', () => {
    const readers = (): readonly string[] => ['src/a.e2e.test.ts']

    expect(scopeFor(['src/b.ts'], [], readers).e2e).toBe(false)
  })

  it('should run the full suite when the changed set is empty', () => {
    expect(scopeFor([], [], none)).toEqual({ e2e: true, full: true, files: [] })
  })
})
