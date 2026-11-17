/**
 * Plans the hook entries a target's settings lack against the seeded
 * `settings.json`, which is the list of what to wire. A seeded script counts
 * only where the target holds it under `.claude/hooks/`, since an entry with
 * no script fails every call it matches, and deleting the script is how a
 * project opts out of one.
 */

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { SettingsEdit } from '@/migrate/settings-edit'

export const SEEDED_SETTINGS = join(
  'tooling',
  'claude',
  'seeds',
  '.claude',
  'settings.json',
)

/** A seeded script the target holds and no group runs for these tools. */
export interface UnwiredHook {
  readonly event: string
  readonly script: string
  /** The tools still lacking it, empty for an event that takes no matcher. */
  readonly tools: readonly string[]
}

export interface HookWiringPlan {
  /** Sorted by event, then script. */
  readonly unwired: readonly UnwiredHook[]
  /** Each event the seed wires, in seed order, with the edits it needs. */
  readonly events: readonly {
    readonly event: string
    readonly edits: readonly SettingsEdit[]
  }[]
}

type Group = Record<string, unknown>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function readSeededHooks(
  toolkitRoot: string,
): Promise<Record<string, unknown>> {
  const seed: unknown = JSON.parse(
    await readFile(join(toolkitRoot, SEEDED_SETTINGS), 'utf8'),
  )
  return isRecord(seed) && isRecord(seed.hooks) ? seed.hooks : {}
}

export function holdsHookScript(root: string): (script: string) => boolean {
  return (script) => existsSync(join(root, '.claude', 'hooks', script))
}

/**
 * The script a command runs, read as the basename of any word in it, so a
 * guard wired by hand as `bash .claude/hooks/plan-guard.sh` matches the seed's
 * quoted project path.
 */
function basenames(command: unknown): string[] {
  if (typeof command !== 'string') return []
  return command
    .split(/\s+/)
    .map((word) => word.replace(/["']/g, '').split('/').at(-1) ?? '')
}

function runsScript(command: unknown, script: string): boolean {
  return basenames(command).includes(script)
}

function scriptOf(command: unknown): string | undefined {
  return basenames(command).find((name) => name.endsWith('.sh'))
}

/**
 * Claude Code reads an absent, empty, or `*` matcher as every tool, one of
 * only name characters as exact names split on `|` or `,`, and any other as
 * an unanchored regular expression, per its hooks reference.
 */
export function matcherCovers(matcher: unknown, tool: string): boolean {
  if (matcher === undefined || matcher === '' || matcher === '*') return true
  if (typeof matcher !== 'string') return false
  if (/^[\w\s,|-]+$/.test(matcher)) {
    return matcher.split(/[|,]/).some((name) => name.trim() === tool)
  }
  try {
    return new RegExp(matcher).test(tool)
  } catch {
    return false
  }
}

function groupRuns(group: unknown, script: string): group is Group {
  return (
    isRecord(group) &&
    Array.isArray(group.hooks) &&
    group.hooks.some(
      (hook) => isRecord(hook) && runsScript(hook.command, script),
    )
  )
}

/**
 * Validates the shape the plan reads, naming the field that broke, so a
 * caller refuses rather than writing over a value it cannot read.
 */
export function hooksShapeError(
  hooks: unknown,
  seeded: Record<string, unknown>,
): string | undefined {
  if (hooks === undefined) return undefined
  if (!isRecord(hooks)) return 'hooks is not an object'
  for (const event of Object.keys(seeded)) {
    if (hooks[event] !== undefined && !Array.isArray(hooks[event])) {
      return `hooks.${event} is not a list`
    }
  }
  return undefined
}

/**
 * Adds only: an existing group, entry, or matcher is never removed or
 * reordered. A lacking entry joins the group whose matcher equals the one it
 * needs, after that group's own hooks, and otherwise lands in a new group
 * whose matcher names only the tools still lacking. Expects a shape
 * `hooksShapeError` passed.
 */
export function planHookWiring(
  hooks: unknown,
  seeded: Record<string, unknown>,
  holds: (script: string) => boolean,
): HookWiringPlan {
  const current = isRecord(hooks) ? hooks : {}
  const unwired: UnwiredHook[] = []
  const events: { event: string; edits: SettingsEdit[] }[] = []

  for (const [event, seededGroups] of Object.entries(seeded)) {
    if (!Array.isArray(seededGroups)) continue
    const groups: unknown[] = Array.isArray(current[event])
      ? current[event]
      : []
    const appends: SettingsEdit[] = []
    const added = new Map<
      string | undefined,
      { matcher?: string; hooks: unknown[] }
    >()

    for (const seededGroup of seededGroups) {
      if (!isRecord(seededGroup) || !Array.isArray(seededGroup.hooks)) continue
      const matcher =
        typeof seededGroup.matcher === 'string'
          ? seededGroup.matcher
          : undefined

      for (const entry of seededGroup.hooks) {
        if (!isRecord(entry)) continue
        const script = scriptOf(entry.command)
        if (script === undefined || !holds(script)) continue

        const running = groups.filter((group) => groupRuns(group, script))
        const tools = matcher === undefined ? [] : matcher.split('|')
        const lacking = tools.filter(
          (tool) =>
            !running.some((group) => matcherCovers(group.matcher, tool)),
        )
        if (matcher === undefined ? running.length > 0 : lacking.length === 0) {
          continue
        }

        unwired.push({ event, script, tools: lacking })
        const needed =
          lacking.length === tools.length ? matcher : lacking.join('|')
        const at = groups.findIndex(
          (group) =>
            isRecord(group) &&
            group.matcher === needed &&
            Array.isArray(group.hooks),
        )
        if (at !== -1) {
          appends.push({
            kind: 'append',
            path: ['hooks', event, at, 'hooks'],
            value: entry,
          })
          continue
        }
        const group = added.get(needed) ?? {
          ...(needed === undefined ? {} : { matcher: needed }),
          hooks: [],
        }
        group.hooks.push(entry)
        added.set(needed, group)
      }
    }

    const newGroups: SettingsEdit[] = [...added.values()].map((group) => ({
      kind: 'append',
      path: ['hooks', event],
      value: group,
    }))
    events.push({ event, edits: [...appends, ...newGroups] })
  }

  unwired.sort(
    (left, right) =>
      left.event.localeCompare(right.event) ||
      left.script.localeCompare(right.script),
  )
  return { unwired, events }
}
