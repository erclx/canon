import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'

import { plural } from '@/cli/ui'
import { isOverWordCap, measureRequirements } from '@/context/requirements'
import { measureDesignProse } from '@/design/budget'
import type { Measure } from '@/gate/measures'
import {
  checkDump,
  checkPlan,
  checkTrack,
  type Finding,
} from '@/records/validate'

export const EXAMPLES_DIR = 'examples'
export const EXAMPLES_INDEX = join(EXAMPLES_DIR, 'index.md')

/**
 * A stamp is the first eight hex digits of the standard's sha256, so any edit
 * to the standard, a typo fix included, moves it.
 */
export function standardStamp(source: string): string {
  return createHash('sha256').update(source).digest('hex').slice(0, 8)
}

interface Stamp {
  readonly standard: string
  readonly stamp: string
}

interface Entry {
  /** Relative to `examples/`, ending in `/` for a folder record. */
  readonly target: string
  readonly stamps: readonly Stamp[]
}

const ENTRY_LINK = /^-[ \t]+\[[^\]]+\]\(([^)\s#]+)\)/
const STAMP_SPAN = /`([^`\s]+\.md)`[ \t]+at[ \t]+`([0-9a-f]{8})`/g

function readEntries(source: string): Entry[] {
  return source.split('\n').flatMap((line) => {
    const target = ENTRY_LINK.exec(line)?.[1]
    if (target === undefined || /^[a-z]+:/.test(target)) return []
    const stamps = [...line.matchAll(STAMP_SPAN)].map((match) => ({
      standard: match[1],
      stamp: match[2],
    }))
    return [{ target, stamps }]
  })
}

/** Each standard an index entry stamps, once, in index order. */
export function stampedStandards(source: string): string[] {
  const stamps = readEntries(source).flatMap((entry) => entry.stamps)
  return [...new Set(stamps.map((stamp) => stamp.standard))]
}

async function listFiles(dir: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(join(dir, prefix), { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? listFiles(dir, `${prefix}${entry.name}/`)
        : Promise.resolve([`${prefix}${entry.name}`]),
    ),
  )
  return nested.flat()
}

function folderFindings(rel: string, findings: readonly Finding[]): string[] {
  return findings.map((found) =>
    `${rel}${found.subject} ${found.message}`.trim(),
  )
}

type Validate = (root: string, rel: string) => Promise<string[]>

/**
 * The record kinds whose shape a validator already reads, keyed by where the
 * example sits. A kind absent here is held by its stamp alone, since its
 * standard has no validator to reuse.
 */
const VALIDATORS: readonly (readonly [RegExp, Validate])[] = [
  [
    /^planning\/feature-[^/]+\.md$/,
    async (root, rel) =>
      checkPlan(basename(rel), await readFile(join(root, rel), 'utf8')).map(
        (found) => `${rel} ${found.subject} ${found.message}`,
      ),
  ],
  [
    /^research\/groundwork\/[^/]+\/$/,
    async (root, rel) =>
      folderFindings(rel, await checkTrack(join(root, rel), basename(rel))),
  ],
  [
    /^research\/(?:intake|drive)\/[^/]+\/$/,
    async (root, rel) =>
      folderFindings(rel, await checkDump(join(root, rel), basename(rel))),
  ],
  [
    /(?:^|\/)DESIGN\.md$/,
    async (root, rel) =>
      measureDesignProse(await readFile(join(root, rel), 'utf8')).map(
        (finding) => `${finding} in ${rel}`,
      ),
  ],
  [
    /(?:^|\/)REQUIREMENTS\.md$/,
    async (root, rel) => {
      const report = await measureRequirements(root, rel)
      return report !== undefined && isOverWordCap(report)
        ? [
            `${rel} holds ${report.words} words against its cap of ${report.wordCap}`,
          ]
        : []
    },
  ],
]

async function stampFindings(
  root: string,
  rel: string,
  stamps: readonly Stamp[],
): Promise<string[]> {
  if (stamps.length === 0) {
    return [
      `${rel} names no standard at a stamp in ${EXAMPLES_INDEX}, so no edit to its standard reaches it.`,
    ]
  }
  const perStamp = await Promise.all(
    stamps.map(async ({ standard, stamp }) => {
      if (!existsSync(join(root, standard))) {
        return [`${rel} is read against ${standard}, which does not exist.`]
      }
      const current = standardStamp(
        await readFile(join(root, standard), 'utf8'),
      )
      if (current === stamp) return []
      return [
        `${standard} changed since ${rel} was stamped at ${stamp}. Reread ${rel} against it, then set its stamp in ${EXAMPLES_INDEX} to ${current}.`,
      ]
    }),
  )
  return perStamp.flat()
}

async function entryFindings(root: string, entry: Entry): Promise<string[]> {
  // `join` keeps a trailing slash, so a folder target stays one here.
  const rel = join(EXAMPLES_DIR, entry.target)
  if (!existsSync(join(root, rel))) {
    return [`${EXAMPLES_INDEX} links ${rel}, which does not exist.`]
  }
  const validate = VALIDATORS.find(([pattern]) => pattern.test(entry.target))
  const [stamps, shape] = await Promise.all([
    stampFindings(root, rel, entry.stamps),
    validate === undefined ? Promise.resolve([]) : validate[1](root, rel),
  ])
  return [...stamps, ...shape]
}

/**
 * Holds every worked record under `examples/` to the standard its index entry
 * names, through the validator that kind already has, and to the stamp of that
 * standard, so a standard edit fails here until someone rereads the example.
 */
export const recordExamples: Measure = async (ctx) => {
  let source: string
  let files: string[]
  try {
    source = await readFile(join(ctx.root, EXAMPLES_INDEX), 'utf8')
    files = await listFiles(join(ctx.root, EXAMPLES_DIR))
  } catch {
    return {
      emissions: [],
      unmeasured: `${EXAMPLES_INDEX} could not be read, so no example was checked.`,
    }
  }

  const entries = readEntries(source)
  const unindexed = files
    .filter((file) => file !== 'index.md')
    .filter(
      (file) =>
        !entries.some((entry) =>
          entry.target.endsWith('/')
            ? file.startsWith(entry.target)
            : file === entry.target,
        ),
    )
    .map(
      (file) =>
        `${join(EXAMPLES_DIR, file)} has no entry in ${EXAMPLES_INDEX}, so no standard holds it.`,
    )

  const perEntry = await Promise.all(
    entries.map((entry) => entryFindings(ctx.root, entry)),
  )
  const failures = [...unindexed, ...perEntry.flat()]

  if (failures.length > 0) return { emissions: [], failure: failures.join(' ') }
  return {
    emissions: [
      {
        kind: 'info',
        text: `${plural(entries.length, 'example')} held to ${plural(stampedStandards(source).length, 'standard')}`,
      },
    ],
  }
}
