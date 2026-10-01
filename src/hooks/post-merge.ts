import { execa } from 'execa'
import { gitEnv } from '@/git-env'

/**
 * One child `canon` call. Each step runs as its own process rather than
 * in-process, so the plugin update after a reinstall runs the binary the
 * upgrade just installed, and every verb keeps its own gates.
 */
export interface StepCall {
  readonly args: readonly string[]
  readonly cwd: string
  readonly env: Record<string, string>
}

export interface StepResult {
  readonly stdout: string
  readonly exitCode: number
}

export type StepRunner = (call: StepCall) => Promise<StepResult>

export interface PostMergeInput {
  /** The main worktree root, where the board and the records live. */
  readonly root: string
  /** The worktree the pull happened in, which the reclaim refuses to remove. */
  readonly cwd: string
  readonly subjects: readonly string[]
  /** Read for the `CANON_SKIP_*` switches. */
  readonly env: Readonly<Record<string, string | undefined>>
  readonly run: StepRunner
  readonly write: (text: string) => void
}

/**
 * The child verb each step runs, in run order. The command's help lists these
 * and the landing page reads that help to say what a merge does, so the
 * figure follows the steps this module actually runs.
 */
export const STEP_VERBS = {
  archive: ['tasks', 'archive'],
  push: ['records', 'push'],
  reclaim: ['worktrees', 'reclaim'],
  upgrade: ['upgrade'],
  pluginUpdate: ['claude', 'plugin-update'],
} as const satisfies Record<string, readonly string[]>

type Fields = Record<string, unknown>

const GIT_TIMEOUT_MS = 10_000

/**
 * Every pull request number the merge brought in. A squash carries `(#NNN)` at
 * the end of its subject, and a release or a merge naming none yields nothing,
 * which is what keeps the archive quiet on runs it has nothing to say about.
 */
export function pullRequestNumbers(subjects: readonly string[]): number[] {
  return subjects.flatMap((subject) => {
    const match = /\(#(\d+)\)\s*$/.exec(subject)
    return match ? [Number(match[1])] : []
  })
}

/**
 * Every subject the pull brought in, not just the tip. One pull routinely
 * fast-forwards over several merges, and reading HEAD alone would archive the
 * last one's task and strand the rest. `git pull` sets ORIG_HEAD to the
 * pre-merge tip, so the range is exactly what arrived, and a merge leaving no
 * ORIG_HEAD falls back to the tip.
 *
 * A hook exports `GIT_DIR` and friends, which beat `-C`, so every read goes
 * through `gitEnv()` to answer for the checkout `cwd` names.
 */
export async function readMergedSubjects(cwd: string): Promise<string[]> {
  const options = {
    reject: false,
    timeout: GIT_TIMEOUT_MS,
    env: gitEnv(),
    extendEnv: false,
  } as const

  const origHead = await execa(
    'git',
    ['-C', cwd, 'rev-parse', '--verify', '--quiet', 'ORIG_HEAD'],
    options,
  )
  const range = origHead.exitCode === 0 ? ['ORIG_HEAD..HEAD'] : ['-1', 'HEAD']
  const log = await execa(
    'git',
    ['-C', cwd, 'log', ...range, '--pretty=%s', '--'],
    options,
  )
  if (log.exitCode !== 0) return []

  return log.stdout.split('\n').filter((line) => line.length > 0)
}

export const runCanon: StepRunner = async (call) => {
  const result = await execa('canon', [...call.args], {
    cwd: call.cwd,
    env: call.env,
    extendEnv: false,
    reject: false,
  })
  return { stdout: result.stdout, exitCode: result.exitCode ?? 1 }
}

/**
 * A child producing no parseable record is an older global binary carrying no
 * such subcommand or flag, which stays quiet until a release lands.
 */
function parseRecord(stdout: string): Fields | undefined {
  try {
    const parsed: unknown = JSON.parse(stdout.trim())
    return parsed !== null && typeof parsed === 'object'
      ? (parsed as Fields)
      : undefined
  } catch {
    return undefined
  }
}

function text(fields: Fields, key: string): string | undefined {
  const value = fields[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function count(fields: Fields, key: string): number {
  const value = fields[key]
  return typeof value === 'number' ? value : 0
}

function archiveLines(
  number: number,
  result: StepResult,
  fields: Fields,
): string | undefined {
  if (result.exitCode === 0) {
    const task = text(fields, 'task')
    return task === undefined
      ? undefined
      : `\n📦 Archived ${task}, closed by #${number}.\n\n`
  }

  // A refusal is ordinary here, since most merges close no task.
  const reason = text(fields, 'reason')
  if (reason === undefined || reason === 'no-match' || reason === 'no-board') {
    return undefined
  }
  return (
    `\n📋 Task not archived for #${number}: ${text(fields, 'message') ?? reason}\n` +
    'Run /task-board to resolve it by hand.\n\n'
  )
}

function pushLines(result: StepResult, fields: Fields): string | undefined {
  if (result.exitCode === 0) {
    const changed = count(fields, 'changed')
    return changed > 0
      ? `\n🗄️  Backed up ${changed} record path(s).\n\n`
      : undefined
  }

  // No records history on this machine, which is every checkout that never
  // ran the one-time setup.
  const reason = text(fields, 'reason') ?? 'unknown'
  if (reason === 'no-repository') return undefined
  const hint =
    reason === 'unsafe-payload'
      ? 'Run canon records push to see the blocked paths.'
      : 'Run canon records push when the remote is reachable.'
  return `\n🗄️  Records not backed up: ${reason}\n${hint}\n\n`
}

/**
 * The exit decides nothing here and the fields decide everything. A run that
 * removes one worktree and fails on another exits 1 with a directory already
 * deleted, so a report keyed on the exit would never name the removal.
 */
function reclaimLines(fields: Fields): string | undefined {
  let lines = ''
  const removed = count(fields, 'removed')
  if (removed > 0) {
    lines += `\n🧹 Reclaimed ${removed} worktree(s) whose pull request merged.\n\n`
  }

  // `gh-missing` answers on every merge forever on a machine without `gh`, so
  // the hook header carries that gap rather than a line nobody acts on twice.
  const reason = text(fields, 'reason')
  const failed = count(fields, 'failed')
  if (reason !== undefined && reason !== 'gh-missing') {
    lines +=
      `\n🧹 Worktrees not reclaimed: ${reason}\n` +
      'Run canon worktrees list to read the state by hand.\n\n'
  } else if (failed > 0) {
    lines +=
      `\n🧹 ${failed} worktree(s) could not be removed.\n` +
      'Run canon worktrees reclaim to read which step failed.\n\n'
  }
  return lines.length > 0 ? lines : undefined
}

/**
 * Shared by the binary reinstall and the plugin update. `current` is the
 * ordinary outcome on most merges and stays quiet, and `quiet` names the
 * refusal reasons that describe a permanent condition on the machine. `icon`
 * carries its own trailing spacing, since the two glyphs render at different
 * widths.
 */
function moveLines(
  result: StepResult,
  fields: Fields,
  icon: string,
  failure: string,
  quiet: readonly string[],
): string | undefined {
  const message = text(fields, 'message')
  if (message === undefined) return undefined

  if (result.exitCode === 0) {
    return fields.state === 'current' ? undefined : `\n${icon}${message}\n\n`
  }

  const reason = text(fields, 'reason')
  if (reason !== undefined && quiet.includes(reason)) return undefined
  return `\n${icon}${failure}: ${message}\n\n`
}

async function step(
  input: PostMergeInput,
  call: StepCall,
  render: (result: StepResult, fields: Fields) => string | undefined,
): Promise<void> {
  let result: StepResult
  try {
    result = await input.run(call)
  } catch {
    return
  }

  const fields = parseRecord(result.stdout)
  if (fields === undefined) return

  const lines = render(result, fields)
  if (lines !== undefined) input.write(lines)
}

/**
 * Runs the five post-merge steps in order: archive, records push, reclaim,
 * upgrade, plugin update. The reclaim sits before the upgrade, since the
 * upgrade reinstalls the binary every later child runs under, and the two
 * network-bound moves sit last so a slow registry delays nothing else.
 *
 * Never throws and reports nothing on the ordinary merge, since nobody is
 * watching and a hook failing aborts nothing useful.
 */
export async function runPostMerge(input: PostMergeInput): Promise<void> {
  const env = gitEnv()
  const at = (args: string[], extra: Record<string, string> = {}) => ({
    args,
    cwd: input.cwd,
    env: { ...env, ...extra },
  })
  const isSkipped = (name: string) => (input.env[name] ?? '').length > 0

  for (const number of pullRequestNumbers(input.subjects)) {
    await step(
      input,
      at([
        ...STEP_VERBS.archive,
        '--pull-request',
        String(number),
        '--root',
        input.root,
        '--json',
      ]),
      (result, fields) => archiveLines(number, result, fields),
    )
  }

  await step(
    input,
    at([...STEP_VERBS.push, '--root', input.root, '--json']),
    pushLines,
  )

  // No `--root` here, and that is load-bearing. The verb reads its own working
  // directory to refuse the worktree it stands in, so a root would turn the
  // running worktree into an ordinary candidate and let a pull inside a
  // linked worktree delete the ground under itself.
  if (!isSkipped('CANON_SKIP_RECLAIM')) {
    await step(input, at([...STEP_VERBS.reclaim, '--json']), (_, fields) =>
      reclaimLines(fields),
    )
  }

  if (!isSkipped('CANON_SKIP_UPGRADE')) {
    await step(
      input,
      at([...STEP_VERBS.upgrade, '--json'], { CANON_NON_INTERACTIVE: '1' }),
      (result, fields) =>
        moveLines(result, fields, '⬆️  ', 'CLI not upgraded', []),
    )
  }

  if (!isSkipped('CANON_SKIP_PLUGIN_UPDATE')) {
    await step(
      input,
      at([...STEP_VERBS.pluginUpdate, '--json']),
      (result, fields) =>
        moveLines(result, fields, '🔌 ', 'Plugin not updated', [
          'no-claude',
          'no-plugin',
        ]),
    )
  }
}
