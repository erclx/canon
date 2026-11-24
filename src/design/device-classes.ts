import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The device classes a project can declare, in reader order. The design-record standard states the config grammar,
 * and the shipped screenshot harness reads it inline, tested on `@/design/fixtures/device-classes`.
 */
export const DEVICE_CLASSES = ['phone', 'tablet', 'desktop'] as const

export type DeviceClass = (typeof DEVICE_CLASSES)[number]

/** The class a viewport width falls in, at the Material 3 window boundaries of 600 and 840. */
export function deviceClassOf(width: number): DeviceClass {
  if (width < 600) return 'phone'
  if (width < 840) return 'tablet'
  return 'desktop'
}

function isDeviceClass(name: string): name is DeviceClass {
  return (DEVICE_CLASSES as readonly string[]).includes(name)
}

/** Where a project declares its device classes, beside the label map. */
export const DEVICE_CONFIG_REL = join('canon', 'config', 'device-classes.toml')

/** One named surface and the classes it supports, matched by design group or path prefix. */
export interface DeviceScope {
  readonly name: string
  readonly groups: readonly string[]
  readonly paths: readonly string[]
  readonly classes: readonly DeviceClass[]
}

export interface DeviceConfig {
  readonly default: readonly DeviceClass[]
  readonly scopes: readonly DeviceScope[]
}

/** Why a config could not be used. A missing file or table is no refusal, and supports all three classes. */
export type DeviceConfigRefusal =
  | 'unreadable-config'
  | 'unknown-key'
  | 'bad-field'
  | 'unknown-class'
  | 'missing-why'

export type DeviceConfigRead =
  | { readonly ok: true; readonly config: DeviceConfig }
  | {
      readonly ok: false
      readonly reason: DeviceConfigRefusal
      /** The dotted key that failed, such as `device-classes.scopes.landing.classes`, empty for the whole file. */
      readonly field: string
      readonly message: string
    }

const NO_CONFIG: DeviceConfig = { default: DEVICE_CLASSES, scopes: [] }

const TABLE = 'device-classes'
const TABLE_KEYS = ['default', 'why', 'scopes']
const SCOPE_KEYS = ['groups', 'paths', 'classes', 'why']

class ConfigRefusal extends Error {
  constructor(
    readonly reason: DeviceConfigRefusal,
    readonly field: string,
    message: string,
  ) {
    super(message)
  }
}

/**
 * The `[device-classes]` table of `canon/config/device-classes.toml`. Every key is checked, since a typo that dropped a
 * scope would capture the wrong widths with no sign. The shipped harness carries its own copy of this grammar.
 */
export function parseDeviceConfig(
  source: string | undefined,
): DeviceConfigRead {
  if (source === undefined) return { ok: true, config: NO_CONFIG }
  let parsed: unknown
  try {
    parsed = Bun.TOML.parse(source)
  } catch {
    return refuse('unreadable-config', '', 'is not valid TOML')
  }
  try {
    return { ok: true, config: readConfig(parsed) }
  } catch (error) {
    if (!(error instanceof ConfigRefusal)) throw error
    return refuse(error.reason, error.field, error.message)
  }
}

export function readDeviceConfig(root: string): DeviceConfigRead {
  const path = join(root, DEVICE_CONFIG_REL)
  return parseDeviceConfig(
    existsSync(path) ? readFileSync(path, 'utf8') : undefined,
  )
}

export interface DeviceClassesMatch {
  readonly classes: readonly DeviceClass[]
  /** The scopes some input matched, in config order. */
  readonly scopes: readonly string[]
  /** Whether the default contributed, through no input at all or an input no scope matched. */
  readonly defaulted: boolean
}

/**
 * The union of the classes every input reaches. A path matches a scope by a prefix or by sitting under
 * `canon/design/<group>/` for one of its groups, a group matches by name, and an input matching none reaches the default.
 */
export function classesFor(
  config: DeviceConfig,
  input: {
    readonly paths?: readonly string[]
    readonly groups?: readonly string[]
  },
): DeviceClassesMatch {
  const paths = input.paths ?? []
  const groups = input.groups ?? []
  const hits = [
    ...paths.map((path) =>
      config.scopes.filter((scope) => scopeHoldsPath(scope, path)),
    ),
    ...groups.map((group) =>
      config.scopes.filter((scope) => scope.groups.includes(group)),
    ),
  ]
  const defaulted = hits.length === 0 || hits.some((hit) => hit.length === 0)
  const matched = new Set(hits.flat().map((scope) => scope.name))
  const scopes = config.scopes.filter((scope) => matched.has(scope.name))
  const reached = new Set([
    ...(defaulted ? config.default : []),
    ...scopes.flatMap((scope) => scope.classes),
  ])
  return {
    classes: DEVICE_CLASSES.filter((deviceClass) => reached.has(deviceClass)),
    scopes: scopes.map((scope) => scope.name),
    defaulted,
  }
}

function scopeHoldsPath(scope: DeviceScope, path: string): boolean {
  return (
    scope.paths.some((prefix) => path.startsWith(prefix)) ||
    scope.groups.some((group) => path.startsWith(`canon/design/${group}/`))
  )
}

function refuse(
  reason: DeviceConfigRefusal,
  field: string,
  detail: string,
): DeviceConfigRead {
  const at =
    field === '' ? DEVICE_CONFIG_REL : `${field} in ${DEVICE_CONFIG_REL}`
  return { ok: false, reason, field, message: `${at} ${detail}.` }
}

function readConfig(parsed: unknown): DeviceConfig {
  const file = asTable(parsed, '')
  checkKeys(file, [TABLE], '')
  if (file[TABLE] === undefined) return NO_CONFIG
  const table = asTable(file[TABLE], TABLE)
  checkKeys(table, TABLE_KEYS, TABLE)

  let fallback: readonly DeviceClass[] = DEVICE_CLASSES
  if (table.default !== undefined) {
    fallback = readClasses(table.default, `${TABLE}.default`)
    readWhy(table.why, `${TABLE}.why`)
  }
  const scopes =
    table.scopes === undefined ? {} : asTable(table.scopes, `${TABLE}.scopes`)
  return {
    default: fallback,
    scopes: Object.entries(scopes).map(([name, value]) =>
      readScope(name, value, `${TABLE}.scopes.${name}`),
    ),
  }
}

function readScope(name: string, value: unknown, field: string): DeviceScope {
  const scope = asTable(value, field)
  checkKeys(scope, SCOPE_KEYS, field)
  const groups = readNames(scope.groups, `${field}.groups`)
  const paths = readNames(scope.paths, `${field}.paths`)
  if (groups.length + paths.length === 0) {
    throw new ConfigRefusal(
      'bad-field',
      field,
      'names no groups or paths, so no change can reach it',
    )
  }
  const classes = readClasses(scope.classes, `${field}.classes`)
  readWhy(scope.why, `${field}.why`)
  return { name, groups, paths, classes }
}

function readClasses(value: unknown, field: string): DeviceClass[] {
  if (value === undefined) {
    throw new ConfigRefusal('bad-field', field, 'is missing')
  }
  const names = readNames(value, field).map((name) => name.toLowerCase())
  if (names.length === 0) {
    throw new ConfigRefusal('bad-field', field, 'names no device class')
  }
  const unknown = names.find((name) => !isDeviceClass(name))
  if (unknown !== undefined) {
    throw new ConfigRefusal(
      'unknown-class',
      field,
      `names '${unknown}'. It takes phone, tablet, or desktop`,
    )
  }
  return DEVICE_CLASSES.filter((deviceClass) => names.includes(deviceClass))
}

function readWhy(value: unknown, field: string): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ConfigRefusal(
      'missing-why',
      field,
      'is missing, and every declared set of classes says why',
    )
  }
}

function readNames(value: unknown, field: string): string[] {
  if (value === undefined) return []
  if (
    !Array.isArray(value) ||
    !value.every((entry) => typeof entry === 'string' && entry !== '')
  ) {
    throw new ConfigRefusal('bad-field', field, 'is not a list of names')
  }
  return value
}

function asTable(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ConfigRefusal('bad-field', field, 'is not a table')
  }
  return value as Record<string, unknown>
}

function checkKeys(
  table: Record<string, unknown>,
  known: readonly string[],
  field: string,
): void {
  const unknown = Object.keys(table).find((key) => !known.includes(key))
  if (unknown === undefined) return
  throw new ConfigRefusal(
    'unknown-key',
    field === '' ? unknown : `${field}.${unknown}`,
    `is no key. It takes ${known.join(', ')}`,
  )
}
