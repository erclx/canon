import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git/env'
import { readCoverage } from '@/gov/coverage'
import type { SyncChange } from '@/sync/engine'

let target: string

function write(rel: string, body: string): void {
  const path = join(target, rel)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, body)
}

function rule(sub: string, name: string, paths?: string[]): SyncChange {
  const frontmatter =
    paths === undefined
      ? '---\ndescription: x\n---\n'
      : `---\ndescription: x\npaths:\n${paths.map((p) => `  - '${p}'`).join('\n')}\n---\n`
  const rel = `.claude/rules/canon/${sub}/${name}.md`
  write(rel, `${frontmatter}\n# ${name}\n`)
  return { kind: 'copy', source: '/unused', dest: join(target, rel), rel }
}

function initGit(): void {
  execFileSync('git', ['init', '-q', target], { env: gitEnv() })
}

beforeEach(() => {
  target = mkdtempSync(join(tmpdir(), 'canon-gov-coverage-'))
})

afterEach(() => {
  rmSync(target, { recursive: true, force: true })
})

describe('readCoverage', () => {
  it('counts the files a rule glob matches', async () => {
    initGit()
    write('src/app.tsx', '')
    write('src/nested/card.tsx', '')
    write('src/util.ts', '')
    const change = rule('lang', 'react', ['**/*.tsx'])

    const [record] = await readCoverage(target, [change])

    expect(record).toEqual({
      rule: '.claude/rules/canon/lang/react.md',
      paths: ['**/*.tsx'],
      files: 2,
      ui: false,
    })
  })

  it('flags a rule under the ui folder', async () => {
    initGit()
    write('index.html', '')
    const change = rule('ui', 'a11y', ['**/*.html'])

    const [record] = await readCoverage(target, [change])

    expect(record.ui).toBe(true)
    expect(record.files).toBe(1)
  })

  it('reports a rule without paths as always loaded', async () => {
    initGit()
    write('a.ts', '')
    const change = rule('canon', 'git')

    const [record] = await readCoverage(target, [change])

    expect(record.paths).toEqual([])
  })

  it('reports zero for a glob that matches nothing', async () => {
    initGit()
    write('a.ts', '')
    const change = rule('lang', 'python', ['**/*.py'])

    const [record] = await readCoverage(target, [change])

    expect(record.files).toBe(0)
  })

  it('leaves the count unset outside git', async () => {
    write('a.ts', '')
    const change = rule('lang', 'typescript', ['**/*.ts'])

    const [record] = await readCoverage(target, [change])

    expect(record.paths).toEqual(['**/*.ts'])
    expect(record.files).toBeUndefined()
  })

  it('records nothing for a delete', async () => {
    initGit()
    const removal: SyncChange = {
      kind: 'delete',
      dest: join(target, '.claude/rules/canon/old.md'),
      rel: '.claude/rules/canon/old.md',
    }

    expect(await readCoverage(target, [removal])).toEqual([])
  })
})
