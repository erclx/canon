import { basename } from 'node:path'
import { APP_TABLES, LEGACY_APP_FILES } from '@/config/app'

/**
 * The shape a value must take. A `map` is a table whose key names are the project's own, such as a label or a
 * target name, so only its values are judged.
 */
export type ValueSpec =
  | 'string'
  | 'boolean'
  | 'integer'
  | 'string-list'
  | TableSpec
  | MapSpec
  | OneOfSpec

export interface TableSpec {
  readonly kind: 'table'
  readonly keys: Readonly<Record<string, ValueSpec>>
}

export interface MapSpec {
  readonly kind: 'map'
  readonly of: ValueSpec
}

export interface OneOfSpec {
  readonly kind: 'one-of'
  readonly of: readonly ValueSpec[]
}

export interface ConfigFileSpec {
  /** The file's name under `canon/config/`. */
  readonly name: string
  readonly root: TableSpec
  /** Whether the base stack seeds a commented starter for it. */
  readonly seeded: boolean
}

const table = (keys: Record<string, ValueSpec>): TableSpec => ({
  kind: 'table',
  keys,
})
const map = (of: ValueSpec): MapSpec => ({ kind: 'map', of })

const DRIVE_KEYS: Record<string, ValueSpec> = {
  launch: 'string',
  data: 'string',
  personas: 'string-list',
  access: 'string',
  scripts: 'string-list',
  proposals: 'string',
  'board-project': 'string',
  'board-folder': 'string',
}

/**
 * Every file a project writes under `canon/config/`, with the keys its readers take. Each reader keeps its own
 * deeper validation, so this judges names and types alone.
 */
export const CONFIG_FILES: readonly ConfigFileSpec[] = [
  {
    name: 'app.toml',
    seeded: true,
    root: table({
      drive: table({
        ...DRIVE_KEYS,
        targets: map(table({ root: 'string', ...DRIVE_KEYS })),
      }),
      preview: table({
        writes: 'string-list',
        keep: 'string-list',
        seed: 'string-list',
        env: 'string',
        serve: 'string-list',
        port: 'integer',
      }),
      health: table({ paths: 'string-list', 'page-only': 'string-list' }),
      painted: table({
        paths: 'string-list',
        exclude: 'string-list',
        'reel-inputs': 'string-list',
      }),
      'device-classes': table({
        default: 'string-list',
        why: 'string',
        scopes: map(
          table({
            groups: 'string-list',
            paths: 'string-list',
            classes: 'string-list',
            why: 'string',
          }),
        ),
      }),
    }),
  },
  {
    name: 'context.toml',
    seeded: true,
    root: table({
      roots: 'string-list',
      gated: 'string-list',
      'gate-length': 'boolean',
    }),
  },
  {
    name: 'pr-labels.toml',
    seeded: true,
    root: table({
      domains: map({
        kind: 'one-of',
        of: ['string-list', table({ paths: 'string-list', color: 'string' })],
      }),
      declined: map('string-list'),
    }),
  },
  {
    name: 'markdown.toml',
    seeded: false,
    root: table({ markdown: table({ gated: 'string-list' }) }),
  },
]

/** Files canon writes itself, which a project never edits and the check never judges. */
export const CANON_WRITTEN_FILES: readonly string[] = [
  'config.json',
  'baseline.json',
]

/** A file a migration folds into another, and the verb that moves it. */
export interface MovedConfigFile {
  readonly name: string
  readonly into: string
  readonly verb: string
}

export const MOVED_CONFIG_FILES: readonly MovedConfigFile[] = APP_TABLES.map(
  (each) => ({
    name: basename(LEGACY_APP_FILES[each].rel),
    into: 'app.toml',
    verb: 'canon migrate app-config',
  }),
)
