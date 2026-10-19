import { ScenarioStop, type StageContext, scenario } from '@/sandbox/scenario'

const EVIDENCE_RENDER =
  'sandbox/fixtures/claude/review-pr/evidence-mismatch/render'

const IGNORED_TREE =
  'node_modules\n.canon/plans/\n.canon/review/\n.canon/tmp/\n'

const FIRST_PASS_SHOULD_FIX = `## Review

0 critical, 1 should-fix, 0 minor. Reviewed against project docs and the board.

**\`src/tasks.ts\`**

- **should-fix**: \`handleCreate\` does not reject an empty title, so a blank task is created. Guard the title before calling \`createTask\`.

🤖 Reviewed by Claude Code`

const FIRST_PASS_MINOR = `## Review

0 critical, 0 should-fix, 1 minor. Reviewed against project docs and the board.

**\`src/tasks.ts\`**

- **minor**: \`handleCreate\` returns the created task without a status field. Nothing consumes one yet.

🤖 Reviewed by Claude Code`

const RESPONSE_ACCEPTED = `## Review response

Accepted as recorded. No status field is added, since nothing consumes one and the shape is settled by v0.1.

🤖 Addressed by Claude Code`

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

function commitAll(ctx: StageContext, subject: string, empty = false): void {
  ctx.git('add', '.')
  if (empty)
    ctx.git('commit', '--allow-empty', '-m', subject, '--no-verify', '-q')
  else ctx.commit(subject)
}

/**
 * Opens the draft pull request on `branch`, or reads the one already open
 * there. A view that fails after a create that failed stops the arm, as the
 * bash command substitution did.
 */
function openDraftPr(
  ctx: StageContext,
  title: string,
  body: string,
  branch: string,
): string {
  const created = ctx
    .read(
      'gh',
      [
        'pr',
        'create',
        '--draft',
        '--title',
        title,
        '--body',
        body,
        '--head',
        branch,
        '--base',
        'main',
      ],
      { stderr: 'ignore', allowFailure: true },
    )
    .trim()
  if (created !== '') return created

  return ctx
    .read('gh', ['pr', 'view', branch, '--json', 'url', '-q', '.url'], {
      stderr: 'ignore',
    })
    .trim()
}

/** Posts a seeded review, naming what to post by hand when `gh` refuses. */
function seedReview(
  ctx: StageContext,
  prUrl: string,
  body: string,
  failure: string,
): void {
  const status = ctx.run(
    'gh',
    ['pr', 'review', prUrl, '--comment', '--body', body],
    { stderr: 'ignore', allowFailure: true },
  )
  if (status !== 0) ctx.log.info(failure)
}

function seedComment(
  ctx: StageContext,
  prUrl: string,
  body: string,
  failure: string,
): void {
  const status = ctx.run('gh', ['pr', 'comment', prUrl, '--body', body], {
    stderr: 'ignore',
    allowFailure: true,
  })
  if (status !== 0) ctx.log.info(failure)
}

const FAIL_FIRST_PASS =
  'Could not seed the first pass. Post one manually before testing.'
const FAIL_RESPONSE =
  'Could not seed the response. Post one manually before testing.'
const FAIL_CLOSE_OUT =
  'Could not seed the close-out. Post one manually before testing.'

/** Seeds the base repo, the feature branch, and the open PR the arms review. */
function seedReviewablePr(ctx: StageContext): string {
  ctx.anchorRemote()

  wipeTree(ctx)

  ctx.write('.gitignore', IGNORED_TREE)

  ctx.fixtures('claude', 'review-pr', 'shared', '01-reviewable-tree')

  commitAll(ctx, 'feat(api): task list endpoint', true)
  ctx.git('push', '--force', 'origin', 'HEAD:main')

  deleteRemoteBranch(ctx, 'feat/create-endpoint')
  ctx.git('checkout', '-b', 'feat/create-endpoint', '-q')

  // Reviewable diff with a subtle defect: no validation, empty title accepted.
  ctx.fixtures('claude', 'review-pr', 'shared', '02-reviewable-handler')

  commitAll(ctx, 'feat(api): add create handler')
  ctx.git('push', '--force', 'origin', 'HEAD', '-q')

  return openDraftPr(
    ctx,
    'feat(api): add create handler',
    'Adds the POST /tasks handler for v0.1.',
    'feat/create-endpoint',
  )
}

/**
 * Seeds a clean diff (the handler validates the title) so the only thing this
 * pass has to report is the ## For the reviewer bullet, answered from the diff.
 */
function seedReviewerRequestPr(ctx: StageContext): string {
  ctx.anchorRemote()

  wipeTree(ctx)

  ctx.write('.gitignore', IGNORED_TREE)

  ctx.fixtures('claude', 'review-pr', 'reviewer-request', '01-tree')

  commitAll(ctx, 'feat(api): task list endpoint', true)
  ctx.git('push', '--force', 'origin', 'HEAD:main')

  deleteRemoteBranch(ctx, 'feat/reviewer-request')
  ctx.git('checkout', '-b', 'feat/reviewer-request', '-q')

  ctx.fixtures('claude', 'review-pr', 'reviewer-request', '02-handler')

  commitAll(ctx, 'feat(api): add create handler')
  ctx.git('push', '--force', 'origin', 'HEAD', '-q')

  return openDraftPr(
    ctx,
    'feat(api): add create handler',
    'Adds the POST /tasks handler for v0.1.\n\n## For the reviewer\n\n- Confirm handleCreate rejects a missing or empty title before it reaches createTask.',
    'feat/reviewer-request',
  )
}

/**
 * Seeds a diff that handles one input the plan's Review focus names and not the
 * other, so the pass has one item to confirm and one to file as a finding. The
 * plan is gitignored, so it lands after the commits rather than inside them.
 */
function seedReviewFocusPr(ctx: StageContext): string {
  ctx.anchorRemote()

  wipeTree(ctx)

  ctx.write('.gitignore', IGNORED_TREE)

  ctx.fixtures('claude', 'review-pr', 'review-focus', '01-tree')

  commitAll(ctx, 'feat(api): task list endpoint', true)
  ctx.git('push', '--force', 'origin', 'HEAD:main')

  deleteRemoteBranch(ctx, 'feat/review-focus')
  ctx.git('checkout', '-b', 'feat/review-focus', '-q')

  ctx.fixtures('claude', 'review-pr', 'review-focus', '02-handler')

  commitAll(ctx, 'feat(api): add create handler')
  ctx.git('push', '--force', 'origin', 'HEAD', '-q')

  ctx.fixtures('claude', 'review-pr', 'review-focus', '03-plan')

  return openDraftPr(
    ctx,
    'feat(api): add create handler',
    'Adds the POST /tasks handler for v0.1.',
    'feat/review-focus',
  )
}

/**
 * The trunk both evidence arms branch from: a header on a static page and the
 * project's evidence convention, one committed capture per width named for it.
 * `evidence/` is the segment `canon pr evidence` keys on, so a trunk holding one
 * is what makes a painting change without a new capture a finding rather than a
 * question. `CLAUDE.md` stays silent on the convention on purpose. A first draft
 * stated it there, and the review body from before `review-craft` caught the
 * missing capture off that sentence alone, so the arm proved nothing about
 * reading the convention from the tree.
 */
function seedHeaderTrunk(ctx: StageContext): void {
  ctx.anchorRemote()

  wipeTree(ctx)

  ctx.write('.gitignore', IGNORED_TREE)

  ctx.fixtures('claude', 'review-pr', 'shared', '03-header-tree')

  ctx.mkdir('src')
  ctx.mkdir('evidence/header')
  ctx.run('cp', [
    `${ctx.root}/${EVIDENCE_RENDER}/base/header.html`,
    `${ctx.root}/${EVIDENCE_RENDER}/base/header.css`,
    'src/',
  ])
  ctx.run('cp', [
    `${ctx.root}/${EVIDENCE_RENDER}/base/390.png`,
    `${ctx.root}/${EVIDENCE_RENDER}/base/1280.png`,
    'evidence/header/',
  ])

  commitAll(ctx, 'feat(site): header', true)
  ctx.git('push', '--force', 'origin', 'HEAD:main')
}

/**
 * A styling change carrying no capture, on a project whose trunk already keeps
 * them. Nothing is posted beyond the pull request itself.
 */
function seedMissingEvidencePr(ctx: StageContext): string {
  seedHeaderTrunk(ctx)

  deleteRemoteBranch(ctx, 'feat/header-spacing')
  ctx.git('checkout', '-b', 'feat/header-spacing', '-q')

  ctx.run('cp', [
    `${ctx.root}/${EVIDENCE_RENDER}/head/header.html`,
    `${ctx.root}/${EVIDENCE_RENDER}/head/header.css`,
    'src/',
  ])

  commitAll(ctx, 'feat(site): widen header spacing and add pricing link')
  ctx.git('push', '--force', 'origin', 'HEAD', '-q')

  return openDraftPr(
    ctx,
    'feat(site): widen header spacing and add pricing link',
    'Adds a Pricing link to the header and loosens its spacing.',
    'feat/header-spacing',
  )
}

/**
 * The same change with captures and a checklist box stating the narrow layout.
 * The narrow head capture shows the nav row running off the edge, while the
 * ticked box claims it collapses into the menu button. The comment is the one
 * the real verb renders from this checkout, which sits on the branch, so the
 * arm reads the body `git-pr` would have posted.
 */
function seedEvidenceMismatchPr(ctx: StageContext): string {
  seedHeaderTrunk(ctx)

  deleteRemoteBranch(ctx, 'feat/header-pricing')
  ctx.git('checkout', '-b', 'feat/header-pricing', '-q')

  ctx.run('cp', [
    `${ctx.root}/${EVIDENCE_RENDER}/head/header.html`,
    `${ctx.root}/${EVIDENCE_RENDER}/head/header.css`,
    'src/',
  ])
  ctx.run('cp', [
    `${ctx.root}/${EVIDENCE_RENDER}/head/390.png`,
    `${ctx.root}/${EVIDENCE_RENDER}/head/1280.png`,
    'evidence/header/',
  ])

  commitAll(ctx, 'feat(site): add pricing link to the header')
  ctx.git('push', '--force', 'origin', 'HEAD', '-q')

  const prUrl = openDraftPr(
    ctx,
    'feat(site): add pricing link to the header',
    'Adds a Pricing link to the header and loosens its spacing.',
    'feat/header-pricing',
  )

  const number = prUrl.slice(prUrl.lastIndexOf('/') + 1)
  const handoff = '.canon/tmp/handoff/ui-checklist/header-pricing.md'
  ctx.mkdir('.canon/tmp/handoff/ui-checklist')
  ctx.run('cp', [
    `${ctx.root}/sandbox/fixtures/claude/review-pr/evidence-mismatch/checklist/header-pricing.md.fixture`,
    handoff,
  ])

  const bodyFile = `.canon/tmp/pr/evidence/body-${number}.md`
  // The redirect created the file ahead of the pipeline, so it exists on a refusal too.
  ctx.write(bodyFile, '')
  const evidence = ctx.capture(
    'canon',
    ['pr', 'evidence', number, '--checklist', handoff, '--json'],
    { stderr: 'inherit' },
  )
  // The refusal reads off the record on stdout whatever the verb's exit was,
  // so a non-ok reason is named here rather than as a bare failure.
  let record: unknown
  try {
    record = JSON.parse(evidence.stdout)
  } catch {
    throw new ScenarioStop(1, 'exited')
  }
  const { reason, body } = (
    typeof record === 'object' && record !== null ? record : {}
  ) as { reason?: unknown; body?: unknown }
  if (reason !== 'ok') {
    ctx.print(`canon pr evidence: ${String(reason)}\n`, 'stderr')
    throw new ScenarioStop(1, 'exited')
  }
  if (typeof body !== 'string') throw new ScenarioStop(1, 'exited')
  ctx.write(bodyFile, body)
  if (evidence.status !== 0) throw new ScenarioStop(evidence.status, 'exited')

  ctx.run('gh', ['pr', 'comment', number, '--body-file', bodyFile], {
    stdout: 'ignore',
  })
  ctx.run('rm', ['-rf', '.canon/tmp/pr/evidence', '.canon/tmp/handoff'])

  return prUrl
}

function logConfiguring(ctx: StageContext, name: string): void {
  ctx.log.step(
    `Configuring pr-review ${name}environment (${ctx.env.ANCHOR_REPO})`,
  )
}

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
  },
  anchor: true,
  arms: {
    'first-pass': (ctx) => {
      ctx.log.step(`Configuring pr-review environment (${ctx.env.ANCHOR_REPO})`)
      seedReviewablePr(ctx)

      ctx.log.step('Scenario ready: PR review from an independent session')
      ctx.log.info(
        'Context: open draft PR on feat/create-endpoint, project docs present',
      )
      ctx.log.info('Action:  /review-pr')
      ctx.log.info(
        'Expect:  reviews the PR diff against docs, posts findings to the PR via gh pr review --comment',
      )
      ctx.log.info('         opens the comment with the ## Review heading')
      ctx.log.info(
        '         writes the body to .canon/tmp/pr/review/body-<number>-<short-sha>.md',
      )
      ctx.log.info(
        '         flags the missing title validation, does NOT merge',
      )
    },

    'close-out': (ctx) => {
      logConfiguring(ctx, 'close-out ')
      const prUrl = seedReviewablePr(ctx)

      // Seed the first pass against the pre-fix head, so its commit.oid bounds the delta.
      seedReview(ctx, prUrl, FIRST_PASS_SHOULD_FIX, FAIL_FIRST_PASS)

      // The worker's response: one commit, which is the entire delta the close-out reads.
      ctx.fixtures('claude', 'review-pr', 'shared', '04-empty-title-guard')

      commitAll(ctx, 'fix(api): reject an empty task title')
      ctx.git('push', 'origin', 'HEAD', '-q')

      ctx.log.step(
        'Scenario ready: close-out on a PR that already carries a review',
      )
      ctx.log.info(
        'Context: open PR on feat/create-endpoint with a posted ## Review and one commit since',
      )
      ctx.log.info('Action:  /review-pr')
      ctx.log.info(
        "Expect:  finds the prior review's commit via gh pr view --json reviews",
      )
      ctx.log.info(
        '         reads only fix(api) reject an empty task title, not the whole change',
      )
      ctx.log.info('         confirms the empty-title finding landed')
      ctx.log.info(
        '         posts under ## Review closed, since the delta raises no findings of its own',
      )
      ctx.log.info(
        '         names the commit and the count read in the summary line',
      )
      ctx.log.info(
        '         writes a new body file rather than overwriting the first pass, does NOT merge',
      )
    },

    'unchanged-head': (ctx) => {
      logConfiguring(ctx, 'unchanged-head ')
      const prUrl = seedReviewablePr(ctx)

      // A pass carrying a finding at any severity takes the open heading, so the
      // seed models the state a conforming minors-only pass leaves. Both headings
      // are in the family the next pass matches, so its commit.oid is still the
      // head that pass reads.
      seedReview(ctx, prUrl, FIRST_PASS_MINOR, FAIL_FIRST_PASS)

      // The worker accepts the minor as recorded, so nothing is committed and the head stays put.
      seedComment(ctx, prUrl, RESPONSE_ACCEPTED, FAIL_RESPONSE)

      ctx.log.step(
        'Scenario ready: a second pass at a head the first pass already covered',
      )
      ctx.log.info(
        'Context: open PR with a posted ## Review, a ## Review response, and no commit since',
      )
      ctx.log.info('Action:  /review-pr')
      ctx.log.info(
        "Expect:  finds the prior review's commit and sees it equal to headRefOid",
      )
      ctx.log.info(
        '         reads the ## Review response rather than a delta, which spans nothing',
      )
      ctx.log.info(
        '         names the body body-<number>-<short-sha>-r<comment-id>.md, id off the comment url',
      )
      ctx.log.info(
        '         posts under ## Review closed, treating the accepted minor as closed',
      )
      ctx.log.info(
        '         does NOT reuse the first pass name, invent a suffix, or merge',
      )
    },

    'answered-head': (ctx) => {
      logConfiguring(ctx, 'answered-head ')
      const prUrl = seedReviewablePr(ctx)

      seedReview(ctx, prUrl, FIRST_PASS_MINOR, FAIL_FIRST_PASS)

      seedComment(ctx, prUrl, RESPONSE_ACCEPTED, FAIL_RESPONSE)

      // The close-out the unchanged-head arm produces, so the newest pass post-dates
      // every response and the thread has nothing left to answer.
      seedReview(
        ctx,
        prUrl,
        '## Review closed\n\n✅ Prior findings addressed. Re-reviewed the response, no commits since the prior pass.\n\n🤖 Reviewed by Claude Code',
        FAIL_CLOSE_OUT,
      )

      ctx.log.step(
        'Scenario ready: a re-run after a close-out already answered the thread',
      )
      ctx.log.info(
        'Context: open PR whose newest pass is ## Review closed, with no response after it',
      )
      ctx.log.info('Action:  /review-pr')
      ctx.log.info(
        'Expect:  sees the prior commit equal to headRefOid and scopes responses to the prior pass',
      )
      ctx.log.info(
        '         derives nothing, since every response pre-dates the close-out',
      )
      ctx.log.info(
        '         stops in Step 2, before reading a diff or writing a body, with',
      )
      ctx.log.info(
        "         'The head is unchanged since the prior pass', posting no comment",
      )
      ctx.log.info(
        '         does NOT reuse the close-out body name, re-derive its comment id, or post a second close-out',
      )
    },

    'reviewer-request': (ctx) => {
      logConfiguring(ctx, 'reviewer-request ')
      seedReviewerRequestPr(ctx)

      ctx.log.step(
        'Scenario ready: a body carrying ## For the reviewer, no other finding',
      )
      ctx.log.info(
        'Context: open draft PR on feat/reviewer-request, one confirmable bullet, clean diff',
      )
      ctx.log.info('Action:  /review-pr')
      ctx.log.info(
        'Expect:  reads ## For the reviewer bounded to its own bullets, answers it from the diff',
      )
      ctx.log.info(
        '         folds the answer under a For the reviewer, 1 confirmed details block',
      )
      ctx.log.info(
        '         posts under ## Review closed, since the bullet is answered and nothing else is owed',
      )
      ctx.log.info(
        '         writes the body to .canon/tmp/pr/review/body-<number>-<short-sha>.md, does NOT merge',
      )
    },

    'late-finding': (ctx) => {
      logConfiguring(ctx, 'late-finding ')
      const prUrl = seedReviewablePr(ctx)

      seedReview(ctx, prUrl, FIRST_PASS_MINOR, FAIL_FIRST_PASS)

      // A finding a worker produces after the close-out rather than in answer to
      // one already on the thread, with no commit behind it. The head stays put,
      // so this is what the widened reply-family query has to reach instead of
      // refusing ahead of it.
      seedComment(
        ctx,
        prUrl,
        '## Post-review findings\n\n`handleCreate` also accepts a title of unbounded length, so nothing caps what reaches storage.\n\n🤖 Addressed by Claude Code',
        'Could not seed the late finding. Post one manually before testing.',
      )

      ctx.log.step(
        'Scenario ready: a late finding under a reply heading outside ## Review response',
      )
      ctx.log.info(
        'Context: open PR with a posted ## Review and a ## Post-review findings reply, no commit since',
      )
      ctx.log.info('Action:  /review-pr')
      ctx.log.info(
        "Expect:  finds the prior review's commit and sees it equal to headRefOid",
      )
      ctx.log.info(
        '         reads the ## Post-review findings comment rather than refusing in Step 2',
      )
      ctx.log.info(
        '         names the body body-<number>-<short-sha>-r<comment-id>.md, id off the comment url',
      )
      ctx.log.info(
        '         posts a review addressing the late finding rather than stopping with nothing to add',
      )
    },

    'repeat-close-out': (ctx) => {
      logConfiguring(ctx, 'repeat-close-out ')
      const prUrl = seedReviewablePr(ctx)

      // The first pass, against the pre-fix head, so its commit.oid bounds the delta.
      seedReview(ctx, prUrl, FIRST_PASS_SHOULD_FIX, FAIL_FIRST_PASS)

      ctx.fixtures('claude', 'review-pr', 'shared', '04-empty-title-guard')

      commitAll(ctx, 'fix(api): reject an empty task title')
      ctx.git('push', 'origin', 'HEAD', '-q')

      // The standing verdict. Posting it here rather than after the next commit is
      // what pins its commit.oid to this head, which is the state the guard reads
      // back and the field a PUT rewrite cannot move.
      const closedSha = ctx.read('git', ['rev-parse', '--short', 'HEAD']).trim()
      seedReview(
        ctx,
        prUrl,
        `## Review closed\n\n✅ Prior findings addressed. Re-reviewed ${closedSha}, 1 commit since the prior pass.\n\n🤖 Reviewed by Claude Code`,
        FAIL_CLOSE_OUT,
      )

      // The producing shape, written out. The close-out above left nothing owed,
      // the author makes a change that was their own call, and the delta reaching
      // the next pass has nothing to say by construction. A conforming pass has to
      // rewrite the standing close-out rather than post a second one beside it.
      ctx.fixtures('claude', 'review-pr', 'repeat-close-out', '01-trim-once')

      commitAll(ctx, 'refactor(api): read the trimmed title once')
      ctx.git('push', 'origin', 'HEAD', '-q')

      ctx.log.step(
        'Scenario ready: a moved head whose standing verdict is already a close-out',
      )
      ctx.log.info(
        'Context: open PR carrying ## Review, then ## Review closed, then one commit raising nothing',
      )
      ctx.log.info('Action:  /review-pr')
      ctx.log.info(
        'Expect:  sees the prior commit reach the head, so the unchanged-head stop does not fire',
      )
      ctx.log.info(
        '         reads the refactor commit alone and raises no finding on it',
      )
      ctx.log.info(
        '         reads the standing verdict as ## Review closed and rewrites that comment',
      )
      ctx.log.info(
        '         through gh api -X PUT rather than posting a second close-out beside it',
      )
      ctx.log.info(
        '         leaves the thread with one ## Review closed, does NOT merge',
      )
    },

    'marker-race': (ctx) => {
      logConfiguring(ctx, 'marker-race ')
      const prUrl = seedReviewablePr(ctx)

      // What the seeded pass read, captured before the push below. Everything
      // between these two lines is the compose window, which is the stretch the
      // real race lives in and the one nothing about GitHub's own stamps records.
      const readSha = ctx.read('git', ['rev-parse', 'HEAD']).trim()
      const readAt = `${new Date().toISOString().slice(0, 19)}Z`

      // The push that lands inside that window. It is the same fix the close-out
      // arm seeds, so what the delta raises is the pass's own call and this arm
      // asserts only that the pass reached the delta at all.
      ctx.fixtures('claude', 'review-pr', 'shared', '04-empty-title-guard')

      commitAll(ctx, 'fix(api): reject an empty task title')
      ctx.git('push', 'origin', 'HEAD', '-q')

      // Posted after that push, so GitHub stamps commit.oid with the new head
      // while the marker names the commit the pass actually read. That is the
      // race reproduced exactly rather than waited for, and it is why this arm
      // needs no timing.
      seedReview(
        ctx,
        prUrl,
        `${FIRST_PASS_SHOULD_FIX}\n<!-- review-pr: commit=${readSha} read-at=${readAt} -->`,
        'Could not seed the raced pass. Post one manually before testing.',
      )

      ctx.log.step(
        'Scenario ready: a pass whose stamp and whose marker name different commits',
      )
      ctx.log.info(
        'Context: open PR whose only review carries commit.oid at the head and a marker one commit behind',
      )
      ctx.log.info('Action:  /review-pr')
      ctx.log.info(
        'Expect:  reads the covered commit off the marker via canon pr review-state',
      )
      ctx.log.info(
        '         sees it behind the head, so the unchanged-head stop does NOT fire',
      )
      ctx.log.info(
        '         reads fix(api) reject an empty task title as the delta',
      )
      ctx.log.info(
        '         writes a body carrying its own commit= read-at= marker on the last line',
      )
      ctx.log.info(
        "         a pass reading commit.oid instead stops with 'The head is unchanged' and posts nothing",
      )
      ctx.log.info(
        'Assert:  declared in fixtures/claude/review-pr/marker-race/expect.toml',
      )
    },

    'missing-evidence': (ctx) => {
      logConfiguring(ctx, 'missing-evidence ')
      seedMissingEvidencePr(ctx)

      ctx.log.step('Scenario ready: a painting change with no capture')
      ctx.log.info(
        'Context: open draft PR on feat/header-spacing changing src/header.html and src/header.css',
      )
      ctx.log.info(
        '         the trunk keeps captures under evidence/header/, and the PR carries no evidence comment',
      )
      ctx.log.info('Action:  /review-pr')
      ctx.log.info(
        'Expect:  flags the change as shipping no screenshot, as a finding rather than a question',
      )
      ctx.log.info('         posts under ## Review, does NOT merge')
      ctx.log.info(
        'Assert:  declared in fixtures/claude/review-pr/missing-evidence/expect.toml',
      )
    },

    'evidence-mismatch': (ctx) => {
      logConfiguring(ctx, 'evidence-mismatch ')
      seedEvidenceMismatchPr(ctx)

      ctx.log.step(
        'Scenario ready: a ticked box the narrow capture contradicts',
      )
      ctx.log.info(
        'Context: open draft PR on feat/header-pricing with an ## Evidence comment from canon pr evidence',
      )
      ctx.log.info(
        '         the checklist box says the nav collapses into a Menu button below 600px',
      )
      ctx.log.info(
        '         the head capture at 390 shows the nav row running off the edge, and the box claiming',
      )
      ctx.log.info('         the collapse is ticked')
      ctx.log.info('Action:  /review-pr')
      ctx.log.info(
        'Expect:  opens the head capture through git show, files a finding quoting the ticked box',
      )
      ctx.log.info('         posts under ## Review, does NOT merge')
      ctx.log.info(
        'Assert:  declared in fixtures/claude/review-pr/evidence-mismatch/expect.toml',
      )
    },

    'review-focus': (ctx) => {
      logConfiguring(ctx, 'review-focus ')
      seedReviewFocusPr(ctx)

      ctx.log.step(
        'Scenario ready: a first pass against a plan carrying **Review focus:**',
      )
      ctx.log.info(
        'Context: open draft PR on feat/review-focus, .canon/plans/feature-review-focus.md names two inputs',
      )
      ctx.log.info('Action:  /review-pr')
      ctx.log.info(
        "Expect:  reads the plan's **Review focus:** and checks each item against the diff",
      )
      ctx.log.info(
        '         confirms the empty-title item in a folded Review focus details block, naming the guard',
      )
      ctx.log.info(
        '         files the unbounded-length item as a should-fix under src/tasks.ts',
      )
      ctx.log.info(
        '         posts under ## Review, since the should-fix is open, does NOT merge',
      )
      ctx.log.info(
        'Assert:  declared in fixtures/claude/review-pr/review-focus/expect.toml',
      )
    },
  },
})
