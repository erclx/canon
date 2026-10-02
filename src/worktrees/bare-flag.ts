import { basename } from 'node:path'
import { execa } from 'execa'
import { gitEnv } from '@/git-env'

/** Why a run wrote nothing. The three are different states a caller can tell apart. */
export type BareFlagSkip =
  | 'flag-unset'
  | 'common-dir-unreadable'
  | 'genuinely-bare'

/** What the repair did, or the reason it left the configuration alone. */
export type BareFlagRecord =
  | { readonly repaired: true; readonly reason: null; readonly message: string }
  | {
      readonly repaired: false
      readonly reason: BareFlagSkip
      readonly message: null
    }

export const REPAIRED_MESSAGE =
  "Repaired core.bare, which worktree entry left set. Recovery is 'git config core.bare false'."

const skipped = (reason: BareFlagSkip): BareFlagRecord => ({
  repaired: false,
  reason,
  message: null,
})

/**
 * Repairs `core.bare`, which Claude Code's worktree entry leaves set in the
 * shared config and nothing restores.
 *
 * The flag strands the main worktree and breaks the git reads that scope a
 * verification run, so the gate runs this ahead of every stage. Every git call
 * drops the repository-resolution variables a git hook exports, so the root
 * the caller names is the repository that gets read and written.
 *
 * A genuinely bare repository keeps its objects at the root and has no `.git`
 * directory, so its common dir fails the basename test and keeps its flag. That
 * test is the one case where an unguarded repair does damage.
 */
export async function repairBareFlag(root: string): Promise<BareFlagRecord> {
  const git = (...args: string[]) =>
    execa('git', ['-C', root, ...args], {
      env: gitEnv(),
      extendEnv: false,
      reject: false,
    })

  const flag = await git('config', '--get', 'core.bare')
  if (flag.exitCode !== 0 || flag.stdout.trim() !== 'true') {
    return skipped('flag-unset')
  }

  const common = await git(
    'rev-parse',
    '--path-format=absolute',
    '--git-common-dir',
  )
  if (common.exitCode !== 0) return skipped('common-dir-unreadable')
  if (basename(common.stdout.trim()) !== '.git')
    return skipped('genuinely-bare')

  const write = await git('config', 'core.bare', 'false')
  if (write.exitCode !== 0) return skipped('common-dir-unreadable')

  return { repaired: true, reason: null, message: REPAIRED_MESSAGE }
}
