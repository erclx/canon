import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PROJECT_ROOT } from '@/roots/project'

/** What a reader prints in place of a field the manifest did not carry. */
export const UNKNOWN_LABEL = 'unknown'

/**
 * Either field is absent when the manifest could not be read or did not carry it. They are
 * optional rather than sentinel strings so a caller has to narrow before using one.
 */
export interface InstalledPackage {
  readonly name?: string
  readonly version?: string
}

/**
 * Read at runtime rather than inlined, since a literal is a second place the version lives.
 * `package.json` ships in every npm tarball, so the read resolves from an install or a clone.
 * Apart from the skew read so `src/cli.ts` keeps the registry lookup out of its startup graph.
 */
export function readInstalled(root: string = PROJECT_ROOT): InstalledPackage {
  try {
    const raw = readFileSync(join(root, 'package.json'), 'utf8')
    const parsed = JSON.parse(raw) as { name?: string; version?: string }

    return { name: parsed.name, version: parsed.version }
  } catch {
    return {}
  }
}
