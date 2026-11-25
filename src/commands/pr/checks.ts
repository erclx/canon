import { resolve } from 'node:path'
import type { Command } from 'commander'
import {
  type CheckRunListing,
  collapseChecks,
  withMergeState,
} from '@/pr/checks'
import { resolveTip } from '@/pr/head'
import { readStatuses } from '@/commands/pr/gates'
import { intro, logInfo, logStep, logWarn, outro, plural } from '@/cli/ui'
import {
  PULL_REFUSALS,
  ReadOptions,
  gh,
  readIdentity,
  refReader,
  refusePull,
  refuseWith,
} from '@/commands/pr/pull'

export function registerChecks(pr: Command): void {
  pr.command('checks')
    .description(
      'Report the check runs and commit statuses belonging to the branch tip',
    )
    .argument('[number]', 'Pull request to read, defaulting to this branch')
    .helpOption('-h, --help', 'Show this help message')
    .option('--root <path>', 'Repository to read, defaulting to the cwd')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        '`gh pr checks` cannot be made sha-aware at all: its field set carries no',
        'sha, so a caller cannot learn which commit its answer describes. This',
        'resolves the tip from the remote and reads the check runs keyed on it,',
        'with the commit statuses beside them, since a deploy reports through one.',
        '',
        'Pending is reported for a tip carrying no run yet as well as for one',
        'still going, since the endpoint has answered with a non-zero count and',
        'an empty row list, and reading that as passing is the false green the',
        'sha key alone does not close.',
        '',
        'Refusals, read off `reason`:',
        '  ambiguous-pull    two open pull requests share the branch against',
        '                    different bases, so name a number',
        '  no-branch         the pull request carries no head branch name',
        '  unresolvable-ref  the remote read failed, which is not an absent branch',
        '  no-remote-branch  the remote carries no branch by that name, so there',
        '                    is no tip to compare against',
        '  runs-unreadable   the check runs or statuses for the tip could not be read,',
        '                    which is unread rather than none',
        '  gh-missing        `gh` is not on the path, so no pull request resolved',
        '  gh-failed         `gh` could not answer for this branch, so name a number',
        '  rate-limited      GitHub refused a read for a spent quota, named with',
        '                    `bucket` and `resetAt`, so wait for the reset',
        '  no-object-head    the pull request object reported no head commit',
        '  bad-input         the number named is not a positive whole number,',
        '                    refused before any call to GitHub',
        '  no-pull           no pull request carries the number named',
        '',
        'A branch conflicting with its base gets no merge ref, so no run ever',
        'starts for it and the state stays pending. The record carries',
        '`conflicted: true` beside it when `mergeStateStatus` reads DIRTY and no',
        'run belongs to the tip, and a caller stops waiting and rebases.',
        '',
        'Exit codes:',
        '  0  the runs for the tip were read, whatever they say',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'Examples:',
        '  canon pr checks',
        '  canon pr checks 1341 --json',
        '',
      ].join('\n'),
    )
    .action(async (number: string | undefined, opts: ReadOptions) => {
      process.exitCode = await runChecks(number, opts)
    })
}

async function runChecks(
  number: string | undefined,
  opts: ReadOptions,
): Promise<number> {
  const root = resolve(opts.root ?? process.cwd())
  const emitJson = opts.json ?? false

  intro('canon pr checks')

  const read = await readIdentity(root, number)
  if (read.kind === 'refused') {
    return refusePull(read, emitJson, root)
  }

  const { identity } = read
  const resolved = await resolveTip(identity.branch, refReader(root))
  if (resolved.kind === 'refused') {
    return refusePull(resolved, emitJson, root)
  }

  // Raised to the endpoint's maximum rather than paged, since a count above the rows reads pending.
  const listed = await gh(root, [
    'api',
    `repos/{owner}/{repo}/commits/${resolved.tip}/check-runs?per_page=100`,
  ])
  if (listed === null) {
    return refuseWith(
      'runs-unreadable',
      PULL_REFUSALS['runs-unreadable'],
      emitJson,
      root,
    )
  }

  let listing: CheckRunListing
  try {
    listing = JSON.parse(listed)
  } catch {
    return refuseWith(
      'runs-unreadable',
      PULL_REFUSALS['runs-unreadable'],
      emitJson,
      root,
    )
  }

  const statuses = await readStatuses(root, resolved.tip)
  if (statuses === undefined) {
    return refuseWith(
      'runs-unreadable',
      PULL_REFUSALS['runs-unreadable'],
      emitJson,
      root,
    )
  }

  const reading = withMergeState(
    identity.mergeState,
    collapseChecks(resolved.tip, listing, undefined, statuses),
  )

  logStep('Scope')
  logInfo(
    `${identity.branch} at ${reading.tip.slice(0, 8)}, ${plural(reading.matched, 'run')} and ${statuses.length} ${statuses.length === 1 ? 'status' : 'statuses'} belonging to it`,
  )
  // Named apart from the count above, since a foreign-commit run alone makes the verdict pending.
  if (reading.foreign > 0) {
    logWarn(
      `${plural(reading.foreign, 'further run')} belonging to another commit, so this listing does not describe the tip alone.`,
    )
  }
  if (reading.collapsed > 0) {
    logInfo(
      `${plural(reading.collapsed, 'run')} folded into a newer run of the same check, so the count above includes a superseded run the state did not use.`,
    )
  }

  logStep(
    reading.state === 'passing'
      ? 'Passing'
      : reading.state === 'failing'
        ? 'Failing'
        : 'Pending',
  )
  if (reading.state === 'passing') {
    logInfo('every run or status on the tip completed and none failed')
  } else if (reading.state === 'failing') {
    logWarn(
      'a run or status on the tip failed, which none still going can clear',
    )
  } else if (reading.conflicted) {
    logWarn(
      'the branch conflicts with its base, so no run will start for the tip. Rebase onto the base rather than waiting.',
    )
  } else if (reading.matched === 0) {
    logInfo(
      `no run belongs to the tip yet${reading.reported > 0 ? `, against a reported count of ${reading.reported}` : ''}. That is unread rather than clean.`,
    )
  } else {
    logInfo('a run or status on the tip has yet to conclude')
  }

  outro()

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        root,
        ...(identity.number !== undefined && { number: identity.number }),
        branch: identity.branch,
        statuses: statuses.length,
        ...reading,
      })}\n`,
    )
  }

  return 0
}
