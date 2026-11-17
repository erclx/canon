import {
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gateRecord } from '@/commands/gate'
import { type StageResult, summarize } from '@/gate/sequencer'
import { gitEnv } from '@/git/env'

const CLI = join(import.meta.dirname, '..', 'cli.ts')
const RUN_TIMEOUT_MS = 60_000

describe('canon gate run in a target', () => {
  let target: string

  beforeEach(async () => {
    target = realpathSync(mkdtempSync(join(tmpdir(), 'canon-gate-target-')))
    writeFileSync(
      join(target, 'package.json'),
      JSON.stringify({ name: 'target' }),
    )
    writeFileSync(join(target, 'README.md'), '# Target\n\nA plain line.\n')
    const git = { cwd: target, env: gitEnv(), extendEnv: false }
    await execa('git', ['init', '-q', '--initial-branch=main'], git)
    await execa('git', ['add', '-A'], git)
  })

  afterEach(() => {
    rmSync(target, { recursive: true, force: true })
  })

  it(
    'should check the working directory with the shared stages alone',
    async () => {
      const result = await execa(
        process.execPath,
        [CLI, 'gate', 'run', '--all', '--json'],
        {
          cwd: target,
          env: { ...gitEnv(), CI: 'false' },
          extendEnv: false,
          reject: false,
          timeout: RUN_TIMEOUT_MS,
        },
      )
      const record = JSON.parse(result.stdout) as {
        root: string
        stages: { id: string; status: string }[]
      }

      expect(result.exitCode).toBe(0)
      expect(record.root).toBe(target)
      expect(record.stages.map((stage) => stage.id)).toEqual([
        'design-prose',
        'context-citations',
        'canonical-records',
        'document-ceiling',
        'embedded-programs',
        'file-length',
        'comment-head-blocks',
        'comment-body-blocks',
        'comment-history',
        'markdown',
      ])
    },
    RUN_TIMEOUT_MS,
  )

  it(
    'should skip the context stage in a target carrying no context folder',
    async () => {
      const result = await execa(
        process.execPath,
        [CLI, 'gate', 'run', '--all', '--json'],
        {
          cwd: target,
          env: { ...gitEnv(), CI: 'false' },
          extendEnv: false,
          reject: false,
          timeout: RUN_TIMEOUT_MS,
        },
      )
      const record = JSON.parse(result.stdout) as {
        stages: { id: string; status: string }[]
      }

      expect(
        record.stages.find((stage) => stage.id === 'context-citations')
          ?.status,
      ).toBe('skipped')
    },
    RUN_TIMEOUT_MS,
  )
})

function stageResult(overrides: Partial<StageResult> = {}): StageResult {
  return {
    id: 'tests',
    label: 'Tests',
    status: 'passed',
    emissions: [],
    ms: 10,
    ...overrides,
  }
}

function recordOf(results: StageResult[]) {
  return gateRecord({
    ok: !results.some((result) => result.status === 'failed'),
    root: '/tmp/gate-fixture',
    changed: { scoped: false, files: [] },
    summary: summarize(results),
    results,
  })
}

describe('the gate record', () => {
  it('should carry a failed stage output so a caller can name the failing test', () => {
    const record = recordOf([
      stageResult({
        status: 'failed',
        failure: 'Tests failed',
        emissions: [
          { kind: 'info', text: 'Waited 3s for the Tests stage' },
          { kind: 'output', text: ' FAIL  src/a.test.ts > breaks\n' },
        ],
      }),
    ])

    expect(record.stages[0].output).toBe(' FAIL  src/a.test.ts > breaks')
  })

  it('should keep only the last 200 lines of a failed stage output', () => {
    const text = Array.from(
      { length: 250 },
      (_, index) => `line ${index + 1}`,
    ).join('\n')

    const record = recordOf([
      stageResult({ status: 'failed', emissions: [{ kind: 'output', text }] }),
    ])

    const lines = record.stages[0].output?.split('\n') ?? []
    expect(lines).toHaveLength(200)
    expect(lines[0]).toBe('line 51')
    expect(lines[199]).toBe('line 250')
  })

  it('should carry no output on a passed stage', () => {
    const record = recordOf([
      stageResult({ emissions: [{ kind: 'output', text: 'all green' }] }),
    ])

    expect(record.stages[0].output).toBeUndefined()
  })
})
