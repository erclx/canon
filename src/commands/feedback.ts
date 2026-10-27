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
  postIssueComment,
  readFeedbackIssue,
} from '@/feedback/github'
import {
  commentFailureMessage,
  issueFailureMessage,
} from '@/feedback/github-format'
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

  const read = await readFeedbackIssue(issue)
  if (!read.ok) {
    frameError(commentFailureMessage(read, issue))
    process.stdout.write(`${body}\n`)
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
    // A cached plugin still pipes `--github`, and commander rejects an unknown
    // option, so the flag stays accepted and hidden for one release.
    .addOption(new Option('--github').hideHelp())
    .action(async (opts: { on?: string }) => {
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

      // A report missing its surface is no more useful in the tracker than
      // anywhere else, so validation runs before any `gh` call.
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
      // The block goes to stdout so the session can paste it where the issue
      // would have gone, and the reason frames on stderr.
      frameError(issueFailureMessage(result))
      process.stdout.write(`${body}\n`)
      process.exitCode = 1
    })
}
