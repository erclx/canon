import { existsSync, readFileSync } from 'node:fs'
import { basename } from 'node:path'
import type { Manifest } from '@/tooling/manifest'

export interface PackageJson {
  readonly dependencies?: Record<string, string>
  readonly devDependencies?: Record<string, string>
  readonly scripts?: Record<string, string>
  readonly [key: string]: unknown
}

export interface ScriptState {
  readonly key: string
  readonly state: 'missing' | 'drifted' | 'matching'
}

export interface DepState {
  readonly spec: string
  readonly name: string
  readonly state: 'missing' | 'present' | 'ahead'
  /** The spec the target records, set only when it is `ahead` of the pin. */
  readonly installed?: string
}

export function readPackage(path: string): PackageJson | undefined {
  if (!existsSync(path)) return undefined
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as PackageJson
  } catch {
    return undefined
  }
}

/**
 * Whether the chain asks for any dev dependency or script, which is what makes
 * a missing package.json worth writing. A stack that installs nothing, such as
 * the one `canon claude` drives, leaves a project without a manifest alone.
 */
export function declaresInstalls(chain: readonly Manifest[]): boolean {
  if (collectDeps(chain, {}).length > 0) return true

  const scripts = applyScripts({}, chain)
  return scripts.added.length > 0 || scripts.overridden.length > 0
}

/**
 * The manifest a sync writes into a folder that has none. The name is the
 * folder's, reduced to the characters npm accepts, so it is never empty or
 * invalid.
 */
export function minimalPackage(target: string): PackageJson {
  const name = basename(target)
    .toLowerCase()
    .replace(/[^a-z0-9-._]/g, '-')
    .replace(/^[._]+/, '')
    .slice(0, 214)

  return {
    name: name === '' ? 'project' : name,
    version: '0.0.0',
    type: 'module',
  }
}

export function serializePackage(pkg: PackageJson): string {
  return `${JSON.stringify(pkg, null, 2)}\n`
}

/**
 * Splits a dependency spec into its package name, handling the scoped case
 * where the leading `@` is part of the name rather than a version separator.
 * `@scope/pkg@^1.2.3` yields `@scope/pkg`, `react@19` yields `react`.
 */
export function parseSpec(spec: string): { name: string; pin: string } {
  let name = spec

  if (spec.startsWith('@')) {
    const rest = spec.slice(1)
    if (rest.includes('@')) name = `@${rest.slice(0, rest.indexOf('@'))}`
  } else {
    name = spec.split('@')[0]
  }

  const pin = spec === name ? '' : spec.slice(name.length + 1)
  return { name, pin }
}

function firstInteger(value: string): string | undefined {
  return value.match(/[0-9]+/)?.[0]
}

/**
 * Compares a manifest pin against what package.json records. A spec counts as
 * missing when absent or on an earlier major than the pin, and ahead when it
 * sits on a later one, which a write leaves alone. A spec with no integer to
 * compare, such as `latest` or `workspace:*`, counts as present.
 */
function compareSpec(
  installed: string | undefined,
  pin: string,
): DepState['state'] {
  if (installed === undefined) return 'missing'
  if (pin === '') return 'present'

  const pinMajor = firstInteger(pin)
  const installedMajor = firstInteger(installed)
  if (pinMajor === undefined || installedMajor === undefined) return 'present'

  const delta = Number(installedMajor) - Number(pinMajor)
  if (delta === 0) return 'present'
  return delta > 0 ? 'ahead' : 'missing'
}

/**
 * Resolves dev dependencies across the chain, ancestors first, deduplicated by
 * package name so the outermost stack that names a package wins.
 */
export function collectDeps(
  chain: readonly Manifest[],
  pkg: PackageJson,
): DepState[] {
  const installed = { ...pkg.dependencies, ...pkg.devDependencies }
  const seen = new Set<string>()
  const states: DepState[] = []

  for (const manifest of [...chain].reverse()) {
    for (const spec of manifest.devPackages) {
      const { name, pin } = parseSpec(spec)
      if (name === '' || seen.has(name)) continue
      seen.add(name)

      const state = compareSpec(installed[name], pin)
      states.push(
        state === 'ahead'
          ? { spec, name, state, installed: installed[name] }
          : { spec, name, state },
      )
    }
  }

  return states
}

/**
 * Compares manifest scripts and `[scripts.override]` keys against
 * package.json. The expected value of each key comes from `applyScripts`, so
 * the scan and the write path agree on which stack wins. Plain keys come
 * first, nearest stack first, then override-only keys.
 */
export function collectScripts(
  chain: readonly Manifest[],
  pkg: PackageJson,
): ScriptState[] {
  const scripts = pkg.scripts ?? {}
  const expected = applyScripts({}, chain).pkg.scripts ?? {}
  const keys = new Set<string>()

  for (const manifest of chain) {
    for (const key of Object.keys(manifest.scripts)) keys.add(key)
  }
  for (const manifest of chain) {
    for (const key of Object.keys(manifest.scriptOverrides)) keys.add(key)
  }

  return [...keys].map((key): ScriptState => {
    const current = scripts[key]
    if (current === undefined) return { key, state: 'missing' }
    return { key, state: current === expected[key] ? 'matching' : 'drifted' }
  })
}

/**
 * Fills scripts the target does not define, nearest stack first, then replays
 * `[scripts.override]` from the furthest ancestor inward so the nearest stack
 * has the last word. This is the ordering `apply_stack_scripts` produced
 * through its recursion.
 */
export function applyScripts(
  pkg: PackageJson,
  chain: readonly Manifest[],
): { pkg: PackageJson; added: string[]; overridden: string[] } {
  const scripts: Record<string, string> = { ...pkg.scripts }
  const added: string[] = []
  const overridden: string[] = []

  for (const manifest of chain) {
    for (const [key, value] of Object.entries(manifest.scripts)) {
      if (scripts[key] === undefined) {
        scripts[key] = value
        added.push(key)
      }
    }
  }

  for (const manifest of [...chain].reverse()) {
    for (const [key, value] of Object.entries(manifest.scriptOverrides)) {
      if (scripts[key] === value) continue
      scripts[key] = value
      if (!overridden.includes(key)) overridden.push(key)
    }
  }

  return { pkg: { ...pkg, scripts }, added, overridden }
}
