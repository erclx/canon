import { basename, resolve } from 'node:path'
import type { Command } from 'commander'
import { resolveTip } from '@/pr/head'
import {
  findDeployWorkflow,
  mintPreview,
  type PreviewHeadReason,
  readPreviewHead,
  type PreviewRefusal,
  type PreviewRunner,
  type RunRow,
  servesChange,
} from '@/pr/preview'
import { intro, logInfo, logStep, logWarn, outro } from '@/cli/ui'
import {
  PULL_REFUSALS,
  ReadOptions,
  everyChangedPath,
  gh,
  listPullFiles,
  readIdentity,
  refReader,
  refuseWith,
} from '@/commands/pr/pull'
import { readWorkflows } from '@/commands/pr/workflows'

interface PreviewOptions extends ReadOptions {
  readonly timeout?: string
  readonly check?: boolean
}

/** How long `canon pr preview` waits on the deploy run by default, in minutes. */
const PREVIEW_TIMEOUT_MINUTES = 15

/** How often the deploy run is re-read while waiting on it. */
const PREVIEW_POLL_MS = 15_000

const PREVIEW_REFUSALS: Record<
  PreviewRefusal | 'bad-timeout' | 'check-timeout' | 'unreadable-changes',
  string
> = {
  'bad-timeout': '--timeout takes a positive number of minutes.',
  'check-timeout':
    '--check only reads the deploy runs and waits on nothing, so it takes no --timeout.',
  'no-deploy':
    'No workflow under .github/workflows/ runs pages deploy and carries a workflow_dispatch trigger, so there is nothing to dispatch.',
  unserved:
    "The deploy workflow's push path filter matches no path this pull request changed, so the site it publishes would not show the change. Nothing was dispatched.",
  // biome-ignore lint/suspicious/noTemplateCurlyInString: a workflow expression, not a template
  unfenced:
    'The deploy workflow passes no --branch=${{ github.ref_name }}, so a dispatch from this branch would publish it to production. Add the flag before asking for a preview.',
  'no-alias':
    'The deploy never printed a canon-preview-alias line, so no address could be read. Add the alias step from the cloudflare stack reference to the workflow.',
  'gh-failed':
    'gh could not list or dispatch the deploy workflow for this branch.',
  'unreadable-changes':
    'GitHub could not list what this pull request changed, so whether the deploy serves it is unknown. Nothing was dispatched.',
  'run-failed':
    'The deploy run finished without succeeding, so no preview was published. Read the run log.',
  timeout:
    'The deploy run did not finish inside the bound. The preview may still land. Re-run with a longer --timeout or read the run.',
}

/** What a reader does about each way `canon pr preview --check` answers. */
const PREVIEW_HEAD_NOTES: Record<PreviewHeadReason, string> = {
  fresh: 'The newest successful deploy built the branch tip.',
  stale:
    'The newest successful deploy built an earlier head than the branch tip. Mint again with canon pr preview before driving the preview.',
  building:
    'A deploy of the branch tip is still running. Wait for it rather than minting again.',
  'no-build':
    'No successful deploy exists for this branch. Mint one with canon pr preview.',
}

export function registerPreview(pr: Command): void {
  pr.command('preview')
    .description(
      "Deploy the pull request's branch to a Cloudflare Pages preview and report its address",
    )
    .argument('[number]', 'Pull request to read, defaulting to this branch')
    .helpOption('-h, --help', 'Show this help message')
    .option('--root <path>', 'Repository to read, defaulting to the cwd')
    .option('--json', 'Add a machine-readable record on stdout')
    .option(
      '--timeout <minutes>',
      `How long to wait on the deploy run (default ${PREVIEW_TIMEOUT_MINUTES})`,
    )
    .option(
      '--check',
      'Read whether the newest successful deploy built the branch tip, dispatching nothing',
    )
    .addHelpText(
      'after',
      [
        '',
        'Finds the workflow under .github/workflows/ that runs pages deploy with',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: a workflow expression, not a template
        '--branch=${{ github.ref_name }} and a workflow_dispatch trigger,',
        "dispatches it on the pull request's head branch, waits on that run,",
        'and reads the address from the canon-preview-alias line the workflow',
        'prints. The address is read rather than computed from the branch name,',
        'since Cloudflare flattens and may truncate a branch into its alias.',
        '',
        'A deploy without the --branch flag is refused before anything runs,',
        'because Pages publishes an unfenced deploy to production.',
        '',
        "The pull request's changed paths are then matched against the",
        "workflow's own on.push.paths or paths-ignore filter, since a dispatch",
        'ignores that filter and would publish a site showing none of the',
        'change. A workflow with neither filter serves every change.',
        '',
        'Read `reason` on the JSON record:',
        '  ok          the preview was published, with its address in `url`',
        '  no-deploy   no dispatchable workflow runs pages deploy',
        '  unserved    the push filter matches no changed path, so nothing was',
        '              dispatched, and --check answers the same',
        '  unfenced    the deploy passes no --branch, so nothing was dispatched',
        '  no-alias    the workflow prints no canon-preview-alias line',
        '  run-failed  the deploy run finished without succeeding',
        '  timeout     the run did not finish inside --timeout minutes',
        '',
        'With --check nothing is dispatched or waited on. The newest successful',
        'workflow_dispatch run is compared with the branch tip read from the remote.',
        'Read `reason` on the JSON record, with `built`, `tip`, and `runId`:',
        '  fresh       the newest successful deploy built the tip',
        '  stale       the newest successful deploy built an earlier head',
        '  building    a deploy of the tip is still running, so wait',
        '  no-build    no deploy of this branch has succeeded',
        '',
        'Refusals before either read, read off `reason`:',
        '  bad-timeout         --timeout was not a positive number',
        '  check-timeout       --check was combined with --timeout',
        '  no-branch           the pull request carries no head branch name',
        '  unreadable-changes  the changed paths of the pull request could not be read',
        '  gh-missing          `gh` is not on the path',
        '  gh-failed           `gh` could not read the pull request, or list or',
        '                      dispatch the workflow',
        '',
        'Exit codes:',
        '  0  a preview was published, or --check read fresh',
        '  1  refused, or --check read anything but fresh',
        '',
        'Examples:',
        '  canon pr preview --json',
        '  canon pr preview 1341 --json --timeout 20',
        '  canon pr preview 1341 --check --json',
        '',
      ].join('\n'),
    )
    .action(async (number: string | undefined, opts: PreviewOptions) => {
      process.exitCode = await runPreview(number, opts)
    })
}

function parseRun(stdout: string | null): RunRow | undefined {
  if (stdout === null) return undefined
  try {
    return JSON.parse(stdout) as RunRow
  } catch {
    return undefined
  }
}

/**
 * The `gh` half of a preview. `--workflow` and `gh workflow run` both take the
 * workflow's file name rather than its repository path.
 */
function ghPreviewRunner(root: string): PreviewRunner {
  return {
    async dispatch(workflow, ref) {
      const out = await gh(root, [
        'workflow',
        'run',
        basename(workflow),
        '--ref',
        ref,
      ])
      return out !== null
    },
    async listRuns(workflow, ref) {
      const out = await gh(root, [
        'run',
        'list',
        '--workflow',
        basename(workflow),
        '--branch',
        ref,
        '--event',
        'workflow_dispatch',
        '--limit',
        '20',
        '--json',
        'databaseId,status,conclusion,headSha,createdAt',
      ])
      if (out === null) return undefined
      try {
        return JSON.parse(out) as RunRow[]
      } catch {
        return undefined
      }
    },
    async viewRun(id) {
      return parseRun(
        await gh(root, [
          'run',
          'view',
          String(id),
          '--json',
          'databaseId,status,conclusion,headSha,createdAt',
        ]),
      )
    },
    async readLog(id) {
      return (await gh(root, ['run', 'view', String(id), '--log'])) ?? undefined
    },
    now: () => Date.now(),
    sleep: (ms) => Bun.sleep(ms),
  }
}

async function runPreview(
  number: string | undefined,
  opts: PreviewOptions,
): Promise<number> {
  const root = resolve(opts.root ?? process.cwd())
  const emitJson = opts.json ?? false

  intro('canon pr preview')

  if (opts.check === true && opts.timeout !== undefined) {
    return refuseWith(
      'check-timeout',
      PREVIEW_REFUSALS['check-timeout'],
      emitJson,
      root,
    )
  }

  const minutes = Number(opts.timeout ?? PREVIEW_TIMEOUT_MINUTES)
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return refuseWith(
      'bad-timeout',
      PREVIEW_REFUSALS['bad-timeout'],
      emitJson,
      root,
    )
  }

  // Read ahead of the pull request, so a project with no fenced deploy is
  // refused without a network call and never reaches a dispatch.
  const pick = findDeployWorkflow(await readWorkflows(root))
  if (pick.kind === 'refused') {
    return refuseWith(
      pick.reason,
      PREVIEW_REFUSALS[pick.reason],
      emitJson,
      root,
    )
  }

  const read = await readIdentity(root, number)
  if (read.kind === 'refused') {
    return refuseWith(read.reason, PULL_REFUSALS[read.reason], emitJson, root)
  }
  const { identity } = read

  // A dispatch ignores the workflow's own push filter, so the filter is read
  // here, ahead of both the mint and the check, rather than left to GitHub.
  const changed =
    identity.number === undefined
      ? undefined
      : await listPullFiles(root, identity.number)
  if (changed === undefined) {
    return refuseWith(
      'unreadable-changes',
      PREVIEW_REFUSALS['unreadable-changes'],
      emitJson,
      root,
    )
  }
  if (!servesChange(pick.filter, everyChangedPath(changed))) {
    return refuseWith('unserved', PREVIEW_REFUSALS.unserved, emitJson, root)
  }

  if (opts.check === true) {
    return runPreviewCheck(root, emitJson, pick.path, identity)
  }

  logStep('Deploy')
  logInfo(`${pick.path} on ${identity.branch}`)

  const result = await mintPreview(ghPreviewRunner(root), {
    workflow: pick.path,
    branch: identity.branch,
    timeoutMs: minutes * 60_000,
    pollMs: PREVIEW_POLL_MS,
  })

  if (result.kind === 'refused') {
    logStep('Refused')
    logWarn(PREVIEW_REFUSALS[result.reason])
    outro()
    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({
          root,
          ...(identity.number !== undefined && { number: identity.number }),
          reason: result.reason,
          message: PREVIEW_REFUSALS[result.reason],
          workflow: pick.path,
          ...(result.runId !== undefined && { runId: result.runId }),
        })}\n`,
      )
    }
    return 1
  }

  logStep('Preview')
  logInfo(result.url)
  outro()

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        root,
        ...(identity.number !== undefined && { number: identity.number }),
        reason: 'ok',
        url: result.url,
        workflow: pick.path,
        runId: result.runId,
      })}\n`,
    )
  }

  return 0
}

/**
 * Reads the built head against the tip. The tip comes from the remote rather
 * than `headRefOid`, which lags a push, so a build of the last head reads stale
 * the moment a newer commit lands.
 */
async function runPreviewCheck(
  root: string,
  emitJson: boolean,
  workflow: string,
  identity: { readonly branch: string; readonly number?: number },
): Promise<number> {
  const resolved = await resolveTip(identity.branch, refReader(root))
  if (resolved.kind === 'refused') {
    return refuseWith(
      resolved.reason,
      PULL_REFUSALS[resolved.reason],
      emitJson,
      root,
    )
  }

  const reading = await readPreviewHead(ghPreviewRunner(root), {
    workflow,
    branch: identity.branch,
    tip: resolved.tip,
  })
  if (reading.reason === 'gh-failed') {
    return refuseWith(
      'gh-failed',
      PREVIEW_REFUSALS['gh-failed'],
      emitJson,
      root,
    )
  }

  logStep('Preview head')
  logInfo(PREVIEW_HEAD_NOTES[reading.reason])
  outro()

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        root,
        ...(identity.number !== undefined && { number: identity.number }),
        reason: reading.reason,
        message: PREVIEW_HEAD_NOTES[reading.reason],
        workflow,
        tip: reading.tip,
        ...(reading.built !== undefined && { built: reading.built }),
        ...(reading.runId !== undefined && { runId: reading.runId }),
      })}\n`,
    )
  }
  return reading.reason === 'fresh' ? 0 : 1
}
