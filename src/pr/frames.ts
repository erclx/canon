import { readFile } from 'node:fs/promises'

/** The branch holding review frames. It never merges into a branch anyone checks out. */
export const FRAMES_BRANCH = 'canon/frames'

/** The branch frames lived on before the rename. A drop and a prune drain it and an add never writes it. */
export const LEGACY_FRAMES_BRANCH = 'canon-frames'

/** The eight bytes every PNG opens with. A frame that lacks them embeds as a broken image. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

const SHORT_HEAD_LENGTH = 7

const HEAD_PATTERN = /^[0-9a-f]{7,40}$/

/** A compact UTC instant such as `20261002T154450Z`, the form `date -u +%Y%m%dT%H%M%SZ` prints. */
const PASS_PATTERN = /^\d{8}T\d{6}Z$/

/** How many times an add rebuilds on a tip another writer moved. */
const ADD_ATTEMPTS = 3

/** One half of a reference address. It opens on a letter or digit and holds no separator, so `..` and `/` cannot survive it. */
const REFERENCE_PART = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

/** A tracked reference, `canon/design/<surface>/<name>`, whose name may carry its `.png`. The halves are validated as a canvas address's are. */
const DESIGN_REFERENCE = /^canon\/design\/([^/]+)\/([^/]+?)(?:\.png)?$/

const FOLDER_PATTERN = /^pr-(\d+)$/

const DAY_MS = 86_400_000

const THEMES = ['dark', 'light'] as const

export type FrameTheme = (typeof THEMES)[number]

export interface TreeEntry {
  readonly path: string
  readonly mode: string
  readonly type: 'blob' | 'tree'
  readonly sha: string
}

export type Tip =
  | { readonly kind: 'found'; readonly commit: string; readonly tree: string }
  | { readonly kind: 'missing' }
  | { readonly kind: 'unreadable' }

/** How a ref write landed. `conflict` means another writer holds the ref the call expected to own. */
export type RefWrite = 'ok' | 'conflict' | 'failed'

export interface PullClosure {
  readonly state: 'open' | 'closed'
  readonly closedAt?: string
}

/**
 * The git data API calls a frame write needs, injected so the logic runs
 * without a network. Every read that fails returns undefined rather than
 * throwing, and each caller decides what an absent answer means.
 */
export interface FramesApi {
  readTip(): Promise<Tip>
  listTree(tree: string): Promise<readonly TreeEntry[] | undefined>
  createBlob(base64: string): Promise<string | undefined>
  createTree(
    entries: readonly TreeEntry[],
    base?: string,
  ): Promise<string | undefined>
  createCommit(
    message: string,
    tree: string,
    parents: readonly string[],
  ): Promise<string | undefined>
  createRef(commit: string): Promise<RefWrite>
  moveRef(commit: string, force: boolean): Promise<RefWrite>
  deleteRef(): Promise<boolean>
  readPull(number: number): Promise<PullClosure | undefined>
}

export type FramesRefusal = 'unreadable-tip' | 'push-failed' | 'ref-conflict'

export interface FrameInput {
  readonly number: number
  readonly head: string
  readonly pass: string
  readonly box?: number
  readonly reference?: string
  readonly theme?: FrameTheme
  readonly bytes: Uint8Array
}

export type PushResult =
  | {
      readonly kind: 'pushed'
      readonly commit: string
      readonly path: string
      readonly created: boolean
    }
  | { readonly kind: 'refused'; readonly reason: FramesRefusal }

export type DropResult =
  | {
      readonly kind: 'dropped'
      readonly removed: readonly number[]
      readonly commit?: string
      readonly deleted?: boolean
      readonly legacy?: true
    }
  | { readonly kind: 'refused'; readonly reason: FramesRefusal }

export type PruneResult =
  | {
      readonly kind: 'dropped'
      readonly removed: readonly number[]
      readonly kept: readonly number[]
      readonly unread: readonly number[]
      readonly commit?: string
      readonly deleted?: boolean
      readonly legacy?: true
    }
  | { readonly kind: 'refused'; readonly reason: FramesRefusal }

/** Whether a value names a commit, so a branch name or a path never becomes a folder. */
export function isFrameHead(head: string): boolean {
  return HEAD_PATTERN.test(head)
}

/** Whether a value is a compact UTC stamp, the only pass segment the path takes. */
export function isFramePass(pass: string): boolean {
  return PASS_PATTERN.test(pass)
}

/** Whether a value names a theme a box can be shot at, the only theme segment the path takes. */
export function isFrameTheme(theme: string): theme is FrameTheme {
  return (THEMES as readonly string[]).includes(theme)
}

/**
 * Where a frame lands. The pass segment keeps a second pass at the same head
 * and box from replacing the image an earlier review comment shows, since a
 * branch-path link reads whatever the path holds now. The theme segment keeps
 * two shots of one box in one pass apart, and a frame without one keeps the
 * plain `box-<n>.png` form.
 */
export function framePath(
  number: number,
  head: string,
  pass: string,
  box: number,
  theme?: FrameTheme,
): string {
  const name = theme === undefined ? `box-${box}` : `box-${box}-${theme}`
  return `pr-${number}/${head.slice(0, SHORT_HEAD_LENGTH)}/${pass}/${name}.png`
}

/**
 * The embed link, by branch path rather than by commit. Every drop rewrites
 * the branch, so a commit-pinned link to another pull request's frame would
 * stop resolving once GitHub collects the commit, while a path link lives
 * exactly as long as its file. The blob form is the one `canon pr evidence`
 * embeds, which a private repository's browser can open where the raw host
 * serves nothing.
 */
export function frameLink(repo: string, path: string): string {
  return `https://github.com/${repo}/blob/${FRAMES_BRANCH}/${path}?raw=true`
}

/**
 * The file-name slug of a `<page>/<frame>` address or a tracked
 * `canon/design/<surface>/<name>` path, or undefined when the
 * address would not round-trip. Each half must open on a letter or digit and
 * hold only letters, digits, dots, underscores, and dashes, and neither may
 * carry `--`, so the joined slug reads back as the same two names and a path
 * never gains a directory or escapes the pass folder.
 */
export function referenceSlug(address: string): string | undefined {
  const tracked = DESIGN_REFERENCE.exec(address)
  const parts = tracked ? [tracked[1], tracked[2]] : address.split('/')
  if (parts.length !== 2) return undefined
  const [page, frame] = parts as [string, string]
  const valid = [page, frame].every(
    (part) => REFERENCE_PART.test(part) && !part.includes('--'),
  )
  if (!valid) return undefined
  return tracked ? `design--${page}--${frame}` : `${page}--${frame}`
}

/** Whether a reference names a tracked `canon/design/<surface>/<name>` file rather than a `<page>/<frame>` address. */
export function isDesignReference(address: string): boolean {
  return DESIGN_REFERENCE.test(address)
}

/**
 * Where a design reference capture lands, beside the evidence frames of one
 * pass. The slug repeats for one reference, so a second capture in a pass
 * overwrites only itself. Undefined when the address has no valid slug.
 */
export function referencePath(
  number: number,
  head: string,
  pass: string,
  address: string,
): string | undefined {
  const slug = referenceSlug(address)
  if (slug === undefined) return undefined
  return `pr-${number}/${head.slice(0, SHORT_HEAD_LENGTH)}/${pass}/ref-${slug}.png`
}

/** The frame's bytes, or undefined when the file is absent, empty, or not a PNG. */
export async function readFrame(path: string): Promise<Uint8Array | undefined> {
  const bytes = await readFile(path).catch(() => undefined)
  if (bytes === undefined || bytes.length <= PNG_SIGNATURE.length) {
    return undefined
  }
  return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)
    ? new Uint8Array(bytes)
    : undefined
}

/**
 * Commits one frame onto the branch, creating the branch with a root
 * commit when it is missing. The ref only fast-forwards here, so a drop or a
 * second add landing between the read and the move fails the move, and the
 * add rebuilds on the tip that writer left.
 */
export async function pushFrame(
  api: FramesApi,
  input: FrameInput,
): Promise<PushResult> {
  const path =
    input.reference === undefined
      ? framePath(
          input.number,
          input.head,
          input.pass,
          input.box ?? 0,
          input.theme,
        )
      : referencePath(input.number, input.head, input.pass, input.reference)
  if (path === undefined) return { kind: 'refused', reason: 'push-failed' }
  const blob = await api.createBlob(Buffer.from(input.bytes).toString('base64'))
  if (blob === undefined) return { kind: 'refused', reason: 'push-failed' }
  const entry: TreeEntry = { path, mode: '100644', type: 'blob', sha: blob }
  const message =
    input.reference === undefined
      ? `chore(frames): add box ${input.box} of #${input.number}`
      : `chore(frames): add reference ${input.reference} of #${input.number}`

  for (let attempt = 0; attempt < ADD_ATTEMPTS; attempt += 1) {
    const tip = await api.readTip()
    if (tip.kind === 'unreadable') {
      return { kind: 'refused', reason: 'unreadable-tip' }
    }

    const base = tip.kind === 'found' ? tip.tree : undefined
    const tree = await api.createTree([entry], base)
    if (tree === undefined) return { kind: 'refused', reason: 'push-failed' }
    const parents = tip.kind === 'found' ? [tip.commit] : []
    const commit = await api.createCommit(message, tree, parents)
    if (commit === undefined) return { kind: 'refused', reason: 'push-failed' }

    const write =
      tip.kind === 'found'
        ? await api.moveRef(commit, false)
        : await api.createRef(commit)
    if (write === 'failed') return { kind: 'refused', reason: 'push-failed' }
    if (write === 'ok') {
      return { kind: 'pushed', commit, path, created: tip.kind === 'missing' }
    }
  }
  return { kind: 'refused', reason: 'ref-conflict' }
}

function folderNumber(entry: TreeEntry): number | undefined {
  if (entry.type !== 'tree') return undefined
  const match = FOLDER_PATTERN.exec(entry.path)
  return match?.[1] === undefined ? undefined : Number(match[1])
}

async function readFolders(
  api: FramesApi,
): Promise<
  | { readonly kind: 'read'; readonly entries: readonly TreeEntry[] }
  | { readonly kind: 'missing' }
  | { readonly kind: 'refused'; readonly reason: FramesRefusal }
> {
  const tip = await api.readTip()
  if (tip.kind === 'missing') return { kind: 'missing' }
  if (tip.kind === 'unreadable') {
    return { kind: 'refused', reason: 'unreadable-tip' }
  }
  const entries = await api.listTree(tip.tree)
  if (entries === undefined) {
    return { kind: 'refused', reason: 'unreadable-tip' }
  }
  return { kind: 'read', entries }
}

/**
 * Rewrites the branch without the named pull requests' folders, as one
 * root commit the ref is force-moved to. A plain delete commit would
 * keep every dropped image reachable through history. The rewrite builds from
 * the tip it reads, and a branch left empty is deleted rather than holding an
 * empty tree.
 */
async function rewriteWithout(
  api: FramesApi,
  entries: readonly TreeEntry[],
  drop: ReadonlySet<number>,
): Promise<DropResult> {
  const removed = entries
    .map(folderNumber)
    .filter((n): n is number => n !== undefined && drop.has(n))
    .sort((a, b) => a - b)
  if (removed.length === 0) return { kind: 'dropped', removed: [] }

  const kept = entries.filter((entry) => {
    const n = folderNumber(entry)
    return n === undefined || !drop.has(n)
  })
  if (kept.length === 0) {
    return (await api.deleteRef())
      ? { kind: 'dropped', removed, deleted: true }
      : { kind: 'refused', reason: 'push-failed' }
  }

  const tree = await api.createTree(kept)
  if (tree === undefined) return { kind: 'refused', reason: 'push-failed' }
  const message = `chore(frames): drop ${removed.map((n) => `#${n}`).join(', ')}`
  const commit = await api.createCommit(message, tree, [])
  if (commit === undefined) return { kind: 'refused', reason: 'push-failed' }
  const write = await api.moveRef(commit, true)
  return write === 'ok'
    ? { kind: 'dropped', removed, commit }
    : { kind: 'refused', reason: 'push-failed' }
}

export async function dropFrames(
  api: FramesApi,
  numbers: readonly number[],
): Promise<DropResult> {
  const folders = await readFolders(api)
  if (folders.kind === 'missing') return { kind: 'dropped', removed: [] }
  if (folders.kind === 'refused') return folders
  return rewriteWithout(api, folders.entries, new Set(numbers))
}

/**
 * Whether a pull request's frames are past keeping. Only a pull request
 * reading closed, with a close date strictly older than the window, expires,
 * so a reopened one, an unread one, and one at the boundary all stay.
 */
export function isExpired(
  closure: PullClosure | undefined,
  days: number,
  now: Date,
): boolean {
  if (closure?.state !== 'closed' || closure.closedAt === undefined) {
    return false
  }
  const closed = Date.parse(closure.closedAt)
  if (Number.isNaN(closed)) return false
  return now.getTime() - closed > days * DAY_MS
}

/**
 * Drops every pull request on the branch that closed more than `days` ago, in
 * one rewrite. A pull request whose state could not be read is kept and
 * listed under `unread`, so a failed read never deletes frames.
 */
export async function pruneFrames(
  api: FramesApi,
  days: number,
  now: Date,
): Promise<PruneResult> {
  const folders = await readFolders(api)
  if (folders.kind === 'missing') {
    return { kind: 'dropped', removed: [], kept: [], unread: [] }
  }
  if (folders.kind === 'refused') return folders

  const numbers = folders.entries
    .map(folderNumber)
    .filter((n): n is number => n !== undefined)
  const closures = await Promise.all(numbers.map((n) => api.readPull(n)))
  const expired = new Set<number>()
  const kept: number[] = []
  const unread: number[] = []
  numbers.forEach((n, index) => {
    const closure = closures[index]
    if (closure === undefined) unread.push(n)
    if (isExpired(closure, days, now)) expired.add(n)
    else kept.push(n)
  })

  const result = await rewriteWithout(api, folders.entries, expired)
  if (result.kind === 'refused') return result
  return {
    ...result,
    kept: kept.sort((a, b) => a - b),
    unread: unread.sort((a, b) => a - b),
  }
}

function mergeNumbers(
  first: readonly number[],
  second: readonly number[],
): number[] {
  return [...new Set([...first, ...second])].sort((a, b) => a - b)
}

/** Whether a drain pass changed the legacy ref, by removing a pull request or deleting it. */
function touchedLegacy(result: DropResult): boolean {
  return (
    result.kind === 'dropped' &&
    (result.removed.length > 0 || result.deleted === true)
  )
}

/**
 * Drops on the current branch, then on the legacy one. The legacy pass only
 * removes, and a refusal there never fails a drop the current branch already
 * finished, since a target that never held the legacy ref reads it as missing
 * and a token may be unable to read it at all.
 */
export async function dropFramesWithLegacy(
  api: FramesApi,
  legacy: FramesApi,
  numbers: readonly number[],
): Promise<DropResult> {
  const current = await dropFrames(api, numbers)
  if (current.kind === 'refused') return current
  const drained = await dropFrames(legacy, numbers)
  if (drained.kind === 'refused' || !touchedLegacy(drained)) return current
  return {
    ...current,
    removed: mergeNumbers(current.removed, drained.removed),
    legacy: true,
  }
}

/** The prune counterpart of `dropFramesWithLegacy`, with the same legacy semantics. */
export async function pruneFramesWithLegacy(
  api: FramesApi,
  legacy: FramesApi,
  days: number,
  now: Date,
): Promise<PruneResult> {
  const current = await pruneFrames(api, days, now)
  if (current.kind === 'refused') return current
  const drained = await pruneFrames(legacy, days, now)
  if (drained.kind === 'refused') return current
  const touched = drained.removed.length > 0 || drained.deleted === true
  const kept = mergeNumbers(current.kept, drained.kept)
  const unread = mergeNumbers(current.unread, drained.unread)
  return {
    ...current,
    removed: mergeNumbers(current.removed, drained.removed),
    kept,
    unread,
    ...(touched && { legacy: true as const }),
  }
}
