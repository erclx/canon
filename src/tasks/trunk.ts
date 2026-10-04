import { execa } from 'execa'
import { gitEnv } from '@/git/env'

const GIT_TIMEOUT_MS = 10_000

/** Preferred first. A clone with no remote still answers off its local trunk. */
const TRUNK_REFS = ['origin/main', 'main'] as const

/**
 * Reports whether a pull request's work reached the trunk. `undefined` means
 * the trunk could not be read, which is a different answer from `false` and has
 * to stay one: a check that degraded to "not landed" on an unreachable trunk
 * would report a board silently rather than say what it failed to test.
 */
export type TrunkReader = (pullRequest: number) => Promise<boolean | undefined>

/**
 * Matches the two subjects a landed pull request leaves on the trunk: the
 * `(#NNN)` suffix a squash merge writes, and the subject GitHub writes for a
 * merge commit. Both carry the number in a form no other commit spells, so a
 * pull request numbered 12 cannot match one numbered 123.
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
 * Reads the trunk as this clone already holds it and never fetches. A validate
 * run happens several times a sweep and a fetch per run is a cost the check
 * does not carry today, so a clone behind the remote reports the row untested
 * or leaves it parked rather than claiming work landed.
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
        // The ref is a revision, and a repository tracking a path under the
        // same name would otherwise fail the whole read as ambiguous.
        '--',
      ],
      // `post-merge` drives the task verbs, and a hook exports the repository
      // variables git reads ahead of `-C`, so the ambient environment would
      // answer for whatever repository fired the hook.
      {
        reject: false,
        timeout: GIT_TIMEOUT_MS,
        env: gitEnv(),
        extendEnv: false,
      },
    )

    // A missing ref exits non-zero, which is the next ref's turn rather than an
    // answer. An exit of zero with no commit is the ref saying the work is not
    // on it, which is an answer and stops the walk.
    if (result.exitCode === 0) return result.stdout.trim().length > 0
  }

  return undefined
}
