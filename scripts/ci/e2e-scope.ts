// Writes which E2E suites a pull request's imports reach, to GITHUB_OUTPUT as
// e2e, full, and files. Any read that fails falls back to the full suite, since
// a missing answer must never skip a suite. Usage: e2e-scope.ts <base>

import { execaSync } from 'execa'
import { appendFileSync } from 'node:fs'
import { relative } from 'node:path'

import { cliBootstrap } from '@/gate/cli-bootstrap'
import {
  e2eCliSpawners,
  e2eReadersOf,
  readTestSources,
} from '@/gate/corpus-readers'
import { FULL_SUITE_TRIGGERS } from '@/gate/stages'

export interface E2eScope {
  readonly e2e: boolean
  readonly full: boolean
  readonly files: readonly string[]
}

/**
 * What the suites that spawn the CLI entry reach through no import: the entry
 * and the modules it loads outside a command, which every command runs through,
 * and whether `package.json` moved its `version` and nothing else.
 */
export interface CliScope {
  readonly spawners?: readonly string[]
  readonly bootstrap?: readonly string[]
  readonly versionOnly?: boolean
}

const FULL: E2eScope = { e2e: true, full: true, files: [] }

/** Whether two `package.json` texts differ in `version` alone. */
export function versionOnly(base: string, head: string): boolean {
  const withoutVersion = (text: string): string => {
    const parsed = JSON.parse(text) as Record<string, unknown>
    delete parsed.version
    return JSON.stringify(parsed)
  }
  try {
    return withoutVersion(base) === withoutVersion(head)
  } catch {
    return false
  }
}

/**
 * An empty changed set is a read that failed, since a pull request always
 * changes a file, so it takes the full suite like a trigger does. A version
 * bump beside `bun.lock` stays a trigger, since the lock can move dependencies.
 */
export function scopeFor(
  changed: readonly string[],
  affected: readonly string[],
  readersOf: (file: string) => readonly string[],
  cli: CliScope = {},
): E2eScope {
  if (changed.length === 0) return FULL
  const triggers =
    cli.versionOnly && !changed.includes('bun.lock')
      ? changed.filter((file) => file !== 'package.json')
      : changed
  if (triggers.some((file) => FULL_SUITE_TRIGGERS.test(file))) return FULL
  const bootstrap = new Set(cli.bootstrap ?? [])
  const spawners = changed.some((file) => bootstrap.has(file))
    ? (cli.spawners ?? [])
    : []
  const readers = changed.flatMap(readersOf)
  const files = [...new Set([...affected, ...readers, ...spawners])].sort()
  return { e2e: files.length > 0, full: false, files }
}

function measure(base: string): E2eScope {
  const root = process.cwd()
  const diff = execaSync('git', [
    'diff',
    '--name-only',
    '--no-renames',
    base,
    'HEAD',
  ])
  const changed = diff.stdout.split('\n').filter((file) => file !== '')
  const listed = execaSync('bun', [
    '--bun',
    'vitest',
    'list',
    '--config',
    'vitest.e2e.config.ts',
    '--changed',
    base,
    '--filesOnly',
    '--json',
  ]).stdout
  const affected = (JSON.parse(listed) as { file: string }[]).map((entry) =>
    relative(root, entry.file),
  )
  const sources = readTestSources(root)
  return scopeFor(changed, affected, (file) => e2eReadersOf(file, sources), {
    spawners: e2eCliSpawners(sources),
    bootstrap: cliBootstrap(root),
    versionOnly: changed.includes('package.json')
      ? versionOnly(show(base), show('HEAD'))
      : false,
  })
}

function show(ref: string): string {
  return execaSync('git', ['show', `${ref}:package.json`]).stdout
}

function main(base: string | undefined): void {
  let scope = FULL
  try {
    if (base !== undefined) scope = measure(base)
  } catch (error) {
    console.error(`e2e-scope: ${String(error)}, running the full suite`)
  }
  const lines = [
    `e2e=${scope.e2e}`,
    `full=${scope.full}`,
    `files=${scope.files.join(' ')}`,
  ]
  const out = process.env.GITHUB_OUTPUT
  if (out !== undefined) appendFileSync(out, `${lines.join('\n')}\n`)
  console.error(lines.join('\n'))
}

if (import.meta.main) main(process.argv[2])
