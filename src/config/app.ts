import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** The one file a project's app settings live in, one table per concern. */
export const APP_CONFIG_REL = join('canon', 'config', 'app.toml')

export const APP_TABLES = [
  'drive',
  'preview',
  'health',
  'painted',
  'device-classes',
] as const

export type AppTable = (typeof APP_TABLES)[number]

/**
 * The file each table lived in before `app.toml`, and how its keys map onto the
 * table's. A `nested` file already holds the table under its own name, so the
 * table is read from inside it rather than from the whole file.
 */
export interface LegacyAppFile {
  readonly rel: string
  readonly format: 'toml' | 'json'
  readonly nested: boolean
  /** Old key to new key, for the top-level keys whose spelling changed. */
  readonly renames: Readonly<Record<string, string>>
}

export const LEGACY_APP_FILES: Readonly<Record<AppTable, LegacyAppFile>> = {
  drive: {
    rel: join('canon', 'config', 'app-drive.toml'),
    format: 'toml',
    nested: false,
    renames: {},
  },
  preview: {
    rel: join('canon', 'config', 'preview.json'),
    format: 'json',
    nested: false,
    renames: {},
  },
  health: {
    rel: join('canon', 'config', 'local.toml'),
    format: 'toml',
    nested: false,
    renames: { health: 'paths' },
  },
  painted: {
    rel: join('canon', 'config', 'painted.json'),
    format: 'json',
    nested: false,
    renames: {
      painted: 'paths',
      unpainted: 'exclude',
      reelInputs: 'reel-inputs',
    },
  },
  'device-classes': {
    rel: join('canon', 'config', 'device-classes.toml'),
    format: 'toml',
    nested: true,
    renames: {},
  },
}

/**
 * A table read from `app.toml` or, when that file holds none, from the file it
 * lived in before, with the old keys renamed to the table's. `value` is unknown
 * because a file can hold the name as something other than a table, which each
 * reader refuses in its own words. `spell` turns a key path in the table's
 * spelling into the one the source file uses, so a refusal names what the
 * project wrote.
 */
export type AppTableRead =
  | { readonly kind: 'absent' }
  | {
      readonly kind: 'table'
      readonly value: unknown
      readonly source: string
      readonly spell: (key: string) => string
    }
  | {
      readonly kind: 'unparsable'
      readonly source: string
      /** The fault as a predicate on the source path, such as `is not valid TOML`. */
      readonly detail: string
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

type Parsed =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly detail: string }

function parseFile(path: string, format: 'toml' | 'json'): Parsed {
  const text = readFileSync(path, 'utf8')
  try {
    return {
      ok: true,
      value: format === 'json' ? JSON.parse(text) : Bun.TOML.parse(text),
    }
  } catch {
    return {
      ok: false,
      detail:
        format === 'json' ? 'does not parse as JSON' : 'is not valid TOML',
    }
  }
}

/**
 * The renamed keys take the new names, and a key already spelled the new way
 * is dropped, since the old reader never read it and must not start to.
 */
function renameKeys(
  value: unknown,
  renames: Readonly<Record<string, string>>,
): unknown {
  if (!isRecord(value)) return value
  const targets = new Set(Object.values(renames))
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) => {
      const renamed = renames[key]
      if (renamed !== undefined) return [[renamed, entry]]
      return targets.has(key) ? [] : [[key, entry]]
    }),
  )
}

function respell(
  key: string,
  renames: Readonly<Record<string, string>>,
): string {
  const [head = '', ...rest] = key.split('.')
  const old = Object.entries(renames).find(([, next]) => next === head)?.[0]
  return [old ?? head, ...rest].join('.')
}

/**
 * Reads one table, `app.toml` first. A table there wins over its old file, and
 * an `app.toml` that does not parse stops every table rather than falling back,
 * since the project has moved and the old file is stale. The old file is read
 * only when `app.toml` is absent or holds no such table.
 */
export function readAppTable(root: string, table: AppTable): AppTableRead {
  const appPath = join(root, APP_CONFIG_REL)
  if (existsSync(appPath)) {
    const parsed = parseFile(appPath, 'toml')
    if (!parsed.ok) {
      return {
        kind: 'unparsable',
        source: APP_CONFIG_REL,
        detail: parsed.detail,
      }
    }
    if (isRecord(parsed.value) && table in parsed.value) {
      return {
        kind: 'table',
        value: parsed.value[table],
        source: APP_CONFIG_REL,
        spell: (key) => `${table}.${key}`,
      }
    }
  }

  return readLegacyTable(root, table)
}

/** The table as its old file alone reads, for a project that has not moved and for the move's own read-back. */
export function readLegacyTable(root: string, table: AppTable): AppTableRead {
  const legacy = LEGACY_APP_FILES[table]
  const legacyPath = join(root, legacy.rel)
  if (!existsSync(legacyPath)) return { kind: 'absent' }
  const parsed = parseFile(legacyPath, legacy.format)
  if (!parsed.ok) {
    return { kind: 'unparsable', source: legacy.rel, detail: parsed.detail }
  }
  if (legacy.nested) {
    if (!isRecord(parsed.value) || !(table in parsed.value)) {
      return { kind: 'absent' }
    }
    return {
      kind: 'table',
      value: parsed.value[table],
      source: legacy.rel,
      spell: (key) => `${table}.${key}`,
    }
  }
  return {
    kind: 'table',
    value: renameKeys(parsed.value, legacy.renames),
    source: legacy.rel,
    spell: (key) => respell(key, legacy.renames),
  }
}
