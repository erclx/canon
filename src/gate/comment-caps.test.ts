import { execaSync } from 'execa'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  commentBodyBlocks,
  commentHeadBlocks,
  commentHistory,
} from '@/gate/comment-caps'
import { type GateContext, runStage } from '@/gate/sequencer'
import { STAGES } from '@/gate/stages'
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

  const context = (changed?: readonly string[]): GateContext => ({
    root,
    ci: false,
    run: refuse,
    cli: refuse,
    changed,
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

    it('should pass a touched in-body run of 1 line', async () => {
      commit('src/a.ts', inBody(1))

      const report = await commentBodyBlocks(context(['src/a.ts']))

      expect(report.failure).toBeUndefined()
    })

    it('should fail a touched in-body run of 2 lines naming its place', async () => {
      commit('src/a.ts', inBody(2))

      const report = await commentBodyBlocks(context(['src/a.ts']))

      expect(report.failure).toBeDefined()
      expect(report.emissions.map((emission) => emission.text)).toEqual([
        'src/a.ts:2 runs 2 comment text lines inside a function body, past 1',
      ])
    })

    it('should pass a touched in-body run whose other line is a directive', async () => {
      commit(
        'src/a.ts',
        [
          'function a() {',
          '  // @ts-expect-error the fixture is untyped',
          '  // the fixture arrives untyped',
          '  return 1',
          '}',
          '',
        ].join('\n'),
      )

      const report = await commentBodyBlocks(context(['src/a.ts']))

      expect(report.failure).toBeUndefined()
    })

    it('should pass a head run of any length under the body cap', async () => {
      commit('src/a.ts', headRuns(1, 40))

      const report = await commentBodyBlocks(context(['src/a.ts']))

      expect(report.failure).toBeUndefined()
    })

    it('should pass a touched head run of 3 text lines', async () => {
      commit('src/a.ts', headRuns(1, 3))

      const report = await commentHeadBlocks(context(['src/a.ts']))

      expect(report.failure).toBeUndefined()
    })

    it('should fail a touched head run of 4 text lines naming its place', async () => {
      commit('src/a.ts', headRuns(1, 4))

      const report = await commentHeadBlocks(context(['src/a.ts']))

      expect(report.failure).toBeDefined()
      expect(report.emissions.map((emission) => emission.text)).toEqual([
        'src/a.ts:1 runs 4 comment text lines outside a function body, past 3',
      ])
    })

    it('should pass an untouched file holding a 77-line head run', async () => {
      commit('src/a.ts', headRuns(1, 77))
      commit('src/b.ts', 'export const b = 1\n')

      const report = await commentHeadBlocks(context(['src/b.ts']))

      expect(report.failure).toBeUndefined()
    })

    it('should report a long head run without failing when scoping is off', async () => {
      commit('src/a.ts', headRuns(1, 77))

      const report = await commentHeadBlocks(context())

      expect(report.failure).toBeUndefined()
      expect(report.emissions[0]).toEqual({
        kind: 'warn',
        text: 'src/a.ts:1 runs 77 comment text lines outside a function body, past 3',
      })
    })

    it('should report an in-body run without failing when scoping is off', async () => {
      commit('src/a.ts', inBody(3))

      const report = await commentBodyBlocks(context())

      expect(report.failure).toBeUndefined()
      expect(report.emissions[0]?.kind).toBe('warn')
    })

    it('should skip a pruned fixture tree as the scan does', async () => {
      commit('src/fixtures/a.ts', inBody(30))

      const report = await commentBodyBlocks(context(['src/fixtures/a.ts']))

      expect(report.failure).toBeUndefined()
    })

    it('should fail a touched comment carrying a date naming its place', async () => {
      commit('src/a.ts', '// measured on 2026-08-20\nexport const a = 1\n')

      const report = await commentHistory(context(['src/a.ts']))

      expect(report.failure).toBeDefined()
      expect(report.emissions.map((emission) => emission.text)).toEqual([
        'src/a.ts:1 carries a date in a comment',
      ])
    })

    it('should pass an untouched comment carrying a date', async () => {
      commit('src/a.ts', '// measured on 2026-08-20\nexport const a = 1\n')
      commit('src/b.ts', 'export const b = 1\n')

      const report = await commentHistory(context(['src/b.ts']))

      expect(report.failure).toBeUndefined()
    })

    it('should pass a touched comment carrying a placeholder date', async () => {
      commit('src/a.ts', '// written as <YYYY-MM-DD>\nexport const a = 1\n')

      const report = await commentHistory(context(['src/a.ts']))

      expect(report.failure).toBeUndefined()
    })

    it('should fail a touched file through the gate stage', async () => {
      commit('src/a.ts', headRuns(1, 4))
      const stage = STAGES.find(
        (candidate) => candidate.id === 'comment-head-blocks',
      )
      if (stage === undefined) throw new Error('no comment-head-blocks stage')

      const result = await runStage(stage, context(['src/a.ts']))

      expect(result.status).toBe('failed')
    })
  })

  it.each([
    ['commentHeadBlocks', commentHeadBlocks],
    ['commentBodyBlocks', commentBodyBlocks],
    ['commentHistory', commentHistory],
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
