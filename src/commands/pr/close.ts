import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { $ } from 'bun'
import type { Command } from 'commander'
import { gitEnv } from '@/git/env'
import { close, type CloseApi, type CloseRefusal } from '@/pr/close'
import { type RestPull } from '@/pr/rest'
import { intro, logInfo, logStep, logWarn, outro } from '@/cli/ui'
import { ReadOptions, gh, refuseWith } from '@/commands/pr/pull'

interface CloseCommandOptions extends ReadOptions {
  readonly reasonFile?: string
  readonly head?: string
  readonly keepBranch?: boolean
}

export function registerClose(pr: Command): void {
  pr.command('close')
    .description(
      'Close a pull request unmerged, posting the reason first and deleting its head branch',
    )
    .argument('<number>', 'Pull request to close')
    .helpOption('-h, --help', 'Show this help message')
    .option('--reason-file <path>', 'Closing comment to post, required')
    .option(
      '--head <branch>',
      'Head branch the pull request must carry, defaulting to the current branch',
    )
    .option('--keep-branch', 'Leave the head branch in place')
    .option('--root <path>', 'Repository to read, defaulting to the cwd')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'The reason is required, so a pull request this verb closes always says',
        'why. It is checked before anything is read: banned characters, phase',
        'labels, board references, session links, and density measured on the',
        'reason itself. A finding refuses reason-unpublishable with the findings',
        'in the record.',
        '',
        'Then the pull request is read and must be open with the head --head',
        'names. The comment posts first, then the close, then the branch',
        'delete, so a failure part way leaves a comment on an open pull request',
        'rather than a close with no reason. A failed delete never fails the',
        'close, and a head in another repository is never deleted.',
        '',
        'Record: number, commentUrl, branch (deleted, kept, fork, delete-failed),',
        'findings on a reason-unpublishable refusal',
        '',
        'Reasons:',
        '  closed',
        '  no-reason, reason-unreadable, reason-unpublishable, no-head,',
        '  gh-failed, pull-closed, head-mismatch, comment-failed, close-failed',
        '',
        'Every call is REST, never `gh pr close`, which runs on GraphQL.',
        '',
        'Exit codes:',
        '  0  closed',
        '  1  refused, with the reason in the JSON record',
        '',
        'Examples:',
        '  canon pr close 1341 --reason-file reason.md --json',
        '  canon pr close 1341 --reason-file reason.md --head feat/old --keep-branch',
        '',
      ].join('\n'),
    )
    .action(async (number: string, opts: CloseCommandOptions) => {
      process.exitCode = await runClose(number, opts)
    })
}

type CloseCommandRefusal = 'reason-unreadable' | 'no-head'

const CLOSE_REFUSALS: Record<CloseRefusal | CloseCommandRefusal, string> = {
  'no-reason':
    'No closing reason was given. Write it to a file and pass --reason-file.',
  'reason-unreadable': 'The --reason-file could not be read.',
  'reason-unpublishable':
    'The reason carries text a reader on the remote cannot use or that breaks the density limits. The findings are in the record.',
  'no-head':
    'This checkout is on no branch, so pass --head with the branch the pull request carries.',
  'gh-failed': 'gh could not read the pull request, so nothing was written.',
  'pull-closed': 'The pull request is already closed.',
  'head-mismatch':
    'The pull request carries another head branch than the one expected. Nothing was written to it.',
  'comment-failed':
    'The closing comment did not post, so the pull request was left open.',
  'close-failed':
    'The comment posted but the close was refused, so the pull request is still open. Close it by hand or re-run.',
}

function closeApi(root: string, number: string): CloseApi {
  return {
    readPull: async () => {
      const stdout = await gh(root, [
        'api',
        `repos/{owner}/{repo}/pulls/${number}`,
      ])
      if (stdout === null) return undefined
      try {
        const row = JSON.parse(stdout) as RestPull
        if (typeof row.head?.ref !== 'string') return undefined
        const headRepo = row.head.repo?.full_name
        return {
          isOpen: row.state === 'open',
          branch: row.head.ref,
          isFork:
            headRepo === undefined || headRepo !== row.base?.repo?.full_name,
        }
      } catch {
        return undefined
      }
    },
    postComment: async (body) => {
      const url = await gh(root, [
        'api',
        '-X',
        'POST',
        `repos/{owner}/{repo}/issues/${number}/comments`,
        '-f',
        `body=${body}`,
        '--jq',
        '.html_url',
      ])
      return url === null || url.trim() === '' ? undefined : url.trim()
    },
    patchClosed: async () =>
      (await gh(root, [
        'api',
        '-X',
        'PATCH',
        `repos/{owner}/{repo}/pulls/${number}`,
        '-f',
        'state=closed',
        '--silent',
      ])) !== null,
    deleteBranch: async (branch) =>
      (await gh(root, [
        'api',
        '-X',
        'DELETE',
        `repos/{owner}/{repo}/git/refs/heads/${encodeURIComponent(branch)}`,
        '--silent',
      ])) !== null,
  }
}

async function runClose(
  number: string,
  opts: CloseCommandOptions,
): Promise<number> {
  const root = resolve(opts.root ?? process.cwd())
  const emitJson = opts.json ?? false

  intro('canon pr close')

  const refuseClose = (
    reason: CloseRefusal | CloseCommandRefusal,
    extra: Record<string, unknown> = {},
  ): number =>
    refuseWith(reason, CLOSE_REFUSALS[reason], emitJson, root, {
      number: Number(number),
      ...extra,
    })

  if (opts.reasonFile === undefined) return refuseClose('no-reason')
  let reason: string
  try {
    reason = await readFile(resolve(root, opts.reasonFile), 'utf8')
  } catch {
    logWarn(`Could not read ${opts.reasonFile}`)
    return refuseClose('reason-unreadable')
  }

  let head = opts.head
  if (head === undefined) {
    const branch = await $`git -C ${root} symbolic-ref --short -q HEAD`
      .env(gitEnv())
      .quiet()
      .nothrow()
    head = branch.exitCode === 0 ? branch.text().trim() : ''
    if (head === '') return refuseClose('no-head')
  }

  const record = await close(closeApi(root, number), {
    number: Number(number),
    reason,
    head,
    isKeepBranch: opts.keepBranch ?? false,
  })

  if (!record.isOk) {
    return refuseClose(record.reason as CloseRefusal, {
      ...(record.commentUrl !== undefined && { commentUrl: record.commentUrl }),
      ...(record.findings !== undefined && { findings: record.findings }),
    })
  }

  logStep('Closed')
  logInfo(`#${record.number} closed, branch ${record.branch}`)
  if (record.branch === 'delete-failed') {
    logWarn(`The branch ${head} could not be deleted. Delete it by hand.`)
  }
  outro()

  if (emitJson) {
    process.stdout.write(`${JSON.stringify({ root, ...record })}\n`)
  }
  return 0
}
