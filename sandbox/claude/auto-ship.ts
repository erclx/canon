import { type StageContext, scenario } from '@/sandbox/scenario'

/** Empties the tree the anchor staged, `.git` aside, so the arm starts clean. */
function wipeTree(ctx: StageContext): void {
  ctx.run('find', [
    '.',
    '-maxdepth',
    '1',
    '!',
    '-name',
    '.git',
    '!',
    '-name',
    '.',
    '-exec',
    'rm',
    '-rf',
    '{}',
    '+',
  ])
}

/** The `-q 2>/dev/null || true` of the bash form: a branch absent from the remote is not an error. */
function deleteRemoteBranch(ctx: StageContext, branch: string): void {
  ctx.run('git', ['push', 'origin', '--delete', branch, '-q'], {
    stderr: 'ignore',
    allowFailure: true,
  })
}

export default scenario({
  anchor: true,
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
  },
  arms: {
    'happy-path': (ctx) => {
      ctx.log.step(`Configuring autoship environment (${ctx.env.ANCHOR_REPO})`)
      ctx.anchorRemote()
      // Wipe anchor content to start clean
      wipeTree(ctx)
      ctx.write('.gitignore', 'node_modules\n.canon/plans/\n')
      ctx.fixtures('claude', 'auto-ship', 'happy-path', '01-tree')

      ctx.git('add', '.')
      ctx.git(
        'commit',
        '--allow-empty',
        '-m',
        'feat(project): initial greeting library',
        '--no-verify',
        '-q',
      )
      ctx.git('push', '--force', 'origin', 'HEAD:main')

      deleteRemoteBranch(ctx, 'feat/add-farewell')

      ctx.mkdir('.canon/plans')
      ctx.fixtures('claude', 'auto-ship', 'happy-path', '02-plan')

      ctx.log.step('Scenario ready: autoship happy path')
      ctx.log.info(
        'Context: main, with an approved plan staged for feat/add-farewell',
      )
      ctx.log.info('Action:  /auto-ship')
      ctx.log.info(
        'Expect:  implements farewell fn, verify passes, PR marked draft and read back',
      )
      ctx.log.info(
        '         Step 4 runs test-order in the worktree and reports clean, since the',
      )
      ctx.log.info(
        '         branch is taken fresh off main and carries no commit of its own yet',
      )
      ctx.log.info(
        '         Step 6 invokes git-ship rather than restating the chain, so the verify',
      )
      ctx.log.info(
        '         runs twice and the marking lands before the CI watch, reported from the read',
      )
    },
    'test-order-violation': (ctx) => {
      ctx.log.step(`Configuring autoship environment (${ctx.env.ANCHOR_REPO})`)
      ctx.anchorRemote()
      // Wipe anchor content to start clean
      wipeTree(ctx)
      ctx.write('.gitignore', 'node_modules\n.canon/plans/\n')
      // The branch has to carry the violating commits, and a worktree taken fresh
      // off the remote default would carry none of them. Branching from local HEAD
      // is what puts them in the range Step 4 reads.
      ctx.fixtures('claude', 'auto-ship', 'test-order-violation', '01-tree')

      ctx.git('add', '.')
      ctx.commit('feat(project): initial greeting library')
      ctx.git('push', '--force', 'origin', 'HEAD:main')

      // Two commits rather than one, because a subject carrying no test at all
      // reads as unclassified. A finding needs both sides in the range with the
      // test arriving second, which is the shape the check is named for.
      ctx.fixtures('claude', 'auto-ship', 'test-order-violation', '02-shout')

      ctx.git('add', 'src/shout.ts')
      ctx.commit('feat(shout): add the shout helper')

      ctx.fixtures(
        'claude',
        'auto-ship',
        'test-order-violation',
        '03-shout-test',
      )

      ctx.git('add', 'src/shout.test.ts')
      ctx.commit('test(shout): cover the shout helper')

      deleteRemoteBranch(ctx, 'feat/add-whisper')

      ctx.mkdir('.canon/plans')
      ctx.fixtures('claude', 'auto-ship', 'test-order-violation', '04-plan')

      ctx.log.step(
        'Scenario ready: autoship over a branch whose history already breaks test order',
      )
      ctx.log.info(
        'Context: local main sits two commits ahead of origin/main. src/shout.ts landed',
      )
      ctx.log.info(
        '         first and src/shout.test.ts landed after it, so the pair reads as',
      )
      ctx.log.info(
        '         implementation-first. A plan for a genuinely new whisper module is staged.',
      )
      ctx.log.info('Action:  /auto-ship')
      ctx.log.info(
        'Expect:  Step 4 reports one finding, naming src/shout.ts and the reason that the',
      )
      ctx.log.info(
        '         implementation reached history before the test covering it, then CONTINUES',
      )
      ctx.log.info(
        '         the chain reaches ship and opens a draft PR anyway, since the verb',
      )
      ctx.log.info(
        "         reports and never gates, and the commits are an earlier round's rather",
      )
      ctx.log.info("         than this run's to rewrite")
      ctx.log.info(
        '         a stopped chain or a rewritten commit is the defect this arm exists to catch',
      )
      ctx.log.info(
        "         Step 2's own whisper work is uncommitted when Step 4 runs, so it is",
      )
      ctx.log.info('         outside the range and reports nothing either way')
      ctx.log.info(
        '         a clean Step 4 here means the worktree was taken off origin/main rather',
      )
      ctx.log.info(
        '         than local HEAD, so check that .claude/settings.json baseRef took effect',
      )
      ctx.log.info(
        'Headless: run this arm with CANON_SKILL_TEST_MAX_TURNS=140, which is the value',
      )
      ctx.log.info(
        '         that reached the pull request. The runner default of 30 and a raise to',
      )
      ctx.log.info(
        '         60 both truncate inside the ship sequence, which leaves the same shape',
      )
      ctx.log.info(
        '         as the stopped chain above. What it consumes is unread rather than',
      )
      ctx.log.info(
        '         measured, since the run ended on the harness background ceiling rather',
      )
      ctx.log.info(
        '         than on the cap, so 140 is a value with margin rather than a bound.',
      )
      ctx.log.info(
        '         Tell truncation from a stop by the branch: a stop on the finding leaves',
      )
      ctx.log.info(
        '         no whisper commit at all, and a truncation leaves the commit with no',
      )
      ctx.log.info('         pull request behind it.')
      ctx.log.info(
        'Driven:  on sonnet for 1.83 dollars on 2026-09-07, reaching a draft pull request',
      )
      ctx.log.info(
        '         and stopping in the CI watch on the harness background ceiling. baseRef',
      )
      ctx.log.info(
        '         took, the branch carried both shout commits intact, Step 4 reported the',
      )
      ctx.log.info('         one finding, and whisper shipped with its test.')
    },
    'ui-continue': (ctx) => {
      ctx.log.step(`Configuring autoship environment (${ctx.env.ANCHOR_REPO})`)
      ctx.anchorRemote()
      // Wipe anchor content to start clean
      wipeTree(ctx)
      ctx.write('.gitignore', 'node_modules\n.canon/plans/\n')
      // ui-checklist writes its handoff under .canon/tmp/, which no other arm
      // reaches, so only this arm ignores it.
      ctx.append('.gitignore', '.canon/tmp/\n')

      ctx.fixtures('claude', 'auto-ship', 'ui-continue', '01-tree')

      ctx.git('add', '.')
      ctx.git(
        'commit',
        '--allow-empty',
        '-m',
        'feat(project): initial button component',
        '--no-verify',
        '-q',
      )
      ctx.git('push', '--force', 'origin', 'HEAD:main')

      deleteRemoteBranch(ctx, 'feat/roomier-button')

      ctx.mkdir('.canon/plans')
      ctx.fixtures('claude', 'auto-ship', 'ui-continue', '02-plan')

      ctx.log.step(
        'Scenario ready: autoship over a UI diff that produces a visual checklist',
      )
      ctx.log.info(
        'Context: main, with a plan staged for feat/roomier-button touching only a .tsx component',
      )
      ctx.log.info('Action:  /auto-ship')
      ctx.log.info(
        'Expect:  implements the padding and radius, verify passes, Step 5 invokes ui-checklist',
      )
      ctx.log.info(
        '         and the checklist it writes does NOT stop the chain',
      )
      ctx.log.info(
        '         the PR opens as a draft and the closing block carries a line naming the',
      )
      ctx.log.info(
        '         unchecked visual boxes, with the taste count in parentheses',
      )
      ctx.log.info(
        '         a chain that stops on the checklist with nothing committed is the defect',
      )
      ctx.log.info('         this arm exists to catch')
    },
  },
})
