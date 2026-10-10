import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { ScenarioStop, type StageContext, scenario } from '@/sandbox/scenario'

const REPORT = 'drift-report.json'
const STALE_LIMIT = 2
const PREFERRED_DROPPED_ROOT = 'prompts'

function lines(text: string): string[] {
  return text.split('\n').filter((line) => line !== '')
}

function sortedLines(
  ctx: StageContext,
  text: string,
  args: string[],
): string[] {
  return lines(ctx.capture('sort', args, { input: text }).stdout)
}

// Every arm runs unstamped. No target on disk carries `canon/config/config.json`,
// so the git-history fallback is the path a real project takes and the stamped
// path is the rare one. An arm that stamped first would exercise the wrong branch.
function writeReport(ctx: StageContext): void {
  ctx.log.step('Running: canon sync --check . --json')
  const result = ctx.capture(
    'bun',
    [join(ctx.root, 'src', 'cli.ts'), 'sync', '--check', '.', '--json'],
    { stderr: 'inherit' },
  )
  ctx.write(REPORT, result.stdout)
  if (result.status !== 0) throw new ScenarioStop(result.status, 'exited')
  ctx.log.info(`Report written to ${REPORT}`)
}

/** A folder at a root this repository dropped, preferring the one the arm was written against. */
function pickDroppedRoot(ctx: StageContext): string {
  const listing = ctx.capture('git', [
    '-C',
    ctx.root,
    'log',
    '--all',
    '--diff-filter=D',
    '--name-only',
    '--format=',
  ]).stdout
  const roots = lines(listing)
    .filter((path) => path.includes('/'))
    .map((path) => path.split('/')[0] ?? '')
  let first = ''
  for (const candidate of sortedLines(ctx, roots.join('\n'), ['-u'])) {
    if (existsSync(join(ctx.root, candidate))) continue
    if (candidate === PREFERRED_DROPPED_ROOT) return candidate
    if (first === '') first = candidate
  }

  return first
}

/**
 * Restores one file's exact published bytes from the commit before it was
 * deleted. Content is what the attribution matches on, so a file written by
 * hand would report unattributed and an arm would assert the wrong verdict.
 */
function restoreDroppedFile(
  ctx: StageContext,
  root: string,
): string | undefined {
  const listing = ctx.capture('git', [
    '-C',
    ctx.root,
    'log',
    '--all',
    '--diff-filter=D',
    '--name-only',
    '--format=',
    '--',
    `${root}/`,
  ]).stdout
  const rel = lines(listing).find((line) => line.startsWith(`${root}/`))
  if (rel === undefined) return undefined

  const commits = ctx.capture('git', [
    '-C',
    ctx.root,
    'log',
    '--all',
    '--diff-filter=D',
    '--format=%H',
    '--',
    rel,
  ]).stdout
  const commit = lines(commits)[0]
  if (commit === undefined) return undefined

  ctx.mkdir(dirname(rel))
  const shown = ctx.capture('git', [
    '-C',
    ctx.root,
    'show',
    `${commit}^:${rel}`,
  ])
  ctx.write(rel, shown.stdout)

  return shown.status === 0 ? rel : undefined
}

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
    // Governance is the scanned domain the arms stage against. Standards
    // installs into no target, so it leaves no copy to make stale.
    SANDBOX_INJECT_GOV: 'true',
  },
  prompt: 'Which arm?',
  arms: {
    stale: (ctx) => {
      const found = ctx.read('find', [
        '.claude/rules',
        '-type',
        'f',
        '-name',
        '*.md',
      ])
      const stale: string[] = []
      for (const file of sortedLines(ctx, found, [])) {
        ctx.append(file, '# stale\n')
        stale.push(file.slice('.claude/rules/'.length))
        if (stale.length === STALE_LIMIT) break
      }

      if (stale.length === 0)
        ctx.fail(
          'Fixture staged no stale rule. The arm would assert against a clean target.',
        )

      ctx.append('CLAUDE.md', '\n')
      ctx.append('CLAUDE.md', '## Project rule the seed never shipped\n')

      writeReport(ctx)

      ctx.log.step('Scenario ready: correct layout, content behind')
      ctx.log.info('Context: the state three of six real targets sit in')
      ctx.log.info(`  Stale rules: ${stale.join(' ')}`)
      ctx.log.info('  CLAUDE.md carries a section the seed does not')
      ctx.log.info('')
      ctx.log.info(
        'Expect:  declared in fixtures/infra/drift/stale/expect.toml',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check infra:drift stale',
      )
    },
    retired: (ctx) => {
      ctx.write('.claude/TASKS.md', '# Tasks\n\nOld single-file board.\n')
      ctx.write('.claude/MEMORY.md', '# Memory\n\nOld single-file memory.\n')
      ctx.write(
        '.claude/TASKS-ARCHIVE.md',
        '# Archive\n\nSuffixed variant the stem rule does not match.\n',
      )

      writeReport(ctx)

      ctx.log.step('Scenario ready: retired artifacts present')
      ctx.log.info(
        'Context: the seed tree moved to folders and the target kept the files',
      )
      ctx.log.info('  .claude/TASKS.md and .claude/MEMORY.md are superseded')
      ctx.log.info(
        '  .claude/TASKS-ARCHIVE.md is the suffixed variant, deliberately unmatched',
      )
      ctx.log.info('')
      ctx.log.info(
        'The report names these and proposes nothing. No command moves them,',
      )
      ctx.log.info('because the content belongs to the project.')
      ctx.log.info('')
      ctx.log.info(
        'Expect:  declared in fixtures/infra/drift/retired/expect.toml',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check infra:drift retired',
      )
    },
    tooling: (ctx) => {
      writeReport(ctx)

      ctx.log.step('Scenario ready: rules installed, tooling never recorded')
      ctx.log.info(
        'Context: every target installed before the tooling record shipped',
      )
      ctx.log.info('  canon/config/config.json carries no tooling chain')
      ctx.log.info('')
      ctx.log.info(
        'The report names tooling unmeasured rather than counting zero',
      )
      ctx.log.info(
        'changes against it. A target that never installed tooling and one',
      )
      ctx.log.info(
        'whose tooling is current produce the same zero, so the count alone',
      )
      ctx.log.info('is a claim rather than the absence of one.')
      ctx.log.info('')
      ctx.log.info(
        'Expect:  declared in fixtures/infra/drift/tooling/expect.toml',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check infra:drift tooling',
      )
    },
    unclaimed: (ctx) => {
      const root = pickDroppedRoot(ctx)
      if (root === '')
        ctx.fail(
          'History records no dropped root. The arm would assert against a target holding nothing.',
        )

      const staged = restoreDroppedFile(ctx, root)
      if (staged === undefined)
        ctx.fail(
          `Could not restore a published file under ${root}/. The arm would assert the wrong verdict.`,
        )

      ctx.write(
        `${root}/project-authored.md`,
        '# Ours\n\nWritten here, never shipped by the toolkit.\n',
      )

      writeReport(ctx)

      ctx.log.step('Scenario ready: a folder the toolkit stopped shipping')
      ctx.log.info(
        'Context: the reverse of every other section, which asks only',
      )
      ctx.log.info(
        'whether the target matches what the toolkit currently ships',
      )
      ctx.log.info(`  ${root}/ holds ${staged} at its published bytes`)
      ctx.log.info(
        `  ${root}/project-authored.md is a sibling the toolkit never had`,
      )
      ctx.log.info('')
      ctx.log.info(
        'The folder is reported as dropped upstream and named with the',
      )
      ctx.log.info(
        'commit it was last published at. It counts toward no gate, because',
      )
      ctx.log.info(
        'a dropped folder and one the project wrote are the same bytes at',
      )
      ctx.log.info('the same path and only the user can tell them apart.')
      ctx.log.info('')
      ctx.log.info(
        'Expect:  declared in fixtures/infra/drift/unclaimed/expect.toml',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check infra:drift unclaimed',
      )
    },
  },
})
