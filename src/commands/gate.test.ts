import { describe, expect, it } from 'vitest'
import { gateRecord } from '@/commands/gate'
import { type StageResult, summarize } from '@/gate/sequencer'

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
