import type { Command } from 'commander'
import { resolve } from 'node:path'
import { execa } from 'execa'
import { gitEnv } from '@/git/env'
import { resolveTip } from '@/pr/head'
import {
  DEFAULT_WAIT_SECONDS,
  lift,
  type LiftApi,
  type PullState,
  readBaseStanding,
  readChangedPaths,
  SETTLING_REEL_SKIPS,
} from '@/pr/lift'
import { loadPaintedPatterns } from '@/pr/painted'
import { type RestPull, reviewRowOf } from '@/pr/rest'
import { intro, logInfo, logStep, logWarn, outro } from '@/cli/ui'
import {
  GH_TIMEOUT_MS,
  PULL_REFUSALS,
  ReadOptions,
  gh,
  gitRunner,
  listReviews,
  readPull,
  refReader,
  refuseWith,
  resolvePullNumber,
} from '@/commands/pr/pull'
import {
  LIFT_REFUSALS,
  readChecksGate,
  readEvidenceGate,
  warnAdvisory,
} from '@/commands/pr/gates'

interface LiftCommandOptions extends ReadOptions {
  readonly check?: boolean
  readonly wait?: string
}

export function registerLift(pr: Command): void {
  pr.command('lift')
    .description(
      "Lift a pull request's draft mark once its reviews, evidence, standing, and CI all read clear at the head",
    )
    .argument('[number]', 'Pull request to lift, defaulting to this branch')
    .helpOption('-h, --help', 'Show this help message')
    .option('--root <path>', 'Repository to read, defaulting to the cwd')
    .option('--json', 'Add a machine-readable record on stdout')
    .option('--check', 'Report every gate and write nothing')
    .option(
      '--wait <seconds>',
      `Hold for a pending CI run up to this long, default ${DEFAULT_WAIT_SECONDS}`,
    )
    .addHelpText(
      'after',
      [
        '',
        'The verb reads the gate itself, so any session that closes a review can',
        'run it and nobody has to vouch for who is asking. Gates, in the order',
        'they are read:',
        '  review    the newest `## Review` is closed at the head, off its marker',
        '  ui        the newest `## UI review` is closed at the head, bound only',
        '            where `canon pr evidence --check` carries a checklist whose',
        '            `drivable` count is not zero, a missing count binding. An',
        '            open UI review refuses `ui-open` whatever the count. A close',
        '            on an earlier commit still holds when it is an ancestor of the',
        '            head and every path changed since is one no box can observe,',
        '            being tests, stories, snapshots, markdown in the root and in',
        '            `canon/`, `.claude/`, `.github/`, and `docs/`, evidence captures,',
        '            and `canon/design/`, and the record names it as `carriedFrom`.',
        '            Any other change refuses `ui-behind`, listing the paths as',
        '            `drivenPaths` and the painted subset as `paintedPaths`, since',
        '            a box drives behavior a `.ts` file holds too. A close whose',
        '            count line shows boxes not driven and none passed, failed,',
        '            or needing eyes refuses `ui-undriven`, carried or not',
        '  evidence  the evidence check reads settled, and every painted path',
        '            it lists as `uncaptured` is covered. A reel the marked',
        '            comment embeds at the head covers every path, and a',
        '            `- **Waived capture:** `<path>`: <reason>` line outside a code',
        '            fence covers the path it names as the list spells it. Only',
        '            the newest `## Review` and the newest `## UI review` count,',
        '            each closed by its own marker and not dismissed, so a pass',
        '            must restate a waiver for it to hold on a later head. A',
        '            review with no pass heading waives nothing. Any other path',
        '            refuses `painted-uncaptured`,',
        '            the gate entry naming what is left as `uncaptured` and what',
        '            a review waived as `waived`, each sorted. An absent list,',
        '            in a project whose base keeps no captures, passes. Last, a',
        '            checklist holding a drivable box owes a reel at the head, or',
        '            one filmed earlier that carries to it under the rule a UI',
        '            close carries by, which the gate entry names as',
        '            `reelCarriedFrom`. Otherwise a',
        '            `reelSkip` on the evidence check whose code, the text before',
        '            its first colon, is one of',
        `            ${SETTLING_REEL_SKIPS.join(', ')}`,
        '            settles it, since no builder can change those. So does a',
        '            `- **Waived reel:** <reason>` line in a',
        '            standing pass, read the way a capture waiver is. Anything',
        '            else refuses `reel-unsettled`, the gate entry naming the skip',
        '            as `reelSkip`, and a waiver that settled it as `reelWaived`',
        '  standing  the head is fresh against the base, not stale or conflicted',
        '  ci        every required check run on the tip passed, waited on up to --wait',
        '',
        "The required checks are the ones the base branch's rules list. A",
        'check outside them is waited on by nobody, and one that failed is',
        'named in the record as `advisory` without blocking. Rules that do not',
        'read, or that list no check, gate by every check run on the tip.',
        '',
        'Review state, UI state, evidence, and standing are read before the CI',
        'wait, so a reviewer whose partner is still driving refuses at once. The',
        'head and the reviews are read again before the mutation.',
        '',
        'Painted paths are what a browser renders (`.tsx`, `.jsx`, `.vue`,',
        '`.svelte`, `.astro`, `.html`, `.css`, `.scss`, `.svg`, images, fonts)',
        'minus test, spec, and story files and anything under a `fixtures`,',
        '`__fixtures__`, or `testdata` folder. A project adds to or trims the',
        'list in `canon/config/painted.json` as `{ "painted": [glob],',
        '"unpainted": [glob] }`, and its own `painted` glob paints a fixture',
        'folder the default leaves out.',
        '',
        'A pull request that is already ready has every gate read too, CI',
        'included. A review, ui, or evidence gate that reads not clear returns',
        'it to draft with reason `redrafted` and the failing reason as',
        '`failed`, exit 1. A stale standing refuses before the CI wait, and CI',
        'is waited on up to --wait as on a draft, with the head, the reviews,',
        'the standing, and the draft state read again after it. Either refuses',
        'with its own reason, exit 1, and never causes a re-draft. One drafted',
        'during the wait refuses `ready-withdrawn` and stays a draft. Every',
        'record whose pull request is still ready carries `isReady: true`.',
        'Only a ready pull request whose gates all clear, CI included,',
        'reports `already-ready`, exit 0. Under --check nothing is written, CI',
        'is read once, and the first failing reason is reported.',
        '',
        'Reasons:',
        '  lifted, already-ready, redrafted, clear (--check)',
        '  pull-closed, review-missing, review-open, review-unmarked,',
        '  review-behind, ui-missing, ui-open, ui-unmarked, ui-behind,',
        '  ui-undriven, evidence-owed, painted-uncaptured, reel-unsettled,',
        '  standing-stale, standing-conflict, standing-unknown,',
        '  ci-pending (--check), ci-failing, ci-conflicted, ci-stalled,',
        '  ci-timeout, head-moved, ready-withdrawn, gh-failed',
        '',
        'Every read is REST. The mutation is the one GraphQL call.',
        '',
        'Exit codes:',
        '  0  lifted, already-ready with CI passing, or every gate clear under',
        '     --check',
        '  1  refused, with the reason in the JSON record',
        '',
        'Examples:',
        '  canon pr lift 1341 --json',
        '  canon pr lift 1341 --check --json',
        '  canon pr lift --wait 600',
        '',
      ].join('\n'),
    )
    .action(async (number: string | undefined, opts: LiftCommandOptions) => {
      process.exitCode = await runLift(number, opts)
    })
}

const READY_MUTATION =
  'mutation($id: ID!) { markPullRequestReadyForReview(input: {pullRequestId: $id}) { pullRequest { isDraft } } }'

const CONVERT_DRAFT_MUTATION =
  'mutation($id: ID!) { convertPullRequestToDraft(input: {pullRequestId: $id}) { pullRequest { isDraft } } }'

/**
 * Runs one pull request mutation and answers whether the draft flag now reads
 * `isDraft`. The flag is read back rather than the exit trusted, since the
 * mutation can answer 200 with an errors array and no change.
 */
async function flipDraft(
  root: string,
  mutation: string,
  field: 'markPullRequestReadyForReview' | 'convertPullRequestToDraft',
  nodeId: string,
  isDraft: boolean,
): Promise<boolean> {
  const result = await execa(
    'gh',
    ['api', 'graphql', '-f', `query=${mutation}`, '-f', `id=${nodeId}`],
    {
      cwd: root,
      reject: false,
      timeout: GH_TIMEOUT_MS,
      env: gitEnv(),
      extendEnv: false,
    },
  )
  if (result.exitCode !== 0) return false
  try {
    const body = JSON.parse(String(result.stdout)) as {
      data?: Record<string, { pullRequest?: { isDraft?: boolean } } | undefined>
    }
    return body.data?.[field]?.pullRequest?.isDraft === isDraft
  } catch {
    return false
  }
}

function liftApi(root: string, number: string, baseRef: string): LiftApi {
  const git = gitRunner(root)

  return {
    readPull: async (): Promise<PullState | undefined> => {
      const stdout = await gh(root, [
        'api',
        `repos/{owner}/{repo}/pulls/${number}`,
      ])
      if (stdout === null) return undefined
      try {
        const row = JSON.parse(stdout) as RestPull
        if (row.node_id === undefined || row.head?.ref === undefined) {
          return undefined
        }
        return {
          isDraft: row.draft === true,
          isOpen: row.state === 'open',
          nodeId: row.node_id,
          branch: row.head.ref,
          head: row.head.sha ?? '',
        }
      } catch {
        return undefined
      }
    },
    readTip: async (branch) => {
      const resolved = await resolveTip(branch, refReader(root))
      return resolved.kind === 'read' ? resolved.tip : undefined
    },
    readReviews: async () => {
      const reviews = await listReviews(root, number)
      return reviews.kind === 'read' ? reviews.rows.map(reviewRowOf) : undefined
    },
    readEvidence: () => readEvidenceGate(root, number),
    readStanding: (head) =>
      readBaseStanding(git, Number(number), head, baseRef),
    readChecks: (tip) => readChecksGate(root, number, tip),
    markReady: (nodeId) =>
      flipDraft(
        root,
        READY_MUTATION,
        'markPullRequestReadyForReview',
        nodeId,
        false,
      ),
    markDraft: (nodeId) =>
      flipDraft(
        root,
        CONVERT_DRAFT_MUTATION,
        'convertPullRequestToDraft',
        nodeId,
        true,
      ),
    readChanged: (from, to) => readChangedPaths(git, from, to),
    sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
    now: () => Date.now(),
  }
}

async function runLift(
  number: string | undefined,
  opts: LiftCommandOptions,
): Promise<number> {
  const root = resolve(opts.root ?? process.cwd())
  const emitJson = opts.json ?? false

  intro('canon pr lift')

  let waitSeconds = DEFAULT_WAIT_SECONDS
  if (opts.wait !== undefined) {
    if (!/^\d+$/.test(opts.wait)) {
      return refuseWith('bad-wait', LIFT_REFUSALS['bad-wait'], emitJson, root)
    }
    waitSeconds = Number(opts.wait)
  }

  if (Bun.which('gh') === null) {
    return refuseWith('gh-missing', LIFT_REFUSALS['gh-missing'], emitJson, root)
  }

  const resolved = await resolvePullNumber(root, number)
  if (resolved.kind === 'refused') {
    return refuseWith(
      resolved.reason,
      PULL_REFUSALS[resolved.reason],
      emitJson,
      root,
    )
  }

  // Read once up front for the base the standing is measured against. The
  // injected `readPull` re-reads the object on every gate that needs it.
  const initial = await readPull(root, resolved.number)
  if (initial.kind === 'refused') {
    return refuseWith(
      initial.reason,
      PULL_REFUSALS[initial.reason],
      emitJson,
      root,
    )
  }
  const base = initial.row.base?.ref
  if (base === undefined || base === '') {
    return refuseWith('gh-failed', LIFT_REFUSALS['gh-failed'], emitJson, root)
  }

  const record = await lift(liftApi(root, resolved.number, `origin/${base}`), {
    isCheck: opts.check ?? false,
    waitSeconds,
    painted: loadPaintedPatterns(root),
  })

  logStep(record.reason)
  logInfo(
    record.reason === 'lifted'
      ? `#${resolved.number} is ready for review at ${record.head?.slice(0, 8)}`
      : record.reason === 'already-ready'
        ? `#${resolved.number} is ready and every gate reads clear, CI included`
        : record.reason === 'redrafted'
          ? `#${resolved.number} is back to draft, since ${record.failed === undefined ? 'a gate' : LIFT_REFUSALS[record.failed]}`
          : record.reason === 'clear'
            ? `every gate reads clear for #${resolved.number}`
            : LIFT_REFUSALS[record.reason],
  )
  for (const gate of record.gates) {
    if (!gate.isOk) logWarn(`${gate.gate}: ${gate.reason ?? 'not clear'}`)
  }
  warnAdvisory(record.advisory)
  outro()

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({ root, number: Number(resolved.number), ...record })}\n`,
    )
  }

  return record.isOk ? 0 : 1
}
