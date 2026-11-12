import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  checkCounterparts,
  counterpartPaths,
  readCounterpartRoot,
} from '@/records/counterpart'

const ROOT_FILES = new Set(['package.json', '.gitignore', 'tsconfig.json'])
const CONTEXT = { rootFiles: ROOT_FILES }

function filesEntry(...paths: string[]): string[] {
  return paths.map((path) => `- \`${path}\`: changes it`)
}

describe('counterpartPaths', () => {
  it.each([
    ['.github/workflows/ci.yml'],
    ['.husky/pre-push'],
    ['.claude/hooks/guard.sh'],
    ['scripts/core/render-film.ts'],
    ['tooling/base/configs/.prettierrc'],
    ['tooling/claude/seeds/CLAUDE.md'],
    ['package.json'],
    ['.gitignore'],
  ])('fires on %s', (path) => {
    expect(counterpartPaths(filesEntry(path), CONTEXT)).toEqual([path])
  })

  it.each([
    ['.ts'],
    ['.astro'],
    ['LICENSE'],
    ['README.md'],
    ['bun.lock'],
    ['tooling/base/manifest.toml'],
    ['src/records/validate.ts'],
    ['.claude/skills/internal-tooling/SKILL.md'],
  ])('does not fire on %s', (path) => {
    expect(counterpartPaths(filesEntry(path), CONTEXT)).toEqual([])
  })

  it('reads a root file only when the root holds it', () => {
    const context = { rootFiles: new Set<string>() }

    expect(counterpartPaths(filesEntry('package.json'), context)).toEqual([])
  })

  it('reads a path cited in the reason half of an entry', () => {
    const entry = [
      '- `src/records/validate.ts`: mirrors the read in `.husky/pre-push`',
    ]

    expect(counterpartPaths(entry, CONTEXT)).toEqual(['.husky/pre-push'])
  })

  it('names a path cited twice once', () => {
    const entries = [
      '- `scripts/a.sh`: changes it',
      '- `src/b.ts`: calls `scripts/a.sh`',
    ]

    expect(counterpartPaths(entries, CONTEXT)).toEqual(['scripts/a.sh'])
  })
})

describe('checkCounterparts', () => {
  const files = filesEntry('.github/workflows/ci.yml')

  it('reports a firing path when the plan carries no section', () => {
    const found = checkCounterparts(files, undefined, CONTEXT)

    expect(found).toHaveLength(1)
    expect(found[0].kind).toBe('counterpart-unstated')
    expect(found[0].subject).toBe('.github/workflows/ci.yml')
  })

  it('reports a firing path no bullet covers', () => {
    const section = ['- `scripts/a.sh`: none, canon-only']

    const found = checkCounterparts(files, section, CONTEXT)

    expect(found.map((one) => one.kind)).toEqual(['counterpart-unstated'])
  })

  it('reads None identified. as covering nothing', () => {
    const found = checkCounterparts(files, ['None identified.'], CONTEXT)

    expect(found.map((one) => one.kind)).toEqual(['counterpart-unstated'])
  })

  it.each([
    ['here', '- `.github/workflows/ci.yml`: here'],
    ['none with a reason', '- `.github/workflows/ci.yml`: none, canon-only'],
    ['filed with a stem', '- `.github/workflows/ci.yml`: filed `v187.9`'],
  ])('accepts %s', (_verdict, bullet) => {
    expect(checkCounterparts(files, [bullet], CONTEXT)).toEqual([])
  })

  it.each([
    ['bare none', '- `.github/workflows/ci.yml`: none'],
    ['filed with no stem', '- `.github/workflows/ci.yml`: filed v187.9'],
    ['an unknown verdict', '- `.github/workflows/ci.yml`: later'],
    ['no verdict at all', '- `.github/workflows/ci.yml`'],
  ])('reports %s as malformed', (_case, bullet) => {
    const found = checkCounterparts(files, [bullet], CONTEXT)

    expect(found.map((one) => one.kind)).toEqual(['counterpart-malformed'])
  })

  it('covers every file under a directory bullet', () => {
    const entries = filesEntry(
      '.github/workflows/ci.yml',
      '.github/workflows/release.yml',
    )
    const section = ['- `.github/workflows/`: filed `v187.9`']

    expect(checkCounterparts(entries, section, CONTEXT)).toEqual([])
  })

  it('does not read a sibling sharing a prefix as covered', () => {
    const entries = filesEntry('scripts/a/b.sh', 'scripts/ab.sh')
    const section = ['- `scripts/a`: here']

    const found = checkCounterparts(entries, section, CONTEXT)

    expect(found.map((one) => one.subject)).toEqual(['scripts/ab.sh'])
  })

  it('covers both paths a two-path bullet names', () => {
    const entries = filesEntry(
      '.github/workflows/ci.yml',
      'tooling/base/seeds/.github/workflows/ci.yml',
    )
    const section = [
      '- `.github/workflows/ci.yml`, `tooling/base/seeds/.github/workflows/ci.yml`: here',
    ]

    expect(checkCounterparts(entries, section, CONTEXT)).toEqual([])
  })

  it('reads a wrapped reason as part of its bullet', () => {
    const section = ['- `.github/workflows/ci.yml`: none,', '  canon-only job']

    expect(checkCounterparts(files, section, CONTEXT)).toEqual([])
  })

  it('reports nothing when no path fires', () => {
    const entries = filesEntry('src/records/validate.ts')

    expect(checkCounterparts(entries, undefined, CONTEXT)).toEqual([])
  })
})

describe('readCounterpartRoot', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-counterpart-'))
    writeFileSync(join(root, 'package.json'), '{}')
    writeFileSync(join(root, 'LICENSE'), '')
    writeFileSync(join(root, 'README.md'), '')
    mkdirSync(join(root, 'src'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('reads nothing in a project with no stack under tooling/', async () => {
    expect(await readCounterpartRoot(root)).toBeUndefined()
  })

  it('reads the top-level files when a stack keeps a manifest', async () => {
    mkdirSync(join(root, 'tooling/base'), { recursive: true })
    writeFileSync(join(root, 'tooling/base/manifest.toml'), '')

    const context = await readCounterpartRoot(root)

    expect([...(context?.rootFiles ?? [])].sort()).toEqual(['package.json'])
  })
})
