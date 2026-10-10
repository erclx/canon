import { Option, type Command } from 'commander'
import {
  deriveDomainLabels,
  deriveTitle,
  missingField,
  missingFieldMessage,
} from '@/feedback/body'
import { createGithubIssue } from '@/feedback/github'
import { issueFailureMessage } from '@/feedback/github-format'
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

export function register(program: Command): void {
  program
    .command('feedback')
    .helpOption('-h, --help', 'Show this help message')
    .description(
      'Open a GitHub issue on the toolkit repo from a feedback block on stdin',
    )
    // A cached plugin still pipes `--github`, and commander rejects an unknown
    // option, so the flag stays accepted and hidden for one release.
    .addOption(new Option('--github').hideHelp())
    .action(async () => {
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
