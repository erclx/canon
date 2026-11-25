import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { resolvePlanReference } from '@/tasks/answers'
import { readPlanTargets, tasksDir } from '@/tasks/archive'
import { covers, readDeclarations } from '@/tasks/reach'
import {
  type BoardRow,
  isOperatorHeld,
  orderingPath,
  readBoard,
  readBlockerClauses,
} from '@/tasks/validate'

const UP_NEXT = 'Up next'
const IN_FLIGHT = 'In flight'
const FIRST_WAVE = 1

export const WAVES_REFUSALS = ['no-board'] as const

export type WavesRefusal = (typeof WAVES_REFUSALS)[number]

export interface WavesRefused {
  readonly ok: false
  readonly reason: WavesRefusal
  readonly message: string
}

export interface WaveRow {
  readonly stem: string
  /** The filename stem of the plan the row's task links first, which the paths came from. */
  readonly plan: string
  /** Live tasks the row's `Waiting on` cell cites, so a row held by a sentence reads empty. */
  readonly after: readonly string[]
  /** Each clause of the `Waiting on` cell as read, and whether it blocks the row, so a misread shows. */
  readonly parse: readonly WaveParse[]
}

export interface WaveParse {
  readonly clause: string
  readonly blocks: boolean
}

export interface Wave {
  readonly wave: number
  readonly rows: readonly WaveRow[]
}

/**
 * A path two or more rows declare, as the broader of the two declarations.
 * `rebases` is the last Up next row to hold it, which merges second.
 */
export interface SharedPath {
  readonly path: string
  readonly stems: readonly string[]
  readonly rebases: string
}

/** One wait a row holds, from its `Waiting on` cell or from a path it shares with an earlier row. */
export type WaveEdge =
  | { readonly to: string; readonly source: 'waiting' }
  | { readonly to: string; readonly source: 'shared'; readonly path: string }

export interface WaveCycle {
  readonly stem: string
  readonly edges: readonly WaveEdge[]
  /** The cell's clauses as read, since a misread can be what closes the cycle. */
  readonly parse: readonly WaveParse[]
}

export interface WavesReport {
  readonly ok: true
  readonly waves: readonly Wave[]
  readonly shared: readonly SharedPath[]
  /** Up next rows linking no live plan, which declare nothing to group on. */
  readonly unplanned: readonly string[]
  /** Up next rows in a wait cycle, or waiting on one, which no wave can hold. */
  readonly cyclic: readonly string[]
  /** Each cyclic row with the edges it waits on and where each came from, beside `cyclic`. */
  readonly cycles: readonly WaveCycle[]
  /** Up next rows whose `Waiting on` cell holds them for the operator's word, in no wave and in no other list. */
  readonly held: readonly string[]
}

export type WavesOutcome = WavesReport | WavesRefused

interface Holder {
  readonly stem: string
  readonly plan: string | undefined
  readonly declared: readonly string[]
  readonly queued: boolean
  readonly waiting: string
}

function rowStem(row: BoardRow): string {
  return row.stem ?? row.label
}

/**
 * Reads the paths every live plan a row's task links declares. A plan that
 * resolves to no live file leaves the row without one, which reads as unplanned.
 */
async function readHolder(
  row: BoardRow,
  root: string,
  queued: boolean,
): Promise<Holder> {
  const stem = rowStem(row)
  const waiting = row.waiting ?? ''
  const file = join(tasksDir(root), `${row.stem}.md`)
  const none = { stem, plan: undefined, declared: [], queued, waiting }
  if (!row.stem || !existsSync(file)) return none

  const targets = readPlanTargets(await readFile(file, 'utf8'))
  const plans = targets
    .map((target) => resolvePlanReference(root, target))
    .flatMap((resolved) => (resolved.ok ? [resolved] : []))
  if (plans.length === 0) return none

  const declared = await Promise.all(
    plans.map(async ({ path }) =>
      readDeclarations(await readFile(path, 'utf8')),
    ),
  )

  return {
    ...none,
    plan: plans[0].plan.replace(/^.*\//, '').replace(/\.md$/, ''),
    declared: [...new Set(declared.flat())],
  }
}

function overlap(a: Holder, b: Holder): string | undefined {
  for (const left of a.declared) {
    for (const right of b.declared) {
      if (covers(left, right)) return left
      if (covers(right, left)) return right
    }
  }
  return undefined
}

/**
 * Collects every path two holders both declare, grouped by the broader
 * declaration, so a folder in one plan and a file under it in another read as
 * one entry named for the folder.
 */
function sharedPaths(holders: readonly Holder[]): SharedPath[] {
  const byPath = new Map<string, Set<string>>()

  for (let i = 0; i < holders.length; i += 1) {
    for (let j = i + 1; j < holders.length; j += 1) {
      for (const left of holders[i].declared) {
        for (const right of holders[j].declared) {
          const path = covers(left, right)
            ? left
            : covers(right, left)
              ? right
              : undefined
          if (path === undefined) continue

          const stems = byPath.get(path) ?? new Set<string>()
          stems.add(holders[i].stem).add(holders[j].stem)
          byPath.set(path, stems)
        }
      }
    }
  }

  const queued = new Set(
    holders.filter((holder) => holder.queued).map((holder) => holder.stem),
  )

  return [...byPath]
    .flatMap(([path, set]) => {
      const stems = holders
        .map((holder) => holder.stem)
        .filter((stem) => set.has(stem))
      const rebases = stems.filter((stem) => queued.has(stem)).at(-1)
      return rebases === undefined ? [] : [{ path, stems, rebases }]
    })
    .sort((a, b) => a.path.localeCompare(b.path))
}

/**
 * Groups the Up next rows into waves and writes nothing. A row lands one wave
 * after the rows it waits on and the earlier rows it shares a path with. A
 * declared set predicts what a branch writes and does not bound it.
 */
export async function planWaves(root: string): Promise<WavesOutcome> {
  const ordering = orderingPath(root)
  if (!existsSync(ordering)) {
    return {
      ok: false,
      reason: 'no-board',
      message: `No board at ${ordering}, so there are no rows to group.`,
    }
  }

  const { rows } = readBoard(await readFile(ordering, 'utf8'))
  const queuedRows = rows.filter((row) => row.group === UP_NEXT)
  const runningRows = rows.filter((row) => row.group === IN_FLIGHT)

  const [queued, running] = await Promise.all([
    Promise.all(queuedRows.map((row) => readHolder(row, root, true))),
    Promise.all(runningRows.map((row) => readHolder(row, root, false))),
  ])

  const held = queued
    .filter((holder) => isOperatorHeld(holder.waiting))
    .map((holder) => holder.stem)
  const open = queued.filter((holder) => !held.includes(holder.stem))
  const planned = open.filter((holder) => holder.plan !== undefined)
  const unplanned = open
    .filter((holder) => holder.plan === undefined)
    .map((holder) => holder.stem)
  const queuedStems = new Set(queued.map((holder) => holder.stem))

  const after = new Map<string, string[]>()
  const parses = new Map<string, WaveParse[]>()
  const live = (holder: Holder, stem: string) =>
    stem !== holder.stem &&
    (queuedStems.has(stem) ||
      running.some((run) => run.stem === stem) ||
      existsSync(join(tasksDir(root), `${stem}.md`)))

  for (const holder of planned) {
    const clauses = await readBlockerClauses(holder.waiting, root)
    const read = clauses.map(({ clause, stems }) => ({
      clause,
      stems: stems.filter((stem) => live(holder, stem)),
    }))
    after.set(holder.stem, [...new Set(read.flatMap((entry) => entry.stems))])
    parses.set(
      holder.stem,
      read.map(({ clause, stems }) => ({ clause, blocks: stems.length > 0 })),
    )
  }

  const edgesOf = (holder: Holder): WaveEdge[] => {
    const waiting = (after.get(holder.stem) ?? []).map((to): WaveEdge => ({
      to,
      source: 'waiting',
    }))

    // An earlier row whose own cell cites this row already waits on it, so the shared path must not wait back.
    const shared = planned
      .slice(0, planned.indexOf(holder))
      .filter((other) => !after.get(other.stem)?.includes(holder.stem))
      .flatMap((other): WaveEdge[] => {
        const path = overlap(holder, other)
        return path === undefined
          ? []
          : [{ to: other.stem, source: 'shared', path }]
      })

    return [...waiting, ...shared]
  }

  const placed = new Map<string, number | null>()
  const visiting = new Set<string>()

  const place = (stem: string): number | null => {
    const known = placed.get(stem)
    if (known !== undefined) return known

    const holder = planned.find((entry) => entry.stem === stem)
    if (holder === undefined) return unplanned.includes(stem) ? FIRST_WAVE : 0
    if (visiting.has(stem)) return null

    visiting.add(stem)
    const waves = edgesOf(holder).map((edge) => place(edge.to))
    visiting.delete(stem)

    const result = waves.includes(null)
      ? null
      : Math.max(0, ...(waves as number[])) + 1
    placed.set(stem, result)
    return result
  }

  const grouped = new Map<number, WaveRow[]>()
  const cyclic: string[] = []
  const cycles: WaveCycle[] = []

  for (const holder of planned) {
    const wave = place(holder.stem)
    if (wave === null || wave === undefined) {
      cyclic.push(holder.stem)
      cycles.push({
        stem: holder.stem,
        edges: edgesOf(holder),
        parse: parses.get(holder.stem) ?? [],
      })
      continue
    }

    const row: WaveRow = {
      stem: holder.stem,
      plan: holder.plan as string,
      after: after.get(holder.stem) ?? [],
      parse: parses.get(holder.stem) ?? [],
    }
    grouped.set(wave, [...(grouped.get(wave) ?? []), row])
  }

  return {
    ok: true,
    waves: [...grouped]
      .sort(([a], [b]) => a - b)
      .map(([wave, members]) => ({ wave, rows: members })),
    shared: sharedPaths([...planned, ...running]),
    unplanned,
    cyclic,
    cycles,
    held,
  }
}
