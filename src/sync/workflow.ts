import { join } from 'node:path'
import {
  changedNames,
  changedPaths,
  classifyStatus,
  commitMessage,
  type DomainChange,
  type GitRunner,
  type PullRequestOpener,
  pullRequestBody,
  syncBranchName,
} from '@/sync/git'
import { domainPaths, SYNC_DOMAINS } from '@/sync/target'
import { isDirectory } from '@/targets/validate'
import {
  intro,
  logError,
  logInfo,
  logStep,
  logWarn,
  outro,
  palette,
  pipeOutput,
  select,
} from '@/cli/ui'

const PROTECTED_BRANCHES: readonly string[] = ['main', 'master']

export type WorkflowChoice = 'pr' | 'commit' | 'cancel'

export interface WorkflowDeps {
  readonly git: GitRunner
  /** Absent when `gh` is not installed, which hides the pull request option. */
  readonly pullRequests: PullRequestOpener | undefined
  readonly now: Date
  readonly nonInteractive: boolean
  /**
   * Defaults to the interactive prompt. A test injects it to reach the commit
   * and pull request branches, which `select` otherwise gates behind a TTY.
   */
  readonly choose?: (canOpenPullRequest: boolean) => Promise<WorkflowChoice>
}

/**
 * Groups the target's pending changes by the domain that produced them. Each
 * domain is read independently, so the four status calls run together.
 */
export async function collectChanges(git: GitRunner): Promise<DomainChange[]> {
  const results = await Promise.all(
    SYNC_DOMAINS.map(async (domain) => {
      const status = await git.status(domainPaths(domain))
      return { domain, status }
    }),
  )

  const changes: DomainChange[] = []

  for (const { domain, status } of results) {
    const names = changedNames(status)
    if (names.length === 0) continue

    changes.push({
      domain,
      verb: classifyStatus(status),
      names,
      paths: changedPaths(status),
    })
  }

  return changes
}

/**
 * Commits what the domain syncs wrote and optionally opens a pull request.
 *
 * This is the only toolkit code that writes to a git remote, which is why a
 * headless run refuses it outright. `select_option` resolved to its first
 * option under `CANON_NON_INTERACTIVE=1`, and the first option here was
 * `Commit and open PR` whenever `gh` was installed, so an agent following the
 * documented non-interactive path pushed a branch and opened a pull request on
 * someone's repository without being asked.
 */
export async function runGitWorkflow(
  target: string,
  deps: WorkflowDeps,
): Promise<number> {
  if (!isDirectory(join(target, '.git'))) return 0

  const changes = await collectChanges(deps.git)
  if (changes.length === 0) return 0

  const domains = changes.map((change) => change.domain)
  const message = commitMessage(domains)
  const body = pullRequestBody(changes)
  const branch = syncBranchName(deps.now)

  intro('canon sync → git')

  const [localTaken, remoteTaken] = await Promise.all([
    deps.git.branchExists(branch),
    deps.git.remoteBranchExists(branch),
  ])

  if (localTaken || remoteTaken) {
    logWarn(
      `${branch} already exists. Wait a minute or delete it, then re-run.`,
    )
    outro()
    return 0
  }

  const currentBranch = await deps.git.currentBranch()
  const onProtected =
    currentBranch === '' || PROTECTED_BRANCHES.includes(currentBranch)

  logStep('Preview')
  logInfo(`Domains: ${domains.join(', ')}`)
  logInfo(
    onProtected
      ? `Branch:  ${branch} (source: ${currentBranch || 'detached'})`
      : `Branch:  ${currentBranch} (commit only) or ${branch} (PR)`,
  )
  logInfo(`Commit:  ${message}`)

  logStep('PR body')
  pipeOutput(body)

  if (deps.nonInteractive) {
    logWarn('Refusing the git workflow in non-interactive mode.')
    logInfo(`Would commit ${domains.join(', ')} to ${branch}.`)
    logInfo('Run interactively to commit, push, and open the pull request.')
    outro()
    return 0
  }

  const opener = deps.pullRequests
  if (opener === undefined) {
    logWarn(
      'gh CLI not found — PR option unavailable. Install from https://cli.github.com',
    )
  }

  const choose = deps.choose ?? promptChoice
  const choice = await choose(opener !== undefined)

  if (choice === 'cancel') {
    logWarn('Skipped')
    outro()
    return 0
  }

  const paths = [...new Set(changes.flatMap((change) => change.paths))]

  try {
    logStep('Committing')

    if (choice === 'pr' || onProtected) await deps.git.createBranch(branch)
    await deps.git.stage(paths)
    await deps.git.commit(message)

    if (choice === 'commit' || opener === undefined) {
      return succeed(
        onProtected
          ? `Committed to ${branch}. Push and open a PR when ready.`
          : `Committed to ${currentBranch}.`,
      )
    }

    await deps.git.push(branch)

    logStep('Opening PR')
    const url = await opener.create(message, body)

    return succeed(`Synced: ${url}`)
  } catch (error) {
    logError(error instanceof Error ? error.message : String(error))
    outro()
    return 1
  }
}

function promptChoice(canOpenPullRequest: boolean): Promise<WorkflowChoice> {
  return select({
    message: 'Review changes, then?',
    options: [
      ...(canOpenPullRequest
        ? [{ value: 'pr' as const, label: 'Commit and open PR' }]
        : []),
      { value: 'commit' as const, label: 'Commit only' },
      { value: 'cancel' as const, label: 'Cancel' },
    ],
  })
}

function succeed(message: string): number {
  const { GREEN, NC } = palette(process.stderr)
  outro()
  process.stderr.write(`\n${GREEN}✓ ${message}${NC}\n`)
  return 0
}
