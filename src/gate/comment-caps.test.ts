import { execaSync } from 'execa'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  commentBodyBlocks,
  commentFileShare,
  commentHeadBlocks,
  commentHistory,
  shippedCommentCaps,
} from '@/gate/comment-caps'
import type { RunCommand } from '@/gate/measures'
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

    it('should report a dense touched file without failing', async () => {
      commit('src/a.ts', headRuns(25, 1))

      const report = await commentFileShare(context(['src/a.ts']))

      expect(report.failure).toBeUndefined()
      expect(report.emissions[0]).toEqual({
        kind: 'warn',
        text: 'src/a.ts carries 25 comment text lines in 50, past 15%',
      })
    })

    it('should not read the share of a file under the floor', async () => {
      commit('src/a.ts', headRuns(24, 1))

      const report = await commentFileShare(context(['src/a.ts']))

      expect(report.emissions.map((emission) => emission.kind)).toEqual([
        'info',
      ])
    })

    it('should report a dense file without failing when scoping is off', async () => {
      commit('src/a.ts', headRuns(30, 1))

      const report = await commentFileShare(context())

      expect(report.failure).toBeUndefined()
      expect(report.emissions[0]?.kind).toBe('warn')
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

    describe('against a merge base', () => {
      const gitRun: RunCommand = async (argv) => {
        const done = execaSync(argv[0] ?? '', argv.slice(1), {
          cwd: root,
          env: gitEnv(),
          extendEnv: false,
          reject: false,
        })
        return {
          exitCode: done.exitCode ?? 1,
          stdout: done.stdout,
          stderr: done.stderr,
          all: '',
        }
      }

      const based = (base: string): GateContext => ({
        ...context(['src/a.ts']),
        run: gitRun,
        base,
      })

      const oldRun = [...comments(5), 'export const a = 1', ''].join('\n')

      it('should report an old run in a touched file without failing it', async () => {
        commit('src/a.ts', oldRun)
        const base = git('rev-parse', 'HEAD')
        writeFileSync(join(root, 'src/a.ts'), `${oldRun}export const b = 2\n`)

        const report = await commentHeadBlocks(based(base))

        expect(report.failure).toBeUndefined()
        expect(report.emissions.map((emission) => emission.text)).toEqual([
          'src/a.ts:1 runs 5 comment text lines outside a function body, past 3, untouched by this branch',
          '1 untouched run reported and not failed, since only a run the branch changed fails',
        ])
      })

      it('should fail an old run the branch edited one line of', async () => {
        commit('src/a.ts', oldRun)
        const base = git('rev-parse', 'HEAD')
        writeFileSync(
          join(root, 'src/a.ts'),
          oldRun.replace('// line 2', '// line two'),
        )

        const report = await commentHeadBlocks(based(base))

        expect(report.failure).toBe(
          '1 head comment run past 3 text lines. Cut each to the contract or the constraint the code cannot carry.',
        )
      })

      it('should fail an edited run where git config swaps the diff prefixes', async () => {
        git('config', 'diff.mnemonicPrefix', 'true')
        commit('src/a.ts', oldRun)
        const base = git('rev-parse', 'HEAD')
        writeFileSync(
          join(root, 'src/a.ts'),
          oldRun.replace('// line 2', '// line two'),
        )

        const report = await commentHeadBlocks(based(base))

        expect(report.failure).toBeDefined()
      })

      it('should fail an old run the branch deleted a line from', async () => {
        commit('src/a.ts', oldRun)
        const base = git('rev-parse', 'HEAD')
        writeFileSync(join(root, 'src/a.ts'), oldRun.replace('// line 2\n', ''))

        const report = await commentHeadBlocks(based(base))

        expect(report.failure).toBeDefined()
      })

      it('should fail a new run beside an old one and report the old', async () => {
        commit('src/a.ts', oldRun)
        const base = git('rev-parse', 'HEAD')
        writeFileSync(
          join(root, 'src/a.ts'),
          `${oldRun}${[...comments(4), 'export const b = 2', ''].join('\n')}`,
        )

        const report = await commentHeadBlocks(based(base))

        expect(report.emissions.map((emission) => emission.text)).toEqual([
          'src/a.ts:7 runs 4 comment text lines outside a function body, past 3',
          'src/a.ts:1 runs 5 comment text lines outside a function body, past 3, untouched by this branch',
          '1 untouched run reported and not failed, since only a run the branch changed fails',
        ])
      })

      it('should fail every run in a file git does not track yet', async () => {
        commit('src/other.ts', 'export const c = 3\n')
        const base = git('rev-parse', 'HEAD')
        writeFileSync(join(root, 'src/a.ts'), inBody(2))

        const report = await commentBodyBlocks(based(base))

        expect(report.failure).toBeDefined()
      })

      it('should fail every run and say why when the diff cannot be read', async () => {
        commit('src/a.ts', oldRun)

        const report = await commentHeadBlocks(based('not-a-revision'))

        expect(report.emissions.map((emission) => emission.text)).toEqual([
          'src/a.ts:1 runs 5 comment text lines outside a function body, past 3',
          'The changed lines could not be read, so every run in a touched file fails',
        ])
      })
    })

    describe('over shipped files', () => {
      it('should fail an untouched seed past the head cap', async () => {
        commit('tooling/web/seeds/src/a.ts', headRuns(1, 4))
        commit('src/b.ts', 'export const b = 1\n')

        const report = await shippedCommentCaps(context(['src/b.ts']))

        expect(report.failure).toBeDefined()
        expect(report.emissions[0]).toEqual({
          kind: 'warn',
          text: 'tooling/web/seeds/src/a.ts:1 runs 4 comment text lines outside a function body, past 3',
        })
      })

      it('should fail a config past the in-body cap when scoping is off', async () => {
        commit('tooling/astro/configs/a.ts', inBody(2))

        const report = await shippedCommentCaps(context())

        expect(report.failure).toBeDefined()
      })

      it('should fail a shipped comment carrying a date', async () => {
        commit(
          'tooling/claude/seeds/.claude/hooks/a.sh',
          '# measured on 2026-08-20\necho a\n',
        )

        const report = await shippedCommentCaps(context())

        expect(report.failure).toBeDefined()
      })

      it('should ignore a file outside configs and seeds', async () => {
        commit('tooling/web/reference.ts', headRuns(1, 40))
        commit('tooling/claude/user/a.ts', headRuns(1, 40))
        commit('src/a.ts', headRuns(1, 40))

        const report = await shippedCommentCaps(context())

        expect(report.failure).toBeUndefined()
      })

      it('should report a dense shipped file without failing', async () => {
        commit('tooling/web/configs/a.ts', headRuns(25, 1))

        const report = await shippedCommentCaps(context())

        expect(report.failure).toBeUndefined()
        expect(report.emissions[0]).toEqual({
          kind: 'warn',
          text: 'tooling/web/configs/a.ts carries 25 comment text lines in 50, past 15%',
        })
      })

      it('should pass shipped files under every cap', async () => {
        commit('tooling/web/configs/a.ts', headRuns(1, 3))

        const report = await shippedCommentCaps(context())

        expect(report.failure).toBeUndefined()
        expect(report.emissions.map((emission) => emission.kind)).toEqual([
          'info',
        ])
      })
    })
  })

  it.each([
    ['commentHeadBlocks', commentHeadBlocks],
    ['commentBodyBlocks', commentBodyBlocks],
    ['commentHistory', commentHistory],
    ['commentFileShare', commentFileShare],
    ['shippedCommentCaps', shippedCommentCaps],
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
