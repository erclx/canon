import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Command } from 'commander'
import { pullRecords, pushRecords } from '@/records/backup'
import { migrateRecord } from '@/records/migrate'
import {
  type ClaimOutcome,
  claimOrdinal,
  highestOrdinal,
  isOrdinalKind,
  ORDINAL_KINDS,
} from '@/records/ordinal'
import {
  DEFAULT_OLDER_THAN_DAYS,
  type PruneReport,
  type PruneUnit,
  pruneScratch,
} from '@/records/prune'
import {
  type FolderSize,
  formatBytes,
  GROWTH_WINDOWS,
  sizedFolders,
  type SizeOutcome,
  sizeRecords,
} from '@/records/size'
import {
  type Finding,
  type FindingRemedy,
  isRecordKind,
  isSharedScratch,
  RECORD_KINDS,
  type RecordKind,
  recordsDir,
  type ValidateOutcome,
  validateRecords,
} from '@/records/validate'
import {
  intro,
  logError,
  logInfo,
  logStep,
  logWarn,
  outro,
  pipeOutput,
  plural,
} from '@/ui'
import { currentWorktreeRoot, mainWorktreeRoot } from '@/worktree'

/** Returned when a record carries a finding, which is the gating result. */
const EXIT_FINDINGS = 2

/** Returned when a record carries a known transform and `--write` was not passed. */
const EXIT_MIGRATABLE = 2

/** Returned when `--claim` loses every retry to a collision. */
const EXIT_CONTENDED = 2

/** Returned when candidates exist and `--write` was not passed. */
const EXIT_PRUNABLE = 2

interface ValidateCommandOptions {
  readonly json?: boolean
  readonly root?: string
}

type BackupCommandOptions = ValidateCommandOptions

interface MigrateCommandOptions extends ValidateCommandOptions {
  readonly write?: boolean
}

interface PruneCommandOptions extends ValidateCommandOptions {
  readonly write?: boolean
  readonly olderThan?: string
}

interface OrdinalCommandOptions extends ValidateCommandOptions {
  readonly claim?: boolean
}

export function register(program: Command): void {
  const records = program
    .command('records')
    .description(
      'Check a governed corpus against its standard, and back up the session records under .claude/',
    )
    .helpOption('-h, --help', 'Show this help message')

  records
    .command('validate')
    .description('Report where a file and the standard governing it disagree')
    .argument('<kind>', `Record folder: ${RECORD_KINDS.join(', ')}`)
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .option(
      '--root <path>',
      'Project root, defaulting to the main worktree except on standards',
    )
    .addHelpText(
      'after',
      [
        '',
        'Checks:',
        '  plans       filename, required sections, and the suggested-and-answer contract',
        '  groundwork  README and current-state files, numbering, dating, and a half-closed track',
        '  intake      overview file, numbering, dating, and the four bullets every item carries',
        '  memory      filename and type prefix, frontmatter, and the body shape each type carries',
        '  standards   frontmatter, the scope section and its handoff list, and a filename',
        '              derived from the governed path',
        '',
        'Exit codes:',
        '  0  every check passed',
        '  1  refused, with the reason on stderr or in the JSON record',
        '  2  at least one record carries a finding',
        '',
        'It reports and never writes, so a session fixes what the report names. A',
        'session record has no history to undo a wrong repair from, and a standard',
        'is installed and cited everywhere, so a rename is larger than a file move.',
        '',
        'Examples:',
        '  canon records validate plans',
        '  canon records validate memory',
        '  canon records validate standards',
        '  canon records validate intake --json',
        '',
      ].join('\n'),
    )
    .action(async (kind: string, opts: ValidateCommandOptions) => {
      process.exitCode = await runValidate(kind, opts)
    })

  records
    .command('migrate')
    .description('Rewrite the records a validate finding names a transform for')
    .argument('<kind>', `Record folder: ${RECORD_KINDS.join(', ')}`)
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .option('--write', 'Rewrite every record a transform can repair')
    .option(
      '--root <path>',
      'Project root, defaulting to the main worktree except on standards',
    )
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  nothing carries a known transform, or --write repaired every one',
        '  1  refused, with the reason on stderr or in the JSON record, every',
        '     candidate it found failed to repair, or --write repaired only',
        '     some of them',
        '  2  a record carries a known transform and --write was not passed',
        '',
        'It reports and never writes without --write, matching canon records',
        'validate: a session record has no history to undo a wrong repair from.',
        'A transform is only offered where the old value is recoverable from the',
        'file itself, so a finding with no transform is left for a session to fix.',
        '',
        'Examples:',
        '  canon records migrate memory',
        '  canon records migrate memory --write',
        '  canon records migrate memory --json',
        '',
      ].join('\n'),
    )
    .action(async (kind: string, opts: MigrateCommandOptions) => {
      process.exitCode = await runMigrate(kind, opts)
    })

  records
    .command('ordinal')
    .description(
      'Report or claim the next ordinal shared by intake and groundwork folders',
    )
    .argument('<kind>', `Ordinal-bearing folder: ${ORDINAL_KINDS.join(', ')}`)
    .argument('<slug>', 'The kebab-case slug the new folder will carry')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .option(
      '--claim',
      'Create the folder atomically instead of only reporting the ordinal',
    )
    .option('--root <path>', 'Project root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        'intake and groundwork folders share one ordinal sequence, so this reads',
        'both .canon/intake/ and .canon/groundwork/ regardless of which kind was',
        'asked for.',
        '',
        'Exit codes:',
        '  0  reported the next ordinal, or --claim created the folder',
        '  1  refused, with the reason on stderr or in the JSON record',
        '  2  --claim lost every retry to a collision',
        '',
        'Without --claim this only reports, so two sessions reading at once can',
        'still report the same number. --claim resolves that by creating the',
        'folder as part of the same act, retrying past a losing race rather than',
        'reporting one.',
        '',
        'Examples:',
        '  canon records ordinal intake my-topic',
        '  canon records ordinal groundwork my-topic --claim',
        '  canon records ordinal groundwork my-topic --claim --json',
        '',
      ].join('\n'),
    )
    .action(async (kind: string, slug: string, opts: OrdinalCommandOptions) => {
      process.exitCode = await runOrdinal(kind, slug, opts)
    })

  records
    .command('size')
    .description('Report what each record folder holds and how much is recent')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .option('--root <path>', 'Project root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        'Folders read, at whichever record root the project carries:',
        '  every folder canon records push carries, plus the scratch folder',
        '  (deletable without loss, so a backup skips it, but a reading does not)',
        '',
        'Exit codes:',
        '  0  the reading completed',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'It gates nothing. A record folder has no correct size, so the reading is',
        'a number to notice rather than a threshold to fail, and a session takes it',
        `by running this rather than by counting the folder. The ${GROWTH_WINDOWS.join(
          ' and ',
        )} day`,
        'counts read mtime, so a file rewritten long after it landed reads as recent,',
        'and a machine restored by records pull reads its whole tree as one week old.',
        '',
        'Examples:',
        '  canon records size',
        '  canon records size --json',
        '',
      ].join('\n'),
    )
    .action(async (opts: BackupCommandOptions) => {
      process.exitCode = await runSize(opts)
    })

  records
    .command('prune-tmp')
    .description('Report scratch nobody has touched in a while, and delete it')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .option('--write', 'Delete every candidate the report lists')
    .option(
      '--older-than <days>',
      `Age in days a unit's newest file must clear to be offered (default ${DEFAULT_OLDER_THAN_DAYS})`,
    )
    .option('--root <path>', 'Project root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        'A candidate is a unit whose newest file is older than --older-than:',
        '  a tmp/<slug>/ folder, a folder one level inside runs/, render/, or',
        '  pr/, or a single marker file inside hooks/<hook>/. A unit with no',
        '  files is offered whatever its age.',
        '',
        'tmp/handoff/ and tmp/pr/poll/ are never offered, since a reader deletes',
        'a handoff itself and a poll baseline is live state. The pre-split names',
        'the same two folders replaced (memory-routing/, teach-promotion/,',
        'ui-checklist/, pr-poll/) are skipped the same way rather than offered',
        'as ordinary slugs.',
        '',
        'Exit codes:',
        '  0  nothing to prune, or --write deleted every candidate',
        '  1  refused, with the reason on stderr or in the JSON record, or a',
        '     delete failed',
        '  2  candidates exist and --write was not passed',
        '',
        'It writes nothing until --write is passed, matching canon records',
        'migrate: a session record has no history to undo a wrong delete from.',
        'It reads mtime like canon records size, so a machine restored by canon',
        'records pull reads everything as new, which fails safe by offering',
        'nothing.',
        '',
        'Examples:',
        '  canon records prune-tmp',
        '  canon records prune-tmp --write',
        '  canon records prune-tmp --older-than 30 --json',
        '',
      ].join('\n'),
    )
    .action(async (opts: PruneCommandOptions) => {
      process.exitCode = await runPruneTmp(opts)
    })

  records
    .command('push')
    .description(
      'Commit the backed record folders and push them to the records remote',
    )
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .option('--root <path>', 'Project root, defaulting to the main worktree')
    .addHelpText('after', backupHelp('push'))
    .action(async (opts: BackupCommandOptions) => {
      process.exitCode = await runPush(opts)
    })

  records
    .command('pull')
    .description(
      'Fetch the records remote and write it into the backed record folders',
    )
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .option('--root <path>', 'Project root, defaulting to the main worktree')
    .addHelpText('after', backupHelp('pull'))
    .action(async (opts: BackupCommandOptions) => {
      process.exitCode = await runPull(opts)
    })
}

function backupHelp(verb: 'push' | 'pull'): string {
  const direction =
    verb === 'push'
      ? [
          'It commits nothing outside the folders above and leaves the project working',
          'tree untouched. The push runs even when this call committed nothing, since a',
          'previous run can have committed and then failed to reach the network.',
          '',
          'Before staging, it refuses the whole push as unsafe-payload when any new or',
          'changed file is over 25 MB or carries a credential canon secrets scan would',
          'report, naming each path. Nothing is staged or committed when it refuses.',
          'A push the remote rejects undoes the commit this call made, so the records',
          'stay on disk and no later run sends that commit again.',
        ]
      : [
          'It refuses rather than discarding local records that never reached the remote,',
          'so a machine holding uncommitted or unpushed records is told to push first.',
        ]

  return [
    '',
    'Backed folders, at whichever record root the project carries:',
    '  every top-level entry, less tmp, ordinal-locks, and .records.git',
    '  (a legacy .claude root instead uses a fixed list; run this with --json',
    '  to see what actually resolved, including any folder seen for the first time)',
    '',
    'Exit codes:',
    '  0  the records remote and this machine agree',
    '  1  refused, with the reason on stderr or in the JSON record',
    '',
    ...direction,
    '',
    'The history lives in a second git directory at .canon/.records.git, pointed at a',
    'private repository a person creates once. The verbs refuse with the setup command',
    'when it is absent, and refuse when its origin is also a remote of this project.',
    '',
    'Examples:',
    `  canon records ${verb}`,
    `  canon records ${verb} --json`,
    '',
  ].join('\n')
}

async function runSize(opts: BackupCommandOptions): Promise<number> {
  const root = opts.root ?? (await mainWorktreeRoot())
  const outcome = await sizeRecords(root)

  if (!outcome.ok)
    return reportRefusal('canon records size', outcome, opts.json ?? false)

  if (opts.json ?? false) {
    process.stdout.write(`${JSON.stringify(outcome)}\n`)
    return 0
  }

  reportSize(outcome)
  return 0
}

/** Widest cell in the column, so a row lines up against the header as well. */
function columnWidth(header: string, cells: readonly string[]): number {
  return Math.max(header.length, ...cells.map((cell) => cell.length))
}

function sizeRow(entry: FolderSize): string[] {
  return [
    entry.folder,
    String(entry.files),
    formatBytes(entry.bytes),
    ...entry.touched.map((window) => String(window.files)),
    entry.oldest ?? '',
    entry.newest ?? '',
  ]
}

/**
 * Renders the present folders as a table, heaviest first.
 *
 * The order is what makes the reading worth taking. A folder listed
 * alphabetically hides behind its neighbors, and the one that grew is the row
 * a reader came for, so it leads.
 */
function reportSize(outcome: Extract<SizeOutcome, { ok: true }>): void {
  const present = outcome.folders
    .filter((entry) => entry.present)
    .toSorted((left, right) => right.files - left.files)
  const absent = outcome.folders
    .filter((entry) => !entry.present)
    .map((entry) => entry.folder)

  intro('canon records size')
  logStep('Folders')

  if (present.length === 0) {
    logInfo('none of the record folders exist yet')
  } else {
    const headers = [
      'folder',
      'files',
      'size',
      ...GROWTH_WINDOWS.map((days) => `${days}d`),
      'oldest',
      'newest',
    ]
    const rows = present.map(sizeRow)
    const widths = headers.map((header, column) =>
      columnWidth(
        header,
        rows.map((row) => row[column]),
      ),
    )

    // The name column reads as a list and the rest as numbers, so one is
    // left-aligned and the others are not.
    const render = (cells: readonly string[]): string =>
      cells
        .map((cell, column) =>
          column === 0
            ? cell.padEnd(widths[column])
            : cell.padStart(widths[column]),
        )
        .join('  ')
        .trimEnd()

    pipeOutput([render(headers), ...rows.map(render)].join('\n'))
  }

  if (absent.length > 0) logInfo(`absent: ${absent.join(', ')}`)

  logStep('Total')
  logInfo(
    `${plural(outcome.files, 'file')}, ${formatBytes(outcome.bytes)} across ${plural(present.length, 'folder')}`,
  )
  outro()
}

async function runPruneTmp(opts: PruneCommandOptions): Promise<number> {
  const emitJson = opts.json ?? false
  const olderThan = Number(opts.olderThan ?? DEFAULT_OLDER_THAN_DAYS)

  if (!Number.isFinite(olderThan) || olderThan <= 0) {
    return reportRefusal(
      'canon records prune-tmp',
      {
        reason: 'bad-older-than',
        message: `--older-than must be a positive number of days, got ${opts.olderThan}.`,
      },
      emitJson,
    )
  }

  const root = opts.root ?? (await mainWorktreeRoot())
  const write = opts.write ?? false
  const outcome = await pruneScratch(root, olderThan, write)

  if (!outcome.ok)
    return reportRefusal('canon records prune-tmp', outcome, emitJson)

  return reportPrune(outcome, emitJson)
}

function pruneRow(entry: PruneUnit): string[] {
  return [
    entry.path,
    String(entry.files),
    formatBytes(entry.bytes),
    entry.newest ?? '',
  ]
}

function pruneExitCode(outcome: PruneReport): number {
  if (outcome.failed.length > 0) return 1
  if (outcome.candidates.length > 0 && outcome.deleted.length === 0)
    return EXIT_PRUNABLE
  return 0
}

function reportPrune(outcome: PruneReport, emitJson: boolean): number {
  const exit = pruneExitCode(outcome)

  if (emitJson) {
    process.stdout.write(`${JSON.stringify(outcome)}\n`)
    return exit
  }

  intro('canon records prune-tmp')

  if (outcome.candidates.length === 0) {
    logStep('Prunable')
    logInfo(`none, older than ${plural(outcome.olderThan, 'day')}`)
  } else {
    logStep(outcome.deleted.length > 0 ? 'Deleted' : 'Prunable')

    const headers = ['path', 'files', 'size', 'newest']
    const rows = outcome.candidates.map(pruneRow)
    const widths = headers.map((header, column) =>
      columnWidth(
        header,
        rows.map((row) => row[column]),
      ),
    )
    const render = (cells: readonly string[]): string =>
      cells
        .map((cell, column) =>
          column === 0
            ? cell.padEnd(widths[column])
            : cell.padStart(widths[column]),
        )
        .join('  ')
        .trimEnd()

    pipeOutput([render(headers), ...rows.map(render)].join('\n'))

    if (outcome.deleted.length === 0) logInfo('Re-run with --write to delete.')
  }

  if (outcome.skipped.length > 0) {
    logStep('Skipped')
    for (const entry of outcome.skipped)
      logInfo(`${entry.path}: ${entry.reason}`)
  }

  if (outcome.failed.length > 0) {
    logStep('Failed')
    for (const entry of outcome.failed)
      logWarn(`${entry.path}: ${entry.message}`)
  }

  outro()
  return exit
}

async function runPush(opts: BackupCommandOptions): Promise<number> {
  const root = opts.root ?? (await mainWorktreeRoot())
  const outcome = await pushRecords(root)

  if (!outcome.ok)
    return reportRefusal('canon records push', outcome, opts.json ?? false)

  if (opts.json ?? false) {
    process.stdout.write(`${JSON.stringify(outcome)}\n`)
    return 0
  }

  intro('canon records push')
  logStep('Staged')
  logInfo(
    `${outcome.folders.length} folder(s), ${outcome.changed} path(s) changed`,
  )
  if (outcome.firstSeen.length > 0) {
    logWarn(`first seen: ${outcome.firstSeen.join(', ')}`)
  }
  for (const path of outcome.added) logInfo(`added: ${path}`)
  if (outcome.dropped.length > 0) {
    logWarn(
      `excluded but still tracked, removed from the history going forward: ${outcome.dropped.join(', ')}`,
    )
  }
  logStep(outcome.pushed ? 'Pushed' : 'Nothing to push')
  logInfo(
    outcome.commit
      ? `records at ${outcome.commit}`
      : 'no records committed yet',
  )
  outro()
  return 0
}

async function runPull(opts: BackupCommandOptions): Promise<number> {
  const root = opts.root ?? (await mainWorktreeRoot())
  const outcome = await pullRecords(root)

  if (!outcome.ok)
    return reportRefusal('canon records pull', outcome, opts.json ?? false)

  if (opts.json ?? false) {
    process.stdout.write(`${JSON.stringify(outcome)}\n`)
    return 0
  }

  intro('canon records pull')
  logStep('Fetched')
  logInfo(`records at ${outcome.commit}`)
  logStep('Written')
  logInfo(`${outcome.files} file(s) across ${outcome.folders.length} folder(s)`)
  outro()
  return 0
}

/**
 * Reports a refusal from any of the three verbs that carry one.
 *
 * The parameter is structural rather than the union of their outcome types,
 * because the three refusal vocabularies are separate lists and naming them all
 * here would grow with every verb added.
 */
function reportRefusal(
  banner: string,
  outcome: {
    readonly reason: string
    readonly message: string
    readonly blocked?: readonly unknown[]
  },
  emitJson: boolean,
): number {
  if (emitJson) {
    process.stderr.write(`${outcome.message}\n`)
    process.stdout.write(
      `${JSON.stringify({
        ok: false,
        reason: outcome.reason,
        message: outcome.message,
        ...(outcome.blocked ? { blocked: outcome.blocked } : {}),
      })}\n`,
    )
    return 1
  }

  // The setup refusals carry the commands to run on their own lines. A marker
  // beside a command reads as a result rather than as something to copy, so the
  // remainder goes out unmarked.
  const [reason, ...rest] = outcome.message.split('\n')

  intro(banner)
  logStep('Refused')
  logError(reason)
  if (rest.length > 0) pipeOutput(rest.join('\n'))
  outro()
  return 1
}

/**
 * A shared-scratch kind reads the main worktree root, so a linked worktree
 * validates the records every other session reads. A tracked corpus reads the
 * checkout the caller stands in, which is the copy that session has edited.
 */
function defaultRoot(kind: RecordKind): Promise<string> {
  return isSharedScratch(kind) ? mainWorktreeRoot() : currentWorktreeRoot()
}

async function runValidate(
  kind: string,
  opts: ValidateCommandOptions,
): Promise<number> {
  const emitJson = opts.json ?? false

  if (!isRecordKind(kind)) {
    return report(
      {
        ok: false,
        reason: 'unknown-kind',
        message: `Not a record kind: ${kind}. Expected one of: ${RECORD_KINDS.join(', ')}.`,
      },
      emitJson,
      process.cwd(),
    )
  }

  const root = opts.root ?? (await defaultRoot(kind))

  return report(await validateRecords(root, kind), emitJson, root)
}

function report(
  outcome: ValidateOutcome,
  emitJson: boolean,
  root: string,
): number {
  if (!outcome.ok) {
    // The framed branch below already reaches stderr through logError, so the
    // bare write is what keeps the JSON mode from reporting the reason on
    // stdout alone.
    if (emitJson) {
      process.stderr.write(`${outcome.message}\n`)
      process.stdout.write(
        `${JSON.stringify({
          ok: false,
          reason: outcome.reason,
          message: outcome.message,
        })}\n`,
      )
      return 1
    }

    intro('canon records validate')
    logStep('Refused')
    logError(outcome.message)
    outro()
    return 1
  }

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        root,
        kind: outcome.kind,
        records: outcome.records,
        findings: outcome.findings,
      })}\n`,
    )
  } else {
    intro('canon records validate')
    logStep(outcome.kind)
    logInfo(`${outcome.records} record(s) read`)

    logStep(outcome.findings.length === 0 ? 'Clean' : 'Findings')
    if (outcome.findings.length === 0) {
      logInfo('every record matches the shape its standard fixes')
    } else {
      for (const found of outcome.findings) logWarn(describe(found))
    }
    outro()
  }

  return outcome.findings.length > 0 ? EXIT_FINDINGS : 0
}

function describe(found: Finding): string {
  const scope = found.record === found.subject ? '' : `${found.record}: `
  return `${scope}${found.subject} ${found.message}`
}

export interface Repair {
  readonly record: string
  readonly remedy: FindingRemedy
  readonly path: string
  readonly text: string
}

export interface Refusal {
  readonly record: string
  readonly message: string
}

/** The message a rejected promise leaves, for a record whose read or write failed. */
function describeFailure(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}

/**
 * Runs every finding's transform, without writing anything back.
 *
 * `Promise.allSettled` rather than `Promise.all`, so a record whose read
 * fails, such as one deleted between `validate`'s listing and this read,
 * becomes a refusal for that one record rather than an unhandled rejection
 * that `program.parse()` has no top-level catch for.
 */
async function attemptMigrations(
  dir: string,
  findings: readonly Finding[],
): Promise<{ repaired: Repair[]; refused: Refusal[] }> {
  const candidates = findings.filter(
    (found): found is Finding & { readonly remedy: FindingRemedy } =>
      found.remedy !== undefined,
  )

  const settled = await Promise.allSettled(
    candidates.map(async (found) => {
      const path = join(dir, found.record)
      const outcome = migrateRecord(
        found.remedy,
        found.record,
        await readFile(path, 'utf8'),
      )
      return { record: found.record, remedy: found.remedy, path, outcome }
    }),
  )

  const repaired: Repair[] = []
  const refused: Refusal[] = []

  settled.forEach((result, index) => {
    if (result.status === 'rejected') {
      refused.push({
        record: candidates[index].record,
        message: `could not be read: ${describeFailure(result.reason)}`,
      })
      return
    }

    const { record, remedy, path, outcome } = result.value

    if (outcome.ok) {
      repaired.push({ record, remedy, path, text: outcome.text })
    } else {
      refused.push({ record, message: outcome.message })
    }
  })

  return { repaired, refused }
}

/**
 * Writes every repair, independently. `Promise.allSettled` so one record's
 * write failing does not abort the writes that would otherwise have
 * succeeded, per the concurrency standard's rule on batched partial failure.
 */
async function writeRepairs(
  repaired: readonly Repair[],
): Promise<{ written: Repair[]; failed: Refusal[] }> {
  const settled = await Promise.allSettled(
    repaired.map((entry) => writeFile(entry.path, entry.text, 'utf8')),
  )

  const written: Repair[] = []
  const failed: Refusal[] = []

  settled.forEach((result, index) => {
    const entry = repaired[index]

    if (result.status === 'fulfilled') {
      written.push(entry)
    } else {
      failed.push({
        record: entry.record,
        message: `could not be written: ${describeFailure(result.reason)}`,
      })
    }
  })

  return { written, failed }
}

async function runMigrate(
  kind: string,
  opts: MigrateCommandOptions,
): Promise<number> {
  const emitJson = opts.json ?? false

  if (!isRecordKind(kind)) {
    return reportRefusal(
      'canon records migrate',
      {
        reason: 'unknown-kind',
        message: `Not a record kind: ${kind}. Expected one of: ${RECORD_KINDS.join(', ')}.`,
      },
      emitJson,
    )
  }

  const root = opts.root ?? (await defaultRoot(kind))
  const outcome = await validateRecords(root, kind)

  if (!outcome.ok) {
    return reportRefusal('canon records migrate', outcome, emitJson)
  }

  const write = opts.write ?? false
  const { repaired, refused } = await attemptMigrations(
    recordsDir(root, kind),
    outcome.findings,
  )

  if (!write) {
    return reportMigrate(root, outcome.kind, repaired, refused, write, emitJson)
  }

  const { written, failed } = await writeRepairs(repaired)

  return reportMigrate(
    root,
    outcome.kind,
    written,
    [...refused, ...failed],
    write,
    emitJson,
  )
}

function reportMigrate(
  root: string,
  kind: RecordKind,
  repaired: readonly Repair[],
  refused: readonly Refusal[],
  write: boolean,
  emitJson: boolean,
): number {
  const total = repaired.length + refused.length

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        root,
        kind,
        written: write,
        migrated: repaired.map((entry) => entry.record),
        refused,
      })}\n`,
    )
  } else {
    intro('canon records migrate')

    if (total === 0) {
      logStep('Clean')
      logInfo('no finding carries a known transform')
    } else {
      logStep(write ? 'Rewritten' : 'Would rewrite')
      if (repaired.length === 0) {
        logInfo('none, every candidate refused, see below')
      } else {
        for (const entry of repaired)
          logInfo(`${entry.record}: ${entry.remedy}`)
      }

      if (refused.length > 0) {
        logStep('Refused')
        for (const entry of refused)
          logWarn(`${entry.record}: ${entry.message}`)
      }

      if (!write && repaired.length > 0) {
        logInfo('Re-run with --write to apply.')
      }
    }

    outro()
  }

  return migrateExitCode(repaired, refused, write)
}

/**
 * `repaired` carries only records a transform actually fixed, whether this
 * is a dry run or the set `--write` wrote, so exit 2 (a write is available)
 * never fires when every candidate refused. A dry run reaching that state
 * previously returned the same code as a genuine offer to write, telling a
 * caller `--write` would repair something when it would repair nothing.
 */
export function migrateExitCode(
  repaired: readonly Repair[],
  refused: readonly Refusal[],
  write: boolean,
): number {
  const total = repaired.length + refused.length

  if (total === 0) return 0
  if (repaired.length === 0) return 1
  if (!write) return EXIT_MIGRATABLE
  return refused.length > 0 ? 1 : 0
}

async function runOrdinal(
  kind: string,
  slug: string,
  opts: OrdinalCommandOptions,
): Promise<number> {
  const emitJson = opts.json ?? false

  if (!isOrdinalKind(kind)) {
    return reportRefusal(
      'canon records ordinal',
      {
        reason: 'unknown-kind',
        message: `Not an ordinal-bearing kind: ${kind}. Expected one of: ${ORDINAL_KINDS.join(', ')}.`,
      },
      emitJson,
    )
  }

  const root = opts.root ?? (await mainWorktreeRoot())
  const claim = opts.claim ?? false

  if (!claim) {
    const next = String((await highestOrdinal(root)) + 1).padStart(2, '0')

    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({ ok: true, root, kind, slug, ordinal: next, claimed: false })}\n`,
      )
    } else {
      intro('canon records ordinal')
      logStep('Next')
      logInfo(`${next}-${slug} (report only, pass --claim to create it)`)
      outro()
    }

    return 0
  }

  return reportOrdinal(root, await claimOrdinal(root, kind, slug), emitJson)
}

function reportOrdinal(
  root: string,
  outcome: ClaimOutcome,
  emitJson: boolean,
): number {
  if (!outcome.ok) {
    if (emitJson) {
      process.stderr.write(`${outcome.message}\n`)
      process.stdout.write(
        `${JSON.stringify({
          ok: false,
          reason: outcome.reason,
          message: outcome.message,
          lastOrdinal: outcome.lastOrdinal,
        })}\n`,
      )
      return EXIT_CONTENDED
    }

    intro('canon records ordinal')
    logStep('Refused')
    logError(outcome.message)
    outro()
    return EXIT_CONTENDED
  }

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({ root, ...outcome, claimed: true })}\n`,
    )
  } else {
    intro('canon records ordinal')
    logStep('Claimed')
    logInfo(outcome.path)
    outro()
  }

  return 0
}
