import { existsSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { execa } from 'execa'

/**
 * Resolved in order, so a project carrying both formats with the repo's own.
 * Prettier prints to stdout unless told to write, where oxfmt rewrites in place.
 */
const FORMATTERS = [
  { name: 'oxfmt', flags: [] },
  { name: 'prettier', flags: ['--write'] },
] as const

/** What a formatter reads. A shell script or a binary seed is left to its own tool. */
const FORMATTABLE = new Set(['.json', '.jsonc', '.md', '.yml', '.yaml'])

/**
 * Runs the project's installed formatter over the files a sync wrote, so a
 * write the formatter would reshape does not leave a whitespace diff on a file
 * nobody edited. Only the named paths are passed, never the project, which
 * keeps a dirty tree unformatted. A path is absolute or relative to `target`.
 *
 * Best effort: no installed formatter, or one that fails, leaves the output as
 * written and the sync unaffected. Never pass a file the sync hashes against
 * its source, since the bytes on disk would stop matching the record.
 */
export async function formatWritten(
  target: string,
  paths: readonly string[],
): Promise<void> {
  const files = paths
    .filter((path) => FORMATTABLE.has(extname(path)))
    .map((path) => resolve(target, path))
  if (files.length === 0) return

  const formatter = FORMATTERS.map((candidate) => ({
    ...candidate,
    path: join(target, 'node_modules', '.bin', candidate.name),
  })).find((candidate) => existsSync(candidate.path))
  if (formatter === undefined) return

  await execa(formatter.path, [...formatter.flags, ...files], {
    cwd: target,
    reject: false,
  })
}
