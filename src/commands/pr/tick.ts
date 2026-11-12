import type { Command } from 'commander'
import { resolve } from 'node:path'
import {
  findEvidenceChecklist,
  findEvidenceCommentId,
  readChecklistBoxes,
} from '@/pr/evidence'
import { resolveTip } from '@/pr/head'
import { readChangedPaths } from '@/pr/lift'
import { readCarry } from '@/pr/carry'
import { coversHead, resolveUiScope } from '@/pr/review-scope'
import {
  countTicksAtHead,
  type TickRefusal,
  tickBoxes,
  type UiPassSummary,
  writeUiPassLine,
} from '@/pr/tick'
import { reviewRowOf } from '@/pr/rest'
import { intro, logInfo, logStep, logWarn, outro, plural } from '@/cli/ui'
import {
  POSITIVE_WHOLE,
  PULL_REFUSALS,
  ReadOptions,
  gh,
  gitRunner,
  listComments,
  listReviews,
  patchPullBody,
  readIdentity,
  refReader,
  refuseWith,
} from '@/commands/pr/pull'

interface TickOptions extends ReadOptions {
  readonly boxes?: string
  readonly head?: string
}

type TickReason =
  | TickRefusal
  | 'count-mismatch'
  | 'stale-head'
  | 'redrive-owed'
  | 'bad-boxes'
  | 'no-comment'
  | 'body-refused'

const TICK_REFUSALS: Record<TickReason | 'gh-failed', string> = {
  'body-refused':
    'The boxes are ticked on the evidence comment, but gh could not edit the pull request body, so its UI pass line still shows the earlier result. Re-run the tick to retry the body.',
  'stale-head':
    'The head named is not the branch tip on the remote, and the tip does not descend from it or the gap could not be read, so a tick would claim a pass on a commit that is no longer the pull request. Re-drive the checklist at the tip.',
  'redrive-owed':
    'A push since the driven head changed a path a box can observe, so the pass does not carry to the tip. Nothing was written. Re-drive the checklist at the tip rather than retrying the tick there.',
  'bad-boxes':
    '--boxes takes box numbers as a comma-separated list of positive whole numbers, such as 1,3, and --head takes the commit that was driven.',
  'count-mismatch':
    'The newest UI verdict at this head passed a different number of boxes than the ticks this call would leave at the head. Nothing was written. With fewer ticks than passed, re-run once with every box that passed. With more, a box ticked earlier at this head has since failed, which only the operator can untick.',
  'no-comment': 'No comment on this pull request carries the evidence marker.',
  'no-checklist': 'The evidence comment carries no checklist to tick.',
  'no-box':
    'A named box is past the end of the checklist. Number boxes off `canon pr evidence --json`.',
  'taste-box':
    'A named box carries (taste) among its trailing markers, which no driver passes. Nothing was written.',
  'gh-failed':
    'gh could not read or edit the marked comment on this pull request.',
}

export function registerTick(pr: Command): void {
  pr.command('tick')
    .description(
      "Tick the checklist boxes a UI pass drove, stamping each with the commit it passed at, on the pull request's evidence comment",
    )
    .argument('[number]', 'Pull request to edit, defaulting to this branch')
    .helpOption('-h, --help', 'Show this help message')
    .option('--root <path>', 'Repository to read, defaulting to the cwd')
    .option('--json', 'Add a machine-readable record on stdout')
    .requiredOption(
      '--boxes <list>',
      'Box numbers to tick, comma-separated, as `canon pr evidence --json` numbers them',
    )
    .requiredOption('--head <sha>', 'The commit the boxes were driven at')
    .addHelpText(
      'after',
      [
        '',
        'Edits the marked evidence comment in place, so a skill never',
        'hand-edits a comment body. Each named box becomes',
        '`- [x] <box> · passed at <short sha>`. Ticking a box again restamps',
        'it. A later render at another head clears a tick whose stamp names',
        'a different commit.',
        '',
        "It also keeps one marked line in the pull request body's ## Testing,",
        'such as `- [x] UI pass, 17 of 17 boxes passed at <short sha>, 1 taste',
        'box left to the operator`. The line is ticked only when every box a',
        'driver can run is ticked, counts taste boxes apart, and is the only',
        'body text this verb writes, so hand edits elsewhere survive.',
        '',
        'A --head behind the remote tip carries to the tip when every path',
        'changed since is one no box can observe, being tests, stories,',
        'snapshots, markdown in the root and in `canon/`, `.claude/`,',
        '`.github/`, and `docs/`, evidence captures, and `canon/design/`. The',
        'boxes are then stamped at the tip and the record names `carriedFrom`.',
        'Any other changed path, markdown elsewhere included, owes a re-drive.',
        '',
        'Before writing it reads the newest UI verdict. One that covers the tip,',
        'or the driven head on a carry, and carries a count line must match the',
        'ticks this call leaves at the tip, so a re-drive passes every box that',
        'passed, since a new head clears the older ticks. Any other verdict',
        'leaves the check unrun.',
        '',
        'Read `reason` on the JSON record:',
        '  ticked       the boxes were ticked and the body line written, with the',
        '               tip in `head`, `countCheck` as matched or unchecked, and',
        '               `carriedFrom` when --head was carried to the tip',
        '  count-mismatch the verdict passed a different number of boxes than',
        '               this call leaves ticked at the tip, nothing written,',
        '               `passed` and `ticked` carry the two counts. Fewer ticks',
        '               owe a re-run with every passed box, more ticks owe the',
        '               operator an untick of a box that has since failed',
        '  body-refused the comment is ticked but gh could not edit the body,',
        '               exit 1 with `commentTicked`. Re-run to retry the body.',
        '  redrive-owed a push since --head changed a path a box can observe,',
        '               nothing written, with `driven`, `head`, and `drivenPaths`',
        '  stale-head   --head is behind the tip with no readable linear gap,',
        '               as a force-push or a rebase leaves, nothing written',
        '  taste-box    a named box carries (taste), nothing written',
        '  no-box       a named number is past the checklist, nothing written',
        '  no-checklist the evidence comment carries no checklist',
        '  no-comment   no comment carries the evidence marker',
        '  bad-boxes    --boxes or --head is malformed',
        '',
        'Exit codes:',
        '  0  the boxes were ticked',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'Examples:',
        '  canon pr tick 1341 --boxes 1,2,4 --head 1a2b3c4 --json',
        '',
      ].join('\n'),
    )
    .action(async (number: string | undefined, opts: TickOptions) => {
      process.exitCode = await runTick(number, opts)
    })
}

const MIN_TICK_HEAD_LENGTH = 7

/**
 * Ticks the named boxes on the marked comment. It refuses a head the tip moved
 * past in a way a box can observe, and a taste box, before writing, so both
 * rules hold as checks rather than as prose a driver can talk itself out of.
 */
async function runTick(
  number: string | undefined,
  opts: TickOptions,
): Promise<number> {
  const root = resolve(opts.root ?? process.cwd())
  const emitJson = opts.json ?? false

  intro('canon pr tick')

  const refuseTick = (reason: TickReason | 'gh-failed'): number =>
    refuseWith(reason, TICK_REFUSALS[reason], emitJson, root)

  const numbers = (opts.boxes ?? '').split(',').map((part) => part.trim())
  const head = (opts.head ?? '').trim()
  if (
    numbers.length === 0 ||
    !numbers.every((part) => POSITIVE_WHOLE.test(part)) ||
    !/^[0-9a-f]+$/.test(head) ||
    head.length < MIN_TICK_HEAD_LENGTH
  ) {
    return refuseTick('bad-boxes')
  }

  const read = await readIdentity(root, number)
  if (read.kind === 'refused') {
    return refuseWith(read.reason, PULL_REFUSALS[read.reason], emitJson, root)
  }
  const { identity } = read
  if (identity.number === undefined) return refuseTick('gh-failed')

  const reading = await resolveTip(identity.branch, refReader(root))
  if (reading.kind === 'refused') {
    return refuseWith(
      reading.reason,
      PULL_REFUSALS[reading.reason],
      emitJson,
      root,
    )
  }
  const carry = await readCarry(
    (from, to) => readChangedPaths(gitRunner(root), from, to),
    head,
    reading.tip,
  )
  if (carry.kind === 'moved') {
    return refuseWith(
      'redrive-owed',
      TICK_REFUSALS['redrive-owed'],
      emitJson,
      root,
      { driven: head, head: reading.tip, drivenPaths: carry.drivenPaths },
    )
  }
  // A gap that could not be read refuses as a rewrite does, which is what the
  // verb answered for every moved tip before the carry.
  if (carry.kind === 'not-ancestor' || carry.kind === 'failed') {
    return refuseTick('stale-head')
  }
  const carriedFrom = carry.kind === 'carried' ? carry.carriedFrom : undefined

  const comments = await listComments(root, String(identity.number))
  if (comments === undefined) return refuseTick('gh-failed')
  const commentId = findEvidenceCommentId(comments)
  const marked = comments.find((comment) =>
    comment.url?.endsWith(`#issuecomment-${commentId}`),
  )
  if (commentId === undefined || marked === undefined) {
    return refuseTick('no-comment')
  }

  const result = tickBoxes(marked.body, numbers.map(Number), reading.tip)
  if (result.kind === 'refused') return refuseTick(result.reason)

  // Read ahead of the write so a short list refuses before it leaves the
  // comment half ticked. A verdict that covers neither the tip nor the head a
  // carry came from, carries no count line, or cannot be read leaves the check
  // unrun and says so.
  const ticked = countTicksAtHead(
    readChecklistBoxes(findEvidenceChecklist([{ body: result.body }]) ?? ''),
    reading.tip,
  )
  const reviews = await listReviews(root, String(identity.number))
  const verdict = resolveUiScope({
    reviews: reviews.kind === 'read' ? reviews.rows.map(reviewRowOf) : [],
  })
  const isCounted =
    verdict.counts !== undefined &&
    verdict.commit !== undefined &&
    (coversHead(verdict.commit, reading.tip) ||
      (carriedFrom !== undefined &&
        (coversHead(verdict.commit, carriedFrom) ||
          coversHead(carriedFrom, verdict.commit))))
  if (isCounted && verdict.counts.passed !== ticked) {
    return refuseWith(
      'count-mismatch',
      TICK_REFUSALS['count-mismatch'],
      emitJson,
      root,
      { passed: verdict.counts.passed, ticked },
    )
  }
  const countCheck = isCounted ? 'matched' : 'unchecked'

  if (result.body !== marked.body) {
    const patched = await gh(root, [
      'api',
      '-X',
      'PATCH',
      `repos/{owner}/{repo}/issues/comments/${commentId}`,
      '-f',
      `body=${result.body}`,
    ])
    if (patched === null) return refuseTick('gh-failed')
  }

  const boxes = readChecklistBoxes(
    findEvidenceChecklist([{ body: result.body }]) ?? '',
  )
  const driven = boxes.filter((box) => !box.isTaste)
  const summary: UiPassSummary = {
    kind: 'passed',
    passed: countTicksAtHead(boxes, reading.tip),
    total: driven.length,
    taste: boxes.length - driven.length,
    head: reading.tip,
  }
  const priorBody = identity.body ?? ''
  const nextBody = writeUiPassLine(priorBody, summary)
  if (
    nextBody !== priorBody &&
    !(await patchPullBody(root, identity.number, nextBody))
  ) {
    logStep('Partly ticked')
    logWarn(TICK_REFUSALS['body-refused'])
    outro()
    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({
          root,
          number: identity.number,
          reason: 'body-refused',
          message: TICK_REFUSALS['body-refused'],
          commentTicked: true,
          countCheck,
          head: reading.tip,
          boxes: numbers.map(Number),
          commentId,
        })}\n`,
      )
    }
    return 1
  }

  logStep('Ticked')
  logInfo(
    `${plural(numbers.length, 'box')} at ${reading.tip.slice(0, 7)} on comment ${commentId}, UI pass line on the body`,
  )
  outro()
  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        root,
        number: identity.number,
        reason: 'ticked',
        countCheck,
        head: reading.tip,
        ...(carriedFrom !== undefined && { carriedFrom }),
        boxes: numbers.map(Number),
        commentId,
      })}\n`,
    )
  }
  return 0
}
