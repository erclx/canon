import type { Command } from 'commander'
import { existsSync, readFileSync } from 'node:fs'
import { findMissingReplyLinks, formatMissing } from '@/hooks/reply-links'
import {
  readMergedSubjects,
  runCanon,
  runPostMerge,
  STEP_VERBS,
} from '@/hooks/post-merge'
import { mainWorktreeRoot } from '@/git/worktree'

interface PostMergeOptions {
  readonly root?: string
}

interface ReplyLinksOptions {
  readonly root?: string
  readonly json?: boolean
}

export function register(program: Command): void {
  const hooks = program
    .command('hooks')
    .description('Run the steps a git hook drives')
    .helpOption('-h, --help', 'Show this help message')

  hooks
    .command('post-merge')
    .description('Run the post-merge steps in order and report each in a line')
    .helpOption('-h, --help', 'Show this help message')
    .option(
      '--root <path>',
      'Main worktree root holding the board and the records',
    )
    .addHelpText(
      'after',
      [
        '',
        'Runs these steps in order, each a child call reading its --json record:',
        ...Object.values(STEP_VERBS).map((verb) => `  canon ${verb.join(' ')}`),
        '',
        'The archive and the member retirement run once per pull request',
        'number the merge brought in. Lines go to stderr, and an ordinary merge',
        'prints nothing.',
        '',
        'The member retirement and the reclaim run from the working directory',
        'with no root, so a pull inside a linked worktree never removes the',
        'worktree it stands in.',
        '',
        'Environment:',
        '  CANON_SKIP_RECLAIM=1        skip the member retirement and the reclaim',
        '  CANON_SKIP_UPGRADE=1        skip the CLI reinstall',
        '  CANON_SKIP_PLUGIN_UPDATE=1  skip the plugin update',
        '',
        'Exit codes:',
        '  0  always, since a hook failing aborts nothing useful',
        '',
        'Examples:',
        '  canon hooks post-merge',
        '  CANON_SKIP_UPGRADE=1 canon hooks post-merge --root "$root"',
        '',
      ].join('\n'),
    )
    .action(async (opts: PostMergeOptions) => {
      const cwd = process.cwd()
      await runPostMerge({
        root: opts.root ?? (await mainWorktreeRoot()),
        cwd,
        subjects: await readMergedSubjects(cwd),
        env: process.env,
        run: runCanon,
        write: (text) => process.stderr.write(text),
      })
      process.exitCode = 0
    })

  hooks
    .command('reply-links')
    .description(
      'Check that every markdown link in a reply on stdin names a file on disk',
    )
    .helpOption('-h, --help', 'Show this help message')
    .option(
      '--root <path>',
      'Root a relative link resolves against, default the main worktree root',
    )
    .option('--json', 'Write the findings as a record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Reads the reply from stdin and resolves each link target on disk.',
        'Placeholders, globs, URLs, anchors, and links inside code are skipped.',
        'A :42 or #L42 tail is stripped before the check.',
        '',
        'Missing paths go to stderr, and --json adds a record on stdout.',
        '',
        'Exit codes:',
        '  0  every link resolves, or the reply holds none',
        '  1  at least one link names nothing on disk, or stdin is a terminal',
        '',
        'Examples:',
        '  printf "%s" "$reply" | canon hooks reply-links',
        '  canon hooks reply-links --json < reply.md',
        '',
      ].join('\n'),
    )
    .action(async (opts: ReplyLinksOptions) => {
      if (process.stdin.isTTY) {
        process.stderr.write('Pipe the reply on stdin.\n')
        process.exitCode = 1
        return
      }

      const found = findMissingReplyLinks(
        readFileSync(0, 'utf8'),
        opts.root ?? (await mainWorktreeRoot()),
        existsSync,
      )
      if (opts.json) {
        process.stdout.write(
          `${JSON.stringify({
            message: found.length > 0 ? formatMissing(found) : undefined,
            missing: found,
            ok: found.length === 0,
          })}\n`,
        )
      }
      if (found.length > 0) process.stderr.write(`${formatMissing(found)}\n`)
      process.exitCode = found.length > 0 ? 1 : 0
    })
}
