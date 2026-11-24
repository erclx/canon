import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  CANON_WRITTEN_FILES,
  CONFIG_FILES,
  type ConfigFileSpec,
  MOVED_CONFIG_FILES,
  type TableSpec,
  type ValueSpec,
} from '@/config/keys'

export const CONFIG_DIR_REL = join('canon', 'config')

export type ConfigFindingKind =
  | 'unparsable'
  | 'unknown-key'
  | 'wrong-type'
  | 'unknown-file'
  | 'unmoved'

/** A `fail` breaks a reader today, and a `warn` is a file no reader reads. */
export interface ConfigFinding {
  readonly file: string
  readonly kind: ConfigFindingKind
  readonly severity: 'fail' | 'warn'
  readonly message: string
}

const NEEDS: Record<Exclude<ValueSpec, object>, string> = {
  string: 'a string',
  boolean: 'true or false',
  integer: 'an integer',
  'string-list': 'a list of strings',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function describeNeed(spec: ValueSpec): string {
  if (typeof spec === 'string') return NEEDS[spec]
  if (spec.kind === 'one-of') return spec.of.map(describeNeed).join(' or ')
  return 'a table'
}

function matches(value: unknown, spec: ValueSpec): boolean {
  if (spec === 'string') return typeof value === 'string'
  if (spec === 'boolean') return typeof value === 'boolean'
  if (spec === 'integer') return Number.isInteger(value)
  if (spec === 'string-list') {
    return (
      Array.isArray(value) && value.every((each) => typeof each === 'string')
    )
  }
  if (spec.kind === 'one-of')
    return spec.of.some((each) => matches(value, each))
  return isRecord(value)
}

/** The child tables of `spec` declaring `key`, so a key written above its header names where it belongs. */
function tablesHolding(spec: TableSpec, key: string): string[] {
  return Object.entries(spec.keys).flatMap(([name, child]) =>
    typeof child === 'object' && child.kind === 'table' && key in child.keys
      ? [name]
      : [],
  )
}

function judge(
  file: string,
  path: string,
  value: unknown,
  spec: ValueSpec,
): ConfigFinding[] {
  if (typeof spec === 'object' && spec.kind === 'one-of') {
    const fits = spec.of.find((each) =>
      typeof each === 'object' ? isRecord(value) : matches(value, each),
    )
    if (fits === undefined) return [wrongType(file, path, spec)]
    return judge(file, path, value, fits)
  }
  if (!matches(value, spec)) return [wrongType(file, path, spec)]
  if (typeof spec === 'string' || !isRecord(value)) return []
  if (spec.kind === 'map') {
    return Object.entries(value).flatMap(([key, entry]) =>
      judge(file, `${path}.${key}`, entry, spec.of),
    )
  }
  return judgeTable(file, path, value, spec)
}

function judgeTable(
  file: string,
  path: string,
  value: Record<string, unknown>,
  spec: TableSpec,
): ConfigFinding[] {
  return Object.entries(value).flatMap(([key, entry]) => {
    const where = path === '' ? key : `${path}.${key}`
    const child = spec.keys[key]
    if (child !== undefined) return judge(file, where, entry, child)
    const owners = tablesHolding(spec, key)
    const hint =
      owners.length > 0
        ? `, and belongs under ${owners.map((each) => `[${each}]`).join(' or ')}`
        : ''
    return [
      {
        file,
        kind: 'unknown-key',
        severity: 'fail',
        message: `${file}: ${where} is not a key canon reads${hint}.`,
      },
    ]
  })
}

function wrongType(file: string, path: string, spec: ValueSpec): ConfigFinding {
  return {
    file,
    kind: 'wrong-type',
    severity: 'fail',
    message: `${file}: ${path} needs ${describeNeed(spec)}.`,
  }
}

/** Judges one file's text against its spec, so a starter is checked without a project around it. */
export function checkConfigText(
  spec: ConfigFileSpec,
  text: string,
): ConfigFinding[] {
  const file = join(CONFIG_DIR_REL, spec.name)
  let parsed: unknown
  try {
    parsed = Bun.TOML.parse(text)
  } catch {
    return [
      {
        file,
        kind: 'unparsable',
        severity: 'fail',
        message: `${file} is not valid TOML.`,
      },
    ]
  }
  return isRecord(parsed) ? judgeTable(file, '', parsed, spec.root) : []
}

/**
 * Every file under `canon/config/` at `root`. A missing folder holds no finding, since a project with no config
 * reads every default.
 */
export function checkConfigFolder(root: string): ConfigFinding[] {
  const dir = join(root, CONFIG_DIR_REL)
  if (!existsSync(dir)) return []

  const names = readdirSync(dir)
    .filter((name) => statSync(join(dir, name)).isFile())
    .sort()
  return names.flatMap((name): ConfigFinding[] => {
    const file = join(CONFIG_DIR_REL, name)
    const spec = CONFIG_FILES.find((each) => each.name === name)
    if (spec !== undefined) {
      return checkConfigText(spec, readFileSync(join(dir, name), 'utf8'))
    }
    if (CANON_WRITTEN_FILES.includes(name)) return []
    const moved = MOVED_CONFIG_FILES.find((each) => each.name === name)
    if (moved !== undefined) {
      return [
        {
          file,
          kind: 'unmoved',
          severity: 'warn',
          message: `${file} moved into ${join(CONFIG_DIR_REL, moved.into)}. Run ${moved.verb} to move it.`,
        },
      ]
    }
    return [
      {
        file,
        kind: 'unknown-file',
        severity: 'warn',
        message: `${file} is not a file canon reads. Every config file: canon docs config`,
      },
    ]
  })
}
