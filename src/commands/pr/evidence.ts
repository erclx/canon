import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Command } from 'commander'
import { execa } from 'execa'
import { gitEnv } from '@/git/env'
import {
  findEvidenceCaseCount,
  findEvidenceChecklist,
  findEvidenceCommentId,
  findEvidenceHead,
  findEvidenceLocal,
  findEvidencePreview,
  findEvidenceReel,
  findEvidenceSkips,
  type EvidenceItem,
  type EvidenceReading,
  groupEvidence,
  hasMarkedEvidenceComment,
  isEvidencePath,
  PNG_HEADER_BYTES,
  readChecklistBoxes,
  countDrivable,
  type ChecklistBox,
  readOwed,
  readPngWidth,
  readUncaptured,
  nextEvidenceReel,
  renderEvidenceBody,
  settleChecklist,
} from '@/pr/evidence'
import { isWithinTolerance } from '@/pr/pixels'
import { loadPaintedPatterns } from '@/pr/painted'
import { findDeployWorkflow, servesChange } from '@/pr/preview'
import { readUiPassHead, writeUiPassLine } from '@/pr/tick'
import { intro, logInfo, logStep, logWarn, outro, plural } from '@/cli/ui'
import {
  GH_TIMEOUT_MS,
  PULL_REFUSALS,
  ReadOptions,
  everyChangedPath,
  gh,
  listComments,
  listPullFiles,
  patchPullBody,
  readIdentity,
  readRepoName,
  refuseWith,
} from '@/commands/pr/pull'
import { readWorkflows } from '@/commands/pr/workflows'

interface EvidenceOptions extends ReadOptions {
  readonly preview?: string
  /** A path to fold in, or false from `--no-checklist` to drop the carried one. */
  readonly checklist?: string | false
  readonly local?: string
  readonly reel?: string
  readonly localSkip?: string
  readonly reelSkip?: string
  readonly check?: boolean
}

/**
 * Why `canon pr evidence` produced no comment body, past the ones
 * `readIdentity` already owns (`gh-missing`, `gh-failed`, `no-branch`) and the
 * one `identity.head` owns (`no-object-head`).
 */
type EvidenceRefusal =
  | 'check-writes'
  | 'gh-failed'
  | 'no-base'
  | 'unreadable-changes'
  | 'unreadable-checklist'
  | 'would-empty'

const EVIDENCE_REFUSALS: Record<EvidenceRefusal, string> = {
  'check-writes':
    '--check is a read and renders no body, so it takes none of --preview, --local, --checklist, --no-checklist, --reel, --local-skip, or --reel-skip. Run the check and the render as two calls.',
  'gh-failed':
    'gh could not answer for this repository. Name the pull request number.',
  'unreadable-checklist':
    'The file named by --checklist could not be read, or holds nothing. Rendering without it would drop the only copy, since the caller deletes the handoff once a post reports success.',
  'no-base':
    'GitHub reported no merge base for this pull request, so no path could be judged added or changed.',
  'unreadable-changes':
    'GitHub could not list what this pull request changed, so the set is unknown.',
  'would-empty':
    'This render holds no cases and the marked comment holds some, so posting it would replace a comparison with an empty one. Edit the comment by hand if every case was removed on purpose.',
}

export function registerEvidence(pr: Command): void {
  pr.command('evidence')
    .description(
      "Render a before/after comparison for the pull request's changed evidence images",
    )
    .argument('[number]', 'Pull request to read, defaulting to this branch')
    .helpOption('-h, --help', 'Show this help message')
    .option('--root <path>', 'Repository to read, defaulting to the cwd')
    .option('--json', 'Add a machine-readable record on stdout')
    .option(
      '--preview <url>',
      'Put this preview address on the line under the heading, from canon pr preview',
    )
    .option(
      '--checklist <path>',
      'Close the body with this visual checklist file, from canon:ui-checklist',
    )
    .option(
      '--no-checklist',
      'Drop the checklist the marked comment carries, rendering the body without it',
    )
    .option(
      '--local <url>',
      "Add this worktree's running server to the address line, from canon pr local",
    )
    .option(
      '--reel <link>',
      'Embed this reel under the address line, filmed at the head, from canon pr frames --reel',
    )
    .option(
      '--local-skip <reason>',
      'Name why no local address is posted, from the reason pr-evidence holds for canon pr local',
    )
    .option(
      '--reel-skip <reason>',
      'Name why no reel is embedded, from the reason pr-evidence holds for canon pr frames --reel',
    )
    .option(
      '--check',
      'Report which post-pull-request steps the thread is still owed, rendering nothing',
    )
    .addHelpText(
      'after',
      [
        '',
        "Compares the pull request's merge base against its head, both read over",
        'the API for the number named, so the record is the same from any',
        'checkout. It never compares the previous push against the new one, so',
        'the comment never claims more than the pull request currently shows.',
        'A path counts as evidence when one of its segments is literally',
        '`evidence` and the filename carries an image extension (png, jpg,',
        'jpeg, gif, webp, avif, svg). A README, a capture',
        'script, or a raw data file kept beside the images is left out rather',
        'than rendered as a broken embed.',
        '',
        'Read `reason` on the JSON record before posting anything:',
        '  ok           a body was rendered, with `commentId` set when a marked',
        '               comment already exists and should be edited in place',
        '  no-evidence  nothing in the diff carries an evidence/ segment and no',
        '               painted path is uncaptured, which is an ordinary,',
        '               silent no-op rather than a refusal',
        '  would-empty  the render holds no cases and the marked comment holds',
        '               some, so no body is printed and a person edits the comment',
        '',
        'Every body opens with `## Evidence`, then one address line joining',
        'the hosted and local previews with " · ", carrying whichever apply,',
        'then the Base and Head line when there are screenshots.',
        '',
        'Each case shows its head image at the comment width under a bold',
        'label, with its base folded beneath in a <details> block, and an',
        'added case shows its head alone. Every state opens while the comment',
        'carries at most six head images and closes past that.',
        '',
        'Each modified PNG is compared with its base pixel by pixel. A case',
        'whose densest 16px square holds 6 or fewer differing pixels moves to',
        'one closed "Within tolerance" block after the states, still named and',
        'embedded, and stops counting toward the six. Its item on the record',
        'carries `withinTolerance`, which is absent for an added case, a',
        'format other than PNG, or a pair with a failed read. None of those',
        'folds, and neither does a pair that differs in size or will not decode.',
        '',
        '--preview puts the hosted address on that line. With no evidence in',
        'the diff, the body is the heading, that line, and the marker alone,',
        'reported as ok, so the preview still lands in one comment a later',
        'call can edit. Without --preview, an address the marked comment',
        'already carries is carried into the new body, so a re-render after a',
        'push keeps it, unless a deploy workflow resolves and its push path',
        'filter matches no path the pull request changed, in which case the',
        'carried hosted address is dropped. An explicit --preview is always',
        'kept. The address region above the comparison is read for each',
        'prefix wherever it sits, so a comment that opens on the addresses',
        'still carries them forward.',
        '',
        '--checklist closes the body with a visual checklist, below the',
        'comparison it annotates. A checklist the marked comment already',
        'carries is read back and carried forward the same way the preview',
        'address is. A tick survives only a render at the head it names: one',
        'stamped `passed at <sha>` for another head is cleared and unstamped,',
        'and so is one carrying no stamp when the comment described another',
        'head. A checklist, supplied or carried, turns no-evidence into ok: a',
        'branch with a checklist and no evidence image renders a marked body',
        'holding the checklist, so a later call finds and edits that comment.',
        '',
        '--no-checklist drops the checklist the marked comment carries, so the',
        'body renders without it and the record reports no checklist fields.',
        'A marked comment holding a checklist still renders as ok rather than',
        'no-evidence, so the comment is edited rather than left showing it.',
        'Of --checklist and --no-checklist, the last one passed wins.',
        '',
        '--local adds a **Local preview:** segment after any hosted one on the',
        'address line, or carries the line alone, and is carried forward the',
        'same way. It does not by itself turn no-evidence into ok, so a',
        'branch with a server running and nothing to show posts no link-only',
        'comment. Together with --checklist the link and the checklist land in',
        'one comment.',
        '',
        '--reel embeds an animated reel on its own line under the addresses,',
        'labeled with the head this render describes as the one it was filmed',
        'at. Without --reel, a reel the marked comment already embeds is carried',
        'forward under the head it names, so a stale reel never reads as',
        'current, and a passed one replaces it. Like --local it rides on a',
        'checklist or a comparison and never opens a comment alone.',
        '',
        '--local-skip and --reel-skip each put one line under the addresses,',
        '**No local preview:** or **No reel:** followed by the text passed, a',
        'reason code and any one-line message joined to it, folded onto one',
        'line. Without the flag, a skip line the marked comment already carries',
        'is carried forward. The local skip line is dropped whenever its',
        'address renders, passed or carried. The reel skip line is dropped only',
        'by a reel filmed at this head, so it stays beside a reel carried from',
        'an earlier head. A passed --local-skip drops a carried',
        'local address, since that line names no head and would read as live,',
        'while a carried reel names its head and stays beside --reel-skip. Like',
        '--local, neither opens a comment alone.',
        '',
        "A render at a new head also resets the pull request body's UI pass",
        'line, the one `canon pr tick` writes under ## Testing, to unchecked',
        'naming that head. It touches no other body text, leaves a line already',
        'naming this head alone, and reports `uiPass` as reset or reset-refused.',
        '',
        'Both reasons carry what the marked comment already posted, each field',
        'present only when that comment holds it:',
        '  preview    the hosted **Preview:** address the comment carries',
        '  local      the **Local preview:** address beside it',
        '  reel       the embedded reel, as `link` and the `head` it was filmed at',
        '  checklist  the checklist between its delimiters, ticks included',
        '  boxes      each checklist box with its number, tick, stamp, and taste',
        '             mark, the numbering `canon pr tick` takes',
        '  drivable   how many boxes a driver can run, every box but one whose',
        '             trailing markers hold (taste), in any order. Zero binds no',
        '             UI review, so `canon pr lift` and `review-state` leave the',
        '             UI family unbound',
        'These come from the comment already posted, never from the flags this',
        'call passed. A checklist the caller posted raw after a refused render',
        'carries no marker, so the record reports none of these for it. An',
        'unread thread refuses as gh-failed on both reasons rather than',
        'reporting the fields absent.',
        '',
        'The ok, no-evidence, and --check records carry `uncaptured`, the',
        'painted paths the pull request changed while no evidence image did, in',
        "a project whose base branch's tree holds one. Painted is the set",
        '`canon/config/painted.json` tunes, minus any path under an evidence/',
        'segment or canon/design/, and any changed evidence image empties the',
        'list. A path the pull request deletes is left out, and a deleted',
        'evidence image empties nothing, since a deletion captures nothing.',
        'The field is absent when the base tree holds no capture or could',
        'not be read, a cut-short listing showing none included, so absent means',
        'unchecked rather than clean. It never adds to `owed`, since no step of',
        'the ship chain can take a capture.',
        '',
        'A rendered body carries the list as an **Uncaptured:** line under the',
        'addresses, each path in a code span. A non-empty list opens a comment',
        'the way a checklist does, so a head whose only news is an uncaptured',
        'path reports ok rather than no-evidence. The line is computed on every',
        'render and never carried, so it drops once a capture empties the list',
        'or a reel filmed at the head renders beside it. `canon pr lift`',
        'refuses `painted-uncaptured` on the same list.',
        '',
        '--check reads the same changed set and thread, renders no body, and',
        'reports what the ship chain still owes the pull request:',
        '  settled  nothing is owed',
        '  owed     `owed` lists evidence, preview, or both, in that order',
        'evidence is owed when an evidence image changed and no comment carries',
        'the marker. preview is owed when either holds, a deploy workflow in',
        'this checkout resolves, its push path filter matches a path the pull',
        'request changed, and the marked comment carries no **Preview:**',
        'address. A failed deploy reads the same as a skipped one.',
        'The record carries `owed` and the same marked fields, plus',
        '`reelSkip`, the text after **No reel:** on the marked comment, present',
        'only when that line is posted. `canon pr lift` reads its reason code,',
        'the text before the first colon, to decide whether a drivable',
        'checklist with no reel at the head is settled. --check refuses',
        'with --preview, --local, --checklist, --no-checklist, --reel,',
        '--local-skip, or --reel-skip as check-writes.',
        '',
        'Refusals, read off `reason`:',
        '  unreadable-checklist  --checklist named a path that could not be read,',
        '                        or one holding nothing',
        '  no-branch             the pull request carries no head branch name',
        '  no-base               GitHub reported no merge base for the pull request',
        '  unreadable-changes    GitHub could not list what the pull request changed',
        '  gh-missing            `gh` is not on the path',
        '  gh-failed             `gh` could not read or edit the pull request or its',
        '                        comments',
        '  no-object-head        the pull request object reported no head commit',
        '',
        'Exit codes:',
        '  0  read, whether it produced a body, reported no-evidence, or checked',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'Examples:',
        '  canon pr evidence --json',
        '  canon pr evidence 1341 --json',
        '  canon pr evidence 1341 --preview https://feat-x.site.pages.dev --json',
        '  canon pr evidence 1341 --checklist .canon/tmp/handoff/ui-checklist/x.md --json',
        '  canon pr evidence 1341 --local http://localhost:5173 --json',
        '  canon pr evidence 1341 --reel <link from canon pr frames --reel> --json',
        "  canon pr evidence 1341 --reel-skip 'no-server: <message>' --json",
        '  canon pr evidence 1341 --check --json',
        '',
      ].join('\n'),
    )
    .action(async (number: string | undefined, opts: EvidenceOptions) => {
      process.exitCode = await runEvidence(number, opts)
    })
}

/**
 * Whether the base branch's tree holds an evidence image, read recursively
 * over the API so the answer is the same from any checkout. GitHub cuts a
 * large listing short, and a cut listing proves captures only when one
 * arrived before the cut, so it reads as unread otherwise. Undefined on any
 * failed read.
 */
async function readBaseKeepsCaptures(
  cwd: string,
  baseRef: string | undefined,
): Promise<boolean | undefined> {
  if (baseRef === undefined || baseRef === '') return undefined
  const stdout = await gh(cwd, [
    'api',
    `repos/{owner}/{repo}/git/trees/${baseRef}?recursive=1`,
    '--jq',
    '.truncated, (.tree[] | select(.type == "blob") | .path)',
  ])
  if (stdout === null) return undefined
  const [truncated, ...paths] = stdout.split('\n').filter(Boolean)
  if (truncated !== 'true' && truncated !== 'false') return undefined
  if (paths.some(isEvidencePath)) return true
  return truncated === 'true' ? undefined : false
}

/**
 * The commit the pull request diverged from its base at, from the compare
 * endpoint, since a checkout on another branch resolves its own trunk tip
 * instead and the base image links would then describe the wrong commit.
 */
async function readPullMergeBase(
  cwd: string,
  baseRef: string | undefined,
  head: string,
): Promise<string | undefined> {
  if (baseRef === undefined || baseRef === '') return undefined
  const sha = await gh(cwd, [
    'api',
    `repos/{owner}/{repo}/compare/${baseRef}...${head}`,
    '--jq',
    '.merge_base_commit.sha',
  ])
  return sha === null || sha.trim() === '' ? undefined : sha.trim()
}

/** How many cases are read at once. Each reads its images one after another, so this bounds both the downloads in flight and the pairs held for comparison. */
const IMAGE_READ_CONCURRENCY = 4

type ImageRead =
  | {
      readonly kind: 'read'
      readonly width?: number
      readonly bytes?: Uint8Array
    }
  | { readonly kind: 'failed' }

/**
 * A PNG at `sha`, read over the contents API like every other evidence read,
 * with its pixel width from the header. The endpoint ignores a `Range` header,
 * so the whole file arrives, and its bytes are kept for the pixel comparison.
 * A format other than PNG reads with neither, and a refused or timed-out call
 * reads as failed, so the caller can keep the ceiling width and still report
 * the cause.
 */
async function readImage(
  cwd: string,
  path: string,
  sha: string,
): Promise<ImageRead> {
  if (!/\.png$/i.test(path)) return { kind: 'read' }
  try {
    const result = await execa(
      'gh',
      [
        'api',
        '-H',
        'Accept: application/vnd.github.raw',
        `repos/{owner}/{repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${sha}`,
      ],
      {
        cwd,
        timeout: GH_TIMEOUT_MS,
        env: gitEnv(),
        extendEnv: false,
        encoding: 'buffer',
      },
    )
    const bytes = result.stdout
    const width = readPngWidth(bytes.subarray(0, PNG_HEADER_BYTES))
    return width === undefined
      ? { kind: 'read', bytes }
      : { kind: 'read', width, bytes }
  } catch {
    return { kind: 'failed' }
  }
}

/** Runs `task` over `inputs` with at most `limit` in flight, keeping input order. */
async function mapPool<T, R>(
  inputs: readonly T[],
  limit: number,
  task: (input: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = Array.from({ length: inputs.length })
  let next = 0
  const lane = async (): Promise<void> => {
    while (next < inputs.length) {
      const index = next++
      results[index] = await task(inputs[index] as T)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, inputs.length) }, lane),
  )
  return results
}

interface SizedEvidence {
  readonly reading: EvidenceReading
  /** Each image whose read failed, as `head:<path>` or `base:<path>`, which rendered at the ceiling and left its case uncompared. */
  readonly unread: readonly string[]
}

interface MeasuredItem {
  readonly item: EvidenceItem
  readonly unread: readonly string[]
}

/**
 * One case with the pixel width of its head image and, when it has one, its
 * base image, and whether the two match within tolerance. The pair is compared
 * as soon as both reads land, so its bytes are dropped before the pool takes
 * the next case. A case missing either PNG carries no verdict.
 */
async function measureItem(
  cwd: string,
  item: EvidenceItem,
  base: string | undefined,
  head: string,
): Promise<MeasuredItem> {
  const headRead = await readImage(cwd, item.path, head)
  const basePath = item.basePath ?? item.path
  const baseRead =
    item.added || base === undefined
      ? undefined
      : await readImage(cwd, basePath, base)
  const unread = [
    ...(headRead.kind === 'failed' ? [`head:${item.path}`] : []),
    ...(baseRead?.kind === 'failed' ? [`base:${basePath}`] : []),
  ]
  const headBytes = headRead.kind === 'read' ? headRead.bytes : undefined
  const baseBytes = baseRead?.kind === 'read' ? baseRead.bytes : undefined
  return {
    item: {
      ...item,
      ...(headRead.kind === 'read' &&
        headRead.width !== undefined && { width: headRead.width }),
      ...(baseRead?.kind === 'read' &&
        baseRead.width !== undefined && { baseWidth: baseRead.width }),
      ...(headBytes !== undefined &&
        baseBytes !== undefined && {
          withinTolerance: isWithinTolerance(baseBytes, headBytes),
          ...(item.basePath !== undefined && {
            identical: Buffer.from(baseBytes).equals(headBytes),
          }),
        }),
    },
    unread,
  }
}

/** Each item measured by `measureItem`, in the reading's order. */
async function withImageReads(
  cwd: string,
  reading: EvidenceReading,
  base: string | undefined,
  head: string,
): Promise<SizedEvidence> {
  if (reading.kind === 'refused') return { reading, unread: [] }
  const measured = await mapPool(
    reading.states.flatMap((entry) => entry.items),
    IMAGE_READ_CONCURRENCY,
    (item) => measureItem(cwd, item, base, head),
  )
  let offset = 0
  const states = reading.states.map((entry) => {
    const items = measured
      .slice(offset, offset + entry.items.length)
      .map((read) => read.item)
    offset += entry.items.length
    return { ...entry, items }
  })
  return {
    reading: { kind: 'read', states },
    unread: measured.flatMap((entry) => entry.unread),
  }
}

async function runEvidence(
  number: string | undefined,
  opts: EvidenceOptions,
): Promise<number> {
  const root = resolve(opts.root ?? process.cwd())
  const emitJson = opts.json ?? false
  const isCheck = opts.check ?? false

  intro('canon pr evidence')

  if (
    isCheck &&
    (opts.preview !== undefined ||
      opts.local !== undefined ||
      opts.checklist !== undefined ||
      opts.reel !== undefined ||
      opts.localSkip !== undefined ||
      opts.reelSkip !== undefined)
  ) {
    return refuseWith(
      'check-writes',
      EVIDENCE_REFUSALS['check-writes'],
      emitJson,
      root,
    )
  }

  // Read ahead of anything else, so a bad path refuses before a `gh` round
  // trip rather than after one.
  let suppliedChecklist: string | undefined
  if (typeof opts.checklist === 'string') {
    suppliedChecklist = await readFile(resolve(root, opts.checklist), 'utf8')
      .then((text) => text.trim() || undefined)
      .catch(() => undefined)
    if (suppliedChecklist === undefined) {
      return refuseWith(
        'unreadable-checklist',
        EVIDENCE_REFUSALS['unreadable-checklist'],
        emitJson,
        root,
      )
    }
  }

  const read = await readIdentity(root, number)
  if (read.kind === 'refused') {
    return refuseWith(read.reason, PULL_REFUSALS[read.reason], emitJson, root)
  }

  const { identity } = read
  if (identity.head === undefined) {
    return refuseWith(
      'no-object-head',
      PULL_REFUSALS['no-object-head'],
      emitJson,
      root,
    )
  }

  if (identity.number === undefined) {
    return refuseWith(
      'gh-failed',
      EVIDENCE_REFUSALS['gh-failed'],
      emitJson,
      root,
    )
  }

  // The check never reads the merge base, so it skips the compare call and
  // a failed one cannot hold a draft lift for a reason the check never had.
  const [pullFiles, base, keepsCaptures] = await Promise.all([
    listPullFiles(root, identity.number),
    isCheck ? undefined : readPullMergeBase(root, identity.base, identity.head),
    readBaseKeepsCaptures(root, identity.base),
  ])
  if (pullFiles === undefined) {
    return refuseWith(
      'unreadable-changes',
      EVIDENCE_REFUSALS['unreadable-changes'],
      emitJson,
      root,
    )
  }

  const grouped = await groupEvidence(
    [...pullFiles.present.keys()],
    async (path) => pullFiles.present.get(path) === false,
    pullFiles.renamedFrom,
  )
  const uncaptured = readUncaptured(
    [...pullFiles.present.keys()],
    loadPaintedPatterns(root),
    keepsCaptures,
  )

  let existingCases = 0
  let commentId: number | undefined
  let carriedPreview: string | undefined
  let carriedChecklist: string | undefined
  let carriedLocal: string | undefined
  // An unread thread refuses rather than rendering, since a body built
  // without it knows neither the comment to edit nor the preview address
  // to carry, and posting it would duplicate the comment and drop the link.
  // It refuses ahead of no-evidence too, so that record never reports an
  // absent field it did not read.
  const comments = await listComments(root, String(identity.number))
  if (comments === undefined) {
    return refuseWith(
      'gh-failed',
      EVIDENCE_REFUSALS['gh-failed'],
      emitJson,
      root,
    )
  }
  commentId = findEvidenceCommentId(comments)
  existingCases = findEvidenceCaseCount(comments)
  carriedPreview = findEvidencePreview(comments)
  // A dropped checklist is not carried, so neither the record nor the render
  // shows it, while the marked comment holding it still counts below.
  const postedChecklist = findEvidenceChecklist(comments)
  carriedChecklist = opts.checklist === false ? undefined : postedChecklist
  carriedLocal = findEvidenceLocal(comments)
  const carriedReel = findEvidenceReel(comments)

  // What the marked comment already shows a reviewer, kept apart from the
  // flags this call passed so a reader learns what is posted.
  const carried = {
    ...(carriedPreview !== undefined && { preview: carriedPreview }),
    ...(carriedLocal !== undefined && { local: carriedLocal }),
    ...(carriedReel !== undefined && { reel: carriedReel }),
    ...(carriedChecklist !== undefined && checklistFields(carriedChecklist)),
  }

  // A deploy that resolves and does not build from any changed path makes a
  // carried hosted link point at a site that shows none of this change.
  const deploy = findDeployWorkflow(await readWorkflows(root))
  const deployServesChange =
    deploy.kind === 'found' &&
    servesChange(deploy.filter, everyChangedPath(pullFiles))
  const isUnserved = deploy.kind === 'found' && !deployServesChange

  // Reported on every record that read the changed set, and never owed,
  // since no step of the ship chain can take the capture a skip left out.
  const uncapturedField = uncaptured !== undefined && { uncaptured }
  const warnUncaptured = (): void => {
    if (uncaptured === undefined || uncaptured.length === 0) return
    logWarn(
      `${plural(uncaptured.length, 'painted path')} changed with no evidence capture: ${uncaptured.join(', ')}`,
    )
  }

  if (isCheck) {
    const owed = readOwed({
      hasEvidenceChange: grouped.kind === 'read',
      hasMarkedComment: hasMarkedEvidenceComment(comments),
      carriedPreview: carriedPreview !== undefined,
      deployServesChange,
    })
    logStep(owed.length === 0 ? 'Settled' : 'Owed')
    logInfo(
      owed.length === 0
        ? 'Nothing the ship chain posts after the pull request is missing.'
        : `missing ${owed.join(', ')}`,
    )
    warnUncaptured()
    outro()
    if (emitJson) {
      // The lift reads the skip to decide whether a drivable checklist with
      // no reel at the head is settled, so the check carries it verbatim.
      const reelSkip = findEvidenceSkips(comments).reel
      process.stdout.write(
        `${JSON.stringify({
          root,
          number: identity.number,
          reason: owed.length === 0 ? 'settled' : 'owed',
          owed,
          ...uncapturedField,
          ...(reelSkip !== undefined && { reelSkip }),
          ...(commentId !== undefined && { commentId }),
          ...carried,
        })}\n`,
      )
    }
    return 0
  }

  if (base === undefined) {
    return refuseWith('no-base', EVIDENCE_REFUSALS['no-base'], emitJson, root)
  }

  // A checklist opens a comment on its own, so it always lands in the marked
  // comment a later call edits. A local address rides on a checklist or a
  // hosted preview and never opens one alone, so a docs-only branch with a
  // server up posts nothing. An uncaptured painted path opens one too, so the
  // gap the lift refuses on shows on the thread.
  // A dropped checklist still opens a render, so the marked comment holding
  // it is edited without the block rather than left showing it.
  const hasChecklist =
    suppliedChecklist !== undefined || postedChecklist !== undefined
  const hasUncaptured = uncaptured !== undefined && uncaptured.length > 0
  if (
    grouped.kind === 'refused' &&
    opts.preview === undefined &&
    !hasChecklist &&
    !hasUncaptured
  ) {
    logStep('Skipped')
    logInfo(
      'No changed path carries an evidence/ segment, so there is nothing to post.',
    )
    warnUncaptured()
    outro()
    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({
          root,
          ...(identity.number !== undefined && { number: identity.number }),
          reason: 'no-evidence',
          ...uncapturedField,
          ...carried,
        })}\n`,
      )
    }
    return 0
  }

  const repo = await readRepoName(root)
  if (repo === undefined) {
    return refuseWith(
      'gh-failed',
      EVIDENCE_REFUSALS['gh-failed'],
      emitJson,
      root,
    )
  }

  const preview = opts.preview ?? (isUnserved ? undefined : carriedPreview)
  // A carried local line names no head and reads as live, so a passed skip
  // drops it the way a passed address replaces it. A carried reel names the
  // head it was filmed at, so it stays beside a passed skip.
  const local =
    opts.local ?? (opts.localSkip === undefined ? carriedLocal : undefined)
  const reel = nextEvidenceReel(opts.reel, identity.head, comments)
  const carriedSkips = findEvidenceSkips(comments)
  const skips = {
    local: opts.localSkip ?? carriedSkips.local,
    reel: opts.reelSkip ?? carriedSkips.reel,
  }
  const unsettled = suppliedChecklist ?? carriedChecklist
  const checklist =
    unsettled === undefined
      ? undefined
      : settleChecklist(unsettled, identity.head, findEvidenceHead(comments))
  const sized = await withImageReads(root, grouped, base, identity.head)
  const states = sized.reading.kind === 'read' ? sized.reading.states : []
  const body = renderEvidenceBody(
    states,
    repo,
    base,
    identity.head,
    preview,
    checklist,
    local,
    reel,
    skips,
    uncaptured,
  )

  const caseCount = states.reduce((n, s) => n + s.items.length, 0)

  // A render with no cases cannot tell a removal from a short read, so it
  // never replaces a comment that carries some. The record keeps the comment
  // id and the carried fields so the caller can still edit by hand.
  if (caseCount === 0 && existingCases > 0) {
    logStep('Refused')
    logWarn(EVIDENCE_REFUSALS['would-empty'])
    outro()
    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({
          root,
          number: identity.number,
          reason: 'would-empty',
          message: EVIDENCE_REFUSALS['would-empty'],
          ...(commentId !== undefined && { commentId }),
          ...carried,
        })}\n`,
      )
    }
    return 1
  }

  // A UI pass line stamped at an earlier head describes a tree that is gone,
  // so a render at a new head puts it back to unchecked. A line already
  // naming this head is left alone, since each body edit reruns the label gate.
  const priorBody = identity.body ?? ''
  const stampedHead = readUiPassHead(priorBody)
  let uiPass: 'reset' | 'reset-refused' | undefined
  if (stampedHead !== undefined && !identity.head.startsWith(stampedHead)) {
    const reset = writeUiPassLine(priorBody, {
      kind: 'reset',
      head: identity.head,
    })
    uiPass = (await patchPullBody(root, identity.number, reset))
      ? 'reset'
      : 'reset-refused'
  }

  logStep('Scope')
  logInfo(
    `${plural(caseCount, 'case')} across ${plural(states.length, 'state')}`,
  )
  if (uiPass === 'reset') logInfo('UI pass line reset to the new head')
  if (uiPass === 'reset-refused') {
    logWarn('gh could not edit the body, so its UI pass line names an old head')
  }
  if (sized.unread.length > 0) {
    logWarn(
      `width unread for ${plural(sized.unread.length, 'image')}, rendered at 1000: ${sized.unread.join(', ')}`,
    )
  }
  if (preview !== undefined) logInfo(`preview ${preview}`)
  if (local !== undefined) logInfo(`local preview ${local}`)
  if (reel !== undefined) {
    logInfo(
      opts.reel === undefined
        ? `reel carried forward, filmed at ${reel.head.slice(0, 7)}`
        : 'reel embedded under the addresses',
    )
  }
  if (checklist !== undefined) {
    logInfo(
      suppliedChecklist === undefined
        ? 'checklist carried forward from the marked comment'
        : 'checklist folded in below the comparison',
    )
  }
  warnUncaptured()

  outro()

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        root,
        ...(identity.number !== undefined && { number: identity.number }),
        reason: 'ok',
        base,
        head: identity.head,
        body,
        states,
        ...(sized.unread.length > 0 && { widthUnread: sized.unread }),
        ...(uiPass !== undefined && { uiPass }),
        ...uncapturedField,
        ...(commentId !== undefined && { commentId }),
        ...carried,
      })}\n`,
    )
  }

  return 0
}

/** The record fields a checklist carries, with `drivable` counting the boxes a driver can run. */
function checklistFields(checklist: string): {
  checklist: string
  boxes: ChecklistBox[]
  drivable: number
} {
  const boxes = readChecklistBoxes(checklist)
  return { checklist, boxes, drivable: countDrivable(boxes) }
}
