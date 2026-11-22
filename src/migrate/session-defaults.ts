/**
 * Adds the seeded settings defaults to a target seeded before them, since init
 * copies a seed only into an absent file. Each default is added only where
 * absent: no deny entry is removed and no `autoMemoryEnabled` overwritten.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  readSettings,
  type SettingsKey,
  type SettingsRecord,
  writeSettings,
} from '@/claude/settings'
import {
  holdsHookScript,
  hooksShapeError,
  planHookWiring,
  readSeededHooks,
  type UnwiredHook,
} from '@/migrate/hook-wiring'
import { applySettingsEdits, type SettingsEdit } from '@/migrate/settings-edit'

/** Both names, since `Task` is the tool's name before Claude Code renamed it. */
export const DENIED_TOOLS: readonly string[] = ['Agent', 'Task']

/**
 * The merge forms the seeded deny list carries, being every merge an agent
 * writes by default that bypasses `canon pr merge`. The REST form is matched
 * on its path, since `gh api` puts its flags anywhere on the line.
 */
export const MERGE_DENIED: readonly string[] = [
  'Bash(gh pr merge:*)',
  'Bash(gh api *pulls/*/merge*)',
]

/**
 * The merge verb's rule, which the seed no longer carries in any list. An ask
 * on it prompts in every permission mode, auto mode included, so a merge the
 * operator named waited on the client. A target holding it keeps it, since
 * this verb only adds, and sync names the hand removal.
 */
export const MERGE_VERB = 'Bash(canon pr merge:*)'

/**
 * The lease pushes a worker runs after a rebase. An allow resolves before auto
 * mode's classifier, so each is exact, since a wildcard would also approve a
 * refspec, a remote, or a flag that reaches the default branch.
 */
export const PUSH_ALLOWED: readonly string[] = [
  'Bash(git push --force-with-lease)',
  'Bash(git push --force-with-lease origin HEAD)',
]

/**
 * Named per subcommand, since a `canon pr` wildcard would approve `close` and
 * `preview`. `canon browser` is left out, since its session flag precedes the
 * subcommand and no rule could allow a screenshot without `run-code` and `eval`.
 */
export const UI_PASS_ALLOWED: readonly string[] = [
  'Bash(canon drive:*)',
  'Bash(canon pr head:*)',
  'Bash(canon pr checks:*)',
  'Bash(canon pr evidence:*)',
  'Bash(canon pr local:*)',
  'Bash(canon pr drive-copy:*)',
  'Bash(canon pr frames:*)',
  'Bash(canon pr tick:*)',
  'Bash(canon pr lift:*)',
]

/**
 * Keeps a pass from installing a browser, in the session form a pass types as
 * well, and from `frames --drop` and `--prune`, which force-move the shared
 * frames ref. A deny resolves ahead of the `canon pr frames` allow.
 */
export const UI_PASS_DENIED: readonly string[] = [
  'Bash(canon browser *install-browser*)',
  'Bash(canon pr frames *--drop*)',
  'Bash(canon pr frames *--prune*)',
]

export interface SessionDefaultsOptions {
  /** The seeded `hooks` value, which is the list of what to wire. */
  readonly seeded?: Record<string, unknown>
  /** Whether the project holds a seeded script under `.claude/hooks/`. */
  readonly holds?: (script: string) => boolean
}

export interface SessionDefaultsPlan {
  readonly keys: readonly SettingsKey[]
  /** The additions, which the write applies in order as text insertions. */
  readonly edits: readonly SettingsEdit[]
  /** The settings as the edits leave them. */
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
  /** True when the ask list still holds the merge verb the seed retired. */
  readonly holdsMergeAsk: boolean
  /**
   * True when the deny list holds the merge verb, which keeps an orchestrator
   * from merging on the operator's word and which this verb never removes.
   */
  readonly holdsMergeDeny: boolean
  /** True when the allow list lacks any lease push entry. */
  readonly lacksPushAllow: boolean
  /** True when the allow list lacks any UI pass entry. */
  readonly lacksUiPassAllow: boolean
  /** Each seeded hook whose script the project holds and no group runs. */
  readonly unwired: readonly UnwiredHook[]
}

export type SessionDefaultsRead =
  | { readonly kind: 'refused'; readonly reason: string }
  | {
      readonly kind: 'absent'
      readonly path: string
      /** Every held seeded script, since a missing settings file runs none. */
      readonly unwired: readonly UnwiredHook[]
    }
  | {
      readonly kind: 'planned'
      readonly path: string
      readonly indent: string
      readonly source: string
      readonly plan: SessionDefaultsPlan
    }

export function settingsPath(root: string): string {
  return join(root, '.claude', 'settings.json')
}

function isRecord(value: unknown): value is SettingsRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function appendTo(path: string[], values: readonly unknown[]): SettingsEdit[] {
  return values.map((value) => ({ kind: 'append', path, value }))
}

/**
 * Appends the deny and allow entries each list lacks and the seeded hooks the
 * project holds and does not run, keeping every list's own order, so the diff
 * a person reads is the added entries alone.
 */
export function planSessionDefaults(
  current: SettingsRecord,
  { seeded = {}, holds = () => false }: SessionDefaultsOptions = {},
): SessionDefaultsPlan {
  const permissions = isRecord(current.permissions) ? current.permissions : {}
  const deny = Array.isArray(permissions.deny) ? permissions.deny : []
  const allow = Array.isArray(permissions.allow) ? permissions.allow : []
  const ask = Array.isArray(permissions.ask) ? permissions.ask : []

  const subagentsMissing = DENIED_TOOLS.filter((tool) => !deny.includes(tool))
  const mergeMissing = MERGE_DENIED.filter((entry) => !deny.includes(entry))
  const uiPassDenyMissing = UI_PASS_DENIED.filter(
    (entry) => !deny.includes(entry),
  )
  const missing = [...subagentsMissing, ...mergeMissing, ...uiPassDenyMissing]
  const pushMissing = PUSH_ALLOWED.filter((entry) => !allow.includes(entry))
  const uiPassMissing = UI_PASS_ALLOWED.filter(
    (entry) => !allow.includes(entry),
  )
  const allowMissing = [...pushMissing, ...uiPassMissing]
  const memoryAbsent = !('autoMemoryEnabled' in current)
  const wiring = planHookWiring(current.hooks, seeded, holds)

  const edits: SettingsEdit[] = [
    ...appendTo(['permissions', 'deny'], missing),
    ...appendTo(['permissions', 'allow'], allowMissing),
    ...(memoryAbsent
      ? [
          {
            kind: 'set',
            path: ['autoMemoryEnabled'],
            value: false,
          } satisfies SettingsEdit,
        ]
      : []),
    ...wiring.events.flatMap((event) => event.edits),
  ]

  const keys: SettingsKey[] = [
    { label: 'permissions.deny', changed: missing.length > 0 },
    { label: 'permissions.allow', changed: allowMissing.length > 0 },
    { label: 'autoMemoryEnabled', changed: memoryAbsent },
    ...wiring.events.map((event) => ({
      label: `hooks.${event.event}`,
      changed: event.edits.length > 0,
    })),
  ]

  const next: unknown = JSON.parse(
    applySettingsEdits(JSON.stringify(current), edits, '  '),
  )
  return {
    keys,
    edits,
    next: isRecord(next) ? next : {},
    changed: edits.length > 0,
    predates:
      memoryAbsent &&
      subagentsMissing.length === DENIED_TOOLS.length &&
      mergeMissing.length === MERGE_DENIED.length,
    lacksMergeDeny: mergeMissing.length > 0,
    holdsMergeAsk: ask.includes(MERGE_VERB),
    holdsMergeDeny: deny.includes(MERGE_VERB),
    lacksPushAllow: pushMissing.length > 0,
    lacksUiPassAllow: uiPassMissing.length > 0,
    unwired: wiring.unwired,
  }
}

/**
 * Refuses whenever a write could replace something the person owns: the
 * toolkit's own settings, unparsable JSON, or a permissions list, `hooks`, or
 * seeded event of an unexpected shape. The seed is read from `toolkitRoot`.
 */
export async function readSessionDefaults(
  root: string,
  toolkitRoot: string,
): Promise<SessionDefaultsRead> {
  if (root === toolkitRoot) {
    return {
      kind: 'refused',
      reason:
        'Cannot run against toolkit root. Files here are the source of truth.',
    }
  }

  const seeded = await readSeededHooks(toolkitRoot)
  const holds = holdsHookScript(root)
  const path = settingsPath(root)
  if (!existsSync(path)) {
    return {
      kind: 'absent',
      path,
      unwired: planHookWiring(undefined, seeded, holds).unwired,
    }
  }

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
  for (const list of ['deny', 'allow', 'ask'] as const) {
    if (
      permissions?.[list] !== undefined &&
      !Array.isArray(permissions[list])
    ) {
      return {
        kind: 'refused',
        reason: `${path}: permissions.${list} is not a list`,
      }
    }
  }

  const shape = hooksShapeError(read.value.hooks, seeded)
  if (shape !== undefined) {
    return { kind: 'refused', reason: `${path}: ${shape}` }
  }

  return {
    kind: 'planned',
    path,
    indent: read.indent,
    source: read.source,
    plan: planSessionDefaults(read.value, { seeded, holds }),
  }
}

/**
 * Applies the plan as insertions into the text it was read from, so every
 * byte outside them stays as the project wrote it.
 */
export async function applySessionDefaults(
  read: Extract<SessionDefaultsRead, { kind: 'planned' }>,
): Promise<void> {
  await writeSettings(
    read.path,
    applySettingsEdits(
      editableSource(read.source),
      read.plan.edits,
      read.indent,
    ),
  )
}

/**
 * `readSettings` reads an empty or whitespace-only file as `{}`, so the edits
 * start from an empty object in the file's own line ending, since there is no
 * JSON text to insert into.
 */
function editableSource(source: string): string {
  if (source.trim() !== '') return source
  return `{}${source.includes('\r\n') ? '\r\n' : '\n'}`
}
