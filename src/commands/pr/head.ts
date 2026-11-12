import { join, resolve } from 'node:path'
import { $ } from 'bun'
import type { Command } from 'commander'
import { resolveHead } from '@/pr/head'
import { intro, logInfo, logStep, logWarn, outro } from '@/cli/ui'
import {
  PULL_REFUSALS,
  ReadOptions,
  readIdentity,
  refReader,
  refuseWith,
} from '@/commands/pr/pull'

export function registerHead(pr: Command): void {
  pr.command('head')
    .description(
      "Compare a pull request's reported head against the branch tip",
    )
    .argument('[number]', 'Pull request to read, defaulting to this branch')
    .helpOption('-h, --help', 'Show this help message')
    .option('--root <path>', 'Repository to read, defaulting to the cwd')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'The pull request object lags the branch ref by up to a minute after a',
        'push and reports nothing about the lag, so a session reading',
        '`headRefOid` alone calls a pushed commit unpushed. This resolves the',
        'tip from the remote with `git ls-remote` and reports which commit each',
        'source names.',
        '',
        'Refusals, read off `reason`:',
        '  ambiguous-pull    two open pull requests share the branch against',
        '                    different bases, so name a number',
        '  no-branch         the pull request carries no head branch name',
        '  unresolvable-ref  the remote read failed, which is not an absent branch',
        '  no-remote-branch  the remote carries no branch by that name, so there',
        '                    is no tip to compare against',
        '  gh-missing        `gh` is not on the path, so no pull request resolved',
        '  gh-failed         `gh` could not answer for this branch, so name a number',
        '  no-object-head    the pull request object reported no head commit',
        '',
        'Read the verdict off the record rather than off the exit. A stale head',
        'exits 0, because an operator shell profile can wrap this binary in a',
        'function whose status comes from a trailing command.',
        '',
        'Exit codes:',
        '  0  the tip resolved, whether the object agreed with it or not',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'Examples:',
        '  canon pr head',
        '  canon pr head 1341 --json',
        '',
      ].join('\n'),
    )
    .action(async (number: string | undefined, opts: ReadOptions) => {
      process.exitCode = await runHead(number, opts)
    })
}

async function runHead(
  number: string | undefined,
  opts: ReadOptions,
): Promise<number> {
  const root = resolve(opts.root ?? process.cwd())
  const emitJson = opts.json ?? false

  intro('canon pr head')

  const read = await readIdentity(root, number)
  if (read.kind === 'refused') {
    return refuseWith(read.reason, PULL_REFUSALS[read.reason], emitJson, root)
  }

  const { identity } = read
  const reading = await resolveHead(
    identity.branch,
    identity.head,
    refReader(root),
  )

  if (reading.kind === 'refused') {
    return refuseWith(
      reading.reason,
      PULL_REFUSALS[reading.reason],
      emitJson,
      root,
    )
  }

  logStep('Scope')
  logInfo(
    `${identity.number === undefined ? 'the pull request on' : `#${identity.number} on`} ${reading.branch}`,
  )

  logStep(reading.state === 'fresh' ? 'Fresh' : 'Stale')
  if (reading.state === 'fresh') {
    logInfo(
      `the object and the remote both name ${reading.tip.slice(0, 8)}, so a read keyed on either describes the same commit`,
    )
  } else {
    logWarn(
      `the remote carries ${reading.tip.slice(0, 8)} and the pull request object still reports ${reading.object.slice(0, 8)}. Key every head-sensitive read on the tip.`,
    )
  }

  outro()

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        root,
        ...(identity.number !== undefined && { number: identity.number }),
        branch: reading.branch,
        state: reading.state,
        tip: reading.tip,
        object: reading.object,
      })}\n`,
    )
  }

  return 0
}
