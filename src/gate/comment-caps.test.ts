import { execaSync } from 'execa'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { commentBodyBlocks, commentFileLines } from '@/gate/comment-caps'
import type { MeasureContext } from '@/gate/measures'
import { gitEnv } from '@/git/env'

const comments = (count: number, indent = ''): string[] =>
  Array.from({ length: count }, (_, n) => `${indent}// line ${n}`)

/** A function whose body opens on one comment run of `count` lines. */
const inBody = (count: number): string =>
  ['function a() {', ...comments(count, '  '), '  return 1', '}', ''].join('\n')

/** `runs` head runs of `size` lines, each ended by a line of code. */
const headRuns = (runs: number, size: number): string =>
  Array.from({ length: runs }, (_, n) =>
    [...comments(size), `export const a${n} = ${n}`].join('\n'),
  ).join('\n') + '\n'

describe('comment caps', () => {
  let root: string

  const refuse = () => {
    throw new Error('the comment caps read tracked files and run nothing')
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
    root = mkdtempSync(join(tmpdir(), 'canon-comment-caps-'))
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

    it('should pass an in-body run of 10 lines', async () => {
      commit('src/a.ts', inBody(10))

      const report = await commentBodyBlocks(context())

      expect(report.failure).toBeUndefined()
    })

    it('should fail an in-body run of 11 lines naming its place', async () => {
      commit('src/a.ts', inBody(11))

      const report = await commentBodyBlocks(context())

      expect(report.failure).toBeDefined()
      expect(report.emissions.map((emission) => emission.text)).toEqual([
        'src/a.ts:2 runs 11 comment lines inside a function body, past 10',
      ])
    })

    it('should pass a head run of any length under the body cap', async () => {
      commit('src/a.ts', headRuns(1, 40))

      const report = await commentBodyBlocks(context())

      expect(report.failure).toBeUndefined()
    })

    it('should pass a file at 200 lines in long runs', async () => {
      commit('src/a.ts', headRuns(20, 10))

      const report = await commentFileLines(context())

      expect(report.failure).toBeUndefined()
    })

    it('should fail a file at 201 lines in long runs', async () => {
      commit('src/a.ts', `${headRuns(19, 10)}${comments(11).join('\n')}\n`)

      const report = await commentFileLines(context())

      expect(report.failure).toBeDefined()
      expect(report.emissions.map((emission) => emission.text)).toEqual([
        'src/a.ts has 201 lines in comment runs of 10 or more, past 200',
      ])
    })

    it('should leave runs under 10 lines out of the file count', async () => {
      commit('src/a.ts', headRuns(30, 9))

      const report = await commentFileLines(context())

      expect(report.failure).toBeUndefined()
    })

    it('should count a bash file toward the file cap', async () => {
      const bash = Array.from(
        { length: 21 },
        (_, n) => `${Array(10).fill('# note').join('\n')}\necho ${n}`,
      ).join('\n')
      commit('scripts/a.sh', `#!/usr/bin/env bash\n${bash}\n`)

      const report = await commentFileLines(context())

      expect(report.failure).toBeDefined()
    })

    it('should skip a pruned fixture tree as the scan does', async () => {
      commit('src/fixtures/a.ts', inBody(30))

      const report = await commentBodyBlocks(context())

      expect(report.failure).toBeUndefined()
    })
  })

  it.each([
    ['commentBodyBlocks', commentBodyBlocks],
    ['commentFileLines', commentFileLines],
  ])(
    'should read a tree git cannot list as unmeasured in %s',
    async (_, measure) => {
      writeFileSync(join(root, 'a.ts'), inBody(30))

      const report = await measure(context())

      expect(report.unmeasured).toBeDefined()
      expect(report.failure).toBeUndefined()
    },
  )
})
