import { resolve } from 'node:path'
import type { Command } from 'commander'
import { checkClaim, type ClaimReport } from '@/sessions/claim'
import {
  callerIdentity,
  repositoryOf,
  type ResolvedSession,
  resolveSessions,
  type SelfReport,
  type SessionReport,
  selfOf,
} from '@/sessions/resolve'
import {
  type Behind,
  exportSession,
  importSession,
} from '@/sessions/transfer/bundle'
import {
  intro,
  logInfo,
  logStep,
  logWarn,
  outro,
  pipeOutput,
  plural,
} from '@/ui'
import { mainWorktreeRoot } from '@/worktree'

interface ListCommandOptions {
  readonly json?: boolean
  readonly branch?: string
  readonly repository?: string
  readonly self?: boolean
}

const REASONS: Record<string, string> = {
  'not-a-repository': 'working outside any git repository',
  'detached-head': 'detached HEAD, so the worktree holds no branch name',
  'git-unavailable': 'git is not on the path, so nothing could be read',
}

export function register(program: Command): void {
  const sessions = program
    .command('sessions')
    .description(
      'Resolve live peer sessions to the worktree and branch each holds',
    )
    .helpOption('-h, --help', 'Show this help message')

  sessions
    .command('list')
    .description(
      'Report every live session with its working directory and branch',
    )
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .option(
      '--branch <name>',
      'Report only the sessions holding this branch in this repository',
    )
    .option(
      '--repository <path>',
      'Answer about this project rather than the working one',
    )
    .option(
      '--self',
      "Report the caller's own row, and refuse where the roster holds none",
    )
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  the roster was read',
        '  1  refused, with the reason on stderr',
        '',
        '--branch scopes the match to one repository, since a branch name',
        'identifies a branch there and nothing across a machine. That is the',
        'repository the command runs in unless --repository names another.',
        'A bare run reports every repository and carries the repository field,',
        'so a caller filtering by hand has something that identifies one.',
        '',
        '--repository moves every reading to the project at that path, the',
        'session match and the worktree and ref reads alike. The roster is',
        'machine-wide already, so this is what lets a dispatcher in one project',
        'see a branch a live session holds in another rather than reading it as',
        'unclaimed and sending a second session onto it.',
        '',
        'With --branch, the JSON also carries "worktree" (the path of any',
        'worktree already checked out to it, or null), "refs" (the refs that',
        'already name it, local head and origin remote-tracking alike), and',
        '"claimed" (true when a worktree, a live session, or an existing ref',
        'holds it). A dispatcher reads "claimed" rather than composing the',
        'three fields itself, since each alone misses a real claim: a worktree',
        'can outlive the session that made it, a session can hold a branch',
        'before a worktree exists for it, and a branch behind a merged pull',
        'request has neither while still being taken.',
        '',
        '"sessionsReadable" is false when the session roster could not be read',
        'and "refsReadable" is false when the ref read failed. Either one',
        'leaves "claimed" covering the readings around it alone. Treat that',
        'case as unverified rather than as a clean "false".',
        '',
        'The ref read sees the remote at whatever the last fetch left, so a',
        'branch pushed from another machine since then reads absent here.',
        '',
        'The match can return more than one session. Read the count rather than',
        'the first row, since two sessions can hold one branch.',
        '',
        "--self narrows the report to the caller's own row, which is what a",
        'dispatcher reads to learn the sessionId it carries into a launch. It',
        'joins on CLAUDE_CODE_SESSION_ID first, falls back to CLAUDE_PID, and',
        'falls back again to the pid the messaging socket path spells. It never',
        'reads CLAUDE_CODE_HOST_SESSION_ID, which holds a value from another',
        'namespace that matches no row.',
        '',
        'It refuses with reason "no-self-identity" when the environment states',
        'none of the three, and "no-self-row" when it states one and no live',
        'row carries it. The second is the ordinary answer for a session',
        'driving from Remote Control, which is addressable on the message',
        'channel and holds no local process record for the roster to report.',
        '',
        'Each session writes its own working directory beside its own name, so a',
        'name from a session listing joins to a branch by an exact match rather',
        'than by ordering the roster on start time.',
        '',
        'The confidence field says how the liveness of a row was decided.',
        '"confirmed" matched the running process against the start time the',
        'record stamped. "unverified" means only that the pid answers, which',
        'cannot rule out a pid handed to an unrelated process, so a roster',
        'reported that way is a candidate list rather than an identity.',
        '',
        'The JSON record also carries "statusUpdatedAt" (the stamp the client',
        'wrote beside "status", or null where its record carries none) and',
        '"statusDwellMs" (the elapsed milliseconds since that stamp, falling',
        'back to the coarser "updatedAt" where the narrower one is absent,',
        'computed at read time and clamped at zero against clock skew). The',
        'framed listing renders the same dwell beside the status, at the',
        'coarsest unit that keeps it a whole number.',
        '',
        'Examples:',
        '  canon sessions list',
        '  canon sessions list --json',
        '  canon sessions list --branch feat/parser --json',
        '  canon sessions list --branch chore/agents --repository ../caret --json',
        '  canon sessions list --self --json',
        '',
      ].join('\n'),
    )
    .action(async (opts: ListCommandOptions) => {
      process.exitCode = await runList(opts)
    })

  sessions
    .command('export')
    .description(
      'Pack a session transcript, its side folder, and a manifest into one local bundle',
    )
    .helpOption('-h, --help', 'Show this help message')
    .argument('<id>', 'The sessionId to export')
    .option(
      '--out <path>',
      'Write the bundle here rather than under .canon/tmp/session-export/',
    )
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  the bundle was written',
        '  1  refused, with the reason on stderr and in the record',
        '',
        'The bundle is a gzip tarball on local disk and is never uploaded. It',
        'holds whatever tool output passed through the session, so treat it as',
        'private. Export runs no skill: write and push a handoff first where one',
        'is wanted, and the manifest reports whether one was found and pushed.',
        '',
        'Refusal reasons: "not-found" (no transcript carries the id) and',
        '"no-archive" (this Bun has no Bun.Archive).',
        '',
        'Examples:',
        '  canon sessions export <id>',
        '  canon sessions export <id> --out ~/session.tar.gz --json',
        '',
      ].join('\n'),
    )
    .action(async (id: string, opts: ExportCommandOptions) => {
      process.exitCode = await runExport(id, opts)
    })

  sessions
    .command('import')
    .description(
      'Place an exported session under this machine so claude can resume it',
    )
    .helpOption('-h, --help', 'Show this help message')
    .argument('<bundle>', 'The bundle an export wrote')
    .option(
      '--root <path>',
      'The repository to resume in. Defaults to the main worktree',
    )
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  the session was placed, with any lag reported in "behind"',
        '  1  refused, with the reason on stderr and in the record',
        '',
        'Refusal reasons: "not-a-bundle", "other-repository" (the origin',
        'differs), "exists" (the transcript or side folder is already there),',
        '"live-here" (the id is live on this machine), and "no-archive".',
        '',
        '"behind" lists "repository-behind" when this checkout lacks the',
        'exported HEAD, and "records-behind" when the records history lacks',
        'the exported records commit, which canon records pull brings.',
        '',
        'Examples:',
        '  canon sessions import session.tar.gz',
        '  canon sessions import session.tar.gz --root ~/repos/canon --json',
        '',
      ].join('\n'),
    )
    .action(async (bundle: string, opts: ImportCommandOptions) => {
      process.exitCode = await runImport(bundle, opts)
    })
}

interface ExportCommandOptions {
  readonly out?: string
  readonly json?: boolean
}

interface ImportCommandOptions {
  readonly root?: string
  readonly json?: boolean
}

/**
 * Whether a session id is live in the local roster. An unreadable roster
 * answers false, since the roster is advisory here and the manifest says so.
 */
async function isLiveHere(id: string): Promise<boolean> {
  const report = await resolveSessions()
  return (
    report.kind === 'resolved' &&
    report.sessions.some((session) => session.sessionId === id)
  )
}

function writeRecord(json: boolean | undefined, record: object): void {
  if (json) process.stdout.write(`${JSON.stringify(record)}\n`)
}

async function runExport(
  id: string,
  opts: ExportCommandOptions,
): Promise<number> {
  const outcome = await exportSession({
    id,
    out: opts.out ? resolve(opts.out) : undefined,
    isLive: isLiveHere,
  })

  intro('canon sessions export')

  if (!outcome.ok) {
    logStep('Refused')
    logWarn(outcome.message)
    outro()
    writeRecord(opts.json, { ...outcome, sessionId: id })
    return 1
  }

  const { manifest } = outcome
  logStep('Bundle')
  logInfo(`Wrote ${outcome.path}`)
  logInfo(`${plural(outcome.files.length, 'side file')} beside the transcript`)

  if (manifest.live) {
    logWarn(
      'The session is live, so the copy stops at its last whole line and resuming elsewhere forks it.',
    )
  }

  logStep('Handoff')
  if (manifest.handoff === null) {
    logInfo(
      'No compact note since the session began, so resume the transcript.',
    )
  } else if (manifest.handoffCommitted) {
    logInfo(`${manifest.handoff} is in the records history. Prefer it.`)
  } else {
    logWarn(
      `${manifest.handoff} is not in the records history yet. Run canon records push so the other machine can pull it.`,
    )
  }
  outro()

  writeRecord(opts.json, {
    ok: true,
    path: outcome.path,
    sessionId: id,
    files: outcome.files,
    manifest,
  })
  return 0
}

const BEHIND_REMEDIES: Record<Behind, string> = {
  'repository-behind':
    'This checkout lacks the exported HEAD. Fetch and check out the branch before resuming.',
  'records-behind':
    'The records history lacks the exported commit. Run canon records pull to bring the handoff.',
}

async function runImport(
  bundle: string,
  opts: ImportCommandOptions,
): Promise<number> {
  const root = opts.root ? resolve(opts.root) : await mainWorktreeRoot()
  const outcome = await importSession({
    bundle: resolve(bundle),
    root,
    isLive: isLiveHere,
  })

  intro('canon sessions import')

  if (!outcome.ok) {
    logStep('Refused')
    logWarn(outcome.message)
    outro()
    writeRecord(opts.json, outcome)
    return 1
  }

  logStep('Placed')
  logInfo(outcome.transcript)
  logInfo(
    `Folder ${outcome.folder}, derived from ${root}. --continue looks there, and --resume finds the id in any folder.`,
  )
  for (const lag of outcome.behind) logWarn(BEHIND_REMEDIES[lag])

  logStep('Resume')
  logInfo(
    outcome.manifest.recommend === 'handoff'
      ? `Recommended: the handoff at ${outcome.manifest.handoff}, since the transcript carries the source machine's absolute paths.`
      : 'Recommended: the transcript, since no handoff was written since the session began.',
  )
  for (const route of outcome.routes) logInfo(route)
  outro()

  writeRecord(opts.json, {
    ok: true,
    sessionId: outcome.manifest.sessionId,
    folder: outcome.folder,
    transcript: outcome.transcript,
    files: outcome.files,
    behind: outcome.behind,
    routes: outcome.routes,
    manifest: outcome.manifest,
  })
  return 0
}

async function runList(opts: ListCommandOptions): Promise<number> {
  const report = await resolveSessions()

  if (report.kind === 'absent') {
    intro('canon sessions list')
    logStep('Refused')
    logWarn(
      `No session registry at ${report.dir}. Nothing was read, so this is not a machine with no sessions.`,
    )
    outro()

    if (opts.json) {
      process.stdout.write(
        `${JSON.stringify({ dir: report.dir, reason: 'no-registry', sessions: [] })}\n`,
      )
    }

    return 1
  }

  // The roster read returns every row and marks none of them as the caller, so
  // the join runs here, ahead of any scope. Resolving it after the branch
  // filter would answer "no row" for a caller whose row was merely filtered
  // out, which is a different failure wearing the same reason.
  const own = opts.self ? selfOf(report.sessions, callerIdentity()) : null

  if (own?.kind === 'unresolved') {
    intro('canon sessions list')
    logStep('Refused')
    logWarn(selfRefusal(own))
    outro()

    if (opts.json) {
      process.stdout.write(
        `${JSON.stringify({
          dir: report.dir,
          reason:
            own.reason === 'no-identity' ? 'no-self-identity' : 'no-self-row',
          sessions: [],
        })}\n`,
      )
    }

    return 1
  }

  const pool = own === null ? report.sessions : [own.session]

  // A branch name identifies a branch inside one repository and nothing across
  // a machine, so an unscoped match reaches a session working in a different
  // project. `main` is the name that collides on every machine running two.
  //
  // Which repository that is is the caller's to name. The roster this filters
  // is machine-wide already, so a dispatcher asking about another project was
  // answered "unclaimed" about a branch a live session there was holding.
  const at = opts.repository ? resolve(opts.repository) : process.cwd()
  const repository = opts.branch ? await repositoryOf(at) : null

  if (opts.branch && repository === null) {
    intro('canon sessions list')
    logStep('Refused')
    logWarn(
      `--branch scopes the match to one repository, and none resolved at ${at}. Run it inside one, name another with --repository, or read the whole roster and filter on the repository field.`,
    )
    outro()

    if (opts.json) {
      process.stdout.write(
        `${JSON.stringify({ dir: report.dir, reason: 'no-repository', sessions: [] })}\n`,
      )
    }

    return 1
  }

  const shown = opts.branch
    ? pool.filter(
        (session) =>
          session.branch === opts.branch && session.repository === repository,
      )
    : pool

  const claim = opts.branch
    ? await checkClaim(opts.branch, { cwd: at, resolve: async () => report })
    : null

  intro('canon sessions list')
  reportConfidence(report)
  reportSessions(shown, opts.branch, repository, own !== null)
  if (claim) reportClaim(claim)
  outro()

  if (opts.json) {
    process.stdout.write(
      `${JSON.stringify({
        dir: report.dir,
        confidence: report.confidence,
        branch: opts.branch ?? null,
        repository,
        worktree: claim?.worktree ?? null,
        refs: claim?.refs ?? null,
        claimed: claim?.claimed ?? null,
        sessionsReadable: claim?.sessionsReadable ?? null,
        refsReadable: claim?.refsReadable ?? null,
        sessions: shown,
      })}\n`,
    )
  }

  return 0
}

/**
 * Separates a client that states no identity from a roster holding no row for
 * one it does state, since the two send a reader to different places.
 */
function selfRefusal(own: Extract<SelfReport, { kind: 'unresolved' }>): string {
  if (own.reason === 'no-identity') {
    return 'Nothing in the environment identifies this session, so --self has nothing to match against. A client setting none of CLAUDE_CODE_SESSION_ID, CLAUDE_PID, or CLAUDE_CODE_MESSAGING_SOCKET cannot be located on the roster at all.'
  }

  const held =
    own.identity.sessionId ??
    (own.identity.pid === null ? 'nothing' : `pid ${own.identity.pid}`)

  return `The environment identifies this session as ${held}, and no live row carries it. The roster holds local process records alone, so a session driving through Remote Control never appears here, and a record whose session has ended is dropped ahead of the match.`
}

/**
 * States how liveness was decided on every run, including the run that decided
 * it the strong way.
 *
 * A caller reading a roster has no other way to tell a confirmed identity from
 * a pid that merely answered, and the two support different actions: the first
 * addresses a session directly and the second opens by asking to be corrected.
 */
function reportConfidence(
  report: Extract<SessionReport, { kind: 'resolved' }>,
): void {
  logStep('Liveness')

  // A roster of none decided nothing, so the confirmed line would claim a check
  // over rows that do not exist. The registry is never pruned and holds a record
  // per session ever run, which is what makes the empty result worth stating.
  if (report.sessions.length === 0) {
    logInfo(
      'No row to decide. Every record belongs to a session that has ended.',
    )
    return
  }

  if (report.confidence === 'confirmed') {
    logInfo(
      'Every row matched a running process against the start time its record stamped.',
    )
    return
  }

  logWarn(
    'Start times could not be read, so rows rest on a pid answering alone. Treat the mapping as inferred and open by asking to be corrected.',
  )
}

function reportSessions(
  sessions: readonly ResolvedSession[],
  branch: string | undefined,
  repository: string | null,
  scoped: boolean,
): void {
  logStep('Sessions')

  if (branch) {
    logInfo(
      `Scoped to ${repository}, since a branch name identifies one there.`,
    )
  }

  // An empty result under --self says nothing about the roster, since the pool
  // was narrowed to one row before the branch filter ran. Reporting the wider
  // answer there would claim a reading this run never took.
  if (sessions.length === 0) {
    if (branch) {
      logInfo(
        scoped
          ? `This session does not hold ${branch}.`
          : `No live session in this repository holds ${branch}.`,
      )
      return
    }

    logInfo(
      'No live session. Every record in the registry belongs to a session that has ended.',
    )
    return
  }

  // The count is what a dispatch turns on. One row is a target and several are
  // candidates, and the caller cannot tell them apart from a roster alone.
  if (branch && sessions.length > 1) {
    logWarn(
      `${sessions.length} sessions hold ${branch}. Confirm which one before addressing it.`,
    )
  }

  logInfo(plural(sessions.length, 'live session'))
  pipeOutput(
    sessions
      .map((session) => {
        const held =
          session.branch ??
          `unresolved: ${REASONS[session.unresolved ?? ''] ?? 'unknown'}`
        const dwell = formatDwell(session.statusDwellMs)
        const status = dwell ? `${session.status} ${dwell}` : session.status
        return `${session.name}  ${status}  ${held}\n  ${session.cwd}`
      })
      .join('\n'),
  )
}

/**
 * Renders the dwell at the coarsest unit that keeps it a whole number, since a
 * reader scanning a roster wants an age at a glance rather than a millisecond
 * count. An absent dwell renders as nothing, folding a status carrying no
 * stamp back to the bare status line the reader already knew.
 */
function formatDwell(ms: number | null): string {
  if (ms === null) return ''
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  return `${hours}h`
}

function reportClaim(claim: ClaimReport): void {
  logStep('Claim')

  if (claim.worktree) {
    logInfo(`Worktree: ${claim.worktree}`)
  }

  if (claim.refs.length > 0) {
    logInfo(`Refs: ${claim.refs.join(', ')}`)
  }

  logInfo(claim.claimed ? 'Claimed.' : 'Unclaimed.')

  if (!claim.sessionsReadable) {
    logWarn(
      'The session roster could not be read, so this leaves the session half out. Treat it as unverified rather than clear.',
    )
  }

  if (!claim.refsReadable) {
    logWarn(
      'The ref read failed, so this cannot say whether the branch already exists. Treat it as unverified rather than clear.',
    )
  }
}
