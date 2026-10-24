/**
 * What one step of a replay concluded. A finding or a refusal is the verb
 * working, so it reads `ok`. Only a run that broke rather than answered fails:
 * a `crash` threw or died, an `unreadable` run answered in a shape a caller
 * cannot parse, and an `unformatted` tree holds a file sync wrote that the
 * formatter canon ships rejects.
 */
export type ReplayVerdict = 'ok' | 'crash' | 'unreadable' | 'unformatted'

export interface StepOutput {
  /** Null when the process ended on a signal, a timeout included. */
  readonly status: number | null
  readonly signal: string | null
  readonly stdout: string
  readonly stderr: string
  /** Whether the step asked for `--json`, which makes stdout a contract. */
  readonly json: boolean
}

export interface Judgement {
  readonly verdict: ReplayVerdict
  readonly detail?: string
}

/** A JavaScript stack frame, `at fn (file:line:col)` or a bare `at file:line:col`. */
const STACK_FRAME = /^\s+at .*:\d+:\d+\)?$/m

/** The line naming what was thrown, `TypeError: ...` or a system code such as `ENOENT: ...`. */
const THROWN_LINE = /^(?:error: |[A-Z][A-Za-z]*Error: |E[A-Z]+: ).*$/m

function crashOf(output: StepOutput): Judgement | undefined {
  if (output.signal !== null)
    return { verdict: 'crash', detail: `killed by ${output.signal}` }
  if (!STACK_FRAME.test(output.stderr)) return undefined

  return {
    verdict: 'crash',
    detail: THROWN_LINE.exec(output.stderr)?.[0] ?? 'stack trace on stderr',
  }
}

export function judgeStep(output: StepOutput): Judgement {
  const crash = crashOf(output)
  if (crash !== undefined) return crash
  if (!output.json) return { verdict: 'ok' }

  try {
    JSON.parse(output.stdout)
  } catch {
    const first = output.stdout.trim().split('\n')[0]

    return {
      verdict: 'unreadable',
      detail:
        first === undefined || first === ''
          ? 'empty stdout'
          : `stdout does not parse: ${first.slice(0, 120)}`,
    }
  }

  return { verdict: 'ok' }
}

/** oxfmt lists each file it would change as `<path> (<n>ms)` under `--check`. */
const OXFMT_FILE = /^(\S.*) \(\d+m?s\)$/

export function judgeFormat(output: StepOutput): Judgement {
  const crash = crashOf(output)
  if (crash !== undefined) return crash
  if (output.status === 0) return { verdict: 'ok' }

  const files = output.stdout
    .split('\n')
    .map((line) => OXFMT_FILE.exec(line.trim())?.[1])
    .filter((file): file is string => file !== undefined)

  return {
    verdict: 'unformatted',
    detail:
      files.length > 0
        ? files.join(', ')
        : output.stderr.trim().split('\n')[0] || `exit ${output.status}`,
  }
}
