import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { APP_TABLES, readAppTable } from '@/config/app'
import { checkConfigText } from '@/config/check'
import {
  CONFIG_FILES,
  type ConfigFileSpec,
  type TableSpec,
} from '@/config/keys'
import { readGateKeys, readRoots } from '@/context/coverage'
import { readDeviceConfig } from '@/design/device-classes'
import { parseLabelMap } from '@/labels/map'
import { loadPreviewConfig } from '@/pr/drive-copy'
import { readHealthPaths } from '@/pr/health'
import { loadPaintedPatterns } from '@/pr/painted'

const REPO = join(import.meta.dirname, '..', '..')
const STARTERS = join(REPO, 'tooling', 'base', 'seeds', 'canon', 'config')
const SEEDED = CONFIG_FILES.filter((spec) => spec.seeded)

/**
 * Named sub-tables a starter leaves to the docs page, since each takes a name the project chooses and a commented
 * example of one reads as a key to uncomment.
 */
const PAGE_ONLY = ['drive.targets', 'device-classes.scopes']

/** A commented key or table header, as opposed to a line of prose. */
const COMMENTED_SETTING = /^# (\[[a-z.-]+\]|[a-z-]+ = .*)$/

function starterText(spec: ConfigFileSpec): string {
  return readFileSync(join(STARTERS, spec.name), 'utf8')
}

function uncomment(text: string): string {
  return text
    .split('\n')
    .map((line) => (COMMENTED_SETTING.test(line) ? line.slice(2) : line))
    .join('\n')
}

/** Every key path a spec names, skipping a named sub-table's inside, since its keys sit under the project's names. */
function keyPaths(spec: TableSpec, prefix = ''): string[] {
  return Object.entries(spec.keys).flatMap(([key, child]) => {
    const path = prefix === '' ? key : `${prefix}.${key}`
    return typeof child === 'object' && child.kind === 'table'
      ? [path, ...keyPaths(child, path)]
      : [path]
  })
}

/** Every key path including those inside a named sub-table, written under `<name>`. */
function everyKeyPath(spec: TableSpec, prefix = ''): string[] {
  return Object.entries(spec.keys).flatMap(([key, child]) => {
    const path = prefix === '' ? key : `${prefix}.${key}`
    if (typeof child !== 'object' || child.kind === 'one-of') return [path]
    if (child.kind === 'table') return [path, ...everyKeyPath(child, path)]
    return typeof child.of === 'object' && child.of.kind === 'table'
      ? [path, ...everyKeyPath(child.of, `${path}.<name>`)]
      : [path]
  })
}

/** The text under `heading`, up to the next heading of the same or a higher level. */
function sectionOf(text: string, heading: string): string {
  const start = text.indexOf(`${heading}\n`)
  if (start === -1) return ''
  const level = heading.split(' ')[0] ?? ''
  const rest = text.slice(start)
  const next = rest
    .slice(heading.length)
    .search(new RegExp(`\\n#{1,${level.length}} `))
  return next === -1 ? rest : rest.slice(0, heading.length + next)
}

/**
 * Where a config file's keys are documented. `app.toml` has a page of its own
 * with a heading per table, and every other file is one section of the config page.
 */
function docsSectionOf(name: string): {
  file: string
  tableHeading: (table: string) => string
} {
  const read = (page: string): string =>
    readFileSync(join(REPO, 'docs', 'agents', page), 'utf8')
  if (name === 'app.toml') {
    return {
      file: read('app-config.md'),
      tableHeading: (table) => `## [${table}]`,
    }
  }
  return {
    file: sectionOf(read('config.md'), `## ${name}`),
    tableHeading: (table) => `### [${table}]`,
  }
}

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-config-starters-'))
  mkdirSync(join(root, 'canon', 'config'), { recursive: true })
  mkdirSync(join(root, 'src'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function install(name: string, text?: string): void {
  const target = join(root, 'canon', 'config', name)
  if (text === undefined) copyFileSync(join(STARTERS, name), target)
  else writeFileSync(target, text)
}

describe('the commented starters', () => {
  it.each(SEEDED.map((spec) => [spec.name, spec] as const))(
    'should pass the check unedited: %s',
    (_name, spec) => {
      expect(checkConfigText(spec, starterText(spec))).toEqual([])
    },
  )

  it.each(SEEDED.map((spec) => [spec.name, spec] as const))(
    'should pass the check with every key uncommented: %s',
    (_name, spec) => {
      expect(checkConfigText(spec, uncomment(starterText(spec)))).toEqual([])
    },
  )

  it.each(SEEDED.map((spec) => [spec.name, spec] as const))(
    'should name every key the spec holds: %s',
    (_name, spec) => {
      const text = starterText(spec)
      const missing = keyPaths(spec.root)
        .filter((path) => !PAGE_ONLY.includes(path))
        .filter((path) => {
          const key = path.split('.').at(-1) ?? ''
          return !(
            text.includes(`[${path}]`) ||
            new RegExp(`^(# )?${key} = `, 'm').test(text)
          )
        })

      expect(missing).toEqual([])
    },
  )

  it.each(CONFIG_FILES.map((spec) => [spec.name, spec] as const))(
    'should have every key on the docs page: %s',
    (_name, spec) => {
      const { file, tableHeading } = docsSectionOf(spec.name)
      const missing = everyKeyPath(spec.root).filter((path) => {
        const key = path.split('.').at(-1) ?? ''
        const table = path.split('.')[0] ?? ''
        const own = file.includes(tableHeading(table))
          ? sectionOf(file, tableHeading(table))
          : file
        return !(own.includes(`\`${key}\``) || own.includes(`[${path}`))
      })

      expect(file).not.toBe('')
      expect(missing).toEqual([])
    },
  )

  it.each(SEEDED.map((spec) => [spec.name, spec] as const))(
    'should hold every comment block to 3 text lines: %s',
    (_name, spec) => {
      const long = starterText(spec)
        .split(/\n\s*\n/)
        .filter(
          (block) =>
            block
              .split('\n')
              .filter(
                (line) => line.startsWith('#') && !COMMENTED_SETTING.test(line),
              ).length > 3,
        )

      expect(long).toEqual([])
    },
  )
})

describe('an unedited starter read by every reader', () => {
  it('should read app.toml as holding no table', () => {
    install('app.toml')

    expect(APP_TABLES.map((table) => readAppTable(root, table).kind)).toEqual(
      APP_TABLES.map(() => 'absent'),
    )
  })

  it('should read context.toml as declaring nothing', () => {
    install('context.toml')

    expect(readRoots(root)).toEqual({ kind: 'roots', patterns: ['src'] })
    expect(readGateKeys(root)).toEqual({
      gated: null,
      gateLength: false,
      invalid: [],
    })
  })

  it('should read the label map as its rows', () => {
    expect(parseLabelMap(starterText(spec('pr-labels.toml'))).kind).toBe('map')
  })
})

describe('a fully uncommented starter read by every reader', () => {
  beforeEach(() => {
    install('app.toml', uncomment(starterText(spec('app.toml'))))
    install('context.toml', uncomment(starterText(spec('context.toml'))))
  })

  it('should read [drive] as a table', () => {
    expect(readAppTable(root, 'drive').kind).toBe('table')
  })

  it('should read [preview] with its serve and port', () => {
    expect(loadPreviewConfig(root)).toMatchObject({
      kind: 'read',
      config: { serve: ['bun', 'run', 'preview'], port: 4173 },
    })
  })

  it('should read [health] as its paths', () => {
    expect(readHealthPaths(root)).toMatchObject({
      kind: 'paths',
      paths: ['/api/health'],
    })
  })

  it('should read [painted] with the declared globs', () => {
    expect(loadPaintedPatterns(root).painted).toContain('src/client/**/*.ts')
  })

  it('should read [device-classes] as its default', () => {
    expect(readDeviceConfig(root)).toMatchObject({
      ok: true,
      config: { default: ['phone', 'tablet', 'desktop'] },
    })
  })

  it('should read context.toml as its roots and gate keys', () => {
    expect(readRoots(root)).toEqual({ kind: 'roots', patterns: ['src'] })
    expect(readGateKeys(root)).toEqual({
      gated: ['canon/context/'],
      gateLength: true,
      invalid: [],
    })
  })
})

function spec(name: string): ConfigFileSpec {
  const found = CONFIG_FILES.find((each) => each.name === name)
  if (found === undefined) throw new Error(`no spec for ${name}`)
  return found
}
