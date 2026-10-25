import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  EXPECTED_FILE,
  expectationOf,
  judgeDrift,
  readExpectation,
  writeExpectation,
  type ReplayExpectation,
} from '@/sandbox/replay/expected'
import type { StepResult } from '@/sandbox/replay/run'

function step(overrides: Partial<StepResult> = {}): StepResult {
  return {
    step: 'sync',
    argv: ['canon', 'sync', '.'],
    exit: 0,
    verdict: 'ok',
    findings: [],
    ...overrides,
  }
}

function expectation(
  steps: ReplayExpectation['steps'] = { sync: { exit: 0, findings: 0 } },
): ReplayExpectation {
  return { steps }
}

describe('judgeDrift', () => {
  it('should pass a run that answers as recorded', () => {
    const judged = judgeDrift([step()], expectation())

    expect(judged).toEqual([step()])
  })

  it('should judge a changed exit drifted', () => {
    const judged = judgeDrift([step({ exit: 2 })], expectation())

    expect(judged[0]?.verdict).toBe('drifted')
    expect(judged[0]?.detail).toBe('exit 2, recorded 0')
  })

  it('should judge a changed finding count drifted', () => {
    const run = step({
      findings: ['REQUIREMENTS.md missing', 'DESIGN.md missing'],
    })

    const judged = judgeDrift([run], expectation())

    expect(judged[0]?.verdict).toBe('drifted')
    expect(judged[0]?.detail).toBe('2 findings, recorded 0')
  })

  it('should judge a step the expectation lacks drifted', () => {
    const judged = judgeDrift([step(), step({ step: 'lint' })], expectation())

    expect(judged[1]?.verdict).toBe('drifted')
    expect(judged[1]?.detail).toContain('no recorded answer')
  })

  it('should add a drifted step for one the run dropped', () => {
    const judged = judgeDrift(
      [step()],
      expectation({
        sync: { exit: 0, findings: 0 },
        format: { exit: 0, findings: 0 },
      }),
    )

    expect(judged).toHaveLength(2)
    expect(judged[1]?.step).toBe('format')
    expect(judged[1]?.verdict).toBe('drifted')
    expect(judged[1]?.detail).toContain('did not run')
  })

  it('should keep a crash that also differs from the recorded answer', () => {
    const crash = step({ exit: 1, verdict: 'crash', detail: 'ENOENT: x' })

    const judged = judgeDrift([crash], expectation())

    expect(judged).toEqual([crash])
  })

  it('should judge every step drifted when no expectation is recorded', () => {
    const judged = judgeDrift([step(), step({ step: 'format' })], undefined)

    expect(judged.map((s) => s.verdict)).toEqual(['drifted', 'drifted'])
    expect(judged[0]?.detail).toContain('--record')
  })
})

describe('expectation files', () => {
  let scratch: string

  beforeEach(() => {
    scratch = mkdtempSync(join(tmpdir(), 'replay-expected-'))
  })

  afterEach(() => {
    rmSync(scratch, { recursive: true, force: true })
  })

  it('should read back the expectation of the run it was recorded from', () => {
    const run = [step({ findings: ['a'] }), step({ step: 'format', exit: 1 })]

    writeExpectation(scratch, expectationOf(run))

    expect(readExpectation(scratch)).toEqual({
      steps: {
        sync: { exit: 0, findings: 1 },
        format: { exit: 1, findings: 0 },
      },
    })
  })

  it('should end the written file on a newline', () => {
    writeExpectation(scratch, expectation())

    expect(
      readFileSync(join(scratch, EXPECTED_FILE), 'utf8').endsWith('}\n'),
    ).toBe(true)
  })

  it('should read a folder with no file as no expectation', () => {
    expect(existsSync(join(scratch, EXPECTED_FILE))).toBe(false)
    expect(readExpectation(scratch)).toBeUndefined()
  })
})
