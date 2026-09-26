import { resolve } from 'node:path'
import type { Command } from 'commander'
import { type LabelAuditRefusal, auditLabels } from '@/labels/audit'
import { resolveScanInput } from '@/labels/event'
import { checkTitleFormat, type TitleFormatIssue } from '@/labels/format'
import { MAP_REL } from '@/labels/map'
import { scanPhaseLabels } from '@/labels/phase'
import { scanTitleSpelling } from '@/labels/spelling'
import { intro, logInfo, logStep, logWarn, outro, plural } from '@/ui'

interface AuditOptions {
  readonly base?: string
  readonly root?: string
  readonly json?: boolean
}

interface ScanOptions {
  readonly event?: string
  readonly title?: string
  readonly body?: string
  readonly bodyFile?: string
  readonly head?: string
  readonly json?: boolean
}

/** What a reader does about each way `checkTitleFormat` graded a title as broken. */
const TITLE_FORMAT_MESSAGES: Record<TitleFormatIssue, string> = {
  structure: 'does not match <type>(<scope>)[!]: <subject>',
  'casing-type': 'the type is not lowercase',
  'casing-scope': 'the scope is not lowercase',
  'casing-subject': 'the first word of the subject is not lowercase',
  length: 'is over 72 characters',
}

/** What a reader does about each way the audit produced no reading. */
const REFUSALS: Record<LabelAuditRefusal, string> = {
  // An answer rather than a fault. A project declaring no map is labelled
  // silently by design, so a refusal reading as a break would make the map
  // mandatory for every target.
  'no-map': `No ${MAP_REL} here, so this project labels nothing and declares no surfaces to cover.`,
  'unreadable-map': `${MAP_REL} is not valid TOML, so no row could be read.`,
  'no-domains': `${MAP_REL} carries no usable row under [domains], so every path would read as uncovered.`,
  'no-base': 'No base resolves against the trunk. Fetch origin or pass --base.',
  'bad-base':
    'The ref passed to --base resolves to no commit here. Pass one this tree carries.',
  'unreadable-changes':
    'git could not list what this branch changed, so the set is unknown.',
}

export function register(program: Command): void {
  const labels = program
    .command('labels')
    .description('Resolve a changed set against the pull request label map')
    .helpOption('-h, --help', 'Show this help message')

  labels
    .command('audit')
    .description(
      'Report the labels a changed set earns and the paths no row reaches',
    )
    .argument(
      '[paths...]',
      'Changed set to read, defaulting to the branch range',
    )
    .helpOption('-h, --help', 'Show this help message')
    .option('--base <ref>', 'Far side of the range, defaulting to the trunk')
    .option('--root <path>', 'Repository to read, defaulting to the cwd')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        `Reads ${MAP_REL} and matches it prefix-anchored, which is the rule the`,
        "map's own census was measured against. It reports and never gates,",
        'because whether an uncovered surface deserves a label is a judgment.',
        '',
        'What it separates:',
        '  uncovered  a surface no row reaches, which is a gap wanting a row',
        '  declined   a path a [declined] row names, which is a decision already taken',
        '',
        'What it does not measure:',
        '  a prefix reaching no path, which is the map going stale from the other',
        '  side and a second measure rather than this one',
        '',
        'Exit codes:',
        '  0  every changed path is labelled or declined',
        '  1  refused, with the reason on stderr or in the JSON record',
        '  2  at least one changed path is reached by no row',
        '',
        'Examples:',
        '  canon labels audit',
        '  canon labels audit --json',
        '  canon labels audit --base origin/main',
        '  canon labels audit src/cli.ts docs/index.md --json',
        '',
      ].join('\n'),
    )
    .action(async (paths: string[], opts: AuditOptions) => {
      process.exitCode = await runAudit(paths, opts)
    })

  labels
    .command('scan')
    .description(
      'Fail a pull request or a posted review whose title, body, or review comment carries a phase label, a board identifier, a session link, or a title with an unspelled word',
    )
    .helpOption('-h, --help', 'Show this help message')
    .option(
      '--event <path>',
      'GitHub pull_request or pull_request_review event payload to read, such as $GITHUB_EVENT_PATH',
    )
    .option('--title <text>', 'Title to scan, overriding the event payload')
    .option('--body <text>', 'Body to scan, overriding the event payload')
    .option(
      '--body-file <path>',
      'Body to scan, read from a file, overriding the event payload',
    )
    .option('--head <ref>', 'Head branch, overriding the event payload')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Reads canon standards versioning for the two namespaces and sorts every',
        'version-shaped token this pull request carries into the one the pull',
        'request is allowed to hold. A release-please pull request, read off its',
        'own fixed head branch and title, may carry semver references. Every',
        'other pull request may carry neither, so any token found there is a',
        'leaked phase label.',
        '',
        'A posted review is read the same way, scanning `review.body` off a',
        '`pull_request_review` payload rather than the title and body of the',
        'pull request itself, which is text a person can otherwise publish',
        'by writing straight into the review box instead of the description.',
        '',
        'It reports a board identifier beside that, being text naming the task',
        'board rather than the change: a version token a code span quotes, and a',
        'path under a record root, both of which a reader on the remote holds no',
        'copy of. A path under a tracked folder is left alone, so a rule or a',
        'skill any clone resolves is not reported.',
        '',
        'It reports a session link as the third category, being a link to one',
        'Claude Code session, which the harness appends to text it tells a',
        'session to publish. That link resolves for the one account holding the',
        'session and for no other reader, which no clone repairs, so it is read',
        'on a release pull request too, where the board identifier is not.',
        '',
        "It also spell-checks the title alone against this repository's own",
        'cspell config, since release-please copies the title into',
        'CHANGELOG.md and nothing else spell-checks it first. The check shells',
        "this repository's own resolved cspell binary and reports nothing when",
        'a target project carries none, rather than reaching the network or',
        'forcing a new dependency.',
        '',
        "It also grades the title alone against standards/pr.md's ## Title",
        'section: the `<type>(<scope>)[!]: <subject>` structure, lowercase casing',
        'for the type, the scope, and the first subject word, and a 72-',
        'character length cap. A scan given no title, whether from a review',
        'or from a bare --body or --body-file invocation, skips this check',
        'rather than grading an empty string.',
        '',
        'Exit codes:',
        '  0  none of the five found',
        '  1  refused, with the reason on stderr or in the JSON record',
        '  2  the title or body carries a phase label, a board identifier, a',
        '     session link, a title word no dictionary holds, or a title',
        "     breaking standards/pr.md's format, casing, or length",
        '',
        'Examples:',
        '  canon labels scan --event "$GITHUB_EVENT_PATH"',
        '  canon labels scan --title "feat: x" --body "planned under v68.5" --head feat/x',
        '  canon labels scan --body-file reply.md',
        '',
      ].join('\n'),
    )
    .action(async (opts: ScanOptions) => {
      process.exitCode = await runScan(opts)
    })
}

async function runAudit(paths: string[], opts: AuditOptions): Promise<number> {
  const root = resolve(opts.root ?? process.cwd())
  const emitJson = opts.json ?? false

  const report = await auditLabels(root, {
    base: opts.base,
    ...(paths.length > 0 && { paths }),
  })

  intro('canon labels audit')

  // The frame renders on stderr in both modes and the record goes to stdout
  // alone, so an operator reading the terminal sees the refusal rather than a
  // command that appeared to do nothing.
  if (report.kind === 'refused') {
    logStep('Refused')
    logWarn(REFUSALS[report.reason])
    outro()

    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({
          root,
          reason: report.reason,
          message: REFUSALS[report.reason],
        })}\n`,
      )
    }
    return 1
  }

  const { coverage } = report

  logStep('Scope')
  logInfo(
    report.base === undefined
      ? `${plural(report.changed.length, 'path')} supplied by the caller`
      : `${plural(report.changed.length, 'path')} changed since ${report.base.slice(0, 8)}`,
  )

  logStep('Labels')
  logInfo(
    coverage.labels.length === 0
      ? 'this set earns no label'
      : coverage.labels.join(', '),
  )

  // Named rather than counted into the uncovered line. A path somebody decided
  // against wants nothing done, and folding it in would ask for a row that was
  // already refused.
  logStep('Declined')
  if (coverage.declined.length === 0) {
    logInfo('no changed path is deliberately unlabelled')
  } else {
    for (const entry of coverage.declined) {
      logInfo(`${entry.path}: ${entry.reason}`)
    }
  }

  logStep(coverage.uncovered.length === 0 ? 'Covered' : 'Uncovered')
  if (coverage.uncovered.length === 0) {
    logInfo('every changed path is reached by a row')
  } else {
    logWarn(
      `${plural(coverage.uncovered.length, 'path')} reached by no row. Give each a prefix on the row that owns its subject, or a [declined] row with the reason it earns none.`,
    )
    for (const path of coverage.uncovered) logWarn(path)
  }

  outro()

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        root,
        ...(report.base !== undefined && { base: report.base }),
        changed: report.changed,
        labels: coverage.labels,
        declined: coverage.declined,
        uncovered: coverage.uncovered,
      })}\n`,
    )
  }

  return coverage.uncovered.length === 0 ? 0 : 2
}

async function runScan(opts: ScanOptions): Promise<number> {
  const emitJson = opts.json ?? false

  intro('canon labels scan')

  const resolved = resolveScanInput(opts)

  if (resolved.kind === 'refused') {
    logStep('Refused')
    logWarn(resolved.message)
    outro()

    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({ reason: resolved.reason, message: resolved.message })}\n`,
      )
    }
    return 1
  }

  const result = scanPhaseLabels(resolved)
  const spelling = await scanTitleSpelling(resolved.title, process.cwd())
  // A scan given no title, whatever produced that absence, has nothing to
  // grade and would otherwise fail as `structure` for the wrong reason.
  const titleFormat =
    resolved.title !== '' ? checkTitleFormat(resolved.title) : undefined

  logStep(resolved.source === 'review' ? 'Review comment' : 'Pull request')
  logInfo(
    resolved.source === 'review'
      ? 'reads as a posted review comment'
      : result.cutsRelease
        ? 'reads as a release-please pull request'
        : 'reads as an ordinary pull request',
  )

  logStep(result.phaseLabels.length === 0 ? 'Clean' : 'Phase label found')
  if (result.phaseLabels.length === 0) {
    logInfo('no phase label in the title or body')
  } else {
    logWarn(
      `${plural(result.phaseLabels.length, 'phase label')} in the title or body. Describe the change itself and drop the internal label before publishing.`,
    )
    for (const label of result.phaseLabels) logWarn(label)
  }

  logStep(
    result.boardReferences.length === 0 ? 'Clean' : 'Board identifier found',
  )
  if (result.boardReferences.length === 0) {
    logInfo('no quoted label or record path in the title or body')
  } else {
    logWarn(
      `${plural(result.boardReferences.length, 'board identifier')} in the title or body. Name what a reader on the remote can open, since a record path is gitignored there and a quoted label reads as one only from the board.`,
    )
    for (const reference of result.boardReferences) logWarn(reference)
  }

  logStep(result.sessionLinks.length === 0 ? 'Clean' : 'Session link found')
  if (result.sessionLinks.length === 0) {
    logInfo('no session link in the title or body')
  } else {
    logWarn(
      `${plural(result.sessionLinks.length, 'session link')} in the title or body. Delete every hit rather than rewriting it, since a session resolves for the one account that started it and for no other reader.`,
    )
    for (const link of result.sessionLinks) logWarn(link)
  }

  const spellingChecked = spelling.kind === 'checked'
  const unspelledWords =
    spelling.kind === 'checked' ? spelling.unknownWords : []

  logStep(
    spelling.kind === 'unavailable'
      ? 'Spelling unavailable'
      : unspelledWords.length === 0
        ? 'Clean'
        : 'Unspelled word found',
  )
  if (spelling.kind === 'unavailable' && spelling.reason === 'no-binary') {
    logInfo(
      `no node_modules/.bin/cspell resolved walking up from ${spelling.probedFrom}, so the title was not checked`,
    )
  } else if (spelling.kind === 'unavailable') {
    logInfo(
      `cspell did not exit clean or with issues found (${spelling.message}), so the title was not checked`,
    )
  } else if (unspelledWords.length === 0) {
    logInfo('no word in the title is absent from every dictionary')
  } else {
    logWarn(
      `${plural(unspelledWords.length, 'word')} in the title absent from every dictionary. Fix the spelling, or add jargon and project-specific terms to .cspell/project-terms.txt and dependency vocabulary to .cspell/tech-stack.txt.`,
    )
    for (const word of unspelledWords) logWarn(word)
  }

  const titleFormatIssues = titleFormat?.issues ?? []

  logStep(
    titleFormat === undefined
      ? 'Title format not checked'
      : titleFormat.conforms
        ? 'Clean'
        : 'Title format issue found',
  )
  if (titleFormat === undefined) {
    logInfo('the scan carries no title, so there is no format to grade')
  } else if (titleFormat.conforms) {
    logInfo(
      'the title matches <type>(<scope>)[!]: <subject> and its casing and length rules',
    )
  } else {
    logWarn(
      `${plural(titleFormatIssues.length, 'title format issue')} against standards/pr.md's ## Title section.`,
    )
    for (const issue of titleFormatIssues) logWarn(TITLE_FORMAT_MESSAGES[issue])
  }

  outro()

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        cutsRelease: result.cutsRelease,
        phaseLabels: result.phaseLabels,
        semverTags: result.semverTags,
        boardReferences: result.boardReferences,
        sessionLinks: result.sessionLinks,
        unspelledWords,
        spellingChecked,
        titleFormatIssues,
      })}\n`,
    )
  }

  return result.phaseLabels.length === 0 &&
    result.boardReferences.length === 0 &&
    result.sessionLinks.length === 0 &&
    unspelledWords.length === 0 &&
    titleFormatIssues.length === 0
    ? 0
    : 2
}
