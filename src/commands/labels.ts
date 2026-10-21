import { resolve } from 'node:path'
import { $ } from 'bun'
import type { Command } from 'commander'
import { execa } from 'execa'
import { gitEnv } from '@/git/env'
import { diffLabels } from '@/labels/apply'
import { type LabelAuditRefusal, auditLabels } from '@/labels/audit'
import { checkClosing } from '@/labels/closing'
import {
  bodyDensity,
  isPost,
  POST_HEADINGS,
  postDensity,
} from '@/labels/density'
import { resolveScanInput } from '@/labels/event'
import { checkTitleFormat, type TitleFormatIssue } from '@/labels/format'
import { MAP_REL } from '@/labels/map'
import { isReleasePullRequest, scanPhaseLabels } from '@/labels/phase'
import { checkSections } from '@/labels/sections'
import { BAN_SETS } from '@/markdown/bans'
import { bodyLines, scanBans } from '@/markdown/scan'
import { intro, logInfo, logStep, logWarn, outro, plural } from '@/cli/ui'

interface AuditOptions {
  readonly base?: string
  readonly root?: string
  readonly json?: boolean
}

interface ApplyOptions extends AuditOptions {
  readonly check?: boolean
}

type ApplyRefusal = 'bad-number' | 'no-branch' | 'gh-failed' | 'head-mismatch'

const GH_TIMEOUT_MS = 30_000

interface ScanOptions {
  readonly event?: string
  readonly title?: string
  readonly body?: string
  readonly bodyFile?: string
  readonly head?: string
  readonly closes?: string
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

const APPLY_REFUSALS: Record<ApplyRefusal, string> = {
  'bad-number': 'The pull request number must be a positive whole number.',
  'no-branch':
    'This checkout is on no branch, so there is no head to bind the pull request to.',
  'gh-failed':
    'gh could not read the pull request or the labels, so nothing was written.',
  'head-mismatch':
    'That pull request is not open on the current branch. Nothing was written to it.',
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
        'Reasons:',
        '  no-map  the project declares no label map, so it labels nothing. An',
        '          expected absence for `canon audits run`, not a fault',
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
    .command('apply')
    .description(
      'Add the labels this branch earns to its open pull request, adding what is missing and never removing',
    )
    .argument('<number>', "This branch's open pull request")
    .helpOption('-h, --help', 'Show this help message')
    .option(
      '--base <ref>',
      "Read the git range back to this ref instead of the pull request's files",
    )
    .option('--root <path>', 'Repository to read, defaulting to the cwd')
    .option('--check', 'Report the labels owed and write nothing')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        "Resolves the earned set from the pull request's own files listing, or",
        'from the git range when --base is passed, binds to the pull request only',
        'when its head is the current branch and it is open, and adds each earned',
        'label the pull request lacks over REST.',
        '',
        'It adds and never removes, so a label a person applied by hand stays.',
        'A label the remote does not carry is reported under missingOnRemote and',
        'skipped, never created. A project declaring no map earns nothing and',
        'exits 0.',
        '',
        'Record: number, earned, present, added, owed, missingOnRemote, uncovered',
        '',
        'Exit codes:',
        '  0  nothing is owed after the run',
        '  1  refused, with the reason on stderr or in the JSON record',
        '  2  labels are still owed, being any under --check, or a label the',
        '     remote lacks or a failed add otherwise',
        '',
        'Reasons:',
        '  head-mismatch  the pull request is not open on the current branch, under',
        '                 --check as well',
        '  gh-failed      the files listing or the labels could not be read, and the',
        '                 run does not fall back to git',
        '',
        'Examples:',
        '  canon labels apply 123 --json',
        '  canon labels apply 123 --check',
        '',
      ].join('\n'),
    )
    .action(async (number: string, opts: ApplyOptions) => {
      process.exitCode = await runApply(number, opts)
    })

  labels
    .command('scan')
    .description(
      'Fail a pull request or a posted review whose title, body, or review comment carries a phase label, a board identifier, or a session link',
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
    .option(
      '--closes <numbers>',
      'Issues the body must close, a comma list or `none`, graded when given',
    )
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Reads the git-commit versioning reference for the two namespaces and sorts every',
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
        "It also grades the title alone against claude/skills/git-pr/references/pr.md's ## Title",
        'section: the `<type>(<scope>)[!]: <subject>` structure, lowercase casing',
        'for the type, the scope, and the first subject word, and a 72-',
        'character length cap. A scan given no title, whether from a review',
        'or from a bare --body or --body-file invocation, skips this check',
        'rather than grading an empty string.',
        '',
        'It grades the body of an ordinary pull request against the closed',
        'section list: a level-two heading outside it, or a missing',
        '## Summary or ## Key changes, fails. A review, a release-please body,',
        'and a scan carrying no title skip this check.',
        '',
        'It fails the density of that same body, reported per section under',
        '`density`: a bullet past 200 characters, more than 5 plain',
        'bullets or 2 paragraphs in a row, a paragraph past 350 characters, any',
        'H3 or deeper heading, and Technical context mixing bullets with',
        'paragraphs. A bold label alone on a line splits a Key changes run, a',
        'bold-led paragraph starts a new Technical context run, and Testing',
        'takes the heading limit alone. Each finding carries its section, kind,',
        'line in the whole body, value, and limit.',
        '',
        'A body the section check skips is graded as a post under the same',
        '`density` key when its first level-two heading is one of',
        `${POST_HEADINGS.map((heading) => `## ${heading}`).join(', ')}.`,
        'A post takes the same length and run limits, allows an H3, and',
        'measures a nested item as a bullet of its own. The footer, the',
        'marker, and a table never report, a block inside <details> takes the',
        'length limits alone, and a checklist box under ## What to look at',
        'takes no length limit. Post density never fails the scan.',
        '',
        'It also fails a banned',
        'character, an em dash or a semicolon, in the title or body of a pull',
        'request or a review, outside a code span or a link.',
        '',
        'With --closes, it also grades the closing lines. Each issue named needs',
        'its own `Closes #NNN` keyword in the body, and a closing keyword for an',
        'issue the list leaves out fails. `none` expects no closing line.',
        'Without the flag the check does not run, so the pull request job and a',
        'followup keep their behavior. A keyword in a code span or a fence is',
        'not read, as GitHub does not read it.',
        '',
        'Exit codes:',
        '  0  none of the nine found',
        '  1  refused, with the reason on stderr or in the JSON record',
        '  2  the title or body carries a phase label, a board identifier, a',
        '     session link, a banned character, a heading outside the closed',
        '     list or a required one missing, a density finding in the body, a',
        '     missing or stray closing line',
        '     under --closes, or a title',
        "     breaking claude/skills/git-pr/references/pr.md's format, casing, or length",
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

/** Runs one `gh` call under the stripped environment, null when it failed. */
async function gh(
  cwd: string,
  args: readonly string[],
): Promise<string | null> {
  try {
    const result = await execa('gh', [...args], {
      cwd,
      timeout: GH_TIMEOUT_MS,
      env: gitEnv(),
      extendEnv: false,
    })
    return result.stdout
  } catch {
    return null
  }
}

function nonEmptyLines(text: string): string[] {
  return text.split('\n').filter((line) => line !== '')
}

async function runApply(number: string, opts: ApplyOptions): Promise<number> {
  const root = resolve(opts.root ?? process.cwd())
  const emitJson = opts.json ?? false
  const isCheck = opts.check ?? false

  intro('canon labels apply')

  const refuse = (reason: ApplyRefusal | LabelAuditRefusal): number => {
    const message =
      reason in APPLY_REFUSALS
        ? APPLY_REFUSALS[reason as ApplyRefusal]
        : REFUSALS[reason as LabelAuditRefusal]
    logStep('Refused')
    logWarn(message)
    outro()
    if (emitJson) {
      process.stdout.write(`${JSON.stringify({ root, reason, message })}\n`)
    }
    return 1
  }

  if (!/^[1-9][0-9]*$/.test(number)) return refuse('bad-number')

  const branch = await $`git -C ${root} symbolic-ref --short -q HEAD`
    .env(gitEnv())
    .quiet()
    .nothrow()
  const head = branch.exitCode === 0 ? branch.text().trim() : ''
  if (head === '') return refuse('no-branch')

  // Binding runs ahead of the audit, every label read, and every write, under
  // --check and a project with no map as well, so a number this branch does
  // not own costs the run and nothing else.
  const target = await gh(root, [
    'api',
    `repos/{owner}/{repo}/pulls/${number}`,
    '--jq',
    '"\\(.head.ref) \\(.state)"',
  ])
  if (target === null) return refuse('gh-failed')
  if (target.trim() !== `${head} open`) return refuse('head-mismatch')

  // An explicit --base is an explicit request for the git route. Otherwise the
  // pull request's own file listing is the diff the labels describe, and a
  // failed read refuses rather than falling back, since binding needed gh too.
  let paths: string[] | undefined
  if (opts.base === undefined) {
    const listing = await gh(root, [
      'api',
      '--paginate',
      `repos/{owner}/{repo}/pulls/${number}/files`,
      '--jq',
      '.[].filename',
    ])
    if (listing === null) return refuse('gh-failed')
    paths = nonEmptyLines(listing)
  }

  const report = await auditLabels(root, {
    base: opts.base,
    ...(paths !== undefined && { paths }),
  })

  // A project declaring no map earns nothing and is labelled silently, which
  // is an answer and exits clean rather than reading as a break.
  if (report.kind === 'refused' && report.reason === 'no-map') {
    logStep('Labels')
    logInfo(REFUSALS['no-map'])
    outro()
    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({
          number: Number(number),
          reason: 'no-map',
          earned: [],
          present: [],
          added: [],
          owed: [],
          missingOnRemote: [],
          uncovered: [],
        })}\n`,
      )
    }
    return 0
  }
  if (report.kind === 'refused') return refuse(report.reason)

  const presentRaw = await gh(root, [
    'api',
    '--paginate',
    `repos/{owner}/{repo}/issues/${number}/labels`,
    '--jq',
    '.[].name',
  ])
  const remoteRaw = await gh(root, [
    'api',
    '--paginate',
    'repos/{owner}/{repo}/labels',
    '--jq',
    '.[].name',
  ])
  if (presentRaw === null || remoteRaw === null) return refuse('gh-failed')

  const earned = report.coverage.labels
  const present = nonEmptyLines(presentRaw)
  const diff = diffLabels(earned, present, nonEmptyLines(remoteRaw))

  let added: string[] = []
  let failed: string[] = []

  if (!isCheck && diff.toAdd.length > 0) {
    const wrote = await gh(root, [
      'api',
      '-X',
      'POST',
      `repos/{owner}/{repo}/issues/${number}/labels`,
      ...diff.toAdd.flatMap((label) => ['-f', `labels[]=${label}`]),
      '--silent',
    ])
    if (wrote === null) failed = [...diff.toAdd]
    else added = [...diff.toAdd]
  }

  logStep('Labels')
  logInfo(earned.length === 0 ? 'this set earns no label' : earned.join(', '))

  if (isCheck) {
    logStep(diff.owed.length === 0 ? 'Nothing owed' : 'Owed')
    for (const label of diff.owed) logWarn(label)
  } else {
    logStep('Added')
    logInfo(added.length === 0 ? 'no label was added' : added.join(', '))
  }

  for (const label of diff.missingOnRemote) {
    logWarn(
      `${label} is not on the remote. Create it with: gh label create ${label}`,
    )
  }
  for (const label of failed) logWarn(`Label apply failed: ${label}`)

  if (report.coverage.uncovered.length > 0) {
    logWarn(
      `${plural(report.coverage.uncovered.length, 'path')} reached by no row of ${MAP_REL}.`,
    )
  }

  outro()

  const owed = diff.owed.filter((label) => !added.includes(label))

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        number: Number(number),
        earned,
        present,
        added,
        owed,
        missingOnRemote: diff.missingOnRemote,
        uncovered: report.coverage.uncovered,
      })}\n`,
    )
  }

  return owed.length === 0 ? 0 : 2
}

/**
 * Reads `--closes` as the issues the body must close. Undefined when the flag
 * is absent, which skips the check, and a message when the value is neither
 * `none` nor a comma list of numbers, since a guessed list would grade the
 * body against the wrong issues.
 */
function parseCloses(value: string | undefined): number[] | string | undefined {
  if (value === undefined) return undefined
  if (value === 'none') return []
  if (!/^\d+(,\d+)*$/.test(value)) {
    return `--closes takes a comma list of issue numbers or none, not ${value}`
  }

  return [...new Set(value.split(',').map(Number))]
}

async function runScan(opts: ScanOptions): Promise<number> {
  const emitJson = opts.json ?? false

  intro('canon labels scan')

  const expected = parseCloses(opts.closes)

  if (typeof expected === 'string') {
    logStep('Refused')
    logWarn(expected)
    outro()

    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({ reason: 'bad-input', message: expected })}\n`,
      )
    }
    return 1
  }

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

  const titleFormatIssues = titleFormat?.issues ?? []

  // A review carries its own headings, a release-please body opens on a
  // version link, and a scan with no title is a reply or a review body rather
  // than a pull request description, so none of the three has the closed list
  // to grade against.
  const sectionsChecked =
    resolved.source === 'pull-request' &&
    resolved.title !== '' &&
    !isReleasePullRequest(resolved)
  const sections = sectionsChecked
    ? checkSections(resolved.body)
    : { outside: [], missing: [] }

  logStep(
    !sectionsChecked
      ? 'Sections not checked'
      : sections.outside.length === 0 && sections.missing.length === 0
        ? 'Clean'
        : 'Section issue found',
  )
  if (!sectionsChecked) {
    logInfo(
      'only an ordinary pull request body is graded against the closed section list',
    )
  } else if (sections.outside.length === 0 && sections.missing.length === 0) {
    logInfo(
      'every heading is in the closed list and the required pair is there',
    )
  } else {
    if (sections.outside.length > 0) {
      logWarn(
        `${plural(sections.outside.length, 'heading')} outside the closed list in the pull request standard. Rename or drop each.`,
      )
      for (const heading of sections.outside) logWarn(heading)
    }
    if (sections.missing.length > 0) {
      logWarn(
        `${plural(sections.missing.length, 'required heading')} missing from the body.`,
      )
      for (const heading of sections.missing) logWarn(heading)
    }
  }

  // A body's density fails the scan. A post's never does, since the review
  // post hook denies on exit 2 and scans with no title, so a post-density
  // fail would block every dense review or reply post.
  const post = !sectionsChecked && isPost(resolved.body)
  const density = sectionsChecked
    ? bodyDensity(resolved.body)
    : post
      ? postDensity(resolved.body)
      : []

  logStep(
    !sectionsChecked && !post
      ? 'Density not checked'
      : density.length === 0
        ? 'Clean'
        : 'Density finding found',
  )
  if (!sectionsChecked && !post) {
    logInfo(
      'only an ordinary pull request body or a post opening on a post heading is graded for density',
    )
  } else if (density.length === 0) {
    logInfo('every section is within its length, run, and heading limits')
  } else {
    logWarn(
      `${plural(density.length, 'density finding')} in the ${post ? 'post' : 'body'}. Regroup the section under bold labels or split the long item rather than cutting a path.`,
    )
    for (const finding of density) {
      const measured =
        finding.value === null
          ? ''
          : ` (${finding.value} over ${finding.limit})`
      logWarn(
        `line ${finding.line} in ${finding.section ?? 'the opening'}: ${finding.kind}${measured}`,
      )
    }
  }

  const banFindings = [
    ...scanBans(
      [{ number: 1, text: resolved.title, fenced: false }],
      BAN_SETS,
    ).map((finding) => ({ ...finding, where: 'title' })),
    ...scanBans(bodyLines(resolved.body), BAN_SETS).map((finding) => ({
      ...finding,
      where: 'body',
    })),
  ]
  const bannedCharacters = [
    ...new Set(banFindings.map((finding) => finding.term)),
  ]

  logStep(banFindings.length === 0 ? 'Clean' : 'Banned character found')
  if (banFindings.length === 0) {
    logInfo('no banned character outside a code span or a link')
  } else {
    logWarn(
      `${plural(banFindings.length, 'banned character')} in the title or body. Rewrite the sentence rather than swapping the character.`,
    )
    for (const finding of banFindings) {
      logWarn(`${finding.where} line ${finding.line}: ${finding.term}`)
    }
  }

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
      `${plural(titleFormatIssues.length, 'title format issue')} against claude/skills/git-pr/references/pr.md's ## Title section.`,
    )
    for (const issue of titleFormatIssues) logWarn(TITLE_FORMAT_MESSAGES[issue])
  }

  const closing =
    expected === undefined
      ? { missing: [], stray: [] }
      : checkClosing(resolved.body, expected)

  logStep(
    expected === undefined
      ? 'Closing lines not checked'
      : closing.missing.length === 0 && closing.stray.length === 0
        ? 'Clean'
        : 'Closing line issue found',
  )
  if (expected === undefined) {
    logInfo('no --closes list, so the closing lines are not graded')
  } else if (closing.missing.length === 0 && closing.stray.length === 0) {
    logInfo('the closing lines match the issues the task closes')
  } else {
    if (closing.missing.length > 0) {
      logWarn(
        `${plural(closing.missing.length, 'issue')} with no closing line. Add one \`Closes #NNN\` per issue.`,
      )
      for (const number of closing.missing) logWarn(`#${number}`)
    }
    if (closing.stray.length > 0) {
      logWarn(
        `${plural(closing.stray.length, 'closing line')} for an issue this pull request does not close. Delete each.`,
      )
      for (const number of closing.stray) logWarn(`#${number}`)
    }
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
        titleFormatIssues,
        sections: { checked: sectionsChecked, ...sections },
        density,
        bannedCharacters,
        missingClosures: closing.missing,
        strayClosures: closing.stray,
      })}\n`,
    )
  }

  return result.phaseLabels.length === 0 &&
    result.boardReferences.length === 0 &&
    result.sessionLinks.length === 0 &&
    titleFormatIssues.length === 0 &&
    sections.outside.length === 0 &&
    sections.missing.length === 0 &&
    !(sectionsChecked && density.length > 0) &&
    banFindings.length === 0 &&
    closing.missing.length === 0 &&
    closing.stray.length === 0
    ? 0
    : 2
}
