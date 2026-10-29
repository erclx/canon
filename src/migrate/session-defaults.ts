/**
 * Adds the session defaults the seeded `.claude/settings.json` carries to a
 * target that was seeded before them: the subagent deny, the memory default,
 * the merge deny entries, and the plan guard's PreToolUse wiring where the
 * project holds the guard script.
 *
 * `canon claude init` copies a seed only when the file is absent, so a target
 * holding its own settings never sees a later seed change. This verb adds each
 * default only where the key is absent: a deny entry is never removed, and a
 * person's `autoMemoryEnabled: true` is never overwritten.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  readSettings,
  type SettingsKey,
  type SettingsRecord,
  serializeSettings,
  writeSettings,
} from '@/claude/settings'

/** Both names, since `Task` is the tool's name before Claude Code renamed it. */
export const DENIED_TOOLS: readonly string[] = ['Agent', 'Task']

/** The merge entries the seeded deny list carries, so a session cannot merge. */
export const MERGE_DENIED: readonly string[] = [
  'Bash(canon pr merge:*)',
  'Bash(gh pr merge:*)',
]

/** The command the seed wires, as the seeded settings spell it. */
export const PLAN_GUARD_COMMAND =
  '"$CLAUDE_PROJECT_DIR"/.claude/hooks/plan-guard.sh'

const PLAN_GUARD_SCRIPT = 'plan-guard.sh'

/**
 * Each tool the guard acts on, beside the seeded matcher that carries it. A
 * guard wired by hand under any matcher covering the tool counts as wired.
 */
const PLAN_GUARD_WIRING: readonly { tool: string; matcher: string }[] = [
  { tool: 'Bash', matcher: 'Bash' },
  { tool: 'Write', matcher: 'Write|Edit' },
]

export interface SessionDefaultsOptions {
  /** True when the project holds `.claude/hooks/plan-guard.sh` to wire. */
  readonly planGuard?: boolean
}

export interface SessionDefaultsPlan {
  readonly keys: readonly SettingsKey[]
  readonly next: SettingsRecord
  readonly changed: boolean
  /**
   * True when the file holds no default at all. A file holding either one has
   * been through the seed or this verb, so a missing deny there was removed
   * on purpose, which is how an operator opts back into subagents.
   */
  readonly predates: boolean
  /** True when the deny list lacks any merge entry, whatever else it holds. */
  readonly lacksMergeDeny: boolean
}

export type SessionDefaultsRead =
  | { readonly kind: 'refused'; readonly reason: string }
  | { readonly kind: 'absent'; readonly path: string }
  | {
      readonly kind: 'planned'
      readonly path: string
      readonly indent: string
      readonly plan: SessionDefaultsPlan
    }

export function settingsPath(root: string): string {
  return join(root, '.claude', 'settings.json')
}

function isRecord(value: unknown): value is SettingsRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Appends the denied tools and merge entries a list lacks, keeping the list's
 * own order, so the diff a person reads is the added entries alone.
 */
export function planSessionDefaults(
  current: SettingsRecord,
  { planGuard = false }: SessionDefaultsOptions = {},
): SessionDefaultsPlan {
  const next: SettingsRecord = { ...current }
  const permissions = isRecord(current.permissions) ? current.permissions : {}
  const deny = Array.isArray(permissions.deny) ? permissions.deny : []

  const subagentsMissing = DENIED_TOOLS.filter((tool) => !deny.includes(tool))
  const mergeMissing = MERGE_DENIED.filter((entry) => !deny.includes(entry))
  const missing = [...subagentsMissing, ...mergeMissing]
  if (missing.length > 0) {
    next.permissions = { ...permissions, deny: [...deny, ...missing] }
  }

  const memoryAbsent = !('autoMemoryEnabled' in current)
  if (memoryAbsent) next.autoMemoryEnabled = false

  const preToolUse = planGuard ? wirePlanGuard(current.hooks) : undefined
  if (preToolUse !== undefined) {
    const hooks = isRecord(current.hooks) ? current.hooks : {}
    next.hooks = { ...hooks, PreToolUse: preToolUse }
  }

  const keys: SettingsKey[] = [
    { label: 'permissions.deny', changed: missing.length > 0 },
    { label: 'autoMemoryEnabled', changed: memoryAbsent },
    { label: 'hooks.PreToolUse', changed: preToolUse !== undefined },
  ]
  return {
    keys,
    next,
    changed: keys.some((key) => key.changed),
    predates:
      memoryAbsent &&
      subagentsMissing.length === DENIED_TOOLS.length &&
      mergeMissing.length === MERGE_DENIED.length,
    lacksMergeDeny: mergeMissing.length > 0,
  }
}

/**
 * Claude Code reads an absent, empty, or `*` matcher as every tool, and any
 * other as a pattern the whole tool name must match.
 */
function matcherCovers(matcher: unknown, tool: string): boolean {
  if (matcher === undefined || matcher === '' || matcher === '*') return true
  if (typeof matcher !== 'string') return false
  try {
    return new RegExp(`^(?:${matcher})$`).test(tool)
  } catch {
    return matcher === tool
  }
}

function runsPlanGuard(group: unknown, tool: string): boolean {
  if (!isRecord(group) || !Array.isArray(group.hooks)) return false
  if (!matcherCovers(group.matcher, tool)) return false
  return group.hooks.some(
    (hook) =>
      isRecord(hook) &&
      typeof hook.command === 'string' &&
      hook.command.includes(PLAN_GUARD_SCRIPT),
  )
}

/**
 * Returns the PreToolUse list with the guard appended to each seeded matcher
 * lacking it, or undefined when every tool already runs it. An existing group
 * under the seeded matcher takes the entry, keeping its own hooks first.
 */
function wirePlanGuard(hooks: unknown): unknown[] | undefined {
  const current =
    isRecord(hooks) && Array.isArray(hooks.PreToolUse) ? hooks.PreToolUse : []
  const lacking = PLAN_GUARD_WIRING.filter(
    ({ tool }) => !current.some((group) => runsPlanGuard(group, tool)),
  )
  if (lacking.length === 0) return undefined

  const entry = { type: 'command', command: PLAN_GUARD_COMMAND }
  const next = [...current]
  for (const { matcher } of lacking) {
    const at = next.findIndex(
      (group) =>
        isRecord(group) &&
        group.matcher === matcher &&
        Array.isArray(group.hooks),
    )
    const group = next[at]
    if (isRecord(group) && Array.isArray(group.hooks)) {
      next[at] = { ...group, hooks: [...group.hooks, entry] }
    } else {
      next.push({ matcher, hooks: [entry] })
    }
  }
  return next
}

/**
 * Refuses rather than plans whenever a write could replace something the
 * person owns: the toolkit's own settings, a file `JSON.parse` cannot read,
 * or a `permissions`, `deny`, `hooks`, or `PreToolUse` value of an
 * unexpected shape.
 */
export async function readSessionDefaults(
  root: string,
  protectedRoot: string,
): Promise<SessionDefaultsRead> {
  if (root === protectedRoot) {
    return {
      kind: 'refused',
      reason:
        'Cannot run against toolkit root. Files here are the source of truth.',
    }
  }

  const path = settingsPath(root)
  if (!existsSync(path)) return { kind: 'absent', path }

  let read: Awaited<ReturnType<typeof readSettings>>
  try {
    read = await readSettings(path)
  } catch (error) {
    return {
      kind: 'refused',
      reason: error instanceof Error ? error.message : String(error),
    }
  }

  const { permissions } = read.value
  if (permissions !== undefined && !isRecord(permissions)) {
    return { kind: 'refused', reason: `${path}: permissions is not an object` }
  }
  if (permissions?.deny !== undefined && !Array.isArray(permissions.deny)) {
    return {
      kind: 'refused',
      reason: `${path}: permissions.deny is not a list`,
    }
  }

  const planGuard = existsSync(
    join(root, '.claude', 'hooks', PLAN_GUARD_SCRIPT),
  )
  const { hooks } = read.value
  if (planGuard && hooks !== undefined && !isRecord(hooks)) {
    return { kind: 'refused', reason: `${path}: hooks is not an object` }
  }
  if (
    planGuard &&
    isRecord(hooks) &&
    hooks.PreToolUse !== undefined &&
    !Array.isArray(hooks.PreToolUse)
  ) {
    return {
      kind: 'refused',
      reason: `${path}: hooks.PreToolUse is not a list`,
    }
  }

  return {
    kind: 'planned',
    path,
    indent: read.indent,
    plan: planSessionDefaults(read.value, { planGuard }),
  }
}

export async function applySessionDefaults(
  read: Extract<SessionDefaultsRead, { kind: 'planned' }>,
): Promise<void> {
  await writeSettings(read.path, serializeSettings(read.plan.next, read.indent))
}
