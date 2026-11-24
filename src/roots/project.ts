import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The root of the package this CLI is running out of: the repository root in a checkout, the
 * installed package directory in a target. Derived from `import.meta.url`, since the test
 * runner leaves Bun's `import.meta.dir` undefined, and in a module apart from `execScript`.
 */
export const PROJECT_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../..',
)

const readPackageName = (root: string): string | undefined => {
  try {
    const raw = readFileSync(resolve(root, 'package.json'), 'utf8')
    return (JSON.parse(raw) as { name?: string }).name
  } catch {
    return undefined
  }
}

/**
 * Whether `root` is a checkout of this same package, judged by package name rather than path
 * equality with `PROJECT_ROOT`, since a linked worktree tracks the identical `package.json`.
 * Path equality is wrong for a CLI running out of one worktree against another.
 */
export function isOwnCheckout(root: string): boolean {
  const ownName = readPackageName(PROJECT_ROOT)
  return ownName !== undefined && readPackageName(root) === ownName
}

/**
 * Whether `startDir` sits in a checkout of this package, judged by the nearest ancestor
 * `package.json` carrying a name, so a subdirectory reads as the project it belongs to.
 */
export function isWithinOwnCheckout(startDir: string): boolean {
  const ownName = readPackageName(PROJECT_ROOT)
  if (ownName === undefined) return false

  let dir = resolve(startDir)
  while (true) {
    const name = readPackageName(dir)
    if (name !== undefined) return name === ownName

    const parent = dirname(dir)
    if (parent === dir) return false
    dir = parent
  }
}

/**
 * Walks upward from `startDir` for the nearest ancestor `package.json` sharing this package's
 * `name`, and reports its path when that ancestor is not `PROJECT_ROOT`, as when a bare `canon`
 * on PATH resolves to the installed package while the caller stands in a checkout.
 */
export function findCheckoutMismatch(startDir: string): string | undefined {
  const ownName = readPackageName(PROJECT_ROOT)
  if (ownName === undefined) return undefined

  let dir = resolve(startDir)
  while (true) {
    if (readPackageName(dir) === ownName) {
      return dir === PROJECT_ROOT ? undefined : dir
    }

    const parent = dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

/**
 * The warning line every verb that answers from `PROJECT_ROOT` emits when the caller's cwd sits
 * inside a second checkout, or `undefined`. It returns the string so this module keeps no
 * `@/cli/ui` dependency, and names both roots and no subcommand.
 */
export function checkoutMismatchWarning(cwd: string): string | undefined {
  const mismatch = findCheckoutMismatch(cwd)
  if (mismatch === undefined) return undefined

  return `Resolved via ${PROJECT_ROOT}, not the checkout at ${mismatch}. Run \`bun ${mismatch}/src/cli.ts ...\` to answer from that checkout instead.`
}
