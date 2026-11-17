import { execaSync } from 'execa'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { readersOf, readTestSources } from '@/gate/corpus-readers'
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

  it('should leave out a tracked test the working tree deleted', () => {
    write('src/a.test.ts', 'tracked')
    git('add', '--all')
    rmSync(join(root, 'src/a.test.ts'))

    expect(readTestSources(root).size).toBe(0)
  })
})
