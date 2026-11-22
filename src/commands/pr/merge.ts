import type { Command } from 'commander'
import { resolve } from 'node:path'
import { execa } from 'execa'
import { gitEnv } from '@/git/env'
import { fastForwardMain } from '@/git/worktree'
import {
  merge,
  type MergeApi,
  type MergeOutcome,
  type MergeRefusal,
  type MergeRequest,
} from '@/pr/merge'
import type { RestPull } from '@/pr/rest'
import { intro, logInfo, logStep, outro } from '@/cli/ui'
import {
  GH_TIMEOUT_MS,
  PULL_REFUSALS,
  ReadOptions,
  gh,
  refuseWith,
  resolvePullNumber,
} from '@/commands/pr/pull'
import { readChecksGate, warnAdvisory } from '@/commands/pr/gates'

interface MergeCommandOptions extends ReadOptions {
  readonly dryRun?: boolean
  /** Commander sets this false on `--no-pull` and true otherwise. */
  readonly pull?: boolean
}

export function registerMerge(pr: Command): void {
  pr.command('merge')
    .description(
      "Squash-merge a ready pull request with a message carrying only the change: its Summary, Key changes, and Technical context, or a bot pull request's own changelog or package table",
    )
    .argument('[number]', 'Pull request to merge, defaulting to this branch')
    .helpOption('-h, --help', 'Show this help message')
    .option('--root <path>', 'Repository to read, defaulting to the cwd')
    .option('--json', 'Add a machine-readable record on stdout')
    .option('--dry-run', 'Print the title and description and merge nothing')
    .option(
      '--no-pull',
      'Leave the main worktree where it is after the merge, rather than fast-forwarding it',
    )
    .addHelpText(
      'after',
      [
        '',
        'The operator runs this verb, or an orchestrator runs it on the',
        "operator's word for one named pull request. A deny on `gh pr merge`",
        'and the REST merge keeps an agent off the other forms. The seeded',
        'settings carry no rule on this verb, so the permission mode decides',
        'whether a call prompts.',
        '',
        'The title is the pull request title plus ` (#<number>)`. The',
        "description is the body's `## Summary`, `## Key changes`, and",
        '`## Technical context`, in that order under their headings, with the',
        'UI pass line dropped. Technical context is optional. Testing, the',
        'reviewer requests, and every other section stay out of the trunk.',
        '',
        'A release-please or Dependabot pull request is read off its head',
        'branch, plus the release body opening or a bot author, and needs no',
        'flag. A release composes to its changelog without the robot line, the',
        'dividers, and the footer. Dependabot composes to its lead and package',
        'table, cut at the first `Updates ` line or `<details>` block. A bot body with nothing left',
        'refuses missing-summary.',
        '',
        'Refusals are read before the one write, which sends the head it read',
        'as `sha`, so a push after the read refuses rather than merging. The',
        'verb reads the draft flag and not the reviews, since a ready pull',
        'request already passed `canon pr lift`. It does not wait on checks or',
        'delete the branch.',
        '',
        'After a merge lands, the verb fast-forwards the checkout at --root when',
        'it is the main worktree on the trunk, which fires the `post-merge` hook',
        'as a hand pull does, with git and hook output on stderr. The record',
        'carries `pull` as `{ outcome, reason }`, and no pull outcome changes the',
        "merge's reason or exit code. --dry-run and a refusal pull nothing.",
        '  pulled:  fast-forwarded, up-to-date',
        '  skipped: no-pull (--no-pull), linked-worktree, off-trunk, not-a-repo',
        '  refused: dirty-tree, diverged, pull-failed, with the checkout left as',
        '           it was, so pull by hand once the cause is cleared',
        '',
        "The checks gate by the ones the base branch's rules require, the way",
        '`canon pr lift` reads them. A failing check outside that set is named',
        'in the record as `advisory` and does not refuse the merge.',
        '',
        'Reasons:',
        '  merged, dry-run (--dry-run)',
        '  pull-closed, pull-draft, missing-summary, missing-key-changes,',
        '  ci-failing, ci-conflicted, ci-stalled, ci-pending, head-moved,',
        '  not-mergeable, gh-failed',
        '',
        'The merge is the REST `PUT pulls/<number>/merge` with',
        '`merge_method=squash`, never `gh pr merge`, which runs on GraphQL.',
        '',
        'Exit codes:',
        '  0  merged, or every refusal clear under --dry-run',
        '  1  refused, with the reason in the JSON record',
        '',
        'Examples:',
        '  canon pr merge 1341 --dry-run',
        '  canon pr merge 1341 --json',
        '  canon pr merge 1341 --no-pull --json',
        '',
      ].join('\n'),
    )
    .action(async (number: string | undefined, opts: MergeCommandOptions) => {
      process.exitCode = await runMerge(number, opts)
    })
}

const MERGE_REFUSALS: Record<MergeRefusal | 'gh-missing', string> = {
  'gh-missing': PULL_REFUSALS['gh-missing'],
  'pull-closed': 'The pull request is closed, so there is nothing to merge.',
  'pull-draft':
    'The pull request is a draft, so its reviews have not lifted the mark.',
  'missing-summary':
    'The body carries no `## Summary` with text under it, so the description has no change to state.',
  'missing-key-changes':
    'The body carries no `## Key changes` with text under it, so the description has no change to state.',
  'ci-failing': 'A check run on the head failed.',
  'ci-conflicted': 'The branch conflicts with its base.',
  'ci-stalled':
    'A workflow run on the head has sat queued with no job past 10 minutes. Close and reopen the pull request to start a fresh run.',
  'ci-pending':
    'A check run on the head has yet to conclude. Run the verb again once it does.',
  'head-moved':
    'The head moved after the read, so GitHub refused rather than merging unread commits.',
  'not-mergeable': 'GitHub answered that the pull request is not mergeable.',
  'gh-failed':
    'A read or the merge was refused, so nothing is reported as merged.',
}

/**
 * The REST merge, never `gh pr merge`. gh reports the status only as the `(HTTP <code>)`
 * tail of its stderr, so 409 and 405 are read off it.
 */
async function putSquashMerge(
  root: string,
  number: string,
  request: MergeRequest,
): Promise<MergeOutcome> {
  const result = await execa(
    'gh',
    [
      'api',
      '-X',
      'PUT',
      `repos/{owner}/{repo}/pulls/${number}/merge`,
      '-f',
      `commit_title=${request.title}`,
      '-f',
      `commit_message=${request.description}`,
      '-f',
      `sha=${request.sha}`,
      '-f',
      'merge_method=squash',
    ],
    {
      cwd: root,
      reject: false,
      timeout: GH_TIMEOUT_MS,
      env: gitEnv(),
      extendEnv: false,
    },
  )
  if (result.exitCode !== 0) {
    const status = /\(HTTP (\d{3})\)/.exec(String(result.stderr))?.[1]
    if (status === '409') return { kind: 'head-moved' }
    if (status === '405') return { kind: 'not-mergeable' }
    return { kind: 'failed' }
  }
  try {
    const body = JSON.parse(String(result.stdout)) as {
      merged?: unknown
      sha?: unknown
    }
    return body.merged === true && typeof body.sha === 'string'
      ? { kind: 'merged', sha: body.sha }
      : { kind: 'failed' }
  } catch {
    return { kind: 'failed' }
  }
}

function mergeApi(root: string, number: string): MergeApi {
  return {
    readPull: async () => {
      const stdout = await gh(root, [
        'api',
        `repos/{owner}/{repo}/pulls/${number}`,
      ])
      if (stdout === null) return undefined
      try {
        const row = JSON.parse(stdout) as RestPull
        if (row.head?.sha === undefined || typeof row.title !== 'string') {
          return undefined
        }
        return {
          isOpen: row.state === 'open',
          isDraft: row.draft === true,
          title: row.title,
          body: row.body ?? '',
          head: row.head.sha,
          branch: row.head.ref ?? '',
          isBotAuthor: row.user?.type === 'Bot',
        }
      } catch {
        return undefined
      }
    },
    readChecks: (head) => readChecksGate(root, number, head),
    putMerge: (request) => putSquashMerge(root, number, request),
    pullMain: () => fastForwardMain(root),
  }
}

async function runMerge(
  number: string | undefined,
  opts: MergeCommandOptions,
): Promise<number> {
  const root = resolve(opts.root ?? process.cwd())
  const emitJson = opts.json ?? false

  intro('canon pr merge')

  if (Bun.which('gh') === null) {
    return refuseWith(
      'gh-missing',
      MERGE_REFUSALS['gh-missing'],
      emitJson,
      root,
    )
  }

  const resolved = await resolvePullNumber(root, number)
  if (resolved.kind === 'refused') {
    return refuseWith(
      resolved.reason,
      PULL_REFUSALS[resolved.reason],
      emitJson,
      root,
    )
  }

  const record = await merge(mergeApi(root, resolved.number), {
    number: Number(resolved.number),
    isDryRun: opts.dryRun ?? false,
    isPull: opts.pull ?? true,
  })

  logStep(record.reason)
  logInfo(
    record.reason === 'merged'
      ? `#${record.number} squash-merged as ${record.sha?.slice(0, 8)}`
      : record.reason === 'dry-run'
        ? `#${record.number} would merge with the message below`
        : MERGE_REFUSALS[record.reason],
  )
  warnAdvisory(record.advisory)
  if (record.pull !== undefined) {
    logInfo(`main worktree ${record.pull.outcome}: ${record.pull.reason}`)
  }
  outro()

  if (emitJson) {
    process.stdout.write(`${JSON.stringify({ root, ...record })}\n`)
  } else if (record.reason === 'dry-run') {
    process.stdout.write(`${record.title}\n\n${record.description}\n`)
  }

  return record.isOk ? 0 : 1
}
