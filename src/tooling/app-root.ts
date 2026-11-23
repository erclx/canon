import { readFileSync } from 'node:fs'
import { hashContent, readStamp, type Stamp } from '@/sync/stamp'

/** The app folder of every target whose tooling record names none, which is every target scaffolded before the option. */
export const DEFAULT_APP_ROOT = 'src'

/** Golden text standing for the app folder, rendered from the target's record before any write or comparison. */
export const APP_ROOT_TOKEN = '{{appRoot}}'

const SEGMENT = /^[a-z0-9][a-z0-9_-]*$/

/**
 * The app folder a value names, as posix segments under the project with any trailing slash dropped, or
 * undefined for one that is empty, absolute, climbs out, or carries a segment no package tool accepts.
 */
export function parseAppRoot(value: string): string | undefined {
  const trimmed = value.replace(/\/+$/, '')
  if (trimmed === '') return undefined
  const segments = trimmed.split('/')
  return segments.every((segment) => SEGMENT.test(segment))
    ? segments.join('/')
    : undefined
}

/** A record naming no root, or one that no longer parses, reads as the default. */
export function stampedAppRoot(stamp: Stamp | undefined): string {
  const recorded = stamp?.domains.tooling?.appRoot
  return (
    (recorded === undefined ? undefined : parseAppRoot(recorded)) ??
    DEFAULT_APP_ROOT
  )
}

export function readAppRoot(target: string): string {
  return stampedAppRoot(readStamp(target))
}

/** Where a golden path lands: one under the golden tree's `src/` lands under the app root instead. */
export function appRootPath(rel: string, appRoot: string): string {
  if (appRoot === DEFAULT_APP_ROOT) return rel
  if (rel === DEFAULT_APP_ROOT) return appRoot
  const prefix = `${DEFAULT_APP_ROOT}/`
  return rel.startsWith(prefix) ? `${appRoot}/${rel.slice(prefix.length)}` : rel
}

/** A file carrying no token comes back byte for byte, so a binary golden file is never decoded. */
export function renderGolden(source: string, appRoot: string): Buffer {
  const bytes = readFileSync(source)
  if (!bytes.includes(APP_ROOT_TOKEN)) return bytes
  return Buffer.from(bytes.toString('utf8').replaceAll(APP_ROOT_TOKEN, appRoot))
}

export function hashGolden(source: string, appRoot: string): string {
  return hashContent(renderGolden(source, appRoot))
}
