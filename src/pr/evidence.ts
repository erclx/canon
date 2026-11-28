import {
  DEVICE_CLASSES,
  type DeviceClass,
  deviceClassOf,
} from '@/design/device-classes'
import { isPainted, type PaintedPatterns } from '@/pr/painted'
import type { PreviewHeadReason } from '@/pr/preview'

/** The path segment that marks an image as evidence a pull request should compare. */
const EVIDENCE_SEGMENT = 'evidence'

/** The most images a comment carries and still opens its states, since past it the page is a wall of screenshots. */
const EVIDENCE_OPEN_LIMIT = 6

/** Length of the commit names the visible line shows, the width `git` abbreviates to. */
export const SHORT_SHA_LENGTH = 7

/** Prefix of the trailing marker this module writes and reads back. */
const MARKER_PREFIX = '<!-- pr-evidence:'

/** How the address line names the branch's preview deployment. */
const PREVIEW_PREFIX = '**Preview:**'

/** How the segment naming the head the hosted preview was built from opens, which a reader before it drops as unknown. */
const PREVIEW_BUILT_PREFIX = '**Preview built at:**'

/** How the address line names the branch's server on the operator's own machine, after any hosted segment. */
const LOCAL_PREFIX = '**Local preview:**'

/** How the reel line under the addresses opens. */
const REEL_PREFIX = '**Reel** filmed at'

/** The reel line as `renderEvidenceBody` writes it, read back for the link and the head label. */
const REEL_LINE =
  /^\*\*Reel\*\* filmed at `([0-9a-f]{7,40})`:<br><img src="([^"]+)"/

/** How the line under the reel naming the checklist groups it films and leaves out opens. */
const REEL_COVERS_PREFIX = '**Reel covers:**'

/** How the line naming why no local address was posted opens. */
const LOCAL_SKIP_PREFIX = '**No local preview:**'

/** How the line naming why no reel was filmed at any width opens. */
const REEL_SKIP_PREFIX = '**No reel:**'

/** The line naming why no reel was filmed at one width, read back for the width and the reason. */
const REEL_WIDTH_SKIP_LINE = /^\*\*No reel at ([1-9]\d*):\*\*\s*(.*)$/

/** How the line naming the painted paths changed with no capture opens. */
const UNCAPTURED_PREFIX = '**Uncaptured:**'

/** The most pixels a reel asks for in the comment, since one filmed wider is shrunk to fit the column. */
const REEL_MAX_EMBED = 960

/**
 * The width a reel or a box is taken at when it names none, as the reel step
 * films a box without one. A comment posted before reels carried a width reads
 * as one reel at this width.
 */
export const DEFAULT_REEL_WIDTH = 1280

/** The width `canon pr frames` writes into a reel's file name. */
const REEL_LINK_WIDTH = /\/reel-([1-9]\d*)\.webp(?:[?#]|$)/

/** What joins the hosted and local segments on the one address line. */
const ADDRESS_SEPARATOR = ' · '

/** The summary of the block holding every case whose pixels matched its base. */
const FOLDED_SUMMARY = 'Within tolerance'

/** The heading every body opens with. */
const EVIDENCE_HEADING = '## Evidence'

/** How the line counting renamed images whose pixels did not change opens. */
const MOVED_PREFIX = '**Moved unchanged:**'

/** How the visible commit line opens. */
const BASE_PREFIX = '**Base:**'

/** The heading the checklist sits under, printed outside the delimiters so a carried checklist never doubles it. */
const CHECKLIST_HEADING = '## What to look at'

/** Delimiters around the checklist, so a re-render can read back what a reviewer has already ticked. */
export const CHECKLIST_START = '<!-- pr-checklist:start -->'
export const CHECKLIST_END = '<!-- pr-checklist:end -->'

/** One checklist line, a list marker then a box that GitHub renders for `x` in either case. */
const BOX_LINE = /^(\s*[-*+] \[)([ xX])(\] )(.*)$/

/** The trailing segment a tick carries, naming the commit the box passed at. Matched only at the end of a line, so a box whose own text says `passed at` is left alone. */
const STAMP = / · passed at `([0-9a-f]{7,40})`$/

/** The marker a box a person has to judge by eye carries among its trailing markers. */
const TASTE_MARKER = '(taste)'

/** The run of parenthesized markers that ends a box, such as `(taste) (local only)`, in any order. */
const TRAILING_MARKERS = /(?:\s*\([^()]*\))+$/

/** A `#issuecomment-<id>` suffix, which is the REST comment id `gh pr view` never returns directly. */
const ISSUE_COMMENT_ID = /#issuecomment-(\d+)$/

/**
 * The image extensions this module embeds. A README, script, or data file kept
 * beside the captures would render as a broken `<img>`.
 */
const IMAGE_EXTENSION = /\.(png|jpe?g|gif|webp|avif|svg)$/i

export interface EvidenceItem {
  readonly path: string
  readonly stem: string
  /** True when `path` did not exist at the comparison's base commit and was not renamed from a path that did. */
  readonly added: boolean
  /** Where a renamed image sat at the base, which its before image reads from. Absent for any image that was not renamed. */
  readonly basePath?: string
  /** Pixel width of the head image, read from its PNG header. Absent when unread. */
  readonly width?: number
  /** Pixel width of the base image, absent for an added case or an unread header. */
  readonly baseWidth?: number
  /** Whether the head differs from its base by no more than sub-visual noise. Absent when the pair was not compared. */
  readonly withinTolerance?: boolean
  /** Whether the head and base files hold the same bytes. Read only for a renamed image, where it alone lets the listing drop the pair, since a small edit also passes the tolerance. */
  readonly identical?: boolean
}

export interface EvidenceState {
  /** The remainder of the path's directory under the `evidence/` segment. Empty when the image sits directly inside it. */
  readonly state: string
  readonly items: readonly EvidenceItem[]
}

export type EvidenceRefusal = 'no-evidence'

export type EvidenceReading =
  | { readonly kind: 'read'; readonly states: readonly EvidenceState[] }
  | { readonly kind: 'refused'; readonly reason: EvidenceRefusal }

/** Whether a path existed at the comparison's base commit, read however the caller resolves it. */
export type ExistsAtBase = (path: string) => Promise<boolean>

function evidencePosition(path: string): number {
  return path.split('/').indexOf(EVIDENCE_SEGMENT)
}

export function isEvidencePath(path: string): boolean {
  return evidencePosition(path) !== -1 && IMAGE_EXTENSION.test(path)
}

function splitEvidencePath(path: string): {
  readonly state: string
  readonly stem: string
} {
  const segments = path.split('/')
  const rest = segments.slice(evidencePosition(path) + 1)
  const filename = rest[rest.length - 1] ?? ''
  return {
    state: rest.slice(0, -1).join('/'),
    stem: filename.replace(/\.[^./]+$/, ''),
  }
}

/**
 * Groups every evidence path by state, keyed by filename stem so a pair sharing
 * a name across two states reads as one case. A path in `renamedFrom` is not
 * added, and its base reads from the path it maps to.
 */
export async function groupEvidence(
  changed: readonly string[],
  existsAtBase: ExistsAtBase,
  renamedFrom: ReadonlyMap<string, string> = new Map(),
): Promise<EvidenceReading> {
  const paths = changed.filter(isEvidencePath)
  if (paths.length === 0) return { kind: 'refused', reason: 'no-evidence' }

  const resolved = await Promise.all(
    paths.map(async (path) => {
      const { state, stem } = splitEvidencePath(path)
      const basePath = renamedFrom.get(path)
      const added = basePath === undefined && !(await existsAtBase(path))
      return { path, state, stem, added, basePath }
    }),
  )

  const byState = new Map<string, EvidenceItem[]>()
  for (const { path, state, stem, added, basePath } of resolved) {
    const item: EvidenceItem = {
      path,
      stem,
      added,
      ...(basePath !== undefined && { basePath }),
    }
    const items = byState.get(state)
    if (items === undefined) byState.set(state, [item])
    else items.push(item)
  }

  const states = [...byState.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([state, items]) => ({
      state,
      items: [...items].sort((a, b) => a.stem.localeCompare(b.stem)),
    }))

  return { kind: 'read', states }
}

// The raw host serves nothing to a private repository's browser, while the
// blob form redirects to the bytes carrying the viewer's session.
function rawUrl(repo: string, sha: string, path: string): string {
  return `https://github.com/${repo}/blob/${sha}/${path}?raw=true`
}

/**
 * The most pixels a screenshot asks for, since `width="100%"` would stretch a
 * narrow crop. An image asks for the smaller of its own width and this, and
 * one whose width was not read asks for this.
 */
const IMAGE_WIDTH = 1000

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** Bytes of a PNG that reach the end of IHDR's width field. */
export const PNG_HEADER_BYTES = 24

/**
 * The pixel width in a PNG's IHDR chunk, or undefined for bytes that are not
 * a PNG with a header or that carry a zero width.
 */
export function readPngWidth(bytes: Uint8Array): number | undefined {
  if (bytes.length < PNG_HEADER_BYTES) return undefined
  if (PNG_SIGNATURE.some((byte, index) => bytes[index] !== byte)) {
    return undefined
  }
  const width = new DataView(bytes.buffer, bytes.byteOffset).getUint32(16)
  return width > 0 ? width : undefined
}

/** A label and an attribute value share one escape, since a stem is a path segment placed in both. The pipe stays escaped, since a label once sat in a table cell. */
function escapeCell(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('|', '&#124;')
}

function unescapeCell(text: string): string {
  return text
    .replaceAll('&#124;', '|')
    .replaceAll('&quot;', '"')
    .replaceAll('&gt;', '>')
    .replaceAll('&lt;', '<')
    .replaceAll('&amp;', '&')
}

function evidenceImage(url: string, alt: string, width?: number): string {
  const shown = Math.min(width ?? IMAGE_WIDTH, IMAGE_WIDTH)
  return `<img src="${url}" width="${shown}" alt="${alt}">`
}

const EVIDENCE_IMAGE = String.raw`(?:!\[\]\([^)]*\)|<img [^>]*>)`

/** A case row in a shape before the head image carried an alt: a Base cell before the head image, or the head image alone. */
const LEGACY_ROW_PATTERN = new RegExp(
  String.raw`^\| .+ \| (?:(?:\*\(new\)\*|${EVIDENCE_IMAGE}) \| )?${EVIDENCE_IMAGE} \|$`,
)

/** A head image, which every render since the alt text was added names with a trailing `head`. A row carries one per case it holds. */
const HEAD_IMAGE_PATTERN = /<img [^>]*alt="[^"]* head">/g

/** The form a case name takes when it names a view, a theme, and a width. Anchored on the right, since a view may carry hyphens. */
const CASE_NAME = /^(.+)-(dark|light)-(\d+)$/

const THEMES = ['dark', 'light'] as const

type Theme = (typeof THEMES)[number]

interface ViewCase {
  readonly item: EvidenceItem
  readonly theme: Theme
  readonly width: string
}

function isTheme(value: string): value is Theme {
  return value === 'dark' || value === 'light'
}

function readCaseName(stem: string):
  | {
      readonly view: string
      readonly theme: Theme
      readonly width: string
    }
  | undefined {
  const match = CASE_NAME.exec(stem)
  const view = match?.[1]
  const theme = match?.[2]
  const width = match?.[3]
  if (view === undefined || theme === undefined || width === undefined) {
    return undefined
  }
  return isTheme(theme) ? { view, theme, width } : undefined
}

function compareWidths(a: string, b: string): number {
  return Number(a) - Number(b) || a.localeCompare(b)
}

function commitLink(repo: string, sha: string): string {
  return `[\`${sha.slice(0, SHORT_SHA_LENGTH)}\`](https://github.com/${repo}/commit/${sha})`
}

/** The base folded under its head, so a reviewer reads the new state first and opens the old one on a click. */
function baseFold(item: EvidenceItem, repo: string, base: string): string[] {
  return [
    '<details>',
    '<summary>Base</summary>',
    '',
    evidenceImage(
      rawUrl(repo, base, item.basePath ?? item.path),
      `${escapeCell(item.stem)} base`,
      item.baseWidth,
    ),
    '',
    '</details>',
    '',
  ]
}

function headImage(item: EvidenceItem, repo: string, head: string): string {
  return evidenceImage(
    rawUrl(repo, head, item.path),
    `${escapeCell(item.stem)} head`,
    item.width,
  )
}

/**
 * One case as a label line, its head image, and its base folded beneath. An
 * added case shows its head alone, marked new only beside a block holding a base.
 */
function caseLines(
  label: string,
  item: EvidenceItem,
  hasBase: boolean,
  repo: string,
  base: string,
  head: string,
): string[] {
  const mark = item.added && hasBase ? ' *(new)*' : ''
  return [
    `**${label}**${mark}`,
    '',
    headImage(item, repo, head),
    '',
    ...(item.added ? [] : baseFold(item, repo, base)),
  ]
}

function block(
  opener: string,
  summary: string,
  cases: readonly string[][],
): string {
  return [
    opener,
    `<summary>${summary}</summary>`,
    '',
    ...cases.flat(),
    '</details>',
  ].join('\n')
}

/** One block for the cases of a state that did not name a view, each labeled by its name. */
function renderFlat(
  label: string,
  items: readonly EvidenceItem[],
  repo: string,
  base: string,
  head: string,
  opener: string,
): string {
  const hasBase = items.some((item) => !item.added)
  const cases = items.map((item) =>
    caseLines(escapeCell(item.stem), item, hasBase, repo, base, head),
  )
  return block(opener, `${label} (${items.length})`, cases)
}

/** One block for a view, its cases by width and then dark before light, each labeled by width and theme, so a theme missing at a width renders nothing. */
function renderView(
  label: string,
  cases: readonly ViewCase[],
  repo: string,
  base: string,
  head: string,
  opener: string,
): string {
  const hasBase = cases.some((entry) => !entry.item.added)
  const ordered = [...cases].sort(
    (a, b) =>
      compareWidths(a.width, b.width) ||
      THEMES.indexOf(a.theme) - THEMES.indexOf(b.theme),
  )
  const lines = ordered.map((entry) =>
    caseLines(
      `${entry.width} · ${entry.theme}`,
      entry.item,
      hasBase,
      repo,
      base,
      head,
    ),
  )
  return block(opener, `${label} (${cases.length})`, lines)
}

/**
 * Renders the blocks of one state: a block per view the case names split
 * into, then one flat block for the names that did not. Nothing is dropped,
 * so a state of unparsed names reads as one flat block.
 */
function renderState(
  entry: EvidenceState,
  repo: string,
  base: string,
  head: string,
  opener: string,
): string[] {
  const views = new Map<string, ViewCase[]>()
  const flat: EvidenceItem[] = []
  const taken = new Set<string>()
  for (const item of entry.items) {
    const name = readCaseName(item.stem)
    // Two files can share a stem across extensions, and a view cell holds one.
    const cell =
      name === undefined ? '' : `${name.view}|${name.theme}|${name.width}`
    if (name === undefined || taken.has(cell)) {
      flat.push(item)
      continue
    }
    taken.add(cell)
    const cases = views.get(name.view)
    const viewCase = { item, theme: name.theme, width: name.width }
    if (cases === undefined) views.set(name.view, [viewCase])
    else cases.push(viewCase)
  }

  const prefix = entry.state === '' ? '' : `${escapeCell(entry.state)} / `
  const blocks = [...views.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([view, cases]) =>
      renderView(
        `${prefix}${escapeCell(view)}`,
        cases,
        repo,
        base,
        head,
        opener,
      ),
    )
  if (flat.length > 0) {
    const label = entry.state === '' ? 'evidence' : escapeCell(entry.state)
    blocks.push(renderFlat(label, flat, repo, base, head, opener))
  }
  return blocks
}

/** A folded case's label, naming its state and view, since the block gathers cases from every state. */
function foldedLabel(state: string, item: EvidenceItem): string {
  const name = readCaseName(item.stem)
  const caseLabel =
    name === undefined
      ? escapeCell(item.stem)
      : `${escapeCell(name.view)} · ${name.width} · ${name.theme}`
  return state === '' ? caseLabel : `${escapeCell(state)} / ${caseLabel}`
}

/** One closed block for every case whose pixels matched its base, so the open blocks hold only what visibly moved. */
function renderFolded(
  states: readonly EvidenceState[],
  repo: string,
  base: string,
  head: string,
): string {
  const cases = states.flatMap((entry) =>
    entry.items.map((item) =>
      caseLines(foldedLabel(entry.state, item), item, false, repo, base, head),
    ),
  )
  return block('<details>', `${FOLDED_SUMMARY} (${cases.length})`, cases)
}

/** A reel embedded in the comment, the width and head it was filmed at, and what it covers when the filming session said. */
export interface EvidenceReel {
  readonly link: string
  readonly head: string
  readonly width: number
  readonly covers?: string
}

/** The width a reel link names, or the default for a bare `reel.webp` posted before reels carried one. */
export function readReelWidth(link: string): number {
  const width = REEL_LINK_WIDTH.exec(link)?.[1]
  return width === undefined ? DEFAULT_REEL_WIDTH : Number(width)
}

/** The reel line, then its coverage line when it carries one, which lives and dies with the reel. */
function reelLines(reel: EvidenceReel): string[] {
  const head = reel.head.slice(0, SHORT_SHA_LENGTH)
  const shown = Math.min(reel.width, REEL_MAX_EMBED)
  return [
    `${REEL_PREFIX} \`${head}\`:<br><img src="${escapeCell(reel.link)}" width="${shown}" alt="reel filmed at ${head}">`,
    '',
    ...skipLines(REEL_COVERS_PREFIX, reel.covers),
  ]
}

/**
 * Why a render carries no local address or no reel, each a reason code and any
 * one-line message the caller joined to it. `reel` names every width, and
 * `reelByWidth` one width each, which governs that width over `reel`.
 */
export interface EvidenceSkips {
  readonly local?: string
  readonly reel?: string
  readonly reelByWidth?: ReadonlyMap<number, string>
}

/** One `**No reel at <width>:**` line per width, narrowest first, leaving out a width whose reel covers the head. */
function widthSkipLines(
  byWidth: ReadonlyMap<number, string> | undefined,
  covered: ReadonlySet<number>,
): string[] {
  return [...(byWidth ?? new Map<number, string>()).entries()]
    .filter(([width]) => !covered.has(width))
    .sort(([a], [b]) => a - b)
    .flatMap(([width, reason]) => skipLines(`**No reel at ${width}:**`, reason))
}

/**
 * The per-width skips once a reel covers some owed widths but not all. Each owed width left unfilmed takes the all-widths
 * reason as its own, and a reason already passed for a width stands.
 */
function splitWidthSkips(
  owed: readonly number[],
  covering: ReadonlySet<number>,
  skips: EvidenceSkips,
): ReadonlyMap<number, string> | undefined {
  const reason = skips.reel?.trim() ?? ''
  const byWidth = new Map(skips.reelByWidth)
  if (reason === '') return skips.reelByWidth
  for (const width of owed) {
    if (!covering.has(width) && !byWidth.has(width)) byWidth.set(width, reason)
  }
  return byWidth
}

/** A skip line, or nothing for an empty reason. A reason is folded onto one line, since a line break would end the address region early. */
function skipLines(prefix: string, reason: string | undefined): string[] {
  const text = reason?.replace(/\s+/g, ' ').trim() ?? ''
  return text === '' ? [] : [`${prefix} ${escapeCell(text)}`, '']
}

/**
 * The uncaptured line, or nothing once the list is empty or a reel covers the
 * head and so shows the change.
 */
function uncapturedLines(
  uncaptured: readonly string[],
  reelCovers: boolean,
): string[] {
  if (uncaptured.length === 0) return []
  if (reelCovers) return []
  const paths = uncaptured.map((path) => `\`${path}\``).join(', ')
  return [`${UNCAPTURED_PREFIX} ${paths}`, '']
}

export function evidenceMarker(head: string): string {
  return `${MARKER_PREFIX} head=${head} -->`
}

/**
 * Every state opens within `EVIDENCE_OPEN_LIMIT` head images. `coveredWidths` names the widths whose reel covers the head, as `canon pr lift` reads the carry.
 * A covered width drops its skip line, every owed width covered drops the line naming them all, and any covered reel drops the uncaptured line.
 */
export function renderEvidenceBody(
  states: readonly EvidenceState[],
  repo: string,
  base: string,
  head: string,
  preview?: string,
  checklist?: string,
  local?: string,
  reels: readonly EvidenceReel[] = [],
  skips: EvidenceSkips = {},
  uncaptured: readonly string[] = [],
  coveredWidths: ReadonlySet<number> = new Set(
    reels.filter((reel) => head.startsWith(reel.head)).map((r) => r.width),
  ),
  previewBuilt?: string,
  classes: readonly DeviceClass[] = DEVICE_CLASSES,
): string {
  const covering = new Set(
    reels.map((reel) => reel.width).filter((width) => coveredWidths.has(width)),
  )
  const owed =
    checklist === undefined
      ? []
      : owedReelWidths(readChecklistBoxes(checklist), classes)
  const covered =
    covering.size > 0 && owed.every((width) => covering.has(width))
  const splitSkip = covering.size > 0 && !covered
  const widthSkips = splitSkip
    ? splitWidthSkips(owed, covering, skips)
    : skips.reelByWidth
  const segments = [
    ...(preview === undefined ? [] : [`${PREVIEW_PREFIX} ${preview}`]),
    ...(preview === undefined || previewBuilt === undefined
      ? []
      : [
          `${PREVIEW_BUILT_PREFIX} \`${previewBuilt.slice(0, SHORT_SHA_LENGTH)}\``,
        ]),
    ...(local === undefined ? [] : [`${LOCAL_PREFIX} ${local}`]),
  ]
  const opening = [
    EVIDENCE_HEADING,
    '',
    ...(segments.length === 0 ? [] : [segments.join(ADDRESS_SEPARATOR), '']),
    ...(local === undefined ? skipLines(LOCAL_SKIP_PREFIX, skips.local) : []),
    ...reels.flatMap(reelLines),
    ...(covered || splitSkip ? [] : skipLines(REEL_SKIP_PREFIX, skips.reel)),
    ...widthSkipLines(widthSkips, covering),
    ...uncapturedLines(uncaptured, covering.size > 0),
  ]
  const closing =
    checklist === undefined
      ? []
      : [CHECKLIST_HEADING, '', CHECKLIST_START, checklist, CHECKLIST_END, '']
  if (states.length === 0) {
    return [...opening, ...closing, evidenceMarker(head)].join('\n')
  }

  const split = (keep: (item: EvidenceItem) => boolean): EvidenceState[] =>
    states
      .map((entry) => ({ ...entry, items: entry.items.filter(keep) }))
      .filter((entry) => entry.items.length > 0)
  const isMoved = (item: EvidenceItem): boolean =>
    item.basePath !== undefined && item.identical === true
  const open = split((item) => !isMoved(item) && item.withinTolerance !== true)
  const folded = split(
    (item) => !isMoved(item) && item.withinTolerance === true,
  )
  const movedCount = states.reduce(
    (total, entry) => total + entry.items.filter(isMoved).length,
    0,
  )

  const headCount = open.reduce((total, entry) => total + entry.items.length, 0)
  const opener =
    headCount <= EVIDENCE_OPEN_LIMIT ? '<details open>' : '<details>'

  const sections = [
    ...open.flatMap((entry) => renderState(entry, repo, base, head, opener)),
    ...(folded.length === 0 ? [] : [renderFolded(folded, repo, base, head)]),
  ]

  return [
    ...opening,
    `${BASE_PREFIX} ${commitLink(repo, base)} · **Head:** ${commitLink(repo, head)}`,
    '',
    ...(movedCount === 0
      ? []
      : [
          `${MOVED_PREFIX} ${movedCount} ${movedCount === 1 ? 'image' : 'images'}`,
          '',
        ]),
    ...sections,
    '',
    ...closing,
    evidenceMarker(head),
  ].join('\n')
}

/**
 * How many cases a rendered body carries, one per head image. A table row from
 * before the alt text named its head counts as one, so a comment in any earlier
 * layout still counts and the `would-empty` guard holds.
 */
export function countEvidenceCases(body: string): number {
  let total = 0
  for (const line of body.split('\n')) {
    const heads = line.match(HEAD_IMAGE_PATTERN)?.length ?? 0
    if (heads > 0) total += heads
    else if (line.startsWith('| ') && LEGACY_ROW_PATTERN.test(line)) total += 1
  }
  return total
}

export interface EvidenceComment {
  readonly url?: string
  readonly body: string
}

function hasEvidenceMarker(body: string): boolean {
  const lines = body.split('\n')
  let index = lines.length - 1
  while (index >= 0 && (lines[index] ?? '').trim() === '') index -= 1
  if (index < 0) return false
  return (lines[index] ?? '').trim().startsWith(MARKER_PREFIX)
}

/** Whether any comment carries the evidence marker, url or not. */
export function hasMarkedEvidenceComment(
  comments: readonly EvidenceComment[],
): boolean {
  return comments.some((comment) => hasEvidenceMarker(comment.body))
}

/** A post-pull-request step of the ship chain that never landed on the thread. */
export type OwedStep = 'evidence' | 'preview'

export interface OwedInput {
  readonly hasEvidenceChange: boolean
  readonly hasMarkedComment: boolean
  readonly carriedPreview: boolean
  /** A deploy workflow resolves and its push filter matches a path the pull request changed. */
  readonly deployServesChange: boolean
  /** How the newest successful deploy compares with the tip. Unread reads as fresh, the reading before the check compared heads. */
  readonly previewHead?: PreviewHeadReason
  /** Whether a served path changed between the built head and the tip. Unread reads as served, so a cut listing never settles. */
  readonly servedSinceBuilt?: boolean
}

/**
 * Whether a carried preview no longer serves the tip. A deploy still building
 * owes one too, since until it lands the address shows the older head.
 */
function isPreviewBehind(input: OwedInput): boolean {
  if (input.previewHead === 'stale') return input.servedSinceBuilt !== false
  return input.previewHead === 'building' || input.previewHead === 'no-build'
}

/**
 * The steps a pull request is still owed, read off the pull request rather
 * than off any session's account of what it ran. The thread cannot tell a
 * skipped preview from one whose deploy failed, so both read as owed.
 */
export function readOwed(input: OwedInput): OwedStep[] {
  const owed: OwedStep[] = []
  if (input.hasEvidenceChange && !input.hasMarkedComment) owed.push('evidence')
  if (
    (input.hasMarkedComment || input.hasEvidenceChange) &&
    input.deployServesChange &&
    (!input.carriedPreview || isPreviewBehind(input))
  ) {
    owed.push('preview')
  }
  return owed
}

/**
 * Design references are redrawn rather than captured, so recapturing them
 * neither owes nor stands in for an evidence capture.
 */
export const DESIGN_FOLDER = 'canon/design/'

/**
 * The painted paths changed while no evidence image did. Undefined when the base
 * keeps no captures or was not read, since an empty list reads as checked. Any
 * changed image clears it, since this names a skipped capture, not its coverage.
 */
export function readUncaptured(
  changed: readonly string[],
  patterns: PaintedPatterns,
  keepsCaptures: boolean | undefined,
): string[] | undefined {
  if (keepsCaptures !== true) return undefined
  if (changed.some(isEvidencePath)) return []
  return changed.filter(
    (path) =>
      evidencePosition(path) === -1 &&
      !path.startsWith(DESIGN_FOLDER) &&
      isPainted(path, patterns),
  )
}

/**
 * The REST id of the comment this module already posted, read off its `url`
 * field, since `gh pr view --json comments` reports only a GraphQL id there
 * and the REST id is what a later `PATCH` needs.
 */
export function findEvidenceCommentId(
  comments: readonly EvidenceComment[],
): number | undefined {
  for (const comment of comments) {
    if (!hasEvidenceMarker(comment.body)) continue
    const match =
      comment.url === undefined ? null : ISSUE_COMMENT_ID.exec(comment.url)
    if (match?.[1] !== undefined) return Number(match[1])
  }
  return undefined
}

/** How many cases the marked comment already shows, zero when none is marked. */
export function findEvidenceCaseCount(
  comments: readonly EvidenceComment[],
): number {
  const marked = comments.find((comment) => hasEvidenceMarker(comment.body))
  return marked === undefined ? 0 : countEvidenceCases(marked.body)
}

/** Lines that close the address region, being whatever a body carries below its addresses. */
const REGION_ENDS = [
  BASE_PREFIX,
  CHECKLIST_HEADING,
  '<details',
  CHECKLIST_START,
  MARKER_PREFIX,
]

export interface AddressReading {
  /** Indexes of the lines carrying a hosted or local segment. */
  readonly lines: readonly number[]
  readonly preview?: string
  readonly local?: string
}

function readSegment(segment: string, prefix: string): string | undefined {
  return segment.startsWith(prefix)
    ? segment.slice(prefix.length).trim() || undefined
    : undefined
}

/**
 * Reads each address prefix wherever it sits above the commit line, checklist,
 * comparison, or marker, so both layouts keep their links across a re-render
 * and a line quoted in a checklist is never taken for an address.
 */
export function readAddresses(body: string): AddressReading {
  const lines: number[] = []
  let preview: string | undefined
  let local: string | undefined
  const bodyLines = body.split('\n')
  for (let index = 0; index < bodyLines.length; index += 1) {
    const line = (bodyLines[index] ?? '').trim()
    if (REGION_ENDS.some((end) => line.startsWith(end))) break
    let isAddress = false
    for (const segment of line.split(ADDRESS_SEPARATOR.trim())) {
      const trimmed = segment.trim()
      const hosted = readSegment(trimmed, PREVIEW_PREFIX)
      const own = readSegment(trimmed, LOCAL_PREFIX)
      if (hosted !== undefined) preview ??= hosted
      if (own !== undefined) local ??= own
      if (hosted !== undefined || own !== undefined) isAddress = true
    }
    if (isAddress) lines.push(index)
  }
  return {
    lines,
    ...(preview !== undefined && { preview }),
    ...(local !== undefined && { local }),
  }
}

function findMarked(
  comments: readonly EvidenceComment[],
): EvidenceComment | undefined {
  return comments.find((comment) => hasEvidenceMarker(comment.body))
}

/**
 * The preview address the marked comment already carries. A re-render after
 * a later push passes no address of its own, and carrying this one forward
 * keeps that edit from deleting the link a reviewer is using.
 */
export function findEvidencePreview(
  comments: readonly EvidenceComment[],
): string | undefined {
  const marked = findMarked(comments)
  return marked === undefined ? undefined : readAddresses(marked.body).preview
}

/**
 * The local address the marked comment already carries, carried forward on a
 * re-render the way the hosted preview is.
 */
export function findEvidenceLocal(
  comments: readonly EvidenceComment[],
): string | undefined {
  const marked = findMarked(comments)
  return marked === undefined ? undefined : readAddresses(marked.body).local
}

/** Every reel the marked comment embeds, in the order it posts them, each with the width and head it was filmed at. */
export function findEvidenceReels(
  comments: readonly EvidenceComment[],
): EvidenceReel[] {
  const marked = findMarked(comments)
  if (marked === undefined) return []
  const lines = marked.body.split('\n').map((line) => line.trim())
  const reels: EvidenceReel[] = []
  for (const [index, line] of lines.entries()) {
    const match = REEL_LINE.exec(line)
    if (match?.[1] === undefined || match[2] === undefined) continue
    const link = match[2].replaceAll('&amp;', '&')
    const reel = { link, head: match[1], width: readReelWidth(link) }
    const covers = readReelCovers(lines.slice(index + 1))
    reels.push(covers === undefined ? reel : { ...reel, covers })
  }
  return reels
}

/** The coverage line directly under a reel line, past blank lines only, so a coverage line never attaches to a reel it does not follow. */
function readReelCovers(after: readonly string[]): string | undefined {
  const next = after.find((line) => line !== '')
  const covers =
    next === undefined ? undefined : readSegment(next, REEL_COVERS_PREFIX)
  return covers === undefined ? undefined : unescapeCell(covers)
}

/**
 * The skips the marked comment already carries, read from the address region
 * only, so a line quoted in a checklist is never taken for one. A re-render
 * passing no skip carries these forward the way it carries an address.
 */
export function findEvidenceSkips(
  comments: readonly EvidenceComment[],
): EvidenceSkips {
  const marked = findMarked(comments)
  if (marked === undefined) return {}
  let local: string | undefined
  let reel: string | undefined
  const reelByWidth = new Map<number, string>()
  for (const raw of marked.body.split('\n')) {
    const line = raw.trim()
    if (REGION_ENDS.some((end) => line.startsWith(end))) break
    const ownSkip = readSegment(line, LOCAL_SKIP_PREFIX)
    const reelSkip = readSegment(line, REEL_SKIP_PREFIX)
    const widthSkip = REEL_WIDTH_SKIP_LINE.exec(line)
    if (ownSkip !== undefined) local ??= unescapeCell(ownSkip)
    if (reelSkip !== undefined) reel ??= unescapeCell(reelSkip)
    const width = Number(widthSkip?.[1])
    const reason = widthSkip?.[2]?.trim() ?? ''
    if (reason !== '' && !reelByWidth.has(width)) {
      reelByWidth.set(width, unescapeCell(reason))
    }
  }
  return {
    ...(local !== undefined && { local }),
    ...(reel !== undefined && { reel }),
    ...(reelByWidth.size > 0 && { reelByWidth }),
  }
}

/** A reel the caller passed to a render, filmed at the head it describes. */
export interface PassedReel {
  readonly link: string
  readonly covers?: string
}

/**
 * The reels a render embeds, the passed ones first in the order given. A
 * passed reel replaces the posted one at its width and that one's coverage,
 * and a posted reel at any other width carries forward under its own head.
 */
export function nextEvidenceReels(
  passed: readonly PassedReel[],
  head: string,
  comments: readonly EvidenceComment[],
): EvidenceReel[] {
  const filmed = passed.map(({ link, covers }) => ({
    link,
    head,
    width: readReelWidth(link),
    ...(covers !== undefined && { covers }),
  }))
  const widths = new Set(filmed.map((reel) => reel.width))
  const kept = findEvidenceReels(comments).filter(
    (reel) => !widths.has(reel.width),
  )
  return [...filmed, ...kept]
}

/**
 * The checklist the marked comment carries. The handoff file is deleted once
 * posted, so carrying this forward keeps a re-render from wiping ticked boxes.
 */
export function findEvidenceChecklist(
  comments: readonly EvidenceComment[],
): string | undefined {
  const marked = comments.find((comment) => hasEvidenceMarker(comment.body))
  if (marked === undefined) return undefined
  const start = marked.body.indexOf(CHECKLIST_START)
  const end = marked.body.indexOf(CHECKLIST_END, start)
  if (start === -1 || end === -1) return undefined
  return (
    marked.body.slice(start + CHECKLIST_START.length, end).trim() || undefined
  )
}

export interface ChecklistBox {
  /** One-based position among the checklist's boxes, in the order they appear. */
  readonly number: number
  /** Index of the box's line within the checklist. */
  readonly line: number
  /** The box text with any stamp removed. */
  readonly text: string
  readonly isTicked: boolean
  /** The short sha a tick names, absent on an empty box or a tick nothing stamped. */
  readonly stamp?: string
  /** Whether the box's trailing marker run holds `(taste)`, which no driver ticks. */
  readonly isTaste: boolean
  /** The width the box names in its `<route>, <width>:` opening, absent when it names none. */
  readonly width?: number
}

export interface BoxLine {
  readonly before: string
  readonly isTicked: boolean
  readonly text: string
  readonly stamp?: string
}

/** Splits one checklist line into its box parts, or undefined when the line is not a box. */
export function parseBoxLine(line: string): BoxLine | undefined {
  const match = BOX_LINE.exec(line)
  if (match === null) return undefined
  const rest = (match[4] ?? '').trimEnd()
  const stamped = STAMP.exec(rest)
  return {
    before: match[1] ?? '',
    isTicked: (match[2] ?? ' ') !== ' ',
    text: stamped === null ? rest : rest.slice(0, stamped.index),
    ...(stamped?.[1] !== undefined && { stamp: stamped[1] }),
  }
}

/** The box line for the given parts, written back in the one shape the reader accepts. */
export function writeBoxLine(
  box: Pick<BoxLine, 'before' | 'text'>,
  stampedAt?: string,
): string {
  return stampedAt === undefined
    ? `${box.before} ] ${box.text}`
    : `${box.before}x] ${box.text} · passed at \`${stampedAt.slice(0, SHORT_SHA_LENGTH)}\``
}

/** Every box of a checklist in order, numbered the way `canon pr tick` takes them. */
export function readChecklistBoxes(checklist: string): ChecklistBox[] {
  const boxes: ChecklistBox[] = []
  checklist.split('\n').forEach((line, index) => {
    const parsed = parseBoxLine(line)
    if (parsed === undefined) return
    boxes.push({
      number: boxes.length + 1,
      line: index,
      text: parsed.text,
      isTicked: parsed.isTicked,
      ...(parsed.stamp !== undefined && { stamp: parsed.stamp }),
      isTaste: hasTasteMarker(parsed.text),
      ...readBoxWidth(parsed.text),
    })
  })
  return boxes
}

/** The width a box opening on `<route>, <width>: ` names, read from the text before its first `: ` alone. */
function readBoxWidth(text: string): { width?: number } {
  const opening = text.split(': ')[0] ?? ''
  if (opening === text) return {}
  const width = /, ([1-9]\d*)$/.exec(opening)?.[1]
  return width === undefined ? {} : { width: Number(width) }
}

/** The viewport width a reel at each device class films at, as `reel-widths.md` passes `--viewport`. */
const CLASS_REEL_WIDTHS: Readonly<Record<DeviceClass, number>> = {
  phone: 390,
  tablet: 768,
  desktop: DEFAULT_REEL_WIDTH,
}

/** The width a box naming none films at, being the widest class the project supports. */
export function defaultReelWidth(
  classes: readonly DeviceClass[] = DEVICE_CLASSES,
): number {
  const widest = classes.at(-1)
  return widest === undefined ? DEFAULT_REEL_WIDTH : CLASS_REEL_WIDTHS[widest]
}

/**
 * The widths a reel is owed at, one per width a drivable box names and the default for a box naming none or a
 * malformed one, narrowest first. A width outside the device classes the project supports is owed nothing.
 */
export function owedReelWidths(
  boxes: readonly ChecklistBox[],
  classes: readonly DeviceClass[] = DEVICE_CLASSES,
): number[] {
  const widths = new Set(
    boxes
      .filter((box) => !box.isTaste)
      .map((box) => box.width ?? defaultReelWidth(classes))
      .filter((width) => classes.includes(deviceClassOf(width))),
  )
  return [...widths].sort((a, b) => a - b)
}

function hasTasteMarker(text: string): boolean {
  const run = TRAILING_MARKERS.exec(text)?.[0] ?? ''
  const markers: readonly string[] = run.match(/\([^()]*\)/g) ?? []
  return markers.includes(TASTE_MARKER)
}

/** The boxes a driver can run, being every box but a taste one. */
export function countDrivable(boxes: readonly ChecklistBox[]): number {
  return boxes.filter((box) => !box.isTaste).length
}

/** The head the marked comment's trailing marker names. */
export function findEvidenceHead(
  comments: readonly EvidenceComment[],
): string | undefined {
  const marked = comments.find((comment) => hasEvidenceMarker(comment.body))
  if (marked === undefined) return undefined
  const lines = marked.body.trimEnd().split('\n')
  const match = /head=(\S+)/.exec(lines[lines.length - 1] ?? '')
  return match?.[1]
}

/**
 * Clears every tick the render's head has not earned. A stamped tick stays
 * while its sha is a prefix of the head. An unstamped one names no head, so
 * it stays only while the comment it came from described this same head.
 */
export function settleChecklist(
  checklist: string,
  head: string,
  carriedHead: string | undefined,
): string {
  return checklist
    .split('\n')
    .map((line) => {
      const parsed = parseBoxLine(line)
      if (parsed === undefined || !parsed.isTicked) return line
      const isEarned =
        parsed.stamp === undefined
          ? carriedHead === head
          : head.startsWith(parsed.stamp)
      return isEarned ? line : writeBoxLine(parsed)
    })
    .join('\n')
}
