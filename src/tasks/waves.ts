import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { resolvePlanReference } from '@/tasks/answers'
import { readPlanTargets, tasksDir } from '@/tasks/archive'
import { covers, readDeclarations } from '@/tasks/reach'
import {
  type BoardRow,
  orderingPath,
  readBoard,
  readCitedStems,
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

export interface WavesReport {
  readonly ok: true
  readonly waves: readonly Wave[]
  readonly shared: readonly SharedPath[]
  /** Up next rows linking no live plan, which declare nothing to group on. */
  readonly unplanned: readonly string[]
  /** Up next rows in a wait cycle, or waiting on one, which no wave can hold. */
  readonly cyclic: readonly string[]
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

  const planned = queued.filter((holder) => holder.plan !== undefined)
  const unplanned = queued
    .filter((holder) => holder.plan === undefined)
    .map((holder) => holder.stem)
  const queuedStems = new Set(queued.map((holder) => holder.stem))

  const after = new Map<string, string[]>()
  for (const holder of planned) {
    const cited = await readCitedStems(holder.waiting, root)
    after.set(
      holder.stem,
      cited.filter(
        (stem) =>
          stem !== holder.stem &&
          (queuedStems.has(stem) ||
            running.some((run) => run.stem === stem) ||
            existsSync(join(tasksDir(root), `${stem}.md`))),
      ),
    )
  }

  const earlier = (holder: Holder): string[] =>
    planned
      .slice(0, planned.indexOf(holder))
      .filter((other) => overlap(holder, other) !== undefined)
      .map((other) => other.stem)

  const placed = new Map<string, number | null>()
  const visiting = new Set<string>()

  const place = (stem: string): number | null => {
    const known = placed.get(stem)
    if (known !== undefined) return known

    const holder = planned.find((entry) => entry.stem === stem)
    if (holder === undefined) return unplanned.includes(stem) ? FIRST_WAVE : 0
    if (visiting.has(stem)) return null

    visiting.add(stem)
    const waits = [...(after.get(stem) ?? []), ...earlier(holder)]
    const waves = waits.map(place)
    visiting.delete(stem)

    const result = waves.includes(null)
      ? null
      : Math.max(0, ...(waves as number[])) + 1
    placed.set(stem, result)
    return result
  }

  const grouped = new Map<number, WaveRow[]>()
  const cyclic: string[] = []

  for (const holder of planned) {
    const wave = place(holder.stem)
    if (wave === null || wave === undefined) {
      cyclic.push(holder.stem)
      continue
    }

    const row: WaveRow = {
      stem: holder.stem,
      plan: holder.plan as string,
      after: after.get(holder.stem) ?? [],
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
  }
}
