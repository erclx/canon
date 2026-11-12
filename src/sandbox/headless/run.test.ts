import { describe, expect, it } from 'vitest'
import {
  checkArgs,
  deadRunRecord,
  mergeEnvelope,
  parseRunArgs,
  verdictFiles,
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

const skills = (): readonly string[] => ['canon:target-scaffold']

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
  it('should append the verdict, escapes, sessions, CLI, and skills to a parsed envelope', () => {
    const out = '{"is_error":false,"result":"ok","num_turns":1}'

    const { merged, isParsed } = mergeEnvelope(
      out,
      verdict(),
      ['/root/.canon/plans/x.md'],
      sessions(),
      canon(),
      skills(),
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
      skills: ['canon:target-scaffold'],
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
      skills(),
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
      skills: ['canon:target-scaffold'],
    })
  })

  it('should fall back when the envelope is empty', () => {
    expect(
      mergeEnvelope('', verdict(), [], sessions(), canon(), []).isParsed,
    ).toBe(false)
  })

  it('should fall back when the envelope is JSON but not an object', () => {
    expect(
      mergeEnvelope('[1,2]', verdict(), [], sessions(), canon(), []).isParsed,
    ).toBe(false)
  })
})

describe('deadRunRecord', () => {
  // The turn cap ends a session with exit 1 after it has already loaded its
  // skills, which is the run a routing measurement most often takes.
  it('should carry the skills a capped session loaded beside its raw output', () => {
    const out = [
      '{"type":"system","subtype":"init"}',
      '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Skill","input":{"skill":"canon:target-scaffold"}}]}}',
      '{"type":"result","subtype":"error_max_turns","is_error":true}',
    ].join('\n')

    expect(deadRunRecord(1, out, canon())).toEqual({
      is_error: true,
      exit_code: 1,
      raw_output: out,
      canon: {
        cli: '/checkout/src/cli.ts',
        head: '0123456789abcdef0123456789abcdef01234567',
      },
      skills: ['canon:target-scaffold'],
    })
  })

  it('should carry no skills for output cut before any line', () => {
    expect(deadRunRecord(137, '{"type":"sys', canon()).skills).toEqual([])
  })
})

describe('verdictFiles', () => {
  it('should hand the tied list to --escapes and the untied list to --untied-escapes', () => {
    const files = verdictFiles({
      envelope: '{}',
      writes: [],
      escapes: ['/main/.canon/plans/feature-x.md'],
      untiedEscapes: ['/main/.canon/tasks/a.md', '/main/.canon/tasks/b.md'],
      concurrent: [],
    })

    expect(files).toContainEqual({
      flag: '--escapes',
      name: 'escapes.txt',
      body: '/main/.canon/plans/feature-x.md\n',
    })
    expect(files).toContainEqual({
      flag: '--untied-escapes',
      name: 'untied-escapes.txt',
      body: '/main/.canon/tasks/a.md\n/main/.canon/tasks/b.md\n',
    })
  })
})

describe('checkArgs', () => {
  // A run that asserts nothing has earned no pass, and the check reads an
  // unchecked arm as exit 0 unless it is told to be strict.
  it('should pass --strict so an arm declaring nothing fails the run', () => {
    const args = checkArgs(
      '/checkout/src/cli.ts',
      'claude:x',
      undefined,
      [],
      false,
    )

    expect(args).toContain('--strict')
  })

  it('should keep the target, the arm, the files, and --json in the call', () => {
    const args = checkArgs(
      '/checkout/src/cli.ts',
      'claude:x',
      'board',
      ['--envelope', '/w/envelope.json'],
      true,
    )

    expect(args).toEqual([
      '/checkout/src/cli.ts',
      'sandbox',
      'check',
      'claude:x',
      'board',
      '--envelope',
      '/w/envelope.json',
      '--escapes-watched',
      '--strict',
      '--json',
    ])
  })
})
