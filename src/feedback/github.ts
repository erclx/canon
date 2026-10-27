import { execa } from 'execa'
import { gitEnv } from '@/git/env'
import { PROJECT_ROOT } from '@/roots/project'
import {
  buildCommentArgs,
  buildIssueArgs,
  buildIssueReadArgs,
  failureDetail,
  parseIssueRead,
  type CreateIssueOptions,
  type CreateIssueResult,
  type IssueFailure,
  type IssueRead,
} from '@/feedback/github-format'

const GH_TIMEOUT_MS = 30_000

/**
 * Runs `gh` and returns its trimmed stdout, or the failure the operator reads.
 * See src/worktrees/reclaim.ts for why gh needs the stripped environment.
 */
async function runGh(
  args: string[],
): Promise<{ ok: true; stdout: string } | IssueFailure> {
  if (Bun.which('gh') === null) return { ok: false, reason: 'missing-binary' }
  try {
    const result = await execa('gh', args, {
      cwd: PROJECT_ROOT,
      timeout: GH_TIMEOUT_MS,
      env: gitEnv(),
      extendEnv: false,
    })
    return { ok: true, stdout: result.stdout.trim() }
  } catch (error) {
    return { ok: false, reason: 'command-failed', detail: failureDetail(error) }
  }
}

async function runForUrl(
  args: string[],
  emptyDetail: string,
): Promise<CreateIssueResult> {
  const result = await runGh(args)
  if (!result.ok) return result
  if (result.stdout) return { ok: true, url: result.stdout }
  return { ok: false, reason: 'command-failed', detail: emptyDetail }
}

export function createGithubIssue(
  opts: CreateIssueOptions,
): Promise<CreateIssueResult> {
  return runForUrl(
    buildIssueArgs(opts),
    'gh exited zero and printed no issue URL',
  )
}

export async function readFeedbackIssue(
  issue: number,
): Promise<IssueRead | IssueFailure> {
  const result = await runGh(buildIssueReadArgs(issue))
  if (!result.ok) return result
  return parseIssueRead(result.stdout)
}

export function postIssueComment(
  issue: number,
  body: string,
): Promise<CreateIssueResult> {
  return runForUrl(
    buildCommentArgs(issue, body),
    'gh exited zero and printed no comment URL',
  )
}
