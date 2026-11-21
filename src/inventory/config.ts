import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Where a project declares what an inventory walks, at the project root rather
 * than under `.claude/`, since routes and element queries describe the
 * application, not the agent surface.
 */
export const CONFIG_REL = 'inventory.toml'

/** One measurable treatment and the elements that carry it, as the project spells them. */
export interface InventorySubject {
  readonly name: string
  readonly query: string
}

export interface InventoryConfig {
  readonly baseUrl: string
  readonly routes: readonly string[]
  readonly subjects: readonly InventorySubject[]
}

/**
 * Why a config could not be used, never the same as a walk that read nothing.
 * Each value is a refusal rather than an empty listing, since a listing with no
 * rows reads as a site giving one consistent answer.
 */
export type ConfigRefusal =
  | 'no-config'
  | 'unreadable-config'
  | 'no-base-url'
  | 'no-routes'
  | 'no-subjects'

export type ConfigRead =
  | { readonly kind: 'config'; readonly config: InventoryConfig }
  | { readonly kind: 'refused'; readonly reason: ConfigRefusal }

function readSubjects(table: unknown): InventorySubject[] {
  if (typeof table !== 'object' || table === null || Array.isArray(table)) {
    return []
  }

  const subjects: InventorySubject[] = []
  for (const [name, value] of Object.entries(table)) {
    if (typeof value !== 'object' || value === null) continue
    const query = (value as Record<string, unknown>).query
    if (typeof query !== 'string' || query === '') continue
    subjects.push({ name, query })
  }

  return subjects
}

/**
 * Parses config text, so a caller holding the bytes skips the filesystem. A
 * malformed route or subject is dropped rather than refused, as `@/labels/map`
 * does, so one bad entry does not blind the walk to the rest.
 */
export function parseInventoryConfig(source: string): ConfigRead {
  let parsed: Record<string, unknown>
  try {
    parsed = Bun.TOML.parse(source) as Record<string, unknown>
  } catch {
    return { kind: 'refused', reason: 'unreadable-config' }
  }

  const baseUrl = parsed['base-url']
  if (typeof baseUrl !== 'string' || baseUrl === '') {
    return { kind: 'refused', reason: 'no-base-url' }
  }

  const routes = Array.isArray(parsed.routes)
    ? parsed.routes.filter(
        (route): route is string => typeof route === 'string' && route !== '',
      )
    : []
  if (routes.length === 0) return { kind: 'refused', reason: 'no-routes' }

  const subjects = readSubjects(parsed.subjects)
  if (subjects.length === 0) return { kind: 'refused', reason: 'no-subjects' }

  return { kind: 'config', config: { baseUrl, routes, subjects } }
}

/** Reads the config a project declares at `root`, or says why it could not. */
export function readInventoryConfig(root: string): ConfigRead {
  let source: string
  try {
    source = readFileSync(join(root, CONFIG_REL), 'utf8')
  } catch {
    return { kind: 'refused', reason: 'no-config' }
  }

  return parseInventoryConfig(source)
}

/**
 * Joins a base and a route into the address a walk opens, by concatenation
 * rather than `new URL(route, base)`, whose resolver drops any path the base
 * carries, so a project under a subdirectory would walk the origin.
 */
export function routeUrl(baseUrl: string, route: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  const path = route.startsWith('/') ? route : `/${route}`
  return `${base}${path}`
}
