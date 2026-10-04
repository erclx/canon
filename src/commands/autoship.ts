import type { Command } from 'commander'
import {
  type ClassifyRefusal,
  type FailedTest,
  classifyChanges,
} from '@/autoship/classify'
import { intro, logInfo, logStep, logWarn, outro, plural } from '@/cli/ui'

interface ClassifyOptions {
  readonly json?: boolean
}

/** What a reader does about the one way the classification produced no reading. */
const REFUSALS: Record<ClassifyRefusal, string> = {
  'no-changes':
    'No changed files were supplied, so there is no set to classify. Pass the set the ship chain already computed.',
}

/** Why each failed test sends the branch to review, in the reader's terms. */
const TESTS: Record<FailedTest, string> = {
  extension: 'is not prose, so this branch carries a change review reads',
  'behavior-path':
    'sits under a behavior path, so its prose states what an agent does',
}

export function register(program: Command): void {
  const autoship = program
    .command('autoship')
    .description('Answer the decisions the ship chain used to make in prose')
    .helpOption('-h, --help', 'Show this help message')

  autoship
    .command('classify')
    .description('Decide whether a changed set needs the review pass')
    .argument('[paths...]', 'Changed set to classify, as names')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Reads names only and never touches git, so the caller hands over the',
        'set it already computed rather than paying for a second baseline that',
        'can disagree with the first.',
        '',
        'The skip needs both tests to pass. Every name reads as prose, and no',
        'name sits under a behavior path, which is where markdown states what',
        'an agent does. One behavior file sends the whole branch to review,',
        'since documentation shipped beside a behavior change does not cancel',
        'it.',
        '',
        'An empty set refuses rather than skipping. Both tests are universally',
        'quantified, so an empty set satisfies them vacuously, and reading that',
        'as prose-only would route a branch past review for producing no output.',
        '',
        'Exit codes:',
        '  0  prose-only, so the review pass can be skipped',
        '  1  refused, with the reason on stderr or in the JSON record',
        '  2  review is needed, with the file and the test it failed named',
        '',
        'Examples:',
        '  canon autoship classify docs/index.md README.md',
        '  canon autoship classify --json .claude/skills/deploy-check/SKILL.md',
        '',
      ].join('\n'),
    )
    .action((paths: string[], opts: ClassifyOptions) => {
      process.exitCode = runClassify(paths, opts)
    })
}

function runClassify(paths: string[], opts: ClassifyOptions): number {
  const emitJson = opts.json ?? false
  const result = classifyChanges(paths)

  intro('canon autoship classify')

  // The frame renders on stderr in both modes and the record goes to stdout
  // alone, so an operator reading the terminal sees the refusal rather than a
  // command that appeared to do nothing.
  if (result.kind === 'refused') {
    logStep('Refused')
    logWarn(REFUSALS[result.reason])
    outro()

    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({
          decision: 'refused',
          reason: result.reason,
          message: REFUSALS[result.reason],
        })}\n`,
      )
    }
    return 1
  }

  logStep('Scope')
  logInfo(`${plural(paths.length, 'path')} supplied by the caller`)

  if (result.kind === 'skip') {
    logStep('Prose only')
    logInfo('every path reads as prose and none states agent behavior')
    outro()

    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({ decision: 'skip', changed: paths })}\n`,
      )
    }
    return 0
  }

  logStep('Review')
  logWarn(`${result.file} ${TESTS[result.test]}.`)
  outro()

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        decision: 'review',
        test: result.test,
        file: result.file,
        changed: paths,
      })}\n`,
    )
  }
  return 2
}
