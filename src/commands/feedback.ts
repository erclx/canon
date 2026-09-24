import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Command } from 'commander'
import {
  deriveDomainLabels,
  deriveSlug,
  deriveTitle,
  missingField,
  missingFieldMessage,
} from '@/commands/feedback-format'
import { checkoutMismatchWarning, PROJECT_ROOT } from '@/project-root'
import { creationRel } from '@/record-root'
import { createGithubIssue } from '@/github'
import { issueFailureMessage } from '@/github-format'
import { frameError, frameSuccess, logWarn, palette } from '@/ui'

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

function timestamp(): string {
  const d = new Date()
  const pad = (n: number): string => n.toString().padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

/**
 * A registry install ships no `.claude/`, so a local write would land inside
 * `node_modules/` and report a project-relative path the operator cannot find.
 * The toolkit source is the only root where local scratch reaches a maintainer.
 */
function isToolkitSource(): boolean {
  return existsSync(join(PROJECT_ROOT, '.claude'))
}

/**
 * One producer, one record folder. Feedback is not a review, so it writes
 * under a root folder of its own rather than inside `review/`, and `canon
 * records push` backs it with no list edit, since it carries every `.canon/`
 * entry it does not exclude.
 */
function writeLocal(body: string, mismatch: string | undefined): string {
  // Resolved against the same root the write joins onto. `creationRel` reads
  // whichever root already carries a `feedback/` folder and falls back to the
  // creation root when neither does.
  const relativeDir = creationRel(PROJECT_ROOT, 'feedback')
  const feedbackDir = join(PROJECT_ROOT, relativeDir)
  mkdirSync(feedbackDir, { recursive: true })
  const filename = `feedback-${deriveSlug(body)}-${timestamp()}.md`
  const filePath = join(feedbackDir, filename)
  writeFileSync(filePath, `${body}\n`, 'utf8')

  // Manual frame rather than `frameSuccess`, since the mismatch warning is a
  // frame-interior line landing between the opener and the command title,
  // matching the convention `#1587` set at its other six sites.
  const { GREEN, GREY, NC, WHITE } = palette(process.stderr)
  process.stderr.write(`${GREY}┌${NC}\n`)
  if (mismatch !== undefined) logWarn(mismatch)
  process.stderr.write(
    `${GREY}│${NC} ${WHITE}canon feedback${NC}\n${GREY}│${NC}\n${GREY}│${NC} ${GREEN}✓${NC} ${join(relativeDir, filename)}\n${GREY}└${NC}\n`,
  )
  return filePath
}

export function register(program: Command): void {
  program
    .command('feedback')
    .helpOption('-h, --help', 'Show this help message')
    .description(
      'Write toolkit feedback from stdin to .canon/feedback/, or open a GitHub issue with --github',
    )
    .option(
      '--github',
      'Open a GitHub issue on the toolkit repo instead of writing local scratch',
    )
    .action(async (opts: { github?: boolean }) => {
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

      // Both write paths, not `--github` alone. A report missing its surface is
      // no more useful sitting in the triage queue on disk than in the tracker.
      const absent = missingField(body)
      if (absent) {
        frameError(missingFieldMessage(absent))
        process.exitCode = 1
        return
      }

      if (opts.github) {
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
        const reason = issueFailureMessage(result)
        if (!isToolkitSource()) {
          frameError(reason)
          process.exitCode = 1
          return
        }
        const { NC, YELLOW } = palette(process.stderr)
        process.stderr.write(
          `${YELLOW}! ${reason} Wrote local scratch instead.${NC}\n`,
        )
      }

      if (!isToolkitSource()) {
        frameError(
          'Local scratch needs the toolkit source. Re-run with --github to open an issue instead.',
        )
        process.exitCode = 1
        return
      }

      const mismatch = checkoutMismatchWarning(process.cwd())
      const filePath = writeLocal(body, mismatch)
      process.stdout.write(`${filePath}\n`)
    })
}
