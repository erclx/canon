import { type StageContext, scenario } from '@/sandbox/scenario'

const FIXTURE = ['claude', 'git-issue', 'duplicate'] as const

/**
 * The anchor repository is shared by every anchor scenario, so this arm files
 * and closes only issues under a label it owns.
 */
const LABEL = 'dedupe-fixture'

/** A defect no other anchor scenario files, so the search finds this issue alone. */
const TITLE = 'README names a fmt:write script package.json does not define'

function repo(ctx: StageContext): string {
  return `${ctx.env.GITHUB_ORG}/${ctx.env.ANCHOR_REPO}`
}

/** Issues outlive a run where branches are reset, so only this arm's label closes. */
function closeStaleIssues(ctx: StageContext): void {
  const open = ctx
    .read('gh', [
      'issue',
      'list',
      '--repo',
      repo(ctx),
      '--label',
      LABEL,
      '--state',
      'open',
      '--limit',
      '1000',
      '--json',
      'number',
      '--jq',
      '.[].number',
    ])
    .split('\n')
    .filter((line) => line !== '')

  for (const number of open)
    ctx.run('gh', ['issue', 'close', number, '--repo', repo(ctx)])
}

/** The remote mints the number, so it is parsed from the URL `gh issue create` prints. */
function fileIssue(ctx: StageContext, bodyFile: string): string {
  const url = ctx
    .read('gh', [
      'issue',
      'create',
      '--repo',
      repo(ctx),
      '--label',
      LABEL,
      '--title',
      TITLE,
      '--body-file',
      bodyFile,
    ])
    .trim()
  const number = /\/issues\/(\d+)$/.exec(url)?.[1]
  if (number === undefined)
    return ctx.fail(`No issue number in gh output: ${url}`)

  return number
}

/**
 * GitHub indexes a new issue for search after a delay, and the skill finds the
 * seeded issue only through search, so a run started before then files the
 * duplicate this arm exists to catch.
 */
async function waitForSearch(ctx: StageContext, number: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const found = ctx
      .read('gh', [
        'issue',
        'list',
        '--repo',
        repo(ctx),
        '--state',
        'open',
        '--search',
        'fmt:write in:title,body',
        '--json',
        'number',
        '--jq',
        '.[].number',
      ])
      .split('\n')
    if (found.includes(number)) return
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }

  ctx.fail(`Search never listed #${number}, so a run would not find it`)
}

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  anchor: true,
  arms: {
    duplicate: async (ctx) => {
      ctx.log.step(`Filing one ${LABEL} issue on ${repo(ctx)}`)

      ctx.anchorRemote()
      ctx.git('push', '--force', 'origin', 'HEAD:main')

      ctx.run('gh', [
        'label',
        'create',
        LABEL,
        '--force',
        '--repo',
        repo(ctx),
        '--description',
        'Issues the git-issue scenario files',
      ])
      closeStaleIssues(ctx)

      ctx.fixtures(...FIXTURE, '01-initial')
      ctx.git('add', '.')
      ctx.commit('feat: add the sandbox issue app')

      ctx.fixtures(...FIXTURE, '02-issue')
      const open = fileIssue(ctx, '.canon/tmp/issues/open.md')
      await waitForSearch(ctx, open)

      ctx.log.step('Scenario ready: one open issue already covers the defect')
      ctx.log.info(
        `Context: #${open} reports that the README names a fmt:write script package.json lacks`,
      )
      ctx.log.info('')
      ctx.log.info(
        'Action:  /canon:git-issue The README says to run bun run fmt:write, and package.json defines no such script.',
      )
      ctx.log.info(
        'Expect:  declared in fixtures/claude/git-issue/duplicate/expect.toml',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check claude:git-issue duplicate',
      )
      ctx.log.info(
        `         A headless run files nothing and names #${open} as a possible`,
      )
      ctx.log.info('         duplicate, and posts no comment on it.')
    },
  },
})
