import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildStackSummaries, describeStack } from '@/tooling/list'

let root: string

function seedStack(name: string, body: string): void {
  const dir = join(root, 'tooling', name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'manifest.toml'), body)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-tooling-list-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('buildStackSummaries', () => {
  it('should count dev packages, scripts, and gitignore groups', () => {
    seedStack(
      'base',
      [
        '[stack]',
        'name = "base"',
        '',
        '[dependencies.dev]',
        'packages = ["prettier", "husky"]',
        '',
        '[scripts]',
        '"dev" = "vite"',
        '"build" = "vite build"',
        '',
        '[gitignore]',
        '"# System" = [".DS_Store"]',
        '',
      ].join('\n'),
    )

    expect(buildStackSummaries(root)).toEqual([
      {
        name: 'base',
        extends: null,
        devDeps: 2,
        scripts: 2,
        gitignoreGroups: 1,
      },
    ])
  })

  it('should report extends as null when the stack has no parent', () => {
    seedStack('base', '[stack]\nname = "base"\nextends = ""\n')

    expect(buildStackSummaries(root)[0].extends).toBeNull()
  })

  it('should report the parent stack name when extends is set', () => {
    seedStack('web', '[stack]\nname = "web"\nextends = "base"\n')

    expect(buildStackSummaries(root)[0].extends).toBe('base')
  })

  it('should exclude the claude stack the way discovery does', () => {
    seedStack('base', '[stack]\nname = "base"\n')
    seedStack('claude', '[stack]\nname = "claude"\n')

    expect(buildStackSummaries(root).map((entry) => entry.name)).toEqual([
      'base',
    ])
  })

  it('should not count the scripts override table as scripts', () => {
    seedStack(
      'web',
      '[stack]\nname = "web"\n\n[scripts]\n"dev" = "vite"\n\n[scripts.override]\n"build" = "vite build"\n',
    )

    expect(buildStackSummaries(root)[0].scripts).toBe(1)
  })

  it('should serialize a stack name carrying a quote as valid JSON', () => {
    seedStack('odd', '[stack]\nname = "odd"\nextends = "say \\"hi\\""\n')

    const json = JSON.stringify({ stacks: buildStackSummaries(root) })

    expect(JSON.parse(json).stacks[0].extends).toBe('say "hi"')
  })
})

describe('describeStack', () => {
  it('should omit the extends clause for a root stack', () => {
    const line = describeStack({
      name: 'base',
      extends: null,
      devDeps: 5,
      scripts: 8,
      gitignoreGroups: 3,
    })

    expect(line).toBe('base (5 dev deps, 8 scripts, 3 gitignore groups)')
  })

  it('should lead with the extends clause for a child stack', () => {
    const line = describeStack({
      name: 'astro',
      extends: 'web',
      devDeps: 6,
      scripts: 6,
      gitignoreGroups: 1,
    })

    expect(line).toBe(
      'astro (extends: web, 6 dev deps, 6 scripts, 1 gitignore groups)',
    )
  })
})
