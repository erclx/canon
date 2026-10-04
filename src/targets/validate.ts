import { statSync } from 'node:fs'
import { resolve } from 'node:path'
import { checkoutMismatchWarning } from '@/project-root'
import { logError, logWarn, outro } from '@/ui'

export function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

/**
 * Stands in for `validate_target` plus `guard_root`. The bash `guard_root` read
 * as a toolkit-root check, but its body was `cd "$target" && pwd`, so it also
 * rejected a target that does not exist. Porting the name alone would let a
 * typo'd path scaffold a whole new tree, since every apply step creates parents.
 *
 * Returns the resolved path, or the exit code the caller should hand back. The
 * frame is already open by the time this runs, so a rejection closes it.
 */
export function resolveTarget(
  target: string,
  protectedRoot: string,
): string | number {
  const mismatch = checkoutMismatchWarning(process.cwd())
  if (mismatch !== undefined) logWarn(mismatch)

  const resolved = resolve(target)

  if (!isDirectory(resolved)) {
    logError(`Target directory not found: ${target}`)
    outro()
    return 1
  }

  if (resolved === protectedRoot) {
    logError(
      'Cannot run against toolkit root. Files here are the source of truth.',
    )
    outro()
    return 1
  }

  return resolved
}
