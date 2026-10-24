import { type StageContext, scenario } from '@/sandbox/scenario'

const FIXTURE = ['claude', 'canon-feedback-triage', 'file'] as const

function repo(ctx: StageContext): string {
  return `${ctx.env.GITHUB_ORG}/${ctx.env.ANCHOR_REPO}`
}

/** Issues outlive a run where branches are reset, so only a `feedback` issue closes. */
function closeStaleFeedback(ctx: StageContext): void {
  const open = ctx
    .read('gh', [
      'issue',
      'list',
      '--repo',
      repo(ctx),
      '--label',
      'feedback',
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
function fileIssue(ctx: StageContext, title: string, bodyFile: string): string {
  const url = ctx
    .read('gh', [
      'issue',
      'create',
      '--repo',
      repo(ctx),
      '--label',
      'feedback',
      '--title',
      title,
      '--body-file',
      bodyFile,
    ])
    .trim()
  const number = /\/issues\/(\d+)$/.exec(url)?.[1]
  if (number === undefined)
    return ctx.fail(`No issue number in gh output: ${url}`)

  return number
}

function carriedTask(number: string): string {
  return `---
title: 'v01.0: Retry failed webhooks'
description: A webhook delivery that fails is dropped rather than retried
---

# v01.0: Retry failed webhooks

Issue: #${number}

A webhook delivery that fails is dropped rather than retried.

## Outcomes

- [ ] Outcome: a failed delivery retries with a backoff

> Test strategy: unit, fail the first delivery and assert a second attempt.
`
}

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  anchor: true,
  arms: {
    file: (ctx) => {
      ctx.log.step(`Filing feedback issues on ${repo(ctx)}`)

      ctx.anchorRemote()
      ctx.git('push', '--force', 'origin', 'HEAD:main')

      ctx.run('gh', [
        'label',
        'create',
        'feedback',
        '--force',
        '--repo',
        repo(ctx),
        '--description',
        'Toolkit feedback',
      ])
      closeStaleFeedback(ctx)

      ctx.fixtures(...FIXTURE, '01-initial')
      ctx.git('add', '.')
      ctx.commit('feat: add the sandbox feedback app')

      ctx.fixtures(...FIXTURE, '02-issues')
      fileIssue(
        ctx,
        'README names a start script package.json does not define',
        '.canon/tmp/issues/issue-a.md',
      )
      const carried = fileIssue(
        ctx,
        'Failed webhook deliveries are dropped',
        '.canon/tmp/issues/issue-b.md',
      )
      ctx.write(
        '.canon/tasks/v01.0-retry-failed-webhooks.md',
        carriedTask(carried),
      )

      ctx.log.step('Scenario ready: two open feedback issues to triage')
      ctx.log.info(
        'Context: the anchor holds two open feedback issues and the tree a README',
      )
      ctx.log.info('  naming a script package.json lacks')
      ctx.log.info('  Issue A is the stale README reference, a direct-fix size')
      ctx.log.info(
        `  Issue B (#${carried}) is carried by .canon/tasks/v01.0-retry-failed-webhooks.md`,
      )
      ctx.log.info('')
      ctx.log.info('Action:  /canon:canon-feedback-triage')
      ctx.log.info(
        'Expect:  declared in fixtures/claude/canon-feedback-triage/file/expect.toml',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check claude:canon-feedback-triage file',
      )
      ctx.log.info(
        '         A folder at .canon/intake/01-feedback-triage/ with one item for',
      )
      ctx.log.info(
        '         Issue A suggesting plan, Issue B named as skipped in the overview,',
      )
      ctx.log.info('         and every You: slot empty.')
    },
  },
})
