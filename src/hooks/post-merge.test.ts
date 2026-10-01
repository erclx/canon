import { execaSync } from 'execa'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { gitEnv } from '@/git-env'
import {
  type StepCall,
  type StepResult,
  pullRequestNumbers,
  readMergedSubjects,
  runPostMerge,
} from '@/hooks/post-merge'

const ROOT = '/repo'
const CWD = '/repo/.claude/worktrees/feature'

type Responses = Record<string, StepResult>

afterEach(() => {
  vi.unstubAllEnvs()
})

function record(fields: Record<string, unknown>, exitCode = 0): StepResult {
  return { stdout: `${JSON.stringify(fields)}\n`, exitCode }
}

/** Keys a call by its verb, so a test names the step it answers rather than the full argv. */
function stepKey(args: readonly string[]): string {
  if (args[0] === 'tasks') return `archive:${args[3]}`
  if (args[0] === 'records') return 'push'
  if (args[0] === 'worktrees') return 'reclaim'
  if (args[0] === 'upgrade') return 'upgrade'
  return 'plugin-update'
}

function harness(
  responses: Responses = {},
  overrides: {
    subjects?: readonly string[]
    env?: Record<string, string>
  } = {},
) {
  const calls: StepCall[] = []
  let output = ''

  const run = async (call: StepCall): Promise<StepResult> => {
    calls.push(call)
    return responses[stepKey(call.args)] ?? { stdout: '', exitCode: 1 }
  }

  return {
    calls,
    output: () => output,
    go: () =>
      runPostMerge({
        root: ROOT,
        cwd: CWD,
        subjects: overrides.subjects ?? [],
        env: overrides.env ?? {},
        run,
        write: (text) => {
          output += text
        },
      }),
  }
}

describe('pullRequestNumbers', () => {
  it('should read the trailing number off every squash subject', () => {
    const subjects = [
      'feat(skills): one (#2022)',
      'chore(release): 5.7.0',
      'fix(cli): two (#2018)  ',
    ]

    expect(pullRequestNumbers(subjects)).toEqual([2022, 2018])
  })
})

describe('runPostMerge steps', () => {
  it('should run the steps in order with the root on the board steps alone', async () => {
    const h = harness({}, { subjects: ['feat: x (#7)'] })

    await h.go()

    expect(h.calls.map((call) => call.args)).toEqual([
      ['tasks', 'archive', '--pull-request', '7', '--root', ROOT, '--json'],
      ['records', 'push', '--root', ROOT, '--json'],
      ['worktrees', 'reclaim', '--json'],
      ['upgrade', '--json'],
      ['claude', 'plugin-update', '--json'],
    ])
  })

  it('should run the reclaim from the caller cwd', async () => {
    const h = harness()

    await h.go()

    const reclaim = h.calls.find((call) => call.args[0] === 'worktrees')
    expect(reclaim?.cwd).toBe(CWD)
  })

  it('should run the upgrade non-interactively', async () => {
    const h = harness()

    await h.go()

    const upgrade = h.calls.find((call) => call.args[0] === 'upgrade')
    expect(upgrade?.env.CANON_NON_INTERACTIVE).toBe('1')
  })

  it('should strip the hook repository variables from every child', async () => {
    vi.stubEnv('GIT_DIR', '/elsewhere/.git')
    const h = harness()

    await h.go()

    expect(h.calls.every((call) => call.env.GIT_DIR === undefined)).toBe(true)
  })

  it('should try the archive for every merged number', async () => {
    const h = harness({}, { subjects: ['a (#1)', 'b (#2)', 'c (#3)'] })

    await h.go()

    const archived = h.calls
      .filter((call) => call.args[0] === 'tasks')
      .map((call) => call.args[3])
    expect(archived).toEqual(['1', '2', '3'])
  })
})

describe('runPostMerge skip switches', () => {
  it('should skip only the reclaim under CANON_SKIP_RECLAIM', async () => {
    const h = harness({}, { env: { CANON_SKIP_RECLAIM: '1' } })

    await h.go()

    expect(h.calls.map((call) => stepKey(call.args))).toEqual([
      'push',
      'upgrade',
      'plugin-update',
    ])
  })

  it('should skip only the upgrade under CANON_SKIP_UPGRADE', async () => {
    const h = harness({}, { env: { CANON_SKIP_UPGRADE: '1' } })

    await h.go()

    expect(h.calls.map((call) => stepKey(call.args))).toEqual([
      'push',
      'reclaim',
      'plugin-update',
    ])
  })

  it('should skip only the plugin update under CANON_SKIP_PLUGIN_UPDATE', async () => {
    const h = harness({}, { env: { CANON_SKIP_PLUGIN_UPDATE: '1' } })

    await h.go()

    expect(h.calls.map((call) => stepKey(call.args))).toEqual([
      'push',
      'reclaim',
      'upgrade',
    ])
  })
})

describe('runPostMerge archive lines', () => {
  it('should name the archived task and its pull request', async () => {
    const h = harness(
      { 'archive:7': record({ ok: true, task: 'v1.0-thing' }) },
      { subjects: ['x (#7)'] },
    )

    await h.go()

    expect(h.output()).toBe('\n📦 Archived v1.0-thing, closed by #7.\n\n')
  })

  it('should name the files whose links to the archived task failed to repoint', async () => {
    const h = harness(
      {
        'archive:7': record({
          ok: true,
          task: 'v1.0-thing',
          relinkFailed: [
            { file: '.canon/tasks/a.md', message: 'EACCES' },
            { file: '.canon/tasks/b.md', message: 'EACCES' },
          ],
        }),
      },
      { subjects: ['x (#7)'] },
    )

    await h.go()

    expect(h.output()).toBe(
      '\n📦 Archived v1.0-thing, closed by #7.\n' +
        '🔗 Links not repointed in: .canon/tasks/a.md,.canon/tasks/b.md\n\n',
    )
  })

  it('should stay quiet on a pull request no task names', async () => {
    const h = harness(
      { 'archive:7': record({ ok: false, reason: 'no-match' }, 1) },
      { subjects: ['x (#7)'] },
    )

    await h.go()

    expect(h.output()).toBe('')
  })

  it('should stay quiet on a checkout with no board', async () => {
    const h = harness(
      { 'archive:7': record({ ok: false, reason: 'no-board' }, 1) },
      { subjects: ['x (#7)'] },
    )

    await h.go()

    expect(h.output()).toBe('')
  })

  it('should print a message carrying an escaped quote in full', async () => {
    const h = harness(
      {
        'archive:7': record(
          { ok: false, reason: 'pending', message: 'waits on "feat/x" still' },
          1,
        ),
      },
      { subjects: ['x (#7)'] },
    )

    await h.go()

    expect(h.output()).toBe(
      '\n📋 Task not archived for #7: waits on "feat/x" still\nRun /task-board to resolve it by hand.\n\n',
    )
  })
})

describe('runPostMerge records push lines', () => {
  it('should count the paths a push changed', async () => {
    const h = harness({ push: record({ ok: true, changed: 3 }) })

    await h.go()

    expect(h.output()).toBe('\n🗄️  Backed up 3 record path(s).\n\n')
  })

  it('should stay quiet on a push that changed nothing', async () => {
    const h = harness({ push: record({ ok: true, changed: 0 }) })

    await h.go()

    expect(h.output()).toBe('')
  })

  it('should stay quiet on a machine with no records history', async () => {
    const h = harness({
      push: record({ ok: false, reason: 'no-repository' }, 1),
    })

    await h.go()

    expect(h.output()).toBe('')
  })

  it('should point an unsafe payload at the manual push', async () => {
    const h = harness({
      push: record({ ok: false, reason: 'unsafe-payload' }, 1),
    })

    await h.go()

    expect(h.output()).toBe(
      '\n🗄️  Records not backed up: unsafe-payload\nRun canon records push to see the blocked paths.\n\n',
    )
  })

  it('should point any other refusal at a retry', async () => {
    const h = harness({
      push: record({ ok: false, reason: 'push-failed' }, 1),
    })

    await h.go()

    expect(h.output()).toBe(
      '\n🗄️  Records not backed up: push-failed\nRun canon records push when the remote is reachable.\n\n',
    )
  })
})

describe('runPostMerge reclaim lines', () => {
  it('should print both the removal and the failure from the fields', async () => {
    const h = harness({
      reclaim: record({ reason: null, removed: 2, failed: 1 }, 1),
    })

    await h.go()

    expect(h.output()).toBe(
      '\n🧹 Reclaimed 2 worktree(s) whose pull request merged.\n\n' +
        '\n🧹 1 worktree(s) could not be removed.\nRun canon worktrees reclaim to read which step failed.\n\n',
    )
  })

  it('should report an unreadable reading', async () => {
    const h = harness({
      reclaim: record({ reason: 'gh-failed', removed: 0, failed: 0 }, 1),
    })

    await h.go()

    expect(h.output()).toBe(
      '\n🧹 Worktrees not reclaimed: gh-failed\nRun canon worktrees list to read the state by hand.\n\n',
    )
  })

  it('should stay quiet on a machine without gh', async () => {
    const h = harness({
      reclaim: record({ reason: 'gh-missing', removed: 0, failed: 0 }, 1),
    })

    await h.go()

    expect(h.output()).toBe('')
  })
})

describe('runPostMerge upgrade lines', () => {
  it('should stay quiet on a current binary', async () => {
    const h = harness({
      upgrade: record({ state: 'current', message: 'CLI current' }),
    })

    await h.go()

    expect(h.output()).toBe('')
  })

  it('should print the message of a moved binary', async () => {
    const h = harness({
      upgrade: record({ state: 'upgraded', message: 'CLI 1.0 to 1.1' }),
    })

    await h.go()

    expect(h.output()).toBe('\n⬆️  CLI 1.0 to 1.1\n\n')
  })

  it('should report a failed upgrade from its record', async () => {
    const h = harness({
      upgrade: record({ state: 'refused', message: 'registry down' }, 1),
    })

    await h.go()

    expect(h.output()).toBe('\n⬆️  CLI not upgraded: registry down\n\n')
  })

  it('should stay quiet on a failed child with no record', async () => {
    const h = harness({ upgrade: { stdout: '', exitCode: 1 } })

    await h.go()

    expect(h.output()).toBe('')
  })
})

describe('runPostMerge plugin update lines', () => {
  it('should print the message of a moved plugin', async () => {
    const h = harness({
      'plugin-update': record({ state: 'updated', message: 'Plugin 1 to 2' }),
    })

    await h.go()

    expect(h.output()).toBe('\n🔌 Plugin 1 to 2\n\n')
  })

  it('should stay quiet on a project without the plugin', async () => {
    const h = harness({
      'plugin-update': record(
        { reason: 'no-plugin', message: 'not installed' },
        1,
      ),
    })

    await h.go()

    expect(h.output()).toBe('')
  })

  it('should report any other refusal', async () => {
    const h = harness({
      'plugin-update': record(
        { reason: 'update-failed', message: 'update exited 1' },
        1,
      ),
    })

    await h.go()

    expect(h.output()).toBe('\n🔌 Plugin not updated: update exited 1\n\n')
  })
})

describe('runPostMerge resilience', () => {
  it('should finish every step when a child throws', async () => {
    const calls: string[] = []
    const run = async (call: StepCall): Promise<StepResult> => {
      calls.push(stepKey(call.args))
      throw new Error('spawn failed')
    }

    await runPostMerge({
      root: ROOT,
      cwd: CWD,
      subjects: [],
      env: {},
      run,
      write: () => {},
    })

    expect(calls).toEqual(['push', 'reclaim', 'upgrade', 'plugin-update'])
  })
})

describe('readMergedSubjects', () => {
  let repo: string

  function git(...args: string[]): void {
    execaSync('git', ['-C', repo, ...args], {
      env: gitEnv(),
      extendEnv: false,
    })
  }

  function commit(message: string): void {
    writeFileSync(join(repo, 'file.txt'), `${message}\n`)
    git('add', '--all')
    git('commit', '-m', message)
  }

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'canon-post-merge-'))
    git('init', '--initial-branch=main')
    git('config', 'user.email', 'test@example.com')
    git('config', 'user.name', 'Test')
    commit('base (#1)')
  })

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true })
  })

  it('should read every subject since ORIG_HEAD', async () => {
    git('update-ref', 'ORIG_HEAD', 'HEAD')
    commit('two (#2)')
    commit('three (#3)')

    expect(await readMergedSubjects(repo)).toEqual(['three (#3)', 'two (#2)'])
  })

  it('should fall back to the tip with no ORIG_HEAD', async () => {
    commit('two (#2)')

    expect(await readMergedSubjects(repo)).toEqual(['two (#2)'])
  })

  it('should answer for the named repository under an inherited GIT_DIR', async () => {
    vi.stubEnv('GIT_DIR', '/nonexistent/.git')

    expect(await readMergedSubjects(repo)).toEqual(['base (#1)'])
  })
})
