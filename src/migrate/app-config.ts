/**
 * A TOML file moves as text, so its comments stay beside their keys, and a JSON file is written out as TOML. Every
 * moved table is read back and compared with what the old file reads as before anything is written.
 */

import {
  existsSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { execa } from 'execa'
import {
  APP_CONFIG_REL,
  APP_TABLES,
  type AppTable,
  LEGACY_APP_FILES,
  readLegacyTable,
} from '@/config/app'

export interface AppConfigMove {
  readonly table: AppTable
  readonly from: string
}

/** A tracked line naming an old file, which the move leaves to a person. */
export interface AppConfigCitation {
  readonly path: string
  readonly line: number
}

export type AppConfigPlan =
  | {
      readonly kind: 'refused'
      readonly reason:
        | 'unparsable-app-config'
        | 'unparsable-source'
        | 'table-exists'
        | 'unconvertible'
        | 'mismatch'
      readonly message: string
    }
  | {
      readonly kind: 'planned'
      readonly moves: readonly AppConfigMove[]
      /** The text `app.toml` holds after the move, unchanged when nothing moves. */
      readonly text: string
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

interface LineState {
  /** Inside a multi-line string or a value still open across lines. */
  readonly inValue: boolean
}

/**
 * Whether each line opens outside any string, array, or inline table, which is
 * where a table header or a key can stand. A multi-line `launch` or array would
 * otherwise read its inner lines as headers.
 */
function lineStates(text: string): LineState[] {
  const states: LineState[] = []
  let depth = 0
  let quote: '' | '"' | "'" | '"""' | "'''" = ''
  let comment = false
  let lineOpen = true
  for (let i = 0; i < text.length; i++) {
    if (lineOpen) {
      states.push({ inValue: depth > 0 || quote.length === 3 })
      lineOpen = false
    }
    const char = text[i]
    if (char === '\n') {
      comment = false
      if (quote.length === 1) quote = ''
      lineOpen = true
      continue
    }
    if (comment) continue
    if (quote !== '') {
      if (quote === '"' || quote === '"""') {
        if (char === '\\') {
          i++
          continue
        }
      }
      if (text.startsWith(quote, i)) {
        i += quote.length - 1
        quote = ''
      }
      continue
    }
    if (char === '#') comment = true
    else if (text.startsWith('"""', i) || text.startsWith("'''", i)) {
      quote = text.slice(i, i + 3) as '"""' | "'''"
      i += 2
    } else if (char === '"' || char === "'") quote = char
    else if (char === '[' || char === '{') depth++
    else if (char === ']' || char === '}') depth = Math.max(0, depth - 1)
  }
  if (lineOpen) states.push({ inValue: depth > 0 || quote.length === 3 })
  return states
}

const HEADER = /^(\s*)(\[\[?)(\s*)([^\]]*?)(\s*)(\]\]?)/

/**
 * A file whose top level is the table's body, moved under one header: each of
 * its own table headers gains the table's name, and each top-level key the
 * table renames takes its new name.
 */
function nestToml(
  text: string,
  table: AppTable,
  renames: Readonly<Record<string, string>>,
): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const states = lineStates(lines.join('\n'))
  let topLevel = true
  const moved = lines.map((line, index) => {
    if (states[index]?.inValue) return line
    const header = HEADER.exec(line)
    if (header !== null && header[4] !== undefined && header[4] !== '') {
      topLevel = false
      const [whole, indent, open, before, name, after, close] = header
      return `${indent}${open}${before}${table}.${name}${after}${close}${line.slice(whole.length)}`
    }
    if (!topLevel) return line
    for (const [old, next] of Object.entries(renames)) {
      const key = new RegExp(`^(\\s*)(?:${old}|"${old}"|'${old}')(\\s*=)`)
      if (key.test(line)) return line.replace(key, `$1${next}$2`)
    }
    return line
  })
  return `[${table}]\n${moved.join('\n').replace(/\n*$/, '\n')}`
}

const BARE_KEY = /^[A-Za-z0-9_-]+$/

function tomlKey(key: string): string {
  return BARE_KEY.test(key) ? key : JSON.stringify(key)
}

class Unconvertible extends Error {}

function tomlValue(value: unknown, at: string): string {
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    return `[${value.map((item, index) => tomlValue(item, `${at}[${index}]`)).join(', ')}]`
  }
  if (isRecord(value)) {
    const entries = Object.entries(value).map(
      ([key, item]) => `${tomlKey(key)} = ${tomlValue(item, `${at}.${key}`)}`,
    )
    return entries.length === 0 ? '{}' : `{ ${entries.join(', ')} }`
  }
  throw new Unconvertible(
    `${at} holds ${JSON.stringify(value)}, which TOML cannot hold`,
  )
}

/** A JSON object written as one TOML table, its top-level keys renamed as the table renames them. */
function jsonToToml(
  value: Record<string, unknown>,
  table: AppTable,
  renames: Readonly<Record<string, string>>,
): string {
  const targets = new Set(Object.values(renames))
  const lines = Object.entries(value).flatMap(([key, item]) => {
    const renamed = renames[key]
    if (renamed === undefined && targets.has(key)) return []
    const name = renamed ?? key
    return [`${tomlKey(name)} = ${tomlValue(item, `${table}.${name}`)}`]
  })
  return `[${table}]\n${lines.map((line) => `${line}\n`).join('')}`
}

function parseToml(text: string): unknown {
  try {
    return Bun.TOML.parse(text)
  } catch {
    return undefined
  }
}

/**
 * Refuses rather than writing part of a move, on a file that does not parse, a table `app.toml` already holds beside
 * its old file, a JSON value TOML cannot hold, or a table that would read back different.
 */
export function planAppConfig(root: string): AppConfigPlan {
  const appPath = join(root, APP_CONFIG_REL)
  const existing = existsSync(appPath) ? readFileSync(appPath, 'utf8') : ''
  const current = parseToml(existing)
  if (!isRecord(current)) {
    return {
      kind: 'refused',
      reason: 'unparsable-app-config',
      message: `${APP_CONFIG_REL} is not valid TOML, so no table can be added to it.`,
    }
  }

  const moves: AppConfigMove[] = []
  const blocks: string[] = []
  for (const table of APP_TABLES) {
    const legacy = LEGACY_APP_FILES[table]
    const path = join(root, legacy.rel)
    if (!existsSync(path)) continue
    if (table in current) {
      return {
        kind: 'refused',
        reason: 'table-exists',
        message: `${APP_CONFIG_REL} already holds [${table}] and ${legacy.rel} still exists. Merge the two by hand, then delete ${legacy.rel}.`,
      }
    }
    const source = readFileSync(path, 'utf8')
    let block: string
    if (legacy.format === 'json') {
      let parsed: unknown
      try {
        parsed = JSON.parse(source)
      } catch {
        parsed = undefined
      }
      if (!isRecord(parsed)) {
        return {
          kind: 'refused',
          reason: 'unparsable-source',
          message: `${legacy.rel} is not a JSON object, so it cannot become [${table}].`,
        }
      }
      try {
        block = jsonToToml(parsed, table, legacy.renames)
      } catch (error) {
        if (!(error instanceof Unconvertible)) throw error
        return {
          kind: 'refused',
          reason: 'unconvertible',
          message: `${legacy.rel}: ${error.message}.`,
        }
      }
    } else {
      if (parseToml(source) === undefined) {
        return {
          kind: 'refused',
          reason: 'unparsable-source',
          message: `${legacy.rel} is not valid TOML, so it cannot become [${table}].`,
        }
      }
      block = legacy.nested
        ? source.replace(/\r\n/g, '\n').replace(/\n*$/, '\n')
        : nestToml(source, table, legacy.renames)
    }
    moves.push({ table, from: legacy.rel })
    blocks.push(block)
  }

  if (moves.length === 0) return { kind: 'planned', moves, text: existing }

  const head =
    existing.trim() === '' ? '' : `${existing.replace(/\n*$/, '\n')}\n`
  const text = `${head}${blocks.join('\n')}`
  const mismatch = readsDifferent(root, text, moves)
  if (mismatch !== undefined) {
    return {
      kind: 'refused',
      reason: 'mismatch',
      message: `[${mismatch}] would read differently from ${LEGACY_APP_FILES[mismatch].rel} after the move, so nothing was written.`,
    }
  }
  return { kind: 'planned', moves, text }
}

/** The first moved table whose value in the planned text differs from what its old file reads as today, absent matching absent. */
function readsDifferent(
  root: string,
  text: string,
  moves: readonly AppConfigMove[],
): AppTable | undefined {
  const planned = parseToml(text)
  for (const { table } of moves) {
    const before = readLegacy(root, table)
    const after = isRecord(planned) ? planned[table] : undefined
    if (!Bun.deepEquals(before, after)) return table
  }
  return undefined
}

function readLegacy(root: string, table: AppTable): unknown {
  const read = readLegacyTable(root, table)
  return read.kind === 'table' ? read.value : undefined
}

/**
 * Every tracked line naming an old file outside the old files themselves,
 * undefined when git could not be read, so an unread tree is never reported as
 * holding no citation.
 */
export async function scanAppConfigCitations(
  root: string,
): Promise<readonly AppConfigCitation[] | undefined> {
  const patterns = [
    'app-drive.toml',
    'device-classes.toml',
    'config/preview.json',
    'config/local.toml',
    'config/painted.json',
  ]
  const result = await execa(
    'git',
    [
      '-C',
      root,
      'grep',
      '-n',
      '-I',
      '-F',
      ...patterns.flatMap((pattern) => ['-e', pattern]),
      '--',
      '.',
      ...APP_TABLES.map((table) => `:!${LEGACY_APP_FILES[table].rel}`),
    ],
    { reject: false },
  )
  if (result.exitCode === 1) return []
  if (result.exitCode !== 0) return undefined
  return String(result.stdout)
    .split('\n')
    .flatMap((line) => {
      const match = /^(.+?):(\d+):/.exec(line)
      return match === null || match[1] === undefined || match[2] === undefined
        ? []
        : [{ path: match[1], line: Number(match[2]) }]
    })
}

/** Writes `app.toml` in its own mode when it exists, then removes each moved file. */
export function applyAppConfig(
  root: string,
  plan: Extract<AppConfigPlan, { kind: 'planned' }>,
): void {
  const appPath = join(root, APP_CONFIG_REL)
  const mode = existsSync(appPath) ? statSync(appPath).mode : undefined
  writeFileSync(appPath, plan.text, mode === undefined ? undefined : { mode })
  for (const move of plan.moves) rmSync(join(root, move.from))
}
