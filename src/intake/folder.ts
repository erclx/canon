import { existsSync } from 'node:fs'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join, normalize, relative } from 'node:path'
import { DRIVE_LOG, readDecisions } from '@/intake/drive-log'
import {
  INDEX_FILE,
  type IntakeItem,
  isMalformed,
  isUnread,
  parseDecided,
  readItems,
  writeAnswerLine,
} from '@/intake/items'
import { recordDir } from '@/roots/record'

export const INTAKE_REFUSALS = [
  'no-intake',
  'no-folder',
  'ambiguous-slug',
  'no-cluster',
  'no-item',
  'answered',
  'bad-input',
  'undecided',
] as const

export type IntakeRefusal = (typeof INTAKE_REFUSALS)[number]

export interface IntakeRefused {
  readonly ok: false
  readonly reason: IntakeRefusal
  readonly message: string
  readonly detail: readonly string[]
}

export interface FolderSummary {
  readonly slug: string
  readonly items: number
  readonly open: number
  readonly unread: number
  /** Items carrying no answer slot, which no route here can answer. */
  readonly malformed: number
}

/** An item with its `Decided:` pointer resolved against the folder's drive log. */
export interface ResolvedItem extends IntakeItem {
  /** The decision the pointer reaches, absent when it reaches none. */
  readonly decision: string | undefined
}

export interface ClusterItems {
  readonly cluster: string
  readonly items: readonly ResolvedItem[]
}

export interface FolderListed {
  readonly ok: true
  readonly folders: readonly FolderSummary[]
}

export interface FolderRead {
  readonly ok: true
  readonly slug: string
  readonly clusters: readonly ClusterItems[]
}

export interface AnswerWritten {
  readonly ok: true
  readonly slug: string
  readonly cluster: string
  readonly path: string
  readonly answered: readonly Selection[]
}

export type ListOutcome = FolderListed | IntakeRefused
export type ReadOutcome = FolderRead | IntakeRefused
export type AnswerOutcome = AnswerWritten | IntakeRefused

export interface Selection {
  readonly label: string
  readonly answer: string
}

function refuse(
  reason: IntakeRefusal,
  message: string,
  detail: readonly string[] = [],
): IntakeRefused {
  return { ok: false, reason, message, detail }
}

export function intakeDir(root: string): string {
  return recordDir(root, 'intake')
}

/**
 * Cluster files in read order, which is the numbering the folder carries. The
 * index is dropped because it answers nothing, so every remaining file is one a
 * selection can land in.
 */
export async function listClusters(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })

  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith('.md') &&
        entry.name !== INDEX_FILE,
    )
    .map((entry) => entry.name)
    .sort()
}

async function listSlugs(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

type SlugMatch =
  | { readonly kind: 'matched'; readonly name: string }
  | { readonly kind: 'ambiguous'; readonly names: readonly string[] }
  | { readonly kind: 'none' }

/**
 * A folder carries a `<nn>-<slug>` name, but a caller names the topic alone.
 * An exact match wins first, since it is what a name with no ordinal, or one
 * already copied in full from a listing, resolves against. Otherwise the one
 * entry whose name is an ordinal ahead of the given slug wins, which is what
 * lets a topic keep working as its folder's identity gains a prefix. Two or
 * more such entries is a collision the caller needs told apart from a typo,
 * not a folder silently picked or silently missing.
 */
function matchSlug(names: readonly string[], slug: string): SlugMatch {
  if (names.includes(slug)) return { kind: 'matched', name: slug }

  const suffixed = names.filter(
    (name) => name === `${extractOrdinal(name)}-${slug}`,
  )

  if (suffixed.length === 1) return { kind: 'matched', name: suffixed[0] }
  if (suffixed.length > 1) return { kind: 'ambiguous', names: suffixed }
  return { kind: 'none' }
}

export function extractOrdinal(name: string): string {
  return /^\d{2,}-/.exec(name)?.[0].slice(0, -1) ?? ''
}

export async function openFolder(
  root: string,
  slug: string,
): Promise<string | IntakeRefused> {
  const dir = intakeDir(root)

  if (!existsSync(dir)) {
    return refuse('no-intake', `No intake at ${relative(root, dir)}.`)
  }

  const names = await listSlugs(dir)
  const match = matchSlug(names, slug)

  if (match.kind === 'none') {
    return refuse('no-folder', `No intake folder named ${slug}.`, names)
  }

  if (match.kind === 'ambiguous') {
    return refuse(
      'ambiguous-slug',
      `More than one intake folder matches ${slug}.`,
      match.names,
    )
  }

  return join(dir, match.name)
}

/** Counts per folder, which is what a session picks a folder to work from. */
export async function listFolders(root: string): Promise<ListOutcome> {
  const dir = intakeDir(root)

  if (!existsSync(dir)) {
    return refuse('no-intake', `No intake at ${relative(root, dir)}.`)
  }

  const slugs = await listSlugs(dir)

  const folders = await Promise.all(
    slugs.map(async (slug) => {
      const clusters = await readClusters(join(dir, slug))
      const items = clusters.flatMap((cluster) => cluster.items)

      return {
        slug,
        items: items.length,
        open: items.filter((item) => item.open !== undefined).length,
        unread: items.filter(isUnread).length,
        malformed: items.filter(isMalformed).length,
      }
    }),
  )

  return { ok: true, folders }
}

/**
 * The folder's own drive log, read once per folder. A folder with no log
 * resolves every pointer to nothing, which the answer route refuses.
 */
async function folderDecisions(folder: string): Promise<Map<number, string>> {
  const path = join(folder, DRIVE_LOG)
  if (!existsSync(path)) return new Map()
  return readDecisions(await readFile(path, 'utf8'))
}

/**
 * The decision a pointer reaches, read from this folder's log alone, so a
 * pointer naming any other path resolves to nothing rather than being followed.
 */
function resolveDecision(
  item: IntakeItem,
  decisions: ReadonlyMap<number, string>,
): string | undefined {
  const pointer =
    item.decided === undefined ? undefined : parseDecided(item.decided)
  if (pointer === undefined || normalize(pointer.path) !== DRIVE_LOG) {
    return undefined
  }
  return decisions.get(pointer.finding)
}

async function readClusters(folder: string): Promise<ClusterItems[]> {
  const [names, decisions] = await Promise.all([
    listClusters(folder),
    folderDecisions(folder),
  ])

  return Promise.all(
    names.map(async (cluster) => ({
      cluster,
      items: readItems(await readFile(join(folder, cluster), 'utf8')).map(
        (item) => ({ ...item, decision: resolveDecision(item, decisions) }),
      ),
    })),
  )
}

/** Every item in a folder, grouped by the cluster file that holds it. */
export async function readFolder(
  root: string,
  slug: string,
): Promise<ReadOutcome> {
  const opened = await openFolder(root, slug)
  if (typeof opened !== 'string') return opened

  return {
    ok: true,
    slug: basename(opened),
    clusters: await readClusters(opened),
  }
}

/**
 * Lands a batch of selections in one cluster file.
 *
 * The batch is scoped to a cluster and applied in one read-modify-write because
 * the alternative is a call per selection, and four of those against the same
 * file race on the read and drop every answer but the last.
 *
 * A `decided` label accepts the decision its item's `Decided:` pointer reaches
 * and writes that source into the slot. One that reaches no decision refuses
 * the whole call, so an accept never lands on a decision nobody recorded.
 */
export async function answerItems(
  root: string,
  slug: string,
  cluster: string,
  selections: readonly Selection[],
  decided: readonly string[] = [],
): Promise<AnswerOutcome> {
  const opened = await openFolder(root, slug)
  if (typeof opened !== 'string') return opened

  const name = cluster.endsWith('.md') ? cluster : `${cluster}.md`

  if (name === INDEX_FILE) {
    return refuse(
      'no-cluster',
      `${INDEX_FILE} is the index and carries no answer slot.`,
    )
  }

  const path = join(opened, name)

  if (!existsSync(path)) {
    return refuse(
      'no-cluster',
      `No cluster named ${name} in ${slug}.`,
      await listClusters(opened),
    )
  }

  const broken = selections.filter((selection) =>
    /[\r\n]/.test(selection.answer),
  )

  if (broken.length > 0) {
    return refuse(
      'bad-input',
      `An answer is one line, so item ${broken.map((entry) => entry.label).join(', ')} cannot carry a line break.`,
      broken.map((entry) => entry.label),
    )
  }

  let text = await readFile(path, 'utf8')
  const items = readItems(text)

  const find = (label: string) =>
    items.find((item) => item.label === label.toLowerCase())

  const named = [...selections.map((selection) => selection.label), ...decided]
  const missing = named.filter((label) => find(label)?.answerLine === undefined)

  if (missing.length > 0) {
    return refuse(
      'no-item',
      `${name} carries no answer slot for item ${missing.join(', ')}.`,
      items.map((item) => `${item.label}. ${item.title}`),
    )
  }

  const filled = named
    .filter((label) => find(label)?.answer !== undefined)
    .map((label) => ({ label }))

  if (filled.length > 0) {
    return refuse(
      'answered',
      `${name} item ${filled.map((entry) => entry.label).join(', ')} already carries an answer.`,
      filled.map(
        (entry) => `${entry.label}. ${find(entry.label)?.answer ?? ''}`,
      ),
    )
  }

  const accepted = await acceptDecided(opened, decided, find)
  if (!Array.isArray(accepted)) return accepted

  const landed = [...selections, ...accepted]

  for (const selection of landed) {
    const item = find(selection.label)
    if (item?.answerLine === undefined) continue
    text = writeAnswerLine(text, item.answerLine, selection.answer)
  }

  await writeFile(path, text)

  return {
    ok: true,
    slug: basename(opened),
    cluster: name,
    path,
    answered: landed,
  }
}

/**
 * The answer each decided label lands, keeping `ok` first for every reader
 * keying on it and the finding beside it so the slot names its source.
 */
async function acceptDecided(
  folder: string,
  labels: readonly string[],
  find: (label: string) => IntakeItem | undefined,
): Promise<Selection[] | IntakeRefused> {
  if (labels.length === 0) return []

  const decisions = await folderDecisions(folder)
  const accepted: Selection[] = []
  const undecided: IntakeItem[] = []

  for (const label of labels) {
    const item = find(label)
    if (item === undefined) continue
    const pointer =
      item.decided === undefined ? undefined : parseDecided(item.decided)
    if (pointer === undefined || !resolveDecision(item, decisions)) {
      undecided.push(item)
      continue
    }
    const finding = String(pointer.finding).padStart(2, '0')
    accepted.push({
      label: item.label,
      answer: `ok, as decided in drive-log finding ${finding}`,
    })
  }

  if (undecided.length > 0) {
    return refuse(
      'undecided',
      `Item ${undecided.map((item) => item.label).join(', ')} reaches no decision in ${DRIVE_LOG}, so nothing was written.`,
      undecided.map(
        (item) => `${item.label}. ${item.decided ?? 'no Decided: field'}`,
      ),
    )
  }
  return accepted
}
