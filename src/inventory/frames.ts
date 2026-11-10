import { existsSync, statSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Turns the files `--frames` names into targets the walk opens, each with a
 * label the listing prints in place of a route.
 *
 * A label is the path relative to the directory every input shares, rather
 * than the basename, because a round's arms repeat names across pages. Two
 * frames both called `arm-1.html` would otherwise fold into one location and
 * the count of frames carrying a value would read low.
 */

export interface FrameTarget {
  readonly label: string
  readonly url: string
}

export type FrameResolution =
  | { readonly kind: 'resolved'; readonly frames: readonly FrameTarget[] }
  | { readonly kind: 'missing'; readonly paths: readonly string[] }

export function resolveFrames(
  paths: readonly string[],
  cwd: string,
): FrameResolution {
  const absolute = paths.map((path) => resolve(cwd, path))
  const missing = paths.filter((_path, index) => !isFile(absolute[index] ?? ''))
  if (missing.length > 0) return { kind: 'missing', paths: missing }

  const base = commonDirectory(absolute.map((path) => dirname(path)))
  return {
    kind: 'resolved',
    frames: absolute.map((path) => ({
      label: relative(base, path).split(sep).join('/'),
      url: pathToFileURL(path).href,
    })),
  }
}

function isFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile()
}

function commonDirectory(directories: readonly string[]): string {
  const [first = [], ...rest] = directories.map((directory) =>
    directory.split(sep),
  )
  let depth = first.length
  for (const parts of rest) {
    let shared = 0
    while (shared < depth && parts[shared] === first[shared]) shared += 1
    depth = shared
  }
  return first.slice(0, depth).join(sep) || sep
}
