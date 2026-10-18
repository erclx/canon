/**
 * Adds the session defaults the seeded `.claude/settings.json` carries to a
 * target that was seeded before them.
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
 * Appends the denied tools a list lacks, keeping the list's own order, so the
 * diff a person reads is the added entries alone.
 */
export function planSessionDefaults(
  current: SettingsRecord,
): SessionDefaultsPlan {
  const next: SettingsRecord = { ...current }
  const permissions = isRecord(current.permissions) ? current.permissions : {}
  const deny = Array.isArray(permissions.deny) ? permissions.deny : []

  const missing = DENIED_TOOLS.filter((tool) => !deny.includes(tool))
  if (missing.length > 0) {
    next.permissions = { ...permissions, deny: [...deny, ...missing] }
  }

  const memoryAbsent = !('autoMemoryEnabled' in current)
  if (memoryAbsent) next.autoMemoryEnabled = false

  const keys: SettingsKey[] = [
    { label: 'permissions.deny', changed: missing.length > 0 },
    { label: 'autoMemoryEnabled', changed: memoryAbsent },
  ]
  return {
    keys,
    next,
    changed: keys.some((key) => key.changed),
    predates: memoryAbsent && missing.length === DENIED_TOOLS.length,
  }
}

/**
 * Refuses rather than plans whenever a write could replace something the
 * person owns: the toolkit's own settings, a file `JSON.parse` cannot read,
 * or a `permissions` or `deny` value of an unexpected shape.
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

  return {
    kind: 'planned',
    path,
    indent: read.indent,
    plan: planSessionDefaults(read.value),
  }
}

export async function applySessionDefaults(
  read: Extract<SessionDefaultsRead, { kind: 'planned' }>,
): Promise<void> {
  await writeSettings(read.path, serializeSettings(read.plan.next, read.indent))
}
