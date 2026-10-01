import type { Command } from 'commander'
import {
  readMergedSubjects,
  runCanon,
  runPostMerge,
  STEP_VERBS,
} from '@/hooks/post-merge'
import { mainWorktreeRoot } from '@/worktree'

interface PostMergeOptions {
  readonly root?: string
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
        'The archive runs once per pull request number the merge brought in.',
        'Lines go to stderr, and an ordinary merge prints nothing.',
        '',
        'The reclaim runs from the working directory with no root, so a pull',
        'inside a linked worktree never removes the worktree it stands in.',
        '',
        'Environment:',
        '  CANON_SKIP_RECLAIM=1        skip the worktree reclaim',
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
}
