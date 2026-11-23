import { type IntakeItem, readItems } from '@/intake/items'
import { bodyLines } from '@/markdown/scan'

/** A bundle that resolved to items and shares no file between them. */
export interface BundleUnshared {
  readonly name: string
  readonly line: number
  readonly message: string
}

/** A bundle row the reader could not resolve to items. */
export interface BundleUnresolved {
  readonly line: number
  readonly message: string
}

export interface BundleReport {
  /** Rows that resolved and share no file, which set the exit. */
  readonly unshared: readonly BundleUnshared[]
  /** Rows the reader could not resolve, which report as structure only. */
  readonly unresolved: readonly BundleUnresolved[]
}

const ROW = /^-\s+Bundle\s+([^:]+):\s*(.*)$/
const CLUSTER_REF = /`(\d+-[\w.-]+\.md)`/g
const NUMBER = '\\d+[a-z]*'
const SPAN = `${NUMBER}(?:\\s+to\\s+\\d+)?`
const ITEM_LIST = new RegExp(
  `^items?\\s+(${SPAN}(?:(?:,\\s*(?:and\\s+)?|\\s+and\\s+)${SPAN})*)$`,
  'i',
)
const SHARING = /\bsharing\s+((?:`[^`]+`(?:,?\s+and\s+|,\s*)?)+)/i
const CODE_SPAN = /`([^`]+)`/g

function codeSpans(text: string): string[] {
  return [...text.matchAll(CODE_SPAN)].map((match) => match[1])
}

/** Item labels a list names, with each `a to b` range expanded to every number in it. */
function expandLabels(list: string): string[] {
  const labels: string[] = []
  for (const part of list.split(/,\s*(?:and\s+)?|\s+and\s+/i)) {
    const range = /^(\d+)\s+to\s+(\d+)$/i.exec(part.trim())
    if (!range) {
      labels.push(part.trim().toLowerCase())
      continue
    }
    for (let n = Number(range[1]); n <= Number(range[2]); n++) {
      labels.push(String(n))
    }
  }
  return labels
}

interface Reference {
  readonly file: string
  readonly labels: string[]
}

/** The cluster references on a row's left side, or the reason it cannot be read. */
function readReferences(left: string): Reference[] | string {
  const refs = [...left.matchAll(CLUSTER_REF)]
  if (refs.length === 0 || refs[0].index !== 0) {
    return 'does not open on a `NN-<domain>.md` cluster file'
  }

  const out: Reference[] = []
  for (const [index, ref] of refs.entries()) {
    const start = ref.index + ref[0].length
    const end = refs[index + 1]?.index ?? left.length
    const segment = left
      .slice(start, end)
      .trim()
      .replace(/[,\s]*(?:and)?[,\s]*$/i, '')
    const list = ITEM_LIST.exec(segment)
    if (!list) return `names no readable items after \`${ref[1]}\``
    out.push({ file: ref[1], labels: expandLabels(list[1]) })
  }
  return out
}

/**
 * Whether a text cites a path as a whole path, in a code span, a link target, or bare
 * prose. A path flanked by more path characters is a longer path, so `a.ts` does not
 * match `src/a.ts`, while a `:12` or `#parse` suffix still does.
 */
function cites(text: string, path: string): boolean {
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![\\w./-])${escaped}(?![\\w/-]|\\.\\w)`).test(text)
}

/** Every field an item carries, where a shared path would be cited. */
function fieldText(item: IntakeItem): string {
  return [
    item.problem,
    item.fix,
    item.open,
    item.suggested,
    item.worth,
    item.decided,
  ]
    .filter((field) => field !== undefined)
    .join('\n')
}

type Resolved =
  | { readonly kind: 'ok'; readonly cited: string[] }
  | { readonly kind: 'unresolved'; readonly message: string }

function resolveItems(
  refs: readonly Reference[],
  clusters: ReadonlyMap<string, string>,
): Resolved {
  const cited: string[] = []

  for (const ref of refs) {
    const text = clusters.get(ref.file)
    if (text === undefined) {
      return {
        kind: 'unresolved',
        message: `names \`${ref.file}\`, which is absent`,
      }
    }

    const items = new Map(readItems(text).map((item) => [item.label, item]))
    for (const label of ref.labels) {
      const item = items.get(label)
      if (!item) {
        return {
          kind: 'unresolved',
          message: `names item ${label}, which \`${ref.file}\` does not hold`,
        }
      }
      cited.push(fieldText(item))
    }
  }

  if (cited.length < 2) {
    return {
      kind: 'unresolved',
      message: 'bundles one item, and a bundle stands in for more than one row',
    }
  }

  return { kind: 'ok', cited }
}

/**
 * Reads each `Bundle` row of an overview against the cluster files it names. A path
 * counts as shared only when it is a file, never a folder, and every named item
 * cites it on one of its fields, in a code span, a link, or bare prose.
 */
export function checkBundles(
  overview: string,
  clusters: ReadonlyMap<string, string>,
): BundleReport {
  const unshared: BundleUnshared[] = []
  const unresolved: BundleUnresolved[] = []

  for (const line of bodyLines(overview)) {
    if (line.fenced) continue

    const row = ROW.exec(line.text)
    if (!row) continue

    const name = row[1].trim()
    const body = row[2]
    const fail = (message: string) =>
      unresolved.push({
        line: line.number,
        message: `Bundle ${name} ${message}`,
      })

    const sharing = SHARING.exec(body)
    if (!sharing) {
      fail('names no shared file after `sharing`')
      continue
    }

    const refs = readReferences(
      body.slice(0, sharing.index).replace(/[,\s]+$/, ''),
    )
    if (typeof refs === 'string') {
      fail(refs)
      continue
    }

    const resolved = resolveItems(refs, clusters)
    if (resolved.kind === 'unresolved') {
      fail(resolved.message)
      continue
    }

    const paths = codeSpans(sharing[1]).filter((path) => !path.endsWith('/'))
    const common = paths.some((path) =>
      resolved.cited.every((text) => cites(text, path)),
    )

    if (!common) {
      unshared.push({
        name,
        line: line.number,
        message: `Bundle ${name} shares no file, since no path after \`sharing\` is a file every named item cites`,
      })
    }
  }

  return { unshared, unresolved }
}
