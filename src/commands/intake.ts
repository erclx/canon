import { relative } from 'node:path'
import type { Command } from 'commander'
import {
  type AnswerOutcome,
  answerItems,
  type IntakeRefused,
  type ListOutcome,
  listFolders,
  type ReadOutcome,
  readFolder,
  type Selection,
} from '@/intake/folder'
import {
  type BaselineOutcome,
  type CheckOutcome,
  checkDrive,
  type DriveFindings,
  type DriveRefused,
  recordBaseline,
} from '@/intake/drive-check'
import { isUnread } from '@/intake/items'
import {
  intro,
  logAdd,
  logError,
  logInfo,
  logStep,
  logWarn,
  outro,
  pipeOutput,
} from '@/cli/ui'
import { mainWorktreeRoot } from '@/git/worktree'

/**
 * A selection as the command line spells it, splitting on the first `=`. The
 * label accepts a letter suffix, matching the headings a cluster file carries,
 * and everything after the separator is the answer, so one carrying its own
 * `=` survives intact.
 */
const SELECTION = /^(\d+[a-z]*)=([\s\S]*)$/i

interface ListCommandOptions {
  readonly json?: boolean
  readonly unread?: boolean
  readonly root?: string
}

interface DriveCheckCommandOptions {
  readonly baseline?: boolean
  readonly json?: boolean
  readonly root?: string
}

interface AnswerCommandOptions {
  readonly cluster?: string
  readonly json?: boolean
  readonly root?: string
  readonly set?: readonly string[]
}

export function register(program: Command): void {
  const intake = program
    .command('intake')
    .description('Read and answer intake folders in .canon/intake/')
    .helpOption('-h, --help', 'Show this help message')

  intake
    .command('list')
    .description('List intake folders, or the items one folder holds')
    .argument('[slug]', 'Intake folder name, as in toolkit-overview')
    .helpOption('-h, --help', 'Show this help message')
    .option(
      '--unread',
      'Keep only what is unread, as folders carrying one or as empty slots',
    )
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--root <path>', 'Intake root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        'Refusals, read off `reason`:',
        '  no-intake       the project holds no intake folder',
        '  no-folder       no folder matches the slug',
        '  ambiguous-slug  a bare slug matches more than one ordinal-prefixed',
        '                  folder, all named in `detail`',
        '',
        'Exit codes:',
        '  0  the folders or items were listed',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'With no slug it reports per-folder counts. With one it reports every',
        'item grouped by the cluster file holding it. An empty answer slot',
        'means unread and never agreement, so a count is the report and no',
        'verb here decides one.',
        '',
        'An item carrying no answer slot is counted apart from both, since the',
        'answer verb cannot reach it and folding it into either count hides a',
        'file that needs fixing.',
        '',
        'Examples:',
        '  canon intake list',
        '  canon intake list toolkit-overview --unread --json',
        '',
      ].join('\n'),
    )
    .action(async (slug: string | undefined, opts: ListCommandOptions) => {
      process.exitCode = await runList(slug, opts)
    })

  intake
    .command('answer')
    .description("Write selections into a cluster's answer slots")
    .argument('<slug>', 'Intake folder name, as in toolkit-overview')
    .helpOption('-h, --help', 'Show this help message')
    .option('--cluster <file>', 'Cluster file the items live in')
    .option(
      '--set <item=answer>',
      'Answer to land on an item, repeatable',
      collectSelection,
      [] as string[],
    )
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--root <path>', 'Intake root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        'Refusals, read off `reason`:',
        '  no-intake       the project holds no intake folder',
        '  no-folder       no folder matches the slug',
        '  ambiguous-slug  a bare slug matches more than one ordinal-prefixed',
        '                  folder, all named in `detail`',
        '  no-cluster      the cluster file named does not exist',
        '  no-item         the item number named does not exist in the cluster',
        '  answered        the item already carries an answer',
        '  bad-input       a malformed command line, such as no selection, an empty',
        '                  answer, or two answers for one item',
        '',
        'Exit codes:',
        '  0  every named item now carries its answer',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'Items are numbered per cluster file, so a selection names the cluster',
        'and the number together. One call writes one cluster, which is what',
        'keeps a batch from racing on the file every selection shares.',
        '',
        'An item already carrying an answer is refused rather than overwritten.',
        'A filled slot is a decision already made.',
        '',
        'Examples:',
        '  canon intake answer toolkit-overview --cluster 05-coverage.md --set 3=ok',
        '  canon intake answer toolkit-overview --cluster 05-coverage.md --set 3=ok --set 4="not worth it" --json',
        '',
      ].join('\n'),
    )
    .action(async (slug: string, opts: AnswerCommandOptions) => {
      process.exitCode = await runAnswer(slug, opts)
    })

  intake
    .command('drive-check')
    .description(
      'Check an app drive against its goals, the checkout, and its evidence',
    )
    .argument('<slug>', 'Intake folder name, as in app-drive-1-0')
    .helpOption('-h, --help', 'Show this help message')
    .option(
      '--baseline',
      'Record the main checkout status before the drive, rather than check',
    )
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--root <path>', 'Project root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        'With --baseline it stores the main checkout status at',
        '.canon/tmp/app-drive/<slug>/baseline.json, any ordinal dropped from',
        'the slug, so it runs before the intake folder exists. Without it, it',
        'reads drive.json in the intake folder and fails the drive on:',
        '  unmapped         a ## Goals bullet the record carries no entry for',
        '  unreasoned       a goal marked not-driven with no reason',
        '  unknown          an entry naming no goal the requirements hold',
        '  changed          a checkout path that differs from the baseline',
        '  strayEvidence    an evidence path outside the folder evidence/',
        '  missingEvidence  an evidence path that holds no file',
        '  worktreeLeft     the drive worktree the record names, still on disk',
        '',
        'A goal matches by its text with any bold label and trailing period',
        'dropped. A changed path is named and never reverted.',
        '',
        'Read `reason` off the record: `recorded` for a baseline, `clean` or',
        '`failed` for a check, and a refusal otherwise.',
        '',
        'Refusals, read off `reason`:',
        '  no-intake        the project holds no intake folder',
        '  no-folder        no folder matches the slug',
        '  ambiguous-slug   a bare slug matches more than one folder',
        '  bad-input        the slug could leave the scratch folder',
        '  no-record        the folder carries no drive.json',
        '  bad-record       drive.json does not parse or breaks its shape',
        '  no-requirements  the project carries no requirements record',
        '  no-baseline      no baseline was recorded for the slug',
        '  unreadable-tree  git cannot read the main checkout status',
        '',
        'Exit codes:',
        '  0  the baseline was recorded, or the drive is clean',
        '  1  refused, with the reason on stderr or in the JSON record',
        '  2  the drive failed, with every finding in the record',
        '',
        'Examples:',
        '  canon intake drive-check app-drive-1-0 --baseline --json',
        '  canon intake drive-check app-drive-1-0 --json',
        '',
      ].join('\n'),
    )
    .action(async (slug: string, opts: DriveCheckCommandOptions) => {
      process.exitCode = await runDriveCheck(slug, opts)
    })
}

function collectSelection(value: string, previous: string[]): string[] {
  return [...previous, value]
}

async function runList(
  slug: string | undefined,
  opts: ListCommandOptions,
): Promise<number> {
  const emitJson = opts.json ?? false
  const root = opts.root ?? (await mainWorktreeRoot())

  if (slug === undefined) {
    return reportList(
      await listFolders(root),
      emitJson,
      root,
      opts.unread ?? false,
    )
  }

  return reportFolder(
    await readFolder(root, slug),
    emitJson,
    root,
    opts.unread ?? false,
  )
}

async function runAnswer(
  slug: string,
  opts: AnswerCommandOptions,
): Promise<number> {
  const emitJson = opts.json ?? false

  if (!opts.cluster) {
    return reportRefusal(
      'canon intake answer',
      {
        ok: false,
        reason: 'bad-input',
        message: 'No cluster named. Pass --cluster <file>.',
        detail: [],
      },
      emitJson,
      process.cwd(),
    )
  }

  const raw = opts.set ?? []

  if (raw.length === 0) {
    return reportRefusal(
      'canon intake answer',
      {
        ok: false,
        reason: 'bad-input',
        message: 'No selection given. Pass --set <item>=<answer>.',
        detail: [],
      },
      emitJson,
      process.cwd(),
    )
  }

  const selections: Selection[] = []
  const invalid: string[] = []

  for (const entry of raw) {
    const match = SELECTION.exec(entry)
    const answer = match?.[2].trim()

    if (!match || !answer) {
      invalid.push(entry)
      continue
    }

    selections.push({ label: match[1].toLowerCase(), answer })
  }

  if (invalid.length > 0) {
    return reportRefusal(
      'canon intake answer',
      {
        ok: false,
        reason: 'bad-input',
        message: `Not an item and answer: ${invalid.join(', ')}`,
        detail: invalid,
      },
      emitJson,
      process.cwd(),
    )
  }

  const duplicated = selections
    .map((selection) => selection.label)
    .filter((label, index, all) => all.indexOf(label) !== index)

  if (duplicated.length > 0) {
    return reportRefusal(
      'canon intake answer',
      {
        ok: false,
        reason: 'bad-input',
        message: `Two answers for item ${[...new Set(duplicated)].join(', ')}.`,
        detail: [],
      },
      emitJson,
      process.cwd(),
    )
  }

  const root = opts.root ?? (await mainWorktreeRoot())
  const outcome = await answerItems(root, slug, opts.cluster, selections)

  return reportAnswer(outcome, emitJson, root)
}

async function runDriveCheck(
  slug: string,
  opts: DriveCheckCommandOptions,
): Promise<number> {
  const emitJson = opts.json ?? false
  const root = opts.root ?? (await mainWorktreeRoot())

  if (opts.baseline) {
    return reportBaseline(await recordBaseline(root, slug), emitJson, root)
  }

  return reportDriveCheck(await checkDrive(root, slug), emitJson, root)
}

function reportRefusal(
  title: string,
  refused: IntakeRefused | DriveRefused,
  emitJson: boolean,
  root: string,
): number {
  // The framed branch reaches stderr through logError, so the bare write is
  // what keeps the JSON mode from reporting the reason on stdout alone.
  if (emitJson) {
    process.stderr.write(`${refused.message}\n`)
    process.stdout.write(
      `${JSON.stringify({
        ok: false,
        root,
        reason: refused.reason,
        message: refused.message,
        detail: refused.detail,
      })}\n`,
    )
    return 1
  }

  intro(title)
  logStep('Refused')
  logError(refused.message)
  if (refused.detail.length > 0) pipeOutput(refused.detail.join('\n'))
  outro()

  return 1
}

function reportList(
  outcome: ListOutcome,
  emitJson: boolean,
  root: string,
  unreadOnly: boolean,
): number {
  if (!outcome.ok) {
    return reportRefusal('canon intake list', outcome, emitJson, root)
  }

  // Malformed items are counted over every folder rather than the filtered
  // set, since a folder whose only defect is an item nobody can answer carries
  // no unread count to survive the filter and is exactly what the warning is
  // for.
  const listed = unreadOnly
    ? outcome.folders.filter((folder) => folder.unread > 0)
    : outcome.folders

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({ ok: true, root, folders: listed })}\n`,
    )
    return 0
  }

  intro('canon intake list')
  logStep(listed.length > 0 ? 'Folders' : 'No folders')

  for (const folder of listed) {
    logInfo(
      `${folder.slug}: ${folder.items} item(s), ${folder.open} open, ${folder.unread} unread`,
    )
  }

  const malformed = outcome.folders.filter((folder) => folder.malformed > 0)

  if (malformed.length > 0) {
    logStep('Carrying no answer slot')
    for (const folder of malformed) {
      logWarn(
        `${folder.slug}: ${folder.malformed} item(s), which none of these verbs can answer`,
      )
    }
  }

  outro()

  return 0
}

function reportFolder(
  outcome: ReadOutcome,
  emitJson: boolean,
  root: string,
  unreadOnly: boolean,
): number {
  if (!outcome.ok) {
    return reportRefusal('canon intake list', outcome, emitJson, root)
  }

  const clusters = outcome.clusters
    .map((cluster) => ({
      cluster: cluster.cluster,
      items: unreadOnly ? cluster.items.filter(isUnread) : cluster.items,
    }))
    .filter((cluster) => cluster.items.length > 0)

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({ ok: true, root, slug: outcome.slug, clusters })}\n`,
    )
    return 0
  }

  intro('canon intake list')

  for (const cluster of clusters) {
    logStep(cluster.cluster)
    for (const item of cluster.items) {
      const state = isUnread(item) ? 'unread' : (item.answer ?? 'no slot')
      logInfo(`${item.label}. ${item.title} (${state})`)
    }
  }

  if (clusters.length === 0) {
    logStep(unreadOnly ? 'Nothing unread' : 'No items')
  }

  outro()

  return 0
}

function reportAnswer(
  outcome: AnswerOutcome,
  emitJson: boolean,
  root: string,
): number {
  if (!outcome.ok) {
    return reportRefusal('canon intake answer', outcome, emitJson, root)
  }

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        root,
        slug: outcome.slug,
        cluster: outcome.cluster,
        path: relative(root, outcome.path),
        answered: outcome.answered,
      })}\n`,
    )
    return 0
  }

  intro('canon intake answer')
  logStep('Answered')

  for (const entry of outcome.answered) {
    logInfo(`${entry.label}. ${entry.answer}`)
  }

  logAdd(relative(root, outcome.path))
  outro()

  return 0
}

function reportBaseline(
  outcome: BaselineOutcome,
  emitJson: boolean,
  root: string,
): number {
  if (!outcome.ok) {
    return reportRefusal('canon intake drive-check', outcome, emitJson, root)
  }

  const path = relative(root, outcome.path)

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        root,
        slug: outcome.slug,
        reason: 'recorded',
        baseline: path,
        entries: outcome.entries,
      })}\n`,
    )
    return 0
  }

  intro('canon intake drive-check')
  logStep('Baseline')
  logInfo(`Recorded ${outcome.entries} status line(s).`)
  logAdd(path)
  outro()

  return 0
}

const FINDING_LABELS: Record<keyof DriveFindings, string> = {
  unmapped: 'Goals with no entry',
  unreasoned: 'Goals not driven, with no reason',
  unknown: 'Entries naming no goal',
  changed: 'Changed in the checkout',
  strayEvidence: 'Evidence outside evidence/',
  missingEvidence: 'Evidence holding no file',
  worktreeLeft: 'Drive worktree still on disk',
}

function reportDriveCheck(
  outcome: CheckOutcome,
  emitJson: boolean,
  root: string,
): number {
  if (!outcome.ok) {
    return reportRefusal('canon intake drive-check', outcome, emitJson, root)
  }

  const code = outcome.reason === 'clean' ? 0 : 2

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        root,
        slug: outcome.slug,
        reason: outcome.reason,
        goals: outcome.goals,
        findings: outcome.findings,
      })}\n`,
    )
    return code
  }

  intro('canon intake drive-check')

  if (outcome.reason === 'clean') {
    logStep('Clean')
    logInfo(
      `${outcome.goals} goal(s) mapped, the checkout untouched, the evidence in place.`,
    )
    outro()
    return code
  }

  for (const [key, label] of Object.entries(FINDING_LABELS)) {
    const list = outcome.findings[key as keyof DriveFindings]
    if (list.length === 0) continue
    logStep(label)
    for (const entry of list) logError(entry)
  }
  outro()

  return code
}
