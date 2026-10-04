import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { constants, tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import {
  describeSession,
  installDispatchShim,
  processGroupOf,
  reapProcessGroup,
  sessionsBetween,
  sessionsConcurrent,
  sessionsDir,
  snapshotSessions,
  type ReapState,
} from '@/sandbox/headless/dispatch'
import {
  escapeRoots,
  snapshotRoot,
  snapshotTree,
  writesBetween,
  type Manifest,
} from '@/sandbox/headless/watch'
import { mintSandboxRunId, sandboxTree } from '@/sandbox/tree'
import {
  intro,
  logError,
  logInfo,
  logRemove,
  logStep,
  logWarn,
  outro,
} from '@/ui'

/**
 * The flags and budget every run takes, each overridable through its
 * `CANON_SKILL_TEST_*` variable.
 *
 * `maxTurns` is the only budget. `max_turns` in an arm's `expect.toml` is a
 * ceiling asserted after the run, not a cap enforced during it, so a
 * declaration cannot raise what it runs under. An arm needing more than this
 * truncates, and a truncated run fails the same assertions a reasoning miss
 * does with nothing to separate them.
 *
 * `bypassPermissions` is the only mode that lets a run write under `.claude/`,
 * which most arms need. The scoping the permission layer would have given
 * comes from `write_scope` instead, asserted after the run rather than enforced
 * during it, so a skill that writes where it should not still wrote there.
 */
export function runSettings(env: NodeJS.ProcessEnv): {
  readonly model: string
  readonly allowedTools: string
  readonly maxTurns: string
  readonly permissionMode: string
} {
  const read = (name: string, fallback: string): string => {
    const value = env[name]
    return value === undefined || value === '' ? fallback : value
  }

  return {
    model: read('CANON_SKILL_TEST_MODEL', 'sonnet'),
    allowedTools: read(
      'CANON_SKILL_TEST_TOOLS',
      'Bash,Read,Glob,Grep,Edit,Write',
    ),
    maxTurns: read('CANON_SKILL_TEST_MAX_TURNS', '30'),
    permissionMode: read(
      'CANON_SKILL_TEST_PERMISSION_MODE',
      'bypassPermissions',
    ),
  }
}

/** Narrows the arguments to a startable run, or names why they cannot start one. */
export function parseRunArgs(
  target: string,
  prompt: string | undefined,
):
  | { readonly isValid: true; readonly prompt: string }
  | { readonly isValid: false; readonly reason: string } {
  if (!target.includes(':'))
    return {
      isValid: false,
      reason: 'Invalid target. Use <category>:<command>, e.g. git:commit.',
    }
  if (prompt === undefined || prompt === '')
    return {
      isValid: false,
      reason:
        'Missing prompt. Pass the skill invocation, e.g. "/canon:git-commit".',
    }

  return { isValid: true, prompt }
}

/**
 * The four facts about nested sessions, kept in one field so a reader gets
 * them together. `watched` false means the registry was absent, which makes an
 * empty `new` say nothing at all rather than say the run dispatched nothing.
 *
 * `concurrent` is a witness rather than a verdict. A record present before and
 * after the run rules that session out as this run's own dispatch and rules it
 * in as a candidate explanation for a file `escapes` names with no attribution
 * of its own, never a claim that it, rather than something else, made the
 * write.
 *
 * `reap` carries `clear` for a group that was already empty, `reaped-term` or
 * `reaped-kill` for one this run signalled, `survived` for one that outlived
 * `SIGKILL`, `inherited` for a session that never led a group of its own, and
 * `no-session` for a run that stopped before the session began.
 */
export interface SessionsReport {
  readonly watched: boolean
  readonly new: readonly string[]
  readonly concurrent: readonly string[]
  readonly reap: ReapState | 'inherited' | 'no-session'
}

/**
 * The envelope stays on stdout so existing readers keep working, with the
 * verdict merged in. A session that returned output that does not parse as an
 * object still emits its verdict, since a silent stdout would read as a run
 * that never happened, and `isParsed` false is what forces the exit to 1.
 *
 * An escape rides alongside the verdict rather than inside it. The verdict
 * answers what the sandbox contains, and a file the session put somewhere else
 * is not in that tree to be asserted over.
 */
export function mergeEnvelope(
  out: string,
  verdict: unknown,
  escapes: readonly string[],
  sessions: SessionsReport,
): { readonly merged: Record<string, unknown>; readonly isParsed: boolean } {
  const envelope = parseObject(out)
  if (envelope === undefined)
    return {
      merged: { is_error: true, verdict, escapes, sessions },
      isParsed: false,
    }

  return {
    merged: { ...envelope, verdict, escapes, sessions },
    isParsed: true,
  }
}

function parseObject(text: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(text)
    return typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined
  } catch {
    return undefined
  }
}

/** One envelope field as the result line prints it, `null` when absent. */
function envelopeField(
  envelope: Record<string, unknown> | undefined,
  key: string,
  fallback: string,
): string {
  if (envelope === undefined) return fallback
  const value = envelope[key]
  if (value === undefined || value === null) return 'null'

  return typeof value === 'string' ? value : JSON.stringify(value)
}

function denialCount(envelope: Record<string, unknown> | undefined): string {
  if (envelope === undefined) return '?'
  const denials = envelope.permission_denials
  if (denials === undefined || denials === null) return '0'
  if (Array.isArray(denials) || typeof denials === 'string')
    return String(denials.length)
  if (typeof denials === 'object') return String(Object.keys(denials).length)

  return '?'
}

function stamp(now: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')

  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}T${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

function recordPath(
  projectRoot: string,
  target: string,
  arm: string | undefined,
): { readonly dir: string; readonly file: string } {
  const dir = join(projectRoot, '.canon/tmp/runs/sandbox')
  const name = `${target}${arm === undefined ? '' : `-${arm}`}`.replaceAll(
    ':',
    '-',
  )

  return { dir, file: join(dir, `${name}-${stamp(new Date())}.json`) }
}

/**
 * Writes one run record to stderr and disk only, since
 * `docs/agents/output-shape.md` makes stdout the data contract, so a failure
 * here warns and lets the verdict print regardless.
 */
function writeRecord(
  projectRoot: string,
  target: string,
  arm: string | undefined,
  record: Record<string, unknown>,
  noun: 'run' | 'dead run',
): void {
  const { dir, file } = recordPath(projectRoot, target, arm)
  try {
    mkdirSync(dir, { recursive: true })
  } catch {
    logWarn(`Could not create ${dir}. The ${noun} was not recorded.`)
    return
  }

  try {
    writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, 'utf8')
    logInfo(
      `${noun === 'run' ? 'Run' : 'Dead run'} recorded at ${relative(projectRoot, file)}`,
    )
  } catch {
    rmSync(file, { force: true })
    logWarn(`Could not record the ${noun} at ${file}.`)
  }
}

/**
 * Exits through every path out of a run, the way a bash `trap ... EXIT` does:
 * a provision failure, a dead session, a failed verdict, a thrown error, or an
 * interrupt. Each step runs at most once and is synchronous, so a signal
 * handler can run the whole of it before the process exits.
 */
class RunCleanup {
  reap: SessionsReport['reap'] = 'no-session'
  sessionPgid: number | undefined
  harnessPgid: string | undefined
  shimDir: string | undefined
  workDir: string | undefined
  private isReaped = false
  private isClosed = false

  /**
   * The one place that decides whether a group is safe to signal, so the
   * ordinary path and an early exit cannot disagree about it. An absent group
   * is `no-session` rather than a clean reap, since the two mean opposite
   * things.
   */
  reapSession(): void {
    if (this.isReaped) return
    this.isReaped = true
    if (this.sessionPgid === undefined) return

    if (String(this.sessionPgid) === this.harnessPgid) {
      this.reap = 'inherited'
      logWarn(
        "The session ran in this process's own group, so nothing was signalled.",
      )
      return
    }

    this.reap = reapProcessGroup(this.sessionPgid)
    if (this.reap === 'reaped-term' || this.reap === 'reaped-kill')
      logWarn(
        `The session left a process behind. Reaped its group (${this.reap}).`,
      )
    else if (this.reap === 'survived')
      logWarn(
        `A process in the session's group survived SIGKILL. Check pgid ${this.sessionPgid} by hand.`,
      )
    else if (this.reap === 'refused-own-group')
      logWarn(
        "The reap refused a group matching this process's own. Nothing was signalled.",
      )
  }

  removeShim(): void {
    if (this.shimDir !== undefined)
      rmSync(this.shimDir, { force: true, recursive: true })
    this.shimDir = undefined
  }

  close(): void {
    if (this.isClosed) return
    this.isClosed = true
    this.reapSession()
    this.removeShim()
    if (this.workDir !== undefined)
      rmSync(this.workDir, { force: true, recursive: true })
    outro()
  }
}

export interface RunRequest {
  readonly projectRoot: string
  readonly target: string
  readonly prompt: string | undefined
  readonly arm: string | undefined
}

/**
 * Provisions a scenario, drives one `claude -p` session over it, scores the
 * result with `canon sandbox check`, and prints the envelope with the verdict
 * merged in on stdout. Resolves to the exit code: provisioning's or the dead
 * session's when either stopped the run, otherwise the verdict's.
 */
export async function runHeadless(request: RunRequest): Promise<number> {
  const { projectRoot, target, prompt } = request
  const arm = request.arm === '' ? undefined : request.arm

  intro('canon skill-test')
  const cleanup = new RunCleanup()

  // The session leads a group of its own and so takes no terminal signal, which
  // leaves the runner to reap it on the way out.
  const onSignal = (signal: NodeJS.Signals): void => {
    cleanup.close()
    process.exit(128 + constants.signals[signal])
  }
  process.once('SIGINT', onSignal)
  process.once('SIGTERM', onSignal)

  try {
    return await drive(projectRoot, target, prompt, arm, cleanup)
  } finally {
    process.off('SIGINT', onSignal)
    process.off('SIGTERM', onSignal)
    cleanup.close()
  }
}

async function drive(
  projectRoot: string,
  target: string,
  rawPrompt: string | undefined,
  arm: string | undefined,
  cleanup: RunCleanup,
): Promise<number> {
  if (!process.cwd().startsWith(projectRoot)) {
    logError('Run this from inside the toolkit repository.')
    return 1
  }
  const realClaude = Bun.which('claude')
  if (realClaude === null) {
    logError('claude CLI not found on PATH.')
    return 1
  }
  const args = parseRunArgs(target, rawPrompt)
  if (!args.isValid) {
    logError(args.reason)
    return 1
  }
  const { prompt } = args

  // The agent pushes from inside the sandbox on its own, in the session this
  // spawns, so the guard has to reach that environment and not only
  // provisioning.
  process.env.GIT_TERMINAL_PROMPT = '0'

  // Minted into this process's env before any child starts, so provisioning,
  // the session, and the check all resolve one tree.
  mintSandboxRunId()
  const settings = runSettings(process.env)
  const cli = join(projectRoot, 'src/cli.ts')

  const sandbox = sandboxTree()
  logStep(`Sandbox: ${sandbox}`)

  // The session below loads the branch's skills whole through --plugin-dir. A
  // copied SKILL.md would outrank that and cite references beside it that were
  // never copied, so provisioning injects nothing for a headless run.
  logStep(`Provisioning ${target}`)
  const provision = spawnSync(
    process.execPath,
    [cli, 'sandbox', '--no-header', target, arm ?? ''],
    {
      env: { ...process.env, SANDBOX_SKIP_SKILL_INJECT: '1' },
      stdio: ['inherit', 2, 'inherit'],
    },
  )
  const provisionCode = provision.status ?? 1
  if (provisionCode !== 0) {
    logWarn(
      `Provisioning exited ${provisionCode} before the session could start.`,
    )
    return provisionCode
  }

  const workDir = mkdtempSync(join(tmpdir(), 'canon-skill-test-'))
  cleanup.workDir = workDir
  const before = snapshotTree(sandbox)

  let isEscapeWatched = false
  const roots = escapeRoots(projectRoot)
    .filter((root) => existsSync(root))
    .map((root) => {
      const snapshot = snapshotRoot(root)
      isEscapeWatched ||= snapshot.isWatched
      return { root, manifest: snapshot.manifest }
    })

  // Taken after provisioning, so a scenario that stages a live session record
  // of its own is already in the before snapshot rather than reported as a
  // dispatch this run made. `canon/context/sandbox/isolation.md` carries why
  // such a scenario writes to the real registry at all.
  const registry = sessionsDir()
  const sessionsBefore = snapshotSessions(registry)

  // The session calls the real binary by its resolved path and puts the shim on
  // the PATH the session inherits, so a `claude --bg` from inside the run meets
  // the refusal and this invocation does not. Routing the session through the
  // shim too would read the arm's own prompt as arguments, so a prompt naming
  // `--bg` would refuse the run the shim exists to allow.
  cleanup.shimDir = mkdtempSync(join(tmpdir(), 'canon-dispatch-shim-'))
  installDispatchShim(cleanup.shimDir, realClaude)

  logStep(`Running ${prompt} on ${settings.model}`)

  // Detached, so the session leads a process group of its own and the reap
  // after the verdict signals a group this run created rather than the
  // operator's. Stdout goes to a file rather than a pipe, since a child the
  // session leaves behind would hold a pipe open and stall the read until it
  // exits. Stdin is `/dev/null`, since no command here may wait on a terminal.
  const sessionOut = join(workDir, 'session.out')
  const outFd = openSync(sessionOut, 'w')
  const session: ChildProcess = spawn(
    realClaude,
    [
      '-p',
      prompt,
      '--plugin-dir',
      join(projectRoot, 'claude'),
      '--model',
      settings.model,
      '--output-format',
      'json',
      '--permission-mode',
      settings.permissionMode,
      '--allowedTools',
      settings.allowedTools,
      '--max-turns',
      settings.maxTurns,
    ],
    {
      cwd: sandbox,
      detached: true,
      env: {
        ...process.env,
        PATH: `${cleanup.shimDir}:${process.env.PATH ?? ''}`,
      },
      stdio: ['ignore', outFd, 'inherit'],
    },
  )
  closeSync(outFd)

  const exit = new Promise<number>((resolve) => {
    session.once('error', () => resolve(127))
    session.once('exit', (code, signal) =>
      resolve(code ?? 128 + constants.signals[signal ?? 'SIGTERM']),
    )
  })

  // Read rather than assumed. A detached spawn makes the session lead its own
  // group, so this equals its pid, and comparing it against this process's
  // group before signalling is what keeps the reap off the operator's terminal.
  if (session.pid !== undefined) {
    cleanup.harnessPgid = processGroupOf(process.pid)
    const pgid = processGroupOf(session.pid)
    cleanup.sessionPgid = pgid === undefined ? session.pid : Number(pgid)
  }

  const sessionCode = await exit
  const out = readFileSync(sessionOut, 'utf8').replace(/\n+$/, '')

  if (sessionCode !== 0) {
    logWarn(
      `The session exited ${sessionCode} before a verdict could be taken.`,
    )
    // Stamped as text rather than as a parsed envelope, since a dying session's
    // stdout can be partial or not JSON at all, which is why this run has no
    // verdict to attach it to.
    writeRecord(
      projectRoot,
      target,
      arm,
      { is_error: true, exit_code: sessionCode, raw_output: out },
      'dead run',
    )
    return sessionCode
  }

  const envelope = parseObject(out)
  const isError = envelopeField(envelope, 'is_error', 'unknown')
  const turns = envelopeField(envelope, 'num_turns', '?')
  const cost = envelopeField(envelope, 'total_cost_usd', '?')
  logStep(
    `Result: error=${isError} turns=${turns} cost=$${cost} denials=${denialCount(envelope)}`,
  )
  process.stderr.write(`${envelopeField(envelope, 'result', '')}\n`)

  const writes = writesBetween(before, snapshotTree(sandbox))

  // Taken before the verdict runs, since `canon sandbox check` and the run
  // record both write under a watched root themselves.
  const escapes = roots.flatMap(({ root, manifest }) => {
    const after = snapshotRoot(root)
    isEscapeWatched ||= after.isWatched
    return writesBetween(manifest, after.manifest).map(
      (path) => `${root.replace(/\/+$/, '')}/${path}`,
    )
  })

  // Beside the escape snapshot and ahead of the reap, so a session that
  // outlived the run is recorded as what it was before anything signals it.
  const sessionsAfter = snapshotSessions(registry)
  const newSessions = sessionsBetween(sessionsBefore, sessionsAfter).map(
    (name) => describeSession(registry, name),
  )
  const concurrent = sessionsConcurrent(sessionsBefore, sessionsAfter).map(
    (name) => describeSession(registry, name),
  )

  const verdict = takeVerdict(cli, target, arm, workDir, {
    envelope: out,
    writes,
    escapes,
    concurrent,
    isEscapeWatched,
  })

  // After the verdict, which is the last thing that reads what the run left
  // behind. Nothing here fails the run: a survivor is a fact about the machine
  // rather than a claim about the skill, and the verdict is already taken.
  cleanup.reapSession()
  cleanup.removeShim()

  // An escape reports without failing, the same relationship `write_scope` has
  // to the writes it names. Nothing here distinguishes the spawned session's
  // writes from the operator's own, and on a machine running parallel sessions
  // the watched directories are rarely quiet: of five runs on 2026-08-02, three
  // reported an escape and every one named a file another session was writing.
  // What enforces the scope is that the sandbox sits outside the repository, so
  // a correct run has nothing to escape with.
  if (escapes.length > 0) {
    logWarn('Shared scratch changed under a toolkit root during this run:')
    for (const path of escapes) logRemove(path)
    if (concurrent.length > 0) {
      logWarn(
        'A session was live throughout the run and may account for these:',
      )
      for (const record of concurrent) logRemove(record)
    }
    logWarn(
      'No assertion covers these. Check them against what else was running.',
    )
  }

  if (newSessions.length > 0) {
    logWarn('A session record appeared while this run was in flight:')
    for (const record of newSessions) logRemove(record)
    logWarn(
      'No arm dispatches a session. Read these against what else started.',
    )
  }

  const { merged, isParsed } = mergeEnvelope(out, verdict.record, escapes, {
    watched: sessionsBefore.isWatched || sessionsAfter.isWatched,
    new: newSessions,
    concurrent,
    reap: cleanup.reap,
  })
  if (!isParsed)
    logWarn('Envelope was not valid JSON. Emitting the verdict alone.')

  writeRecord(projectRoot, target, arm, { ...merged, writes }, 'run')
  cleanup.close()
  process.stdout.write(`${JSON.stringify(merged, null, 2)}\n`)

  return isParsed ? verdict.code : 1
}

/**
 * The verdict decides the outcome. The envelope can only fail a run the
 * expectations would otherwise have passed, never pass one on its own.
 */
function takeVerdict(
  cli: string,
  target: string,
  arm: string | undefined,
  workDir: string,
  run: {
    readonly envelope: string
    readonly writes: readonly string[]
    readonly escapes: readonly string[]
    readonly concurrent: readonly string[]
    readonly isEscapeWatched: boolean
  },
): { readonly record: unknown; readonly code: number } {
  const file = (name: string, body: string): string => {
    const path = join(workDir, name)
    writeFileSync(path, body, 'utf8')
    return path
  }
  const lines = (list: readonly string[]): string =>
    list.map((line) => `${line}\n`).join('')

  const check = spawnSync(
    process.execPath,
    [
      cli,
      'sandbox',
      'check',
      target,
      arm ?? '',
      '--envelope',
      file('envelope.json', run.envelope),
      '--writes',
      file('writes.txt', lines(run.writes)),
      '--escapes',
      file('escapes.txt', lines(run.escapes)),
      '--concurrent-sessions',
      file('concurrent.txt', lines(run.concurrent)),
      ...(run.isEscapeWatched ? ['--escapes-watched'] : []),
      '--json',
    ],
    { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] },
  )

  let record: unknown = null
  try {
    record = JSON.parse(check.stdout ?? '')
  } catch {
    record = null
  }

  return { record, code: check.status ?? 1 }
}
