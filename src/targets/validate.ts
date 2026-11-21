import { statSync } from 'node:fs'
import { resolve } from 'node:path'
import { checkoutMismatchWarning } from '@/roots/project'
import { logError, logWarn, outro } from '@/cli/ui'

export function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

/**
 * Stands in for `validate_target` plus `guard_root`. The bash `guard_root` also rejected a target that does
 * not exist, so a typo'd path would otherwise scaffold a whole new tree. Returns the resolved path, or the
 * exit code the caller should hand back.
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
