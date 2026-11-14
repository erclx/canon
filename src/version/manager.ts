export type ManagerId = 'bun' | 'pnpm' | 'yarn' | 'npm'

export interface Manager {
  readonly id: ManagerId
  /** The path segment the detection matched, so a wrong read is correctable. */
  readonly evidence: string
}

/**
 * Segments that only appear in one manager's global install tree, checked
 * before the `node_modules` fallback because every one of these trees contains
 * a `node_modules` too.
 */
const SIGNATURES: readonly (readonly [ManagerId, string])[] = [
  ['bun', '.bun'],
  ['pnpm', 'pnpm'],
  ['pnpm', '.pnpm'],
  ['yarn', 'yarn'],
  ['yarn', '.yarn'],
]

/**
 * Which package manager installed the package rooted at `root`, read off the
 * install path rather than guessed from what is on `PATH`.
 *
 * The evidence travels with the answer and the verb prints it before running
 * anything, so an operator can correct a wrong read. Returns `undefined` for a
 * path outside any install tree, which is a source checkout, since
 * reinstalling over a clone would replace what the operator works in.
 */
export function detectManager(root: string): Manager | undefined {
  const segments = root.split(/[/\\]/).filter((segment) => segment !== '')

  for (const [id, signature] of SIGNATURES) {
    if (segments.includes(signature)) return { id, evidence: signature }
  }

  if (segments.includes('node_modules')) {
    return { id: 'npm', evidence: 'node_modules' }
  }

  return undefined
}

/** The global reinstall each manager spells, pinned to the newest published. */
export function installCommand(
  manager: ManagerId,
  name: string,
): readonly string[] {
  const spec = `${name}@latest`

  switch (manager) {
    case 'bun':
      return ['bun', 'add', '--global', spec]
    case 'pnpm':
      return ['pnpm', 'add', '--global', spec]
    case 'yarn':
      return ['yarn', 'global', 'add', spec]
    case 'npm':
      return ['npm', 'install', '--global', spec]
  }
}
