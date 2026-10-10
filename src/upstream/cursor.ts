import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { dirname } from 'node:path'
import { recordDir } from '@/roots/record'

const FOLDER = 'upstream'
const VERSION = /^\d+(\.\d+)*$/

export interface Cursor {
  readonly version: string
  readonly date: string
  readonly intake: string
}

export interface AdvanceInput {
  readonly version: string
  readonly intake: string
  readonly today: string
  /** The current `llms.txt`, or null to keep the copy already stored. */
  readonly llms: string | null
}

export type AdvanceOutcome =
  | { readonly kind: 'advanced' }
  | {
      readonly kind: 'refused'
      readonly reason: 'older-than-cursor' | 'invalid-version'
    }

export interface LlmsDifference {
  readonly added: string[]
  readonly removed: string[]
}

const cursorPath = (root: string): string =>
  recordDir(root, FOLDER, 'cursor.json')

const llmsPath = (root: string): string => recordDir(root, FOLDER, 'llms.txt')

export function readCursor(root: string): Cursor | null {
  const path = cursorPath(root)
  if (!existsSync(path)) return null

  return JSON.parse(readFileSync(path, 'utf8')) as Cursor
}

export function readLastLlms(root: string): string | null {
  const path = llmsPath(root)

  return existsSync(path) ? readFileSync(path, 'utf8') : null
}

export function compareVersions(a: string, b: string): number {
  const left = a.split('.').map(Number)
  const right = b.split('.').map(Number)

  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0)
    if (diff !== 0) return diff
  }

  return 0
}

// `fetch` reads this file, so a write that half-lands would leave a reader on a
// truncated cursor. A rename within one folder is atomic.
async function writeAtomic(path: string, body: string): Promise<void> {
  mkdirSync(dirname(path), { recursive: true })
  const temp = `${path}.${process.pid}.tmp`
  writeFileSync(temp, body)
  renameSync(temp, path)
}

export async function advanceCursor(
  root: string,
  input: AdvanceInput,
): Promise<AdvanceOutcome> {
  if (!VERSION.test(input.version)) {
    return { kind: 'refused', reason: 'invalid-version' }
  }

  const stored = readCursor(root)
  if (stored && compareVersions(input.version, stored.version) < 0) {
    return { kind: 'refused', reason: 'older-than-cursor' }
  }

  if (input.llms !== null) await writeAtomic(llmsPath(root), input.llms)
  const next: Cursor = {
    version: input.version,
    date: input.today,
    intake: input.intake,
  }
  await writeAtomic(cursorPath(root), `${JSON.stringify(next, null, 2)}\n`)

  return { kind: 'advanced' }
}

const lines = (text: string): string[] => text.split('\n').filter(Boolean)

export function llmsDifference(
  last: string | null,
  current: string,
): LlmsDifference {
  const before = new Set(lines(last ?? ''))
  const after = new Set(lines(current))

  return {
    added: [...after].filter((line) => !before.has(line)),
    removed: [...before].filter((line) => !after.has(line)),
  }
}
