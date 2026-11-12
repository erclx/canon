import { type Command } from 'commander'
import { WAITING_LIMIT } from '@/tasks/board'
import {
  type Finding,
  type FolderClaim,
  type SharedFiles,
  type WideToken,
  type Unplaced,
  type Untested,
  type ValidateOutcome,
  validateBoard,
} from '@/tasks/validate'
import { liveReaders } from '@/tasks/holders'
import { intro, logError, logInfo, logStep, logWarn, outro } from '@/cli/ui'
import { mainWorktreeRoot } from '@/git/worktree'

/** Returned when the board carries a finding, which is the gating result. */
export const EXIT_FINDINGS = 2

interface ValidateCommandOptions {
  readonly json?: boolean
  readonly root?: string
  readonly live?: boolean
}

async function runValidate(opts: ValidateCommandOptions): Promise<number> {
  const root = opts.root ?? (await mainWorktreeRoot())
  const outcome = await validateBoard(
    root,
    opts.live ? { live: liveReaders(root) } : {},
  )

  return reportValidation(outcome, opts.json ?? false, root)
}

function reportValidation(
  outcome: ValidateOutcome,
  emitJson: boolean,
  root: string,
): number {
  if (!outcome.ok) {
    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({ ok: false, reason: outcome.reason, message: outcome.message })}\n`,
      )
      return 1
    }

    intro('canon tasks validate')
    logStep('Refused')
    logError(outcome.message)
    outro()
    return 1
  }

  if (!emitJson) {
    intro('canon tasks validate')
    logStep('Board')
    logInfo(
      `${outcome.rows} row(s) across the readiness groups, ${outcome.backlog} backlog line(s), ${outcome.tasks} task file(s), ${outcome.declined} declined`,
    )

    logStep(outcome.findings.length === 0 ? 'Clean' : 'Findings')
    if (outcome.findings.length === 0) {
      logInfo(
        'every row resolves, every task sits on one surface, and each run now row names its files',
      )
    } else {
      for (const finding of outcome.findings) logWarn(describe(finding))
    }

    // The untested rows carry the warn glyph rather than the pass glyph. They
    // move no exit code, and a green tick on a row nothing re-took is the
    // misread this section exists to prevent.
    logStep('Parked rows')
    if (outcome.untested.length === 0) {
      logInfo('every parked row carried a citation or a file set to re-test')
    } else {
      logWarn(
        `${outcome.untested.length} row(s) carry a blocker no check can settle`,
      )
      for (const row of outcome.untested) logWarn(describeUntested(row))
    }

    // A folder claim is often the correct way to say a row rewrites a whole
    // directory, so it reports beside the findings and moves no exit code. A
    // measure that fails on a legitimate cell trains a reader to skip it.
    logStep('Folder claims')
    if (outcome.claims.length === 0) {
      logInfo('every run now row names files rather than folders')
    } else {
      for (const claim of outcome.claims) logWarn(describeClaim(claim))
    }

    // A shared file holds nothing under the dispatch gate, so the pairs report
    // with the warn glyph and move no exit code. They stay listed for merge
    // order and for the holds a Touches cell cannot state.
    logStep('Shared files')
    if (outcome.shared.length === 0) {
      logInfo('no two run now rows name the same file')
    } else {
      for (const pair of outcome.shared) logWarn(describeShared(pair))
    }

    // The width limit is a heuristic over one preview pane, so a wide token
    // reports and moves no exit code, and a measure failing on a cell that
    // fits would teach a reader to skip it.
    logStep('Wide tokens')
    if (outcome.wide.length === 0) {
      logInfo('every code span fits the preview pane')
    } else {
      for (const token of outcome.wide) logWarn(describeWide(token))
    }

    // Unplaced is the normal state between a session filing a task and an
    // orchestrator placing its row, so it moves no exit code. It still reports,
    // since it is the only local detector for a row a hand-edit dropped or a
    // handoff that never arrived.
    logStep('Unplaced')
    if (outcome.unplaced.length === 0) {
      logInfo('every task file sits on the board or the backlog')
    } else {
      for (const task of outcome.unplaced) logWarn(describeUnplaced(task))
    }

    if (outcome.live.sessions !== 'not-asked') {
      logStep('Held rows')
      if (
        outcome.live.sessions === 'read' &&
        outcome.live.pulls === 'read' &&
        !outcome.findings.some((finding) => finding.kind === 'row-held')
      ) {
        logInfo('no row outside run now is held by a session or a pull request')
      }
    }
  }

  // Unread is a warning in both modes, since diagnostics reach stderr with --json too.
  if (outcome.live.sessions === 'unread') {
    logWarn('the session roster could not be read, so no session was checked')
  }
  if (outcome.live.pulls === 'unread') {
    logWarn(
      'pull requests could not be read, so a hold may be missed or already merged',
    )
  }

  if (!emitJson) outro()

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        root,
        rows: outcome.rows,
        backlog: outcome.backlog,
        tasks: outcome.tasks,
        declined: outcome.declined,
        findings: outcome.findings,
        untested: outcome.untested,
        claims: outcome.claims,
        shared: outcome.shared,
        wide: outcome.wide,
        unplaced: outcome.unplaced,
        live: outcome.live,
      })}\n`,
    )
  }

  return outcome.findings.length > 0 ? EXIT_FINDINGS : 0
}

function describe(finding: Finding): string {
  const scope = finding.group ? `${finding.group}: ` : ''
  return `${scope}${finding.subject} ${finding.message}`
}

function describeUntested(row: Untested): string {
  return `${row.group}: ${row.subject} ${row.message}`
}

function describeClaim(claim: FolderClaim): string {
  return `${claim.group}: ${claim.subject} ${claim.message}`
}

function describeShared(pair: SharedFiles): string {
  return `${pair.group}: ${pair.subject} ${pair.message}`
}

function describeWide(token: WideToken): string {
  return `${token.group}: ${token.subject} ${token.message}`
}

function describeUnplaced(task: Unplaced): string {
  return `${task.subject} ${task.message}`
}

export function registerValidate(tasks: Command): void {
  tasks
    .command('validate')
    .description(
      'Report what each board row claims against what the tree holds',
    )
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .option('--root <path>', 'Board root, defaulting to the main worktree')
    .option(
      '--live',
      'Also read the session roster and open pull requests for held rows',
    )
    .addHelpText(
      'after',
      [
        '',
        'Checks:',
        '  every Run now row points at a plan file that resolves',
        '  no Needs a plan row has a live plan, and every Up next row has one',
        '  every task file carries a board row or a backlog line, never both',
        '  no task carries more than one row',
        '  every Run now row names the files it touches',
        '  every Touches cell matches what its plans derive',
        '  every group header is the set of columns the group owns',
        `  no Waiting on cell renders past ${WAITING_LIMIT} characters`,
        '  a blocker citing a bare vNNN.N label settles like a linked one',
        '  a file two Run now rows share is listed, never failed',
        '  with --live, no Up next or Needs a plan row is held by a live session',
        "  or an open pull request on its plan's branch",
        '',
        'The `live` field states each --live source as read, unread, or not-asked.',
        'A source that fails reads as unread and moves no exit code, so read that',
        'field rather than taking exit 0 as clean. A run without --live reads neither.',
        '',
        'Refusals, read off `reason`:',
        '  no-board     the repository holds no `.canon/tasks/` board',
        '  no-ordering  the board has no ordering file',
        '  no-groups    the board groups rows under headings of its own, with no',
        '               declared columns',
        '',
        'Exit codes:',
        '  0  every check passed',
        '  1  refused, with the reason on stderr or in the JSON record',
        '  2  the board carries at least one finding',
        '',
        'It reports and never writes. A row is a claim about readiness, so a',
        'session fixes the row the report names.',
        '',
        'Examples:',
        '  canon tasks validate',
        '  canon tasks validate --json',
        '  canon tasks validate --live --json',
        '',
      ].join('\n'),
    )
    .action(async (opts: ValidateCommandOptions) => {
      process.exitCode = await runValidate(opts)
    })
}
