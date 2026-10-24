import { describe, expect, it } from 'vitest'
import {
  findingsOf,
  judgeFormat,
  judgeStep,
  type StepOutput,
} from '@/sandbox/replay/verdict'

function output(overrides: Partial<StepOutput> = {}): StepOutput {
  return {
    status: 0,
    signal: null,
    stdout: '{"ok":true}\n',
    stderr: '',
    json: true,
    ...overrides,
  }
}

const BUN_TRACE = [
  "376 |       const source = await readFile(abs, 'utf8')",
  '                                 ^',
  "ENOENT: no such file or directory, open '/t/.claude/rules/canon/claude/590-rule-authoring.md'",
  '    path: "/t/.claude/rules/canon/claude/590-rule-authoring.md",',
  '   errno: -2,',
  '    code: "ENOENT"',
  '',
  '      at async <anonymous> (/canon/src/commands/markdown.ts:376:28)',
  '',
  'Bun v1.4.2 (Linux x64)',
].join('\n')

describe('judgeStep', () => {
  it('should judge a stack trace on stderr a crash naming the error', () => {
    const judged = judgeStep(
      output({ status: 1, stdout: '', stderr: BUN_TRACE }),
    )

    expect(judged.verdict).toBe('crash')
    expect(judged.detail).toContain('ENOENT: no such file or directory')
  })

  it('should judge a process killed by a signal a crash', () => {
    const judged = judgeStep(
      output({ status: null, signal: 'SIGTERM', stdout: '' }),
    )

    expect(judged.verdict).toBe('crash')
  })

  it('should judge a --json run whose stdout does not parse unreadable', () => {
    const judged = judgeStep(output({ stdout: 'Scanning rules\n{"ok":' }))

    expect(judged.verdict).toBe('unreadable')
  })

  it('should judge a --json run with empty stdout unreadable', () => {
    const judged = judgeStep(output({ stdout: '' }))

    expect(judged.verdict).toBe('unreadable')
  })

  it('should judge a refusal record with exit 1 ok', () => {
    const judged = judgeStep(
      output({
        status: 1,
        stdout: '{"ok":false,"reason":"no-plan"}\n',
        stderr: '✗ No plan at .canon/plans/feature-x.md\n',
      }),
    )

    expect(judged.verdict).toBe('ok')
  })

  it('should judge a findings exit 2 ok', () => {
    const judged = judgeStep(
      output({
        status: 2,
        stdout: '{"ok":true,"pending":1}\n',
        stderr: '! 1 past the 40-line checkpoint\n',
      }),
    )

    expect(judged.verdict).toBe('ok')
  })

  it('should not parse stdout of a run that asked for no JSON', () => {
    const judged = judgeStep(
      output({ json: false, stdout: '', stderr: '✓ Everything up to date\n' }),
    )

    expect(judged.verdict).toBe('ok')
  })
})

describe('findingsOf', () => {
  it('should collect each warning line a verb printed, without its mark', () => {
    const findings = findingsOf(
      [
        'canon claude',
        '✓ DESIGN.md',
        '! REQUIREMENTS.md missing. Run `canon claude init`',
        '! 2 gated entries breaking the shape',
        '  canon/context/board/index.md  gated',
      ].join('\n'),
    )

    expect(findings).toEqual([
      'REQUIREMENTS.md missing. Run `canon claude init`',
      '2 gated entries breaking the shape',
    ])
  })

  it('should find nothing on a clean run', () => {
    expect(findingsOf('✓ Everything up to date\n')).toEqual([])
  })
})

describe('judgeFormat', () => {
  it('should judge a clean check ok', () => {
    const judged = judgeFormat(
      output({
        json: false,
        stdout: 'All matched files use the correct format.\n',
      }),
    )

    expect(judged.verdict).toBe('ok')
  })

  it('should judge a failed check unformatted naming each file', () => {
    const judged = judgeFormat(
      output({
        status: 1,
        json: false,
        stdout: [
          'Checking formatting...',
          '',
          'canon/config/config.json (1ms)',
          '.claude/settings.json (0ms)',
          '',
          'Format issues found in above 2 files. Run without `--check` to fix.',
        ].join('\n'),
      }),
    )

    expect(judged).toEqual({
      verdict: 'unformatted',
      detail: 'canon/config/config.json, .claude/settings.json',
    })
  })
})
