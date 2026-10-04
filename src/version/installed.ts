import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PROJECT_ROOT } from '@/roots/project'

/** What a reader prints in place of a field the manifest did not carry. */
export const UNKNOWN_LABEL = 'unknown'

/**
 * Either field is absent when the manifest could not be read or did not carry
 * it. They are optional rather than sentinel strings so a caller has to narrow
 * before using one, which is what makes a name the manifest never supplied
 * impossible to interpolate into a shell command. A sentinel typed `string`
 * reads as an ordinary value at every call site and hides that case.
 */
export interface InstalledPackage {
  readonly name?: string
  readonly version?: string
}

/**
 * Read at runtime rather than inlined, because a literal is a second place the
 * version lives and it stopped tracking `package.json` at `0.1.0`. The release
 * tool writes one file and this follows it. `package.json` ships in every npm
 * tarball regardless of the `files` list, so the read resolves from a registry
 * install as well as from a clone.
 *
 * This sits apart from the skew read so `src/cli.ts` can name the version on
 * every invocation without pulling the registry lookup into the startup import
 * graph of a CLI that compiles nothing ahead of time.
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
