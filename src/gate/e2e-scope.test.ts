import { describe, expect, it } from 'vitest'

import { scopeFor, versionOnly } from '../../scripts/ci/e2e-scope'

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

  it('should add the suite spawning a changed typescript file by path', () => {
    const readers = (file: string): readonly string[] =>
      file === 'tooling/web/configs/e2e/screenshot.ts'
        ? ['src/tooling/screenshot-mask.e2e.test.ts']
        : []

    expect(
      scopeFor(['tooling/web/configs/e2e/screenshot.ts'], [], readers).files,
    ).toEqual(['src/tooling/screenshot-mask.e2e.test.ts'])
  })

  describe('cli', () => {
    const cli = {
      spawners: ['src/browser/swipe.e2e.test.ts'],
      bootstrap: ['src/cli.ts', 'src/cli/retired.ts'],
    }

    it('should add the spawning suites when a file the cli loads outside a command changes', () => {
      expect(scopeFor(['src/cli/retired.ts'], [], none, cli)).toEqual({
        e2e: true,
        full: false,
        files: cli.spawners,
      })
    })

    it('should add the spawning suites when the cli entry changes', () => {
      expect(scopeFor(['src/cli.ts'], [], none, cli).files).toEqual(
        cli.spawners,
      )
    })

    it('should leave the spawning suites out when only a command changes', () => {
      expect(scopeFor(['src/records/backup.ts'], [], none, cli).e2e).toBe(false)
    })

    it('should leave the spawning suites out when no source changes', () => {
      expect(scopeFor(['docs/a.md'], [], none, cli).e2e).toBe(false)
    })
  })

  describe('version', () => {
    it('should skip every suite when a release moves only the package version', () => {
      expect(
        scopeFor(['package.json', 'CHANGELOG.md'], [], none, {
          versionOnly: true,
        }),
      ).toEqual({ e2e: false, full: false, files: [] })
    })

    it('should skip every suite when the package version is the only change', () => {
      expect(
        scopeFor(['package.json'], [], none, { versionOnly: true }).e2e,
      ).toBe(false)
    })

    it('should run the full suite when package.json changes more than its version', () => {
      expect(
        scopeFor(['package.json'], [], none, { versionOnly: false }),
      ).toEqual({ e2e: true, full: true, files: [] })
    })

    it('should run the full suite when another trigger changes beside a version', () => {
      expect(
        scopeFor(['package.json', 'tsconfig.json'], [], none, {
          versionOnly: true,
        }).full,
      ).toBe(true)
    })
  })

  describe('versionOnly', () => {
    it('should hold when only the version differs', () => {
      const base = '{"name":"a","version":"1.0.0","dependencies":{"x":"1"}}'
      const head = '{"name":"a","version":"1.1.0","dependencies":{"x":"1"}}'

      expect(versionOnly(base, head)).toBe(true)
    })

    it('should fail when a dependency differs beside the version', () => {
      const base = '{"version":"1.0.0","dependencies":{"x":"1"}}'
      const head = '{"version":"1.1.0","dependencies":{"x":"2"}}'

      expect(versionOnly(base, head)).toBe(false)
    })

    it('should fail when a side is not json', () => {
      expect(versionOnly('', '{"version":"1.0.0"}')).toBe(false)
    })
  })

  it('should run the full suite when the changed set is empty', () => {
    expect(scopeFor([], [], none)).toEqual({ e2e: true, full: true, files: [] })
  })
})
