import { execa } from 'execa'
import { gitEnv } from '@/git/env'

const GIT_TIMEOUT_MS = 10_000

/** Preferred first. A clone with no remote still answers off its local trunk. */
const TRUNK_REFS = ['origin/main', 'main'] as const

/**
 * Reports whether a pull request's work reached the trunk. `undefined` means
 * the trunk could not be read, which stays apart from `false`, since degrading
 * to "not landed" would silently report a board without saying what it skipped.
 */
export type TrunkReader = (pullRequest: number) => Promise<boolean | undefined>

/**
 * Matches the two subjects a landed pull request leaves on the trunk: the
 * `(#NNN)` suffix a squash merge writes, and GitHub's merge-commit subject. Both
 * carry the number in a form no other commit spells, so 12 cannot match 123.
 */
function grepArgs(pullRequest: number): string[] {
  return [
    '--extended-regexp',
    '--grep',
    `\\(#${pullRequest}\\)`,
    '--grep',
    `Merge pull request #${pullRequest} from`,
  ]
}

/**
 * Reads the trunk as this clone already holds it and never fetches, since a
 * validate run happens several times a sweep. A clone behind the remote reports
 * the row untested or parked rather than claiming work landed.
 */
export function gitTrunkReader(root: string): TrunkReader {
  const answered = new Map<number, boolean | undefined>()

  return async (pullRequest) => {
    if (answered.has(pullRequest)) return answered.get(pullRequest)

    const landed = await readTrunk(root, pullRequest)
    answered.set(pullRequest, landed)
    return landed
  }
}

async function readTrunk(
  root: string,
  pullRequest: number,
): Promise<boolean | undefined> {
  for (const ref of TRUNK_REFS) {
    const result = await execa(
      'git',
      [
        '-C',
        root,
        'log',
        ref,
        '-n',
        '1',
        '--format=%H',
        ...grepArgs(pullRequest),
        // The ref is a revision, and a same-named tracked path would make the read ambiguous.
        '--',
      ],
      // A hook exports repository variables git reads ahead of `-C`, so the ambient environment would mislead.
      {
        reject: false,
        timeout: GIT_TIMEOUT_MS,
        env: gitEnv(),
        extendEnv: false,
      },
    )

    // A missing ref exits non-zero and moves on, while zero with no commit is an answer.
    if (result.exitCode === 0) return result.stdout.trim().length > 0
  }

  return undefined
}
