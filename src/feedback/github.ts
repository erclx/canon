import { execa } from 'execa'
import { gitEnv } from '@/git/env'
import { PROJECT_ROOT } from '@/project-root'
import {
  buildIssueArgs,
  failureDetail,
  type CreateIssueOptions,
  type CreateIssueResult,
} from '@/feedback/github-format'

const GH_TIMEOUT_MS = 30_000

export async function createGithubIssue(
  opts: CreateIssueOptions,
): Promise<CreateIssueResult> {
  if (Bun.which('gh') === null) return { ok: false, reason: 'missing-binary' }
  try {
    // See src/worktrees/reclaim.ts for why gh needs the stripped environment.
    const result = await execa('gh', buildIssueArgs(opts), {
      cwd: PROJECT_ROOT,
      timeout: GH_TIMEOUT_MS,
      env: gitEnv(),
      extendEnv: false,
    })
    const url = result.stdout.trim()
    if (url) return { ok: true, url }
    return {
      ok: false,
      reason: 'command-failed',
      detail: 'gh exited zero and printed no issue URL',
    }
  } catch (error) {
    return { ok: false, reason: 'command-failed', detail: failureDetail(error) }
  }
}
