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
  findEvidenceReels,
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
  nextEvidenceReels,
  readReelWidth,
  renderEvidenceBody,
  settleChecklist,
  SHORT_SHA_LENGTH,
} from '@/pr/evidence'
import { isWithinTolerance } from '@/pr/pixels'
import { readCarry, reelMoves } from '@/pr/carry'
import { type GitRunner, readChangedPaths, readRebasedPaths } from '@/pr/lift'
import { isPainted, loadPaintedPatterns } from '@/pr/painted'
import { resolveTip, type TipRefusal } from '@/pr/head'
import {
  findDeployWorkflow,
  type PreviewHeadReading,
  readPreviewHead,
  type ServedFilter,
  servesChange,
} from '@/pr/preview'
import { readUiPassHead, writeUiPassLine } from '@/pr/tick'
import { intro, logInfo, logStep, logWarn, outro, plural } from '@/cli/ui'
import {
  GH_TIMEOUT_MS,
  PULL_REFUSALS,
  ReadOptions,
  everyChangedPath,
  gh,
  gitRunner,
  listComments,
  listComparedPaths,
  listPullFiles,
  patchPullBody,
  readIdentity,
  readRepoName,
  refReader,
  refusePull,
  refuseWith,
} from '@/commands/pr/pull'
import { readSupportedClasses } from '@/commands/pr/gates'
import { ghPreviewRunner } from '@/commands/pr/preview'
import { readWorkflows } from '@/commands/pr/workflows'

interface EvidenceOptions extends ReadOptions {
  readonly preview?: string
  /** A path to fold in, or false from `--no-checklist` to drop the carried one. */
  readonly checklist?: string | false
  readonly local?: string
  readonly reel?: readonly string[]
  readonly reelCovers?: readonly string[]
  readonly localSkip?: string
  readonly reelSkip?: readonly string[]
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
  | 'reel-covers-unpaired'
  | 'reel-width-repeated'
  | 'unreadable-changes'
  | 'unreadable-checklist'
  | 'would-empty'

/** Why the check could not tell which head the carried preview serves, refused under `gh-failed` rather than read as settled. */
const UNREAD_PREVIEW_HEAD =
  'gh could not list the deploy runs for this branch, or the paths changed since the built head could not be read, as when the remote no longer holds that head, so whether the carried preview serves the tip is unknown.'

const EVIDENCE_REFUSALS: Record<EvidenceRefusal, string> = {
  'check-writes':
    '--check is a read and renders no body, so it takes none of --preview, --local, --checklist, --no-checklist, --reel, --reel-covers, --local-skip, or --reel-skip. Run the check and the render as two calls.',
  'gh-failed':
    'gh could not answer for this repository. Name the pull request number.',
  'unreadable-checklist':
    'The file named by --checklist could not be read, or holds nothing. Rendering without it would drop the only copy, since the caller deletes the handoff once a post reports success.',
  'no-base':
    'GitHub reported no merge base for this pull request, so no path could be judged added or changed.',
  'reel-covers-unpaired':
    'The --reel-covers count differs from the --reel count, so a coverage line would land under the wrong reel or none. The Nth --reel-covers describes the Nth --reel, so pass one per reel or none at all.',
  'reel-width-repeated':
    'Two --reel links name one width, so the comment would embed two reels for one width. Pass one --reel per width, each the link canon pr frames --reel returned.',
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
      'Embed this reel under the address line, filmed at the head, from canon pr frames --reel, once per width',
      collect,
    )
    .option(
      '--reel-covers <text>',
      'Name the checklist groups a passed --reel films and leaves out, on a line under it, paired by position',
      collect,
    )
    .option(
      '--local-skip <reason>',
      'Name why no local address is posted, from the reason pr-evidence holds for canon pr local',
    )
    .option(
      '--reel-skip <reason>',
      'Name why no reel is embedded, from the reason pr-evidence holds for canon pr frames --reel, as <width>=<reason> for one width',
      collect,
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
        'still carries them forward. Beside a hosted address the deploy serves,',
        'a **Preview built at:** segment names the short head of the newest',
        'successful deploy run, and is left off when the runs cannot be listed.',
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
        'at, and repeats once per width. The width is read off the',
        'reel-<width>.webp name canon pr frames --reel writes, a bare reel.webp',
        'reading as 1280, and each reel embeds at that width up to 960. Two',
        '--reel links naming one width refuse as reel-width-repeated. Passed',
        'reels post in the order given. A reel the marked comment already',
        'embeds is carried forward under the head it names unless a passed one',
        'shares its width, so a stale reel never reads as current. Unlike',
        '--local, a passed reel opens a render alone, so a branch whose',
        'evidence is a filmed reel posts it with no checklist or comparison. A',
        'carried reel opens none.',
        '',
        '--reel-covers puts one **Reel covers:** line under a passed reel,',
        'naming the checklist groups it films and the ones it leaves out, the',
        'Nth --reel-covers under the Nth --reel, whatever order the two flags',
        'arrive in. Passing any covers takes one per reel, and a count that',
        'differs refuses as reel-covers-unpaired, so a line never lands under',
        'the wrong reel. The line belongs to its reel: it is carried forward',
        'with a carried reel and dropped when a passed reel replaces it.',
        '',
        '--local-skip and --reel-skip each put a line under the addresses,',
        '**No local preview:** or **No reel:** followed by the text passed, a',
        'reason code and any one-line message joined to it, folded onto one',
        'line. A --reel-skip written <width>=<reason>, such as',
        "'390=no-visible-change', writes **No reel at 390:** instead, which",
        'governs that width over the line naming every width, and the flag',
        'repeats once per width. Without the flag, a skip line the marked',
        'comment already carries is carried forward, and a passed one replaces',
        'only the line for its own width. The local skip line is dropped',
        'whenever its address renders, passed or carried. A width skip line is',
        'dropped by a reel at that width that covers this head, and the line',
        'naming every width only once each width the checklist owes has one,',
        'so it stays beside an earlier reel the lift would not carry. A passed',
        '--local-skip drops a carried local address, since that line names no',
        'head and would read as live, while a carried reel names its head and',
        'stays beside --reel-skip. Like --local, neither opens a comment alone.',
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
        '  reels      each embedded reel in posted order, as `link`, the `width`',
        '             and `head` it was filmed at, and `covers` when its coverage',
        '             line is posted',
        '  reel       the first entry of `reels`, kept for one release for a',
        '             reader of `reel.head`. Read `reels` instead',
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
        'the [painted] table of `canon/config/app.toml` tunes, minus any path under an evidence/',
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
        'or a reel at the head, or carried to it as `canon pr lift` carries one,',
        'renders beside it, which drops the warning too. The field stays raw.',
        '`canon pr lift` refuses `painted-uncaptured` on the same list.',
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
        'A carried address is read against the branch tip on the remote, the',
        'way `canon pr preview --check` reads it, and reported as',
        '`previewHead` with its `reason`, `built`, `tip`, and `runId`. It is',
        'still owed while the tip is building, when no deploy of the branch',
        'succeeded, and when the build is stale and a path the push filter',
        'serves changed since, with `servedSinceBuilt` saying which. A stale',
        'build whose later commits touch no served path stays settled, and a',
        'compare GitHub cut at 300 files counts as served. Across a rebase or',
        "a merge only the branch's own diff counts, read at the built head and",
        "the tip against each one's merge base, so a served path the base alone",
        'changed owes nothing. A run listing or compare that fails, or a built',
        'head the remote no longer holds, refuses as gh-failed rather than',
        'reading settled.',
        'The record carries `owed` and the same marked fields, plus',
        '`reelSkip`, the text after **No reel:** on the marked comment, present',
        'only when that line is posted, and `reelSkips`, each **No reel at',
        '<width>:** line as `width` and `skip`, narrowest first, present only',
        'when one is posted. `deviceClasses` holds the classes the changed',
        'painted paths reach under [device-classes] in canon/config/app.toml, per `canon design',
        'classes`. `canon pr lift` reads each reason code, the text',
        'before the first colon, to decide whether a drivable checklist with',
        'no reel at the head is settled at each width. --check refuses',
        'with --preview, --local, --checklist, --no-checklist, --reel,',
        '--reel-covers, --local-skip, or --reel-skip as check-writes.',
        '',
        'Refusals, read off `reason`:',
        '  unreadable-checklist  --checklist named a path that could not be read,',
        '                        or one holding nothing',
        '  reel-covers-unpaired  --reel-covers were passed in a count other than --reel',
        '  reel-width-repeated   two --reel links name one width',
        '  no-branch             the pull request carries no head branch name',
        '  no-base               GitHub reported no merge base for the pull request',
        '  unreadable-changes    GitHub could not list what the pull request changed',
        '  gh-missing            `gh` is not on the path',
        '  gh-failed             `gh` could not read or edit the pull request or its',
        '                        comments, or with --check list the deploy runs',
        '                        or the paths changed since the built head',
        '  unresolvable-ref      --check could not read the branch tip off the remote',
        '  no-remote-branch      --check found no remote branch to read a tip from',
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
        '  canon pr evidence 1341 --reel <390 link> --reel-covers <text> --reel <1280 link> --json',
        "  canon pr evidence 1341 --reel-skip '390=no-visible-change' --json",
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
 * Whether the base tree holds an evidence image, read over the API so any
 * checkout agrees. A listing GitHub cut proves captures only when one arrived
 * before the cut. Undefined on a failed or unproven read.
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
 * A PNG at `sha` with its header width. The contents API ignores `Range`, so
 * the whole file arrives and its bytes feed the pixel comparison. A failed call
 * reads as failed, so the caller keeps the ceiling width and reports the cause.
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
 * One case with its image widths and whether head and base match within
 * tolerance. The pair is compared as both reads land, so its bytes drop before
 * the pool takes the next case. A case missing either PNG carries no verdict.
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

type CarriedHead =
  | {
      readonly kind: 'read'
      readonly reading: Exclude<PreviewHeadReading, { reason: 'gh-failed' }>
      readonly servedSinceBuilt?: boolean
    }
  | { readonly kind: 'refused'; readonly reason: TipRefusal | 'gh-failed' }

/** Fetches by sha, so it moves no tracking ref a gate fetching beside it would lock on. */
async function fetchMissing(
  git: GitRunner,
  commits: readonly string[],
): Promise<void> {
  const held = await Promise.all(
    commits.map((commit) => git(['cat-file', '-e', `${commit}^{commit}`])),
  )
  const missing = commits.filter((_, index) => held[index] === undefined)
  if (missing.length > 0) await git(['fetch', '-q', 'origin', ...missing])
}

/**
 * Whether the branch changed a served path since the built head, undefined when
 * a read failed. Across a rebase or a merge only the branch's own diff counts,
 * so the base's commits never owe a preview.
 */
async function readServedSince(
  root: string,
  filter: ServedFilter,
  base: string | undefined,
  built: string,
  tip: string,
): Promise<boolean | undefined> {
  const git = gitRunner(root)
  await fetchMissing(git, [built, tip])
  const changed = await readChangedPaths(git, built, tip)
  if (changed === undefined) return undefined

  if (changed.isAncestor) {
    const range = ['--min-parents=2', '--count', tip, `^${built}`]
    const merges = (await git(['rev-list', ...range]))?.trim()
    if (merges === undefined) return undefined
    if (merges === '0') {
      const compared = await listComparedPaths(root, built, tip)
      if (compared === undefined) return undefined
      return (
        compared.kind === 'truncated' || servesChange(filter, compared.paths)
      )
    }
  }

  if (base === undefined) return undefined
  const resolved = await resolveTip(base, refReader(root))
  if (resolved.kind === 'refused') return undefined
  await fetchMissing(git, [resolved.tip])
  const own = await readRebasedPaths(git, resolved.tip, built, tip)
  if (own === undefined) return undefined

  // A path git quotes matches no served glob, so it counts as served.
  return (
    own.differingPaths.some((path) => path.startsWith('"')) ||
    (own.differingPaths.length > 0 && servesChange(filter, own.differingPaths))
  )
}

/**
 * Reads the carried preview's built head against the remote tip the way `canon
 * pr preview --check` does, so the two agree. A stale build counts as behind
 * only when a served path changed since, and a cut listing counts as served.
 */
async function readCarriedHead(
  root: string,
  workflow: string,
  filter: ServedFilter,
  branch: string,
  base: string | undefined,
): Promise<CarriedHead> {
  const resolved = await resolveTip(branch, refReader(root))
  if (resolved.kind === 'refused') return resolved
  const reading = await readPreviewHead(ghPreviewRunner(root), {
    workflow,
    branch,
    tip: resolved.tip,
  })
  if (reading.reason === 'gh-failed') {
    return { kind: 'refused', reason: 'gh-failed' }
  }
  if (reading.reason !== 'stale' || reading.built === undefined) {
    return { kind: 'read', reading }
  }
  const servedSinceBuilt = await readServedSince(
    root,
    filter,
    base,
    reading.built,
    reading.tip,
  )
  return servedSinceBuilt === undefined
    ? { kind: 'refused', reason: 'gh-failed' }
    : { kind: 'read', reading, servedSinceBuilt }
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
      opts.reelCovers !== undefined ||
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

  const passedLinks = opts.reel ?? []
  const passedCovers = opts.reelCovers ?? []
  if (passedCovers.length > 0 && passedCovers.length !== passedLinks.length) {
    return refuseWith(
      'reel-covers-unpaired',
      EVIDENCE_REFUSALS['reel-covers-unpaired'],
      emitJson,
      root,
    )
  }
  const passedWidths = passedLinks.map(readReelWidth)
  if (new Set(passedWidths).size < passedWidths.length) {
    return refuseWith(
      'reel-width-repeated',
      EVIDENCE_REFUSALS['reel-width-repeated'],
      emitJson,
      root,
    )
  }
  const passedSkips = readPassedReelSkips(opts.reelSkip ?? [])

  // Read first, so a bad path refuses before any `gh` round trip.
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
    return refusePull(read, emitJson, root)
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

  // The check skips the merge base, so its failure cannot hold a draft lift.
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
  const painted = loadPaintedPatterns(root)
  const deviceClasses = readSupportedClasses(
    root,
    [...pullFiles.present.keys()].filter((path) => isPainted(path, painted)),
  )
  const uncaptured = readUncaptured(
    [...pullFiles.present.keys()],
    painted,
    keepsCaptures,
  )

  let existingCases = 0
  let commentId: number | undefined
  let carriedPreview: string | undefined
  let carriedChecklist: string | undefined
  let carriedLocal: string | undefined
  // Refused ahead of no-evidence, since without it no comment or preview is known.
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
  // A dropped checklist is not carried, yet the comment holding it still counts.
  const postedChecklist = findEvidenceChecklist(comments)
  carriedChecklist = opts.checklist === false ? undefined : postedChecklist
  carriedLocal = findEvidenceLocal(comments)
  const carriedReels = findEvidenceReels(comments)

  // What the comment already shows, kept apart from this call's flags.
  const carried = {
    ...(carriedPreview !== undefined && { preview: carriedPreview }),
    ...(carriedLocal !== undefined && { local: carriedLocal }),
    ...(carriedReels.length > 0 && {
      reel: carriedReels[0],
      reels: carriedReels,
    }),
    ...(carriedChecklist !== undefined && checklistFields(carriedChecklist)),
  }

  // An unserved change makes a carried hosted link show none of it.
  const deploy = findDeployWorkflow(await readWorkflows(root))
  const deployServesChange =
    deploy.kind === 'found' &&
    servesChange(deploy.filter, everyChangedPath(pullFiles))
  const isUnserved = deploy.kind === 'found' && !deployServesChange

  // Never owed, since no ship chain step can take a capture a skip left out.
  const uncapturedField = uncaptured !== undefined && { uncaptured }
  const warnUncaptured = (reelCovers = false): void => {
    if (reelCovers) return
    if (uncaptured === undefined || uncaptured.length === 0) return
    logWarn(
      `${plural(uncaptured.length, 'painted path')} changed with no evidence capture: ${uncaptured.join(', ')}`,
    )
  }

  if (isCheck) {
    const carriedHead =
      carriedPreview !== undefined &&
      deploy.kind === 'found' &&
      deployServesChange
        ? await readCarriedHead(
            root,
            deploy.path,
            deploy.filter,
            identity.branch,
            identity.base,
          )
        : undefined
    if (carriedHead?.kind === 'refused') {
      return refuseWith(
        carriedHead.reason,
        carriedHead.reason === 'gh-failed'
          ? UNREAD_PREVIEW_HEAD
          : PULL_REFUSALS[carriedHead.reason],
        emitJson,
        root,
      )
    }
    const owed = readOwed({
      hasEvidenceChange: grouped.kind === 'read',
      hasMarkedComment: hasMarkedEvidenceComment(comments),
      carriedPreview: carriedPreview !== undefined,
      deployServesChange,
      ...(carriedHead !== undefined && {
        previewHead: carriedHead.reading.reason,
        servedSinceBuilt: carriedHead.servedSinceBuilt,
      }),
    })
    logStep(owed.length === 0 ? 'Settled' : 'Owed')
    logInfo(
      owed.length === 0
        ? 'Nothing the ship chain posts after the pull request is missing.'
        : `missing ${owed.join(', ')}`,
    )
    if (carriedHead !== undefined) {
      const { built, tip } = carriedHead.reading
      logInfo(
        `preview ${carriedHead.reading.reason}: built ${built?.slice(0, SHORT_SHA_LENGTH) ?? 'nothing'}, tip ${tip.slice(0, SHORT_SHA_LENGTH)}`,
      )
    }
    warnUncaptured()
    outro()
    if (emitJson) {
      // Carried verbatim, since the lift settles a reel-less checklist on it.
      const { reel: reelSkip, reelByWidth } = findEvidenceSkips(comments)
      const reelSkips = [...(reelByWidth ?? new Map<number, string>())]
        .sort(([a], [b]) => a - b)
        .map(([width, skip]) => ({ width, skip }))
      process.stdout.write(
        `${JSON.stringify({
          root,
          number: identity.number,
          reason: owed.length === 0 ? 'settled' : 'owed',
          owed,
          deviceClasses,
          ...uncapturedField,
          ...(reelSkip !== undefined && { reelSkip }),
          ...(reelSkips.length > 0 && { reelSkips }),
          ...(commentId !== undefined && { commentId }),
          ...(carriedHead !== undefined && {
            previewHead: {
              ...carriedHead.reading,
              ...(carriedHead.servedSinceBuilt !== undefined && {
                servedSinceBuilt: carriedHead.servedSinceBuilt,
              }),
            },
          }),
          ...carried,
        })}\n`,
      )
    }
    return 0
  }

  if (base === undefined) {
    return refuseWith('no-base', EVIDENCE_REFUSALS['no-base'], emitJson, root)
  }

  // A local address alone never opens a comment.
  const hasChecklist =
    suppliedChecklist !== undefined || postedChecklist !== undefined
  const hasUncaptured = uncaptured !== undefined && uncaptured.length > 0
  if (
    grouped.kind === 'refused' &&
    opts.preview === undefined &&
    passedLinks.length === 0 &&
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
  // The check owns the verdict, so a failed listing drops the segment, not the post.
  const built =
    preview !== undefined && deploy.kind === 'found' && deployServesChange
      ? await readPreviewHead(ghPreviewRunner(root), {
          workflow: deploy.path,
          branch: identity.branch,
          tip: identity.head,
        })
      : undefined
  if (built?.reason === 'gh-failed') {
    logWarn(
      'gh could not list the deploy runs, so the preview line names no built head',
    )
  }
  const previewBuilt =
    built === undefined || built.reason === 'gh-failed'
      ? undefined
      : built.built
  // A carried local line names no head, so a passed skip drops it.
  const local =
    opts.local ?? (opts.localSkip === undefined ? carriedLocal : undefined)
  const reels = nextEvidenceReels(
    passedLinks.map((link, index) => {
      const covers = passedCovers[index]
      return covers === undefined ? { link } : { link, covers }
    }),
    identity.head,
    comments,
  )
  // Covered exactly when `canon pr lift` would carry the reel to the head.
  const renderHead = identity.head
  const carries = await Promise.all(
    reels.map((reel) =>
      readCarry(
        (from, to) => readChangedPaths(gitRunner(root), from, to),
        reel.head,
        renderHead,
        reelMoves(painted),
      ),
    ),
  )
  const coveredWidths = new Set(
    reels
      .filter((_, index) =>
        ['covered', 'carried'].includes(carries[index]?.kind ?? ''),
      )
      .map((reel) => reel.width),
  )
  const reelCovers = coveredWidths.size > 0
  const carriedSkips = findEvidenceSkips(comments)
  const skips = {
    local: opts.localSkip ?? carriedSkips.local,
    reel: passedSkips.every ?? carriedSkips.reel,
    reelByWidth: new Map([
      ...(carriedSkips.reelByWidth ?? []),
      ...passedSkips.byWidth,
    ]),
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
    reels,
    skips,
    uncaptured,
    coveredWidths,
    previewBuilt,
    deviceClasses,
  )

  const caseCount = states.reduce((n, s) => n + s.items.length, 0)

  // An empty render cannot tell a removal from a short read, so it replaces nothing.
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

  // Only a UI pass line stamped at an earlier head is unchecked, since each edit reruns the gate.
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
  for (const reel of reels) {
    logInfo(
      reel.head === identity.head
        ? `${reel.width} reel embedded under the addresses`
        : `${reel.width} reel carried forward, filmed at ${reel.head.slice(0, 7)}`,
    )
  }
  if (checklist !== undefined) {
    logInfo(
      suppliedChecklist === undefined
        ? 'checklist carried forward from the marked comment'
        : 'checklist folded in below the comparison',
    )
  }
  warnUncaptured(reelCovers)

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

/** Commander's collector for a flag that repeats, keeping every value in the order passed. */
function collect(value: string, previous: readonly string[] = []): string[] {
  return [...previous, value]
}

/** A `--reel-skip` written `<width>=<reason>` names one width, and any other names every width. */
const WIDTH_SKIP = /^([1-9]\d*)=(.*)$/s

/** The passed reel skips split by width, the last one passed winning for each width and for the line naming every width. */
function readPassedReelSkips(values: readonly string[]): {
  every?: string
  byWidth: Map<number, string>
} {
  let every: string | undefined
  const byWidth = new Map<number, string>()
  for (const value of values) {
    const match = WIDTH_SKIP.exec(value)
    if (match?.[1] === undefined || match[2] === undefined) every = value
    else byWidth.set(Number(match[1]), match[2])
  }
  return every === undefined ? { byWidth } : { every, byWidth }
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
