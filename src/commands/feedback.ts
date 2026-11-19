import { Option, type Command } from 'commander'
import {
  deriveDomainLabels,
  deriveTitle,
  followUpProblem,
  missingField,
  missingFieldMessage,
} from '@/feedback/body'
import {
  createGithubIssue,
  listFeedbackIssues,
  postIssueComment,
  readFeedbackIssue,
} from '@/feedback/github'
import {
  commentFailureMessage,
  issueFailureMessage,
  issueReadFailureMessage,
} from '@/feedback/github-format'
import { listFlagProblem, listRecord } from '@/feedback/list'
import { frameError, frameSuccess } from '@/cli/ui'

function readStdin(): Promise<string> {
  return new Promise((resolveStream, rejectStream) => {
    const chunks: Buffer[] = []
    process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk))
    process.stdin.on('end', () =>
      resolveStream(Buffer.concat(chunks).toString('utf8')),
    )
    process.stdin.on('error', rejectStream)
  })
}

/**
 * Triage lists open `feedback` issues only, so a comment anywhere else is
 * never read. Both checks run before the post, since a public comment cannot
 * be taken back by a later refusal.
 */
async function postFollowUp(issue: number, body: string): Promise<void> {
  const problem = followUpProblem(body)
  if (problem) {
    frameError(problem)
    process.exitCode = 1
    return
  }

  // An absent gh sends the block out for a hand paste. A failed read refuses.
  const read = await readFeedbackIssue(issue)
  if (!read.ok && read.reason === 'missing-binary') {
    frameError(commentFailureMessage(read, issue))
    process.stdout.write(`${body}\n`)
    process.exitCode = 1
    return
  }
  if (!read.ok) {
    frameError(issueReadFailureMessage(read, issue))
    process.exitCode = 1
    return
  }
  if (read.state !== 'OPEN') {
    frameError(
      `Issue #${issue} is ${read.state.toLowerCase()}, and triage reads open feedback issues only. File a new report instead.`,
    )
    process.exitCode = 1
    return
  }
  if (!read.labels.includes('feedback')) {
    frameError(
      `Issue #${issue} carries no feedback label, so it is not a toolkit feedback report. Check the number and re-run.`,
    )
    process.exitCode = 1
    return
  }

  const result = await postIssueComment(issue, body)
  if (result.ok) {
    frameSuccess('canon feedback', result.url)
    process.stdout.write(`${result.url}\n`)
    return
  }
  frameError(commentFailureMessage(result, issue))
  process.stdout.write(`${body}\n`)
  process.exitCode = 1
}

async function listOpen(json: boolean): Promise<void> {
  const record = listRecord(await listFeedbackIssues())
  if (!record.ok) {
    frameError(record.message)
    if (json) process.stdout.write(`${JSON.stringify(record)}\n`)
    process.exitCode = 1
    return
  }
  if (json) {
    process.stdout.write(`${JSON.stringify(record)}\n`)
    return
  }
  for (const issue of record.issues) {
    process.stdout.write(`#${issue.number}\t${issue.title}\n`)
  }
  frameSuccess(
    'canon feedback',
    `${record.issues.length} open feedback issue${record.issues.length === 1 ? '' : 's'}`,
  )
}

const ISSUE_NUMBER = /^[1-9]\d*$/

export function register(program: Command): void {
  program
    .command('feedback')
    .helpOption('-h, --help', 'Show this help message')
    .description(
      'Open a GitHub issue on the toolkit repo from a feedback block on stdin',
    )
    .option(
      '--on <issue>',
      'Post a follow-up block as a comment on an open feedback issue instead',
    )
    .option(
      '--list',
      'List the open feedback issues instead, reading nothing from stdin',
    )
    .option('--json', 'With --list, print the result as one JSON record')
    // Hidden and accepted, since a cached plugin still pipes `--github`.
    .addOption(new Option('--github').hideHelp())
    .action(async (opts: { on?: string; list?: boolean; json?: boolean }) => {
      const flagProblem = listFlagProblem(opts)
      if (flagProblem) {
        frameError(flagProblem)
        process.exitCode = 1
        return
      }
      if (opts.list) {
        await listOpen(opts.json ?? false)
        return
      }
      if (opts.on !== undefined && !ISSUE_NUMBER.test(opts.on)) {
        frameError(
          `--on takes an issue number, such as --on 2801, not "${opts.on}".`,
        )
        process.exitCode = 1
        return
      }
      if (process.stdin.isTTY) {
        frameError(
          'No feedback on stdin. Pipe a markdown block: pbpaste | canon feedback',
        )
        process.exitCode = 1
        return
      }
      const body = (await readStdin()).trim()
      if (!body) {
        frameError('Empty feedback body. Provide a markdown block on stdin.')
        process.exitCode = 1
        return
      }

      if (opts.on !== undefined) {
        await postFollowUp(Number(opts.on), body)
        return
      }

      // Validation runs before any `gh` call, so nothing half-formed is filed.
      const absent = missingField(body)
      if (absent) {
        frameError(missingFieldMessage(absent))
        process.exitCode = 1
        return
      }

      const result = await createGithubIssue({
        title: deriveTitle(body),
        body,
        labels: ['feedback', ...deriveDomainLabels(body)],
      })
      if (result.ok) {
        frameSuccess('canon feedback', result.url)
        process.stdout.write(`${result.url}\n`)
        return
      }
      // The block goes to stdout for a hand paste, and the reason to stderr.
      frameError(issueFailureMessage(result))
      process.stdout.write(`${body}\n`)
      process.exitCode = 1
    })
}
