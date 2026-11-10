import { describe, expect, it } from 'vitest'
import {
  mergeEnvelope,
  parseRunArgs,
  type SessionsReport,
} from '@/sandbox/headless/run'
import type { BranchCli } from '@/sandbox/headless/branch-cli'

const sessions = (): SessionsReport => ({
  watched: true,
  new: [],
  concurrent: [],
  reap: 'clear',
})

const canon = (): BranchCli => ({
  cli: '/checkout/src/cli.ts',
  head: '0123456789abcdef0123456789abcdef01234567',
})

const verdict = (): object => ({ state: 'pass', asserted: 1, failed: 0 })

describe('parseRunArgs', () => {
  it('should refuse a target with no category separator', () => {
    expect(parseRunArgs('commit', '/canon:git-commit')).toEqual(
      expect.objectContaining({
        isValid: false,
        reason: expect.stringContaining('Invalid target'),
      }),
    )
  })

  it('should refuse a missing prompt', () => {
    expect(parseRunArgs('git:commit', undefined)).toEqual(
      expect.objectContaining({
        isValid: false,
        reason: expect.stringContaining('Missing prompt'),
      }),
    )
  })

  it('should refuse an empty prompt', () => {
    expect(parseRunArgs('git:commit', '')).toEqual(
      expect.objectContaining({
        isValid: false,
        reason: expect.stringContaining('Missing prompt'),
      }),
    )
  })

  it('should accept a target and a prompt', () => {
    expect(parseRunArgs('git:commit', '/canon:git-commit')).toEqual({
      isValid: true,
      prompt: '/canon:git-commit',
    })
  })
})

describe('mergeEnvelope', () => {
  it('should append the verdict, escapes, sessions, and CLI to a parsed envelope', () => {
    const out = '{"is_error":false,"result":"ok","num_turns":1}'

    const { merged, isParsed } = mergeEnvelope(
      out,
      verdict(),
      ['/root/.canon/plans/x.md'],
      sessions(),
      canon(),
    )

    expect(isParsed).toBe(true)
    expect(merged).toEqual({
      is_error: false,
      result: 'ok',
      num_turns: 1,
      verdict: { state: 'pass', asserted: 1, failed: 0 },
      escapes: ['/root/.canon/plans/x.md'],
      sessions: { watched: true, new: [], concurrent: [], reap: 'clear' },
      canon: {
        cli: '/checkout/src/cli.ts',
        head: '0123456789abcdef0123456789abcdef01234567',
      },
    })
  })

  // A dying session's stdout can be partial, and a silent stdout would read as a
  // run that never happened, so the verdict still prints with the run marked as
  // an error.
  it('should fall back to an error record when the envelope does not parse', () => {
    const { merged, isParsed } = mergeEnvelope(
      '{"is_error":false,"res',
      verdict(),
      [],
      sessions(),
      canon(),
    )

    expect(isParsed).toBe(false)
    expect(merged).toEqual({
      is_error: true,
      verdict: { state: 'pass', asserted: 1, failed: 0 },
      escapes: [],
      sessions: { watched: true, new: [], concurrent: [], reap: 'clear' },
      canon: {
        cli: '/checkout/src/cli.ts',
        head: '0123456789abcdef0123456789abcdef01234567',
      },
    })
  })

  it('should fall back when the envelope is empty', () => {
    expect(mergeEnvelope('', verdict(), [], sessions(), canon()).isParsed).toBe(
      false,
    )
  })

  it('should fall back when the envelope is JSON but not an object', () => {
    expect(
      mergeEnvelope('[1,2]', verdict(), [], sessions(), canon()).isParsed,
    ).toBe(false)
  })
})
