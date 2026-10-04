import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  assertStampField,
  type CommandResult,
  type Measure,
  type RunCommand,
  seedEntryCount,
} from '@/gate/measures'
import {
  collectChangedFiles,
  exitCodeFor,
  type GateContext,
  hasChanged,
  runStage,
  runStages,
  summarize,
} from '@/gate/sequencer'
import { type Stage, STAGES } from '@/gate/stages'
import { machineLockPath } from '@/gate/suite-lock'
import { SYSTEM_PROBES } from '@/sessions/live'

function result(overrides: Partial<CommandResult> = {}): CommandResult {
  return { exitCode: 0, stdout: '', stderr: '', all: '', ...overrides }
}

/**
 * A runner scripted by the joined argument vector, so a case says what one
 * command answers and every other command reports a clean run.
 */
function runnerFor(
  answers: Record<string, CommandResult> = {},
  seen?: string[],
): RunCommand {
  return async (argv) => {
    const key = argv.join(' ')
    seen?.push(key)
    return answers[key] ?? result()
  }
}

function contextWith(overrides: Partial<GateContext> = {}): GateContext {
  return {
    root: '/tmp/gate-fixture',
    ci: false,
    run: runnerFor(),
    cli: runnerFor(),
    write: true,
    ...overrides,
  }
}

function measuring(report: Awaited<ReturnType<Measure>>): Measure {
  return async () => report
}

function stage(id: string, overrides: Partial<Stage> = {}): Stage {
  return {
    id,
    label: id,
    checks: [{ kind: 'command', argv: ['true', id], failure: `${id} failed` }],
    success: `${id} clean`,
    ...overrides,
  }
}

describe('stage ordering', () => {
  it('should run every stage in table order', async () => {
    const seen: string[] = []
    const ctx = contextWith({ run: runnerFor({}, seen) })

    await runStages([stage('first'), stage('second')], ctx)

    expect(seen).toEqual(['true first', 'true second'])
  })

  it('should stop at the stage that found a fact', async () => {
    const ctx = contextWith({
      run: runnerFor({ 'true first': result({ exitCode: 1 }) }),
    })

    const results = await runStages([stage('first'), stage('second')], ctx)

    expect(results.map((entry) => entry.id)).toEqual(['first'])
  })

  it('should report the failing stage remedy rather than a bare exit code', async () => {
    const ctx = contextWith({
      run: runnerFor({ 'true first': result({ exitCode: 1 }) }),
    })

    const results = await runStages([stage('first')], ctx)

    expect(results[0].failure).toBe('first failed')
  })

  it('should keep the write grant deciding which format stage belongs in the run', async () => {
    const ctx = contextWith({ write: false })

    const results = await runStages(
      [
        stage('applies', { when: ({ write }) => write }),
        stage('checks', { when: ({ write }) => !write }),
      ],
      ctx,
    )

    expect(results.map((entry) => entry.id)).toEqual(['checks'])
  })

  it('should carry a duration on every stage result', async () => {
    const outcome = await runStage(stage('timed'), contextWith())

    expect(outcome.ms).toBeGreaterThanOrEqual(0)
  })
})

describe('changed-file scoping', () => {
  it('should skip a stage the changed set carries nothing for', async () => {
    const ctx = contextWith({ changed: ['docs/index.md'] })

    const outcome = await runStage(
      stage('shell', { scope: /\.sh$/, skipped: 'Skipped, no shell changes' }),
      ctx,
    )

    expect(outcome.status).toBe('skipped')
  })

  it('should run a stage the changed set carries a match for', async () => {
    const ctx = contextWith({ changed: ['scripts/core/thing.sh'] })

    const outcome = await runStage(stage('shell', { scope: /\.sh$/ }), ctx)

    expect(outcome.status).toBe('passed')
  })

  it('should run every scoped stage when scoping is off', () => {
    expect(hasChanged(/\.sh$/, undefined)).toBe(true)
  })

  it('should say what a skipped stage did not read', async () => {
    const ctx = contextWith({ changed: ['docs/index.md'] })

    const outcome = await runStage(
      stage('shell', { scope: /\.sh$/, skipped: 'Skipped, no shell changes' }),
      ctx,
    )

    expect(outcome.emissions).toEqual([
      { kind: 'info', text: 'Skipped, no shell changes' },
    ])
  })
})

describe('a stage holding a machine lock', () => {
  const lockPath = () => machineLockPath('suite')

  /** A holder this test process answers for, so the lock reads it as live. */
  function placeLiveHolder(root: string): void {
    mkdirSync(dirname(lockPath()), { recursive: true })
    writeFileSync(
      lockPath(),
      JSON.stringify({
        pid: process.pid,
        procStart: SYSTEM_PROBES.procStartOf(process.pid) ?? undefined,
        root,
      }),
    )
  }

  function probing(seen: boolean[]): Measure {
    return async () => {
      seen.push(existsSync(lockPath()))
      return { emissions: [] }
    }
  }

  afterEach(() => {
    rmSync(dirname(lockPath()), { recursive: true, force: true })
  })

  it('should hold the lock while its checks run', async () => {
    const seen: boolean[] = []

    await runStage(
      stage('suite', {
        lock: 'suite',
        checks: [{ kind: 'measure', measure: probing(seen) }],
      }),
      contextWith(),
    )

    expect(seen).toEqual([true])
  })

  it('should release the lock once its checks finish', async () => {
    await runStage(stage('suite', { lock: 'suite' }), contextWith())

    expect(existsSync(lockPath())).toBe(false)
  })

  it('should release the lock when a check fails', async () => {
    const ctx = contextWith({
      run: runnerFor({ 'true suite': result({ exitCode: 1 }) }),
    })

    const outcome = await runStage(stage('suite', { lock: 'suite' }), ctx)

    expect(outcome.status).toBe('failed')
    expect(existsSync(lockPath())).toBe(false)
  })

  it('should release the lock when a check throws', async () => {
    const throwing: Measure = () => Promise.reject(new Error('spawn failed'))

    const running = runStage(
      stage('suite', {
        lock: 'suite',
        checks: [{ kind: 'measure', measure: throwing }],
      }),
      contextWith(),
    )

    await expect(running).rejects.toThrow('spawn failed')
    expect(existsSync(lockPath())).toBe(false)
  })

  it('should not queue a stage the changed set skips', async () => {
    placeLiveHolder('/worktrees/other')

    const outcome = await runStage(
      stage('suite', { lock: 'suite', scope: /\.ts$/ }),
      contextWith({ changed: ['docs/index.md'] }),
    )

    expect(outcome.status).toBe('skipped')
    expect(readFileSync(lockPath(), 'utf8')).toContain('/worktrees/other')
  })

  it('should not take the lock under CI', async () => {
    placeLiveHolder('/worktrees/other')

    const outcome = await runStage(
      stage('suite', { lock: 'suite' }),
      contextWith({ ci: true }),
    )

    expect(outcome.status).toBe('passed')
  })

  it('should announce the queue before the stage finishes', async () => {
    placeLiveHolder('/worktrees/other')
    setTimeout(() => unlinkSync(lockPath()), 50)
    const order: string[] = []
    const checking: Measure = async () => {
      order.push('check')
      return { emissions: [] }
    }

    await runStage(
      stage('suite', {
        lock: 'suite',
        checks: [{ kind: 'measure', measure: checking }],
      }),
      contextWith({
        onQueue: (label, holder) => order.push(`${label} ${holder.root}`),
      }),
    )

    expect(order).toEqual(['suite /worktrees/other', 'check'])
  })

  it('should carry the time it queued on the result', async () => {
    placeLiveHolder('/worktrees/other')
    setTimeout(() => unlinkSync(lockPath()), 50)

    const outcome = await runStage(
      stage('suite', { lock: 'suite' }),
      contextWith(),
    )

    expect(outcome.queuedMs).toBeGreaterThan(0)
  })

  it('should carry no queue time on a stage that never waited', async () => {
    const outcome = await runStage(
      stage('suite', { lock: 'suite' }),
      contextWith(),
    )

    expect(outcome.queuedMs).toBeUndefined()
  })

  it('should name the worktree it queued behind', async () => {
    placeLiveHolder('/worktrees/other')
    setTimeout(() => unlinkSync(lockPath()), 50)

    const outcome = await runStage(
      stage('suite', { lock: 'suite' }),
      contextWith(),
    )

    expect(outcome.emissions[0]).toMatchObject({
      kind: 'info',
      text: expect.stringContaining('/worktrees/other'),
    })
  })
})

describe('the changed set', () => {
  it('should union the branch diff, the working tree, and untracked files', async () => {
    const run = runnerFor({
      'git merge-base HEAD origin/main': result({ stdout: 'abc123\n' }),
      'git diff --name-only abc123 HEAD': result({ stdout: 'src/one.ts\n' }),
      'git diff --name-only HEAD': result({ stdout: 'src/two.ts\n' }),
      'git ls-files --others --exclude-standard': result({
        stdout: 'src/three.ts\n',
      }),
    })

    const changed = await collectChangedFiles(run)

    expect(changed.files).toEqual(['src/one.ts', 'src/three.ts', 'src/two.ts'])
  })

  it('should run every stage when no merge base resolves', async () => {
    const run = runnerFor({
      'git merge-base HEAD origin/main': result({ exitCode: 1 }),
      'git merge-base HEAD main': result({ exitCode: 1 }),
    })

    const changed = await collectChangedFiles(run)

    expect(changed.scoped).toBe(false)
  })

  it('should run every stage when the local baseline equals HEAD', async () => {
    const run = runnerFor({
      'git merge-base HEAD origin/main': result({ exitCode: 1 }),
      'git merge-base HEAD main': result({ stdout: 'abc123\n' }),
      'git rev-parse HEAD': result({ stdout: 'abc123\n' }),
    })

    const changed = await collectChangedFiles(run)

    expect(changed.notice).toBe(
      'No pushed baseline to compare against. Running every stage.',
    )
  })

  it('should scope against a local baseline that sits behind HEAD', async () => {
    const run = runnerFor({
      'git merge-base HEAD origin/main': result({ exitCode: 1 }),
      'git merge-base HEAD main': result({ stdout: 'abc123\n' }),
      'git rev-parse HEAD': result({ stdout: 'def456\n' }),
      'git diff --name-only abc123 HEAD': result({ stdout: 'src/one.ts\n' }),
    })

    const changed = await collectChangedFiles(run)

    expect(changed).toMatchObject({ scoped: true, files: ['src/one.ts'] })
  })
})

describe('a stage that cannot measure its input', () => {
  const unreadable = stage('coverage', {
    checks: [
      {
        kind: 'measure',
        measure: measuring({
          emissions: [],
          unmeasured: 'The scenario tree did not report.',
        }),
      },
    ],
  })

  it('should report rather than pass on a contributor machine', async () => {
    const outcome = await runStage(unreadable, contextWith({ ci: false }))

    expect(outcome.status).toBe('unmeasured')
  })

  it('should say what it could not read rather than printing a clean line', async () => {
    const outcome = await runStage(unreadable, contextWith({ ci: false }))

    expect(outcome.emissions).toEqual([
      { kind: 'warn', text: 'The scenario tree did not report.' },
    ])
  })

  it('should refuse under CI, where an absent input is a broken runner', async () => {
    const outcome = await runStage(unreadable, contextWith({ ci: true }))

    expect(outcome.status).toBe('failed')
  })

  it('should leave the run green on a contributor machine', async () => {
    const results = await runStages([unreadable], contextWith({ ci: false }))

    expect(exitCodeFor(results)).toBe(0)
  })

  it('should count itself out of the stages that reported', async () => {
    const results = await runStages([unreadable], contextWith({ ci: false }))

    expect(summarize(results)).toMatchObject({ passed: 0, unmeasured: 1 })
  })
})

describe('a drift assert', () => {
  const drifting = stage('indexes', {
    checks: [
      { kind: 'drift', pathspec: '*index.md', failure: 'Indexes drifted.' },
    ],
  })

  it('should fail on a tracked file the regen rewrote', async () => {
    const ctx = contextWith({
      run: runnerFor({
        'git diff --exit-code --quiet -- *index.md': result({ exitCode: 1 }),
      }),
    })

    const outcome = await runStage(drifting, ctx)

    expect(outcome.status).toBe('failed')
  })

  it('should fail on a file the regen emitted that was never committed', async () => {
    const ctx = contextWith({
      run: runnerFor({
        'git ls-files --others --exclude-standard -- *index.md': result({
          stdout: 'docs/new/index.md\n',
        }),
      }),
    })

    const outcome = await runStage(drifting, ctx)

    expect(outcome.status).toBe('failed')
  })

  it('should pass when the index and the untracked set are both clean', async () => {
    const outcome = await runStage(drifting, contextWith())

    expect(outcome.status).toBe('passed')
  })
})

describe('the shipped stage table', () => {
  it('should keep the rule-citation gate that landed before the move', () => {
    const rules = STAGES.find((entry) => entry.id === 'rule-citations')

    expect(rules?.checks).toContainEqual({
      kind: 'cli',
      argv: ['gov', 'citations'],
      failure:
        'A path a rule cites, or an internal frontmatter glob, does not resolve. Run bun src/cli.ts gov citations.',
    })
  })

  it('should health check the hero regen without writing a frame', () => {
    const hero = STAGES.find((entry) => entry.id === 'hero')

    expect(hero?.checks[0]).toEqual({
      kind: 'command',
      argv: ['bun', 'scripts/core/regen-hero.ts', '--check'],
      failure: 'Hero regen health check failed',
    })
  })

  it('should give every stage an id no other stage carries', () => {
    const ids = STAGES.map((entry) => entry.id)

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('should hold a machine lock on the tests stage alone', () => {
    const locked = STAGES.filter((entry) => entry.lock !== undefined)

    expect(locked.map((entry) => [entry.id, entry.lock])).toEqual([
      ['tests', 'tests'],
    ])
  })

  it('should scope the tests stage to the corpora a src test asserts over', () => {
    const tests = STAGES.find((entry) => entry.id === 'tests')

    expect(tests?.scope?.test('governance/rules/ui/450-link-behavior.md')).toBe(
      true,
    )
  })
})

describe('seedEntryCount', () => {
  it('should sum the entries across every folder the audit resolved', () => {
    const payload = JSON.stringify({
      folders: [{ entries: 2 }, { entries: 3 }],
    })

    expect(seedEntryCount(payload)).toBe(5)
  })

  it('should read a record carrying no folders as nothing measured', () => {
    expect(seedEntryCount(JSON.stringify({ folders: [] }))).toBe(0)
  })

  it('should read a payload that does not parse as nothing measured', () => {
    expect(seedEntryCount('not json')).toBe(0)
  })
})

describe('assertStampField', () => {
  let root: string
  let source: string
  let stamp: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-gate-stamp-'))
    source = join(root, 'hero.html')
    stamp = join(root, 'hero.stamp')
    writeFileSync(source, '<p>frame</p>')
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('should report nothing when the recorded digest matches the file', () => {
    const digest = createHash('sha256').update('<p>frame</p>').digest('hex')
    writeFileSync(stamp, `source-sha256: ${digest}\n`)

    expect(assertStampField(root, stamp, 'source-sha256', source)).toEqual([])
  })

  it('should name both sides when the recorded digest disagrees', () => {
    writeFileSync(stamp, 'source-sha256: 0000\n')

    expect(assertStampField(root, stamp, 'source-sha256', source)).toEqual([
      'hero.stamp records source-sha256 0000',
      'hero.html hashes to 748ac6ab9a71d21a35ab438202674fade54b0031f5357bbeb64e704174ea5c26',
    ])
  })

  it('should report a stamp predating the field rather than comparing to nothing', () => {
    writeFileSync(stamp, 'source: hero.html\n')

    expect(assertStampField(root, stamp, 'source-sha256', source)).toEqual([
      'hero.stamp carries no source-sha256 line, so it predates the capture that writes one.',
    ])
  })
})
