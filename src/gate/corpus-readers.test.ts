import { execaSync } from 'execa'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  e2eCliSpawners,
  e2eReadersOf,
  readersOf,
  readTestSources,
} from '@/gate/corpus-readers'
import { gitEnv } from '@/git/env'

describe('readersOf', () => {
  it('should select a test that resolves the folder from the root', () => {
    const sources = new Map([
      [
        'src/intake/drive-check.test.ts',
        "readFileSync(resolve(import.meta.dirname, '../../claude/skills/app-drive/references/drive-record.md'))",
      ],
    ])

    expect(
      readersOf('claude/skills/app-drive/references/drive-record.md', sources),
    ).toEqual(['src/intake/drive-check.test.ts'])
  })

  it('should select a test that joins the segments as arguments', () => {
    const sources = new Map([
      [
        'src/rules/rules.test.ts',
        "join(PROJECT_ROOT, 'governance', 'rules', name)",
      ],
    ])

    expect(readersOf('governance/rules/core/005-behavior.md', sources)).toEqual(
      ['src/rules/rules.test.ts'],
    )
  })

  it('should match a root-level file by its whole path', () => {
    const sources = new Map([
      ['src/readme.test.ts', "readFileSync(join(REPO_ROOT, 'README.md'))"],
    ])

    expect(readersOf('README.md', sources)).toEqual(['src/readme.test.ts'])
  })

  it('should skip a test naming the folder without resolving from the root', () => {
    const sources = new Map([
      ['src/slug.test.ts', "expect(slug('claude/skills/git-pr')).toBe('x')"],
    ])

    expect(readersOf('claude/skills/git-pr/SKILL.md', sources)).toEqual([])
  })

  it('should skip a test naming a different folder', () => {
    const sources = new Map([
      ['src/docs.test.ts', "join(process.cwd(), 'docs/agents')"],
    ])

    expect(readersOf('claude/skills/git-pr/SKILL.md', sources)).toEqual([])
  })

  it('should never select an end-to-end suite', () => {
    const sources = new Map([
      ['src/take/film.e2e.test.ts', "join(PROJECT_ROOT, 'claude/skills')"],
    ])

    expect(readersOf('claude/skills/ui-film/SKILL.md', sources)).toEqual([])
  })
})

describe('e2eReadersOf', () => {
  it('should select only the end-to-end suites reading the folder', () => {
    const sources = new Map([
      ['src/take/film.e2e.test.ts', "join(PROJECT_ROOT, 'claude/skills')"],
      ['src/skills.test.ts', "join(PROJECT_ROOT, 'claude/skills')"],
    ])

    expect(e2eReadersOf('claude/skills/ui-film/SKILL.md', sources)).toEqual([
      'src/take/film.e2e.test.ts',
    ])
  })

  it('should skip an end-to-end suite resolving no root', () => {
    const sources = new Map([
      ['src/take/film.e2e.test.ts', "expect(name).toBe('claude/skills/x')"],
    ])

    expect(e2eReadersOf('claude/skills/ui-film/SKILL.md', sources)).toEqual([])
  })
})

describe('e2eCliSpawners', () => {
  it('should select the end-to-end suites that spawn the cli entry', () => {
    const sources = new Map([
      ['src/a.e2e.test.ts', "new URL('../cli.ts', import.meta.url)"],
      ['src/b.e2e.test.ts', "import { run } from '@/cli/run'"],
      ['src/c.test.ts', "new URL('../cli.ts', import.meta.url)"],
    ])

    expect(e2eCliSpawners(sources)).toEqual(['src/a.e2e.test.ts'])
  })
})

describe('readTestSources', () => {
  let root: string

  const git = (...args: string[]): void => {
    execaSync('git', ['-C', root, ...args], { env: gitEnv(), extendEnv: false })
  }

  const write = (path: string, content: string): void => {
    const full = join(root, path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, content)
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-corpus-readers-'))
    git('init', '--initial-branch=main')
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('should read tracked tests and leave out sources and untracked files', () => {
    write('src/a.test.ts', 'tracked')
    write('src/a.ts', 'source')
    git('add', '--all')
    write('src/c.test.ts', 'untracked')

    expect([...readTestSources(root)]).toEqual([['src/a.test.ts', 'tracked']])
  })

  it('should append a fixture module beside a test to its source', () => {
    write('src/hooks/guard/small-hooks.test.ts', 'runs ROOT hooks')
    write(
      'src/hooks/guard/fixture.ts',
      "export const ROOT = join(import.meta.dirname, '.claude/hooks')",
    )
    git('add', '--all')

    expect(
      readersOf('.claude/hooks/plan-guard.sh', readTestSources(root)),
    ).toEqual(['src/hooks/guard/small-hooks.test.ts'])
  })

  it('should not append a production module beside a test', () => {
    write('src/claude/skills.test.ts', 'asserts the parser')
    write(
      'src/claude/skills.ts',
      "export const SKILLS = join(PROJECT_ROOT, 'claude/skills')",
    )
    git('add', '--all')

    expect(
      readersOf('claude/skills/git-pr/SKILL.md', readTestSources(root)),
    ).toEqual([])
  })

  it('should leave out a tracked test the working tree deleted', () => {
    write('src/a.test.ts', 'tracked')
    git('add', '--all')
    rmSync(join(root, 'src/a.test.ts'))

    expect(readTestSources(root).size).toBe(0)
  })
})
