import { execaSync } from 'execa'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { fileLength } from '@/gate/file-length'
import type { MeasureContext } from '@/gate/measures'
import { gitEnv } from '@/git/env'

const lines = (count: number, trailingNewline = true): string =>
  Array.from({ length: count }, (_, n) => `line ${n}`).join('\n') +
  (trailingNewline ? '\n' : '')

describe('fileLength', () => {
  let root: string

  const refuse = () => {
    throw new Error('fileLength reads tracked files and runs nothing')
  }

  const context = (): MeasureContext => ({
    root,
    ci: false,
    run: refuse,
    cli: refuse,
  })

  const git = (...args: string[]): string =>
    execaSync('git', ['-C', root, ...args], {
      env: gitEnv(),
      extendEnv: false,
    }).stdout

  const commit = (path: string, content: string): void => {
    const full = join(root, path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, content)
    git('add', '--all')
    git('commit', '-m', `add ${path}`)
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-file-length-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  describe('in a repository', () => {
    beforeEach(() => {
      git('init', '--initial-branch=main')
      git('config', 'user.email', 'test@example.com')
      git('config', 'user.name', 'Test')
    })

    it('should pass a file of exactly 2,000 lines', async () => {
      commit('src/a.ts', lines(2000))

      const report = await fileLength(context())

      expect(report.failure).toBeUndefined()
    })

    it('should name how many files a passing run measured', async () => {
      commit('src/a.ts', lines(10))
      commit('src/b.ts', lines(10))
      commit('docs/a.md', lines(10))

      const report = await fileLength(context())

      expect(report.emissions).toEqual([
        {
          kind: 'info',
          text: 'No code file past 2000 lines across 2 source files',
        },
      ])
    })

    it('should pass a 2,000 line file with no trailing newline', async () => {
      commit('src/a.ts', lines(2000, false))

      const report = await fileLength(context())

      expect(report.failure).toBeUndefined()
    })

    it('should fail a file of 2,001 lines naming its path and count', async () => {
      commit('src/a.ts', lines(2001))

      const report = await fileLength(context())

      expect(report.failure).toBeDefined()
      expect(
        report.emissions.map((emission) => emission.text).join('\n'),
      ).toContain('src/a.ts has 2001 lines')
    })

    it('should name every file past the cap and none under it', async () => {
      commit('src/long.ts', lines(2500))
      commit('src/longer.test.ts', lines(3000))
      commit('src/short.ts', lines(10))

      const report = await fileLength(context())

      const text = report.emissions.map((emission) => emission.text).join('\n')
      expect(text).toContain('src/long.ts')
      expect(text).toContain('src/longer.test.ts')
      expect(text).not.toContain('src/short.ts')
    })

    it('should never count markdown, html, or json', async () => {
      commit('docs/a.md', lines(3000))
      commit('canon/design/page.html', lines(3000))
      commit('data.json', lines(3000))

      const report = await fileLength(context())

      expect(report.failure).toBeUndefined()
    })

    it('should count a module file the way the report does', async () => {
      commit('scripts/a.mjs', lines(2001))

      const report = await fileLength(context())

      expect(report.failure).toBeDefined()
    })

    it('should skip a tracked file deleted from the working tree', async () => {
      commit('src/gone.ts', lines(2001))
      rmSync(join(root, 'src/gone.ts'))

      const report = await fileLength(context())

      expect(report.failure).toBeUndefined()
    })

    it('should count a new file git has not yet tracked', async () => {
      commit('src/a.ts', lines(10))
      writeFileSync(join(root, 'src/new.ts'), lines(3000))

      const report = await fileLength(context())

      expect(report.failure).toBeDefined()
    })

    it('should not count a file git ignores', async () => {
      commit('.gitignore', '.claude/worktrees/\n')
      mkdirSync(join(root, '.claude/worktrees/x'), { recursive: true })
      writeFileSync(join(root, '.claude/worktrees/x/a.ts'), lines(3000))

      const report = await fileLength(context())

      expect(report.failure).toBeUndefined()
    })
  })

  it('should read a tree git cannot list as unmeasured', async () => {
    writeFileSync(join(root, 'a.ts'), lines(3000))

    const report = await fileLength(context())

    expect(report.unmeasured).toBeDefined()
    expect(report.failure).toBeUndefined()
  })
})
