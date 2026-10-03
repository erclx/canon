import { createHash } from 'node:crypto'
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import {
  type ElementAddress,
  resolveAddress,
  type SourceElement,
} from '@/canvas/address'
import { recordDir } from '@/record-root'

/**
 * The content format. A page is a folder under the record root's `canvas/`, a
 * frame is one `.html` file in it, and `layout.json` beside them holds each
 * frame's box. The HTML stays a plain file so an agent edits a frame the way it
 * edits any other file, and the box lives apart from it so moving a frame never
 * rewrites its markup.
 */
export const CANVAS_FOLDER = 'canvas'

export const LAYOUT_FILE = 'layout.json'

/** The frame or element the operator pointed at, beside the pages it names. */
export const SELECTION_FILE = 'selection.json'

/** Suffix of the file a write goes through before it replaces its target. */
export const TEMP_SUFFIX = '.tmp'

/** Suffix of the file a writer holds while it reads, merges, and replaces. */
export const LOCK_SUFFIX = '.lock'

/** A lock older than this was left by a writer that died holding it. */
const LOCK_STALE_MS = 10_000

/** How long a writer waits on another's lock before it refuses. */
const LOCK_WAIT_MS = 2_000

const LOCK_POLL_MS = 5

const FRAME_EXTENSION = '.html'

/** The size a frame takes when nothing states one. */
export const DEFAULT_FRAME = { width: 1440, height: 900 } as const

/** Horizontal space between frames placed in a row. */
export const FRAME_GAP = 80

/**
 * One path segment with no dot leading it, so a name can neither climb out of
 * the canvas folder nor hide as a dotfile the listing skips.
 */
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

export interface Box {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface Frame extends Box {
  readonly name: string
  /** Relative to the page folder. */
  readonly file: string
  /** Whether the layout stated this box, or the reader placed it in a row. */
  readonly placed: boolean
}

export interface Page {
  readonly name: string
  readonly frames: readonly Frame[]
  /** Set when `layout.json` exists and does not parse. Frames still list. */
  readonly layoutIssue?: 'malformed'
}

export type ContentRefusal =
  | 'invalid-name'
  | 'invalid-size'
  | 'exists'
  | 'no-page'
  | 'no-frame'
  | 'invalid-position'
  | 'malformed-layout'
  | 'busy'
  | 'invalid-address'
  | 'address-mismatch'

export interface ContentRefused {
  readonly ok: false
  readonly reason: ContentRefusal
  readonly detail: string
}

export type PageOutcome =
  | { readonly ok: true; readonly page: string }
  | ContentRefused

export type FrameOutcome =
  | {
      readonly ok: true
      readonly page: string
      readonly frame: string
      readonly file: string
      readonly box: Box
    }
  | ContentRefused

export function canvasDir(root: string): string {
  return recordDir(root, CANVAS_FOLDER)
}

function pagePath(root: string, page: string): string {
  return join(canvasDir(root), page)
}

function refuse(reason: ContentRefusal, detail: string): ContentRefused {
  return { ok: false, reason, detail }
}

function isValidName(name: string): boolean {
  return NAME_PATTERN.test(name) && !name.includes('..')
}

function isDirectory(path: string): boolean {
  return statSync(path, { throwIfNoEntry: false })?.isDirectory() ?? false
}

function isBox(value: unknown): value is Box {
  if (typeof value !== 'object' || value === null) return false
  const box = value as Record<string, unknown>
  return ['x', 'y', 'width', 'height'].every(
    (key) => typeof box[key] === 'number' && Number.isFinite(box[key]),
  )
}

interface LayoutRead {
  readonly boxes: ReadonlyMap<string, Box>
  readonly malformed: boolean
}

/**
 * Reads what a layout states and nothing else. An entry with a box that is not
 * four finite numbers is skipped rather than refused, since one bad entry
 * should cost that frame its position and not the whole page its frames.
 */
function readLayout(dir: string): LayoutRead {
  const path = join(dir, LAYOUT_FILE)
  if (!existsSync(path)) return { boxes: new Map(), malformed: false }

  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return { boxes: new Map(), malformed: true }
  }

  const frames =
    typeof parsed === 'object' && parsed !== null
      ? (parsed as { frames?: unknown }).frames
      : undefined
  if (typeof frames !== 'object' || frames === null) {
    return { boxes: new Map(), malformed: true }
  }

  const boxes = new Map<string, Box>()
  for (const [name, box] of Object.entries(frames)) {
    if (isBox(box)) {
      boxes.set(name, {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      })
    }
  }
  return { boxes, malformed: false }
}

function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/**
 * Holds an exclusive lock file for the length of a read, merge, and write. The
 * server and a CLI verb are two processes, so a synchronous step inside either
 * does not keep them from reading the same layout and each replacing it with
 * its own edit, which loses the other's. A refused call leaves the file as it
 * found it.
 */
function withLayoutLock(dir: string, run: () => FrameOutcome): FrameOutcome {
  const lock = join(dir, `${LAYOUT_FILE}${LOCK_SUFFIX}`)
  const deadline = Date.now() + LOCK_WAIT_MS
  for (;;) {
    try {
      closeSync(openSync(lock, 'wx'))
      break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      const modified = statSync(lock, { throwIfNoEntry: false })?.mtimeMs
      if (modified !== undefined && Date.now() - modified > LOCK_STALE_MS) {
        rmSync(lock, { force: true })
        continue
      }
      if (Date.now() >= deadline) {
        return refuse('busy', `${LAYOUT_FILE} is being written, try again`)
      }
      sleep(LOCK_POLL_MS)
    }
  }
  try {
    return run()
  } finally {
    rmSync(lock, { force: true })
  }
}

/**
 * Replaces the file in one rename, so the shell reading while a CLI verb writes
 * never sees half a layout and reports it as malformed. The caller holds
 * `withLayoutLock`, which is what keeps two writers from losing each other.
 */
function writeLayout(dir: string, boxes: ReadonlyMap<string, Box>): void {
  const frames = Object.fromEntries(boxes)
  const target = join(dir, LAYOUT_FILE)
  const temp = `${target}.${process.pid}${TEMP_SUFFIX}`
  writeFileSync(temp, `${JSON.stringify({ frames }, null, 2)}\n`)
  renameSync(temp, target)
}

function frameNames(dir: string): string[] {
  return readdirSync(dir)
    .filter((entry) => entry.endsWith(FRAME_EXTENSION))
    .map((entry) => entry.slice(0, -FRAME_EXTENSION.length))
    .filter(isValidName)
    .sort((a, b) => a.localeCompare(b))
}

/** The x a frame starts at when it joins the row after every box given. */
function nextX(boxes: Iterable<Box>): number {
  let right: number | undefined
  for (const box of boxes) {
    const edge = box.x + box.width
    right = right === undefined ? edge : Math.max(right, edge)
  }
  return right === undefined ? 0 : right + FRAME_GAP
}

export function readPage(root: string, page: string): Page | undefined {
  if (!isValidName(page)) return undefined
  const dir = pagePath(root, page)
  if (!isDirectory(dir)) return undefined

  const { boxes, malformed } = readLayout(dir)
  const names = frameNames(dir)

  const placed = names.filter((name) => boxes.has(name))
  const frames: Frame[] = []
  for (const name of placed) {
    const box = boxes.get(name)
    if (box) {
      frames.push({
        name,
        file: `${name}${FRAME_EXTENSION}`,
        ...box,
        placed: true,
      })
    }
  }

  for (const name of names.filter((candidate) => !boxes.has(candidate))) {
    frames.push({
      name,
      file: `${name}${FRAME_EXTENSION}`,
      x: nextX(frames),
      y: 0,
      ...DEFAULT_FRAME,
      placed: false,
    })
  }

  frames.sort((a, b) => a.name.localeCompare(b.name))
  return malformed
    ? { name: page, frames, layoutIssue: 'malformed' }
    : { name: page, frames }
}

export function listPages(root: string): Page[] {
  const dir = canvasDir(root)
  if (!isDirectory(dir)) return []

  return readdirSync(dir)
    .filter(isValidName)
    .filter((name) => isDirectory(join(dir, name)))
    .sort((a, b) => a.localeCompare(b))
    .flatMap((name) => readPage(root, name) ?? [])
}

export function addPage(root: string, page: string): PageOutcome {
  if (!isValidName(page)) {
    return refuse('invalid-name', `${page} is not a valid page name`)
  }
  const dir = pagePath(root, page)
  if (existsSync(dir)) return refuse('exists', `page ${page} already exists`)

  mkdirSync(dir, { recursive: true })
  return { ok: true, page }
}

export function renamePage(
  root: string,
  from: string,
  to: string,
): PageOutcome {
  if (!isValidName(from) || !isValidName(to)) {
    return refuse(
      'invalid-name',
      `${isValidName(from) ? to : from} is not a valid page name`,
    )
  }
  const source = pagePath(root, from)
  if (!isDirectory(source))
    return refuse('no-page', `page ${from} does not exist`)
  const target = pagePath(root, to)
  if (existsSync(target)) return refuse('exists', `page ${to} already exists`)

  renameSync(source, target)
  return { ok: true, page: to }
}

function frameScaffold(name: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${name}</title>
  </head>
  <body>
    <main>
      <h1>${name}</h1>
    </main>
  </body>
</html>
`
}

export interface FrameSize {
  readonly width: number
  readonly height: number
}

export function addFrame(
  root: string,
  page: string,
  frame: string,
  size: FrameSize,
): FrameOutcome {
  if (!isValidName(page)) {
    return refuse('invalid-name', `${page} is not a valid page name`)
  }
  if (!isValidName(frame)) {
    return refuse('invalid-name', `${frame} is not a valid frame name`)
  }
  const isPositive = (value: number) => Number.isFinite(value) && value > 0
  if (!isPositive(size.width) || !isPositive(size.height)) {
    return refuse('invalid-size', 'width and height must be positive numbers')
  }

  const dir = pagePath(root, page)
  if (!isDirectory(dir)) return refuse('no-page', `page ${page} does not exist`)
  const file = `${frame}${FRAME_EXTENSION}`
  if (existsSync(join(dir, file))) {
    return refuse('exists', `frame ${frame} already exists on ${page}`)
  }

  return withLayoutLock(dir, () => {
    /*
     * Placed against the boxes a reader would draw, unplaced frames included,
     * so a new frame never lands under one the layout has yet to name.
     */
    const current = readPage(root, page)?.frames ?? []
    const { boxes, malformed } = readLayout(dir)
    /* Writing over a layout that does not parse would erase every box in it. */
    if (malformed) {
      return refuse('malformed-layout', `${page}/${LAYOUT_FILE} does not parse`)
    }
    const box: Box = { x: nextX(current), y: 0, ...size }

    writeFileSync(join(dir, file), frameScaffold(frame))
    writeLayout(dir, new Map([...boxes, [frame, box]]))
    return { ok: true, page, frame, file, box }
  })
}

export interface Position {
  readonly x: number
  readonly y: number
}

/**
 * Moves one frame and keeps its size. A frame the layout never named takes the
 * default size it was already drawn at, so the move does not resize it.
 */
export function moveFrame(
  root: string,
  page: string,
  frame: string,
  to: Position,
): FrameOutcome {
  if (!isValidName(page)) {
    return refuse('invalid-name', `${page} is not a valid page name`)
  }
  if (!isValidName(frame)) {
    return refuse('invalid-name', `${frame} is not a valid frame name`)
  }
  if (!Number.isFinite(to.x) || !Number.isFinite(to.y)) {
    return refuse('invalid-position', 'x and y must be numbers')
  }

  const dir = pagePath(root, page)
  if (!isDirectory(dir)) return refuse('no-page', `page ${page} does not exist`)
  const file = `${frame}${FRAME_EXTENSION}`
  if (!existsSync(join(dir, file))) {
    return refuse('no-frame', `frame ${frame} does not exist on ${page}`)
  }

  return withLayoutLock(dir, () => {
    const { boxes, malformed } = readLayout(dir)
    if (malformed) {
      return refuse('malformed-layout', `${page}/${LAYOUT_FILE} does not parse`)
    }
    const size = boxes.get(frame) ?? DEFAULT_FRAME
    const box: Box = {
      x: to.x,
      y: to.y,
      width: size.width,
      height: size.height,
    }

    writeLayout(dir, new Map([...boxes, [frame, box]]))
    return { ok: true, page, frame, file, box }
  })
}

export interface Selection {
  readonly page: string
  readonly frame: string
  readonly element?: ElementAddress
}

export interface SelectedElement extends SourceElement {
  readonly index: number
  /**
   * Whether the frame file changed since the element was picked. The address
   * is an index, so an edit can shift it onto another element, and the fields
   * here are what was picked rather than what sits at the index now.
   */
  readonly stale: boolean
}

export interface SelectedFrame {
  readonly page: string
  readonly frame: string
  readonly file: string
  readonly box: Box
  readonly element?: SelectedElement
}

export type SelectionOutcome = { readonly ok: true } | ContentRefused

interface StoredElement extends SourceElement {
  readonly index: number
  readonly hash: string
}

function selectionPath(root: string): string {
  return join(canvasDir(root), SELECTION_FILE)
}

function contentHash(html: string): string {
  return createHash('sha256').update(html).digest('hex')
}

function isAddress(value: ElementAddress): boolean {
  return (
    Number.isInteger(value.index) &&
    Number.isInteger(value.count) &&
    value.index >= 0 &&
    value.index < value.count &&
    typeof value.tag === 'string' &&
    value.tag !== ''
  )
}

/**
 * Records which frame, or which element in it, "this one" means, or clears it.
 * Only a frame on disk can be recorded, and only an element the file holds at
 * the address given, so the file never names something a reader would have to
 * guess about.
 */
export function writeSelection(
  root: string,
  selection: Selection | undefined,
): SelectionOutcome {
  if (selection === undefined) {
    if (existsSync(selectionPath(root))) unlinkSync(selectionPath(root))
    return { ok: true }
  }

  const { page, frame, element } = selection
  if (!isValidName(page) || !isValidName(frame)) {
    return refuse('invalid-name', `${page}/${frame} is not a valid frame`)
  }
  const onPage = readPage(root, page)
  if (!onPage) return refuse('no-page', `page ${page} does not exist`)
  const found = onPage.frames.find((candidate) => candidate.name === frame)
  if (!found) {
    return refuse('no-frame', `frame ${frame} does not exist on ${page}`)
  }

  let stored: StoredElement | undefined
  if (element !== undefined) {
    if (!isAddress(element)) {
      return refuse(
        'invalid-address',
        'an element address needs a whole index below its count and a tag',
      )
    }
    const html = readFileSync(join(pagePath(root, page), found.file), 'utf8')
    const check = resolveAddress(html, element)
    if (!check.ok) return refuse(check.reason, check.detail)
    stored = { index: element.index, ...check.element, hash: contentHash(html) }
  }

  const target = selectionPath(root)
  const temp = `${target}.${process.pid}${TEMP_SUFFIX}`
  const record = stored ? { page, frame, element: stored } : { page, frame }
  writeFileSync(temp, `${JSON.stringify(record)}\n`)
  renameSync(temp, target)
  return { ok: true }
}

function readStoredElement(value: unknown): StoredElement | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const { index, tag, classes, text, hash } = value as Record<string, unknown>
  if (
    typeof index !== 'number' ||
    typeof tag !== 'string' ||
    !Array.isArray(classes) ||
    !classes.every((name) => typeof name === 'string') ||
    typeof text !== 'string' ||
    typeof hash !== 'string'
  ) {
    return undefined
  }
  return { index, tag, classes, text, hash }
}

/**
 * The selected frame with its box, or undefined when nothing is selected, the
 * file does not parse, or the frame it names has since been removed, so a
 * reader never gets a stale name back. An element is reported as picked, with
 * `stale` set once the frame file no longer matches what was picked from.
 */
export function readSelection(root: string): SelectedFrame | undefined {
  const path = selectionPath(root)
  if (!existsSync(path)) return undefined

  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return undefined
  }
  if (typeof parsed !== 'object' || parsed === null) return undefined
  const { page, frame, element } = parsed as Record<string, unknown>
  if (typeof page !== 'string' || typeof frame !== 'string') return undefined

  const found = readPage(root, page)?.frames.find(
    (candidate) => candidate.name === frame,
  )
  if (!found) return undefined
  const { x, y, width, height } = found
  const selected = {
    page,
    frame,
    file: found.file,
    box: { x, y, width, height },
  }

  const stored = readStoredElement(element)
  if (!stored) return selected
  const { hash, ...picked } = stored
  const current = contentHash(
    readFileSync(join(pagePath(root, page), found.file), 'utf8'),
  )
  return { ...selected, element: { ...picked, stale: current !== hash } }
}
