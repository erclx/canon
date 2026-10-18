import { existsSync } from 'node:fs'
import { chmod, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const DEFAULT_INDENT = '  '
const INDENT = /^([ \t]+)\S/m

// The pair setup once wrote to suppress Claude's attribution. Only this exact
// value is retracted, since anything else is a person's own choice.
const RETIRED_ATTRIBUTION = { commit: '', pr: '' }

export type SettingsRecord = Record<string, unknown>

export interface SettingsKey {
  readonly label: string
  readonly changed: boolean
}

export interface SettingsPlan {
  readonly keys: readonly SettingsKey[]
  readonly next: SettingsRecord
  readonly changed: boolean
}

/**
 * Reads the indentation of the first indented line. Rewriting an operator's
 * settings file at a different width is a diff they did not ask for, and this
 * verb is the only one in the toolkit that writes outside a target.
 */
export function detectIndent(source: string): string {
  return INDENT.exec(source)?.[1] ?? DEFAULT_INDENT
}

export function serializeSettings(
  value: SettingsRecord,
  indent: string,
): string {
  return `${JSON.stringify(value, null, indent)}\n`
}

/**
 * Parses a settings file, treating an absent one as empty. A malformed one
 * throws rather than resolving to empty, because the alternative silently
 * replaces a file the operator owns with a generated one.
 */
export async function readSettings(
  path: string,
): Promise<{ value: SettingsRecord; indent: string }> {
  if (!existsSync(path)) return { value: {}, indent: DEFAULT_INDENT }

  const source = await readFile(path, 'utf8')
  const indent = detectIndent(source)
  if (source.trim() === '') return { value: {}, indent }

  let parsed: unknown
  try {
    parsed = JSON.parse(source)
  } catch (cause) {
    throw new Error(`${path} is not valid JSON`, { cause })
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${path} is not a JSON object`)
  }

  return { value: parsed as SettingsRecord, indent }
}

function asRecord(value: unknown): SettingsRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {}
  }
  return value as SettingsRecord
}

function asStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string')
}

function equals(left: unknown, right: unknown): boolean {
  return Bun.deepEquals(left, right)
}

/**
 * Unions two permission lists into the sorted, deduplicated shape `jq unique`
 * produced. The sort is load-bearing, since the comparison that decides
 * whether to write runs against the sorted result.
 */
function mergeList(current: unknown, incoming: unknown): string[] {
  return [...new Set([...asStrings(current), ...asStrings(incoming)])].sort()
}

/**
 * Applies the four settings the toolkit owns, leaving every other key in
 * place. Each key reports whether it changed so the caller prints `+` or `✓`
 * per key, matching the four separate `jq` passes this replaced.
 */
export function planSettings(
  current: SettingsRecord,
  template: SettingsRecord,
  statusLineCommand: string,
): SettingsPlan {
  const next: SettingsRecord = { ...current }
  const keys: SettingsKey[] = []

  const statusLine = asRecord(next.statusLine)
  const statusLineChanged = statusLine.command !== statusLineCommand
  if (statusLineChanged) {
    next.statusLine = { type: 'command', command: statusLineCommand }
  }
  keys.push({ label: 'statusLine', changed: statusLineChanged })

  if (equals(next.attribution, RETIRED_ATTRIBUTION)) {
    delete next.attribution
    keys.push({ label: 'attribution', changed: true })
  }

  const permissions = asRecord(next.permissions)
  const merged: SettingsRecord = { ...permissions }
  const templatePermissions = asRecord(template.permissions)

  for (const field of ['allow', 'deny'] as const) {
    const union = mergeList(permissions[field], templatePermissions[field])
    const changed = !equals(asStrings(permissions[field]), union)
    if (changed) merged[field] = union
    keys.push({ label: `permissions.${field}`, changed })
  }

  if (keys.some((key) => key.label.startsWith('permissions.') && key.changed)) {
    next.permissions = merged
  }

  return { keys, next, changed: keys.some((key) => key.changed) }
}

/**
 * Writes in place, restoring the file's existing mode. The bash wrote through
 * `mktemp` and `mv`, which handed the destination the temp file's 600 and
 * silently tightened a settings file the operator had left at 644.
 */
export async function writeSettings(
  path: string,
  content: string,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true })

  const mode = await stat(path)
    .then((info) => info.mode)
    .catch(() => undefined)

  await writeFile(path, content)

  if (mode !== undefined) await chmod(path, mode)
}
