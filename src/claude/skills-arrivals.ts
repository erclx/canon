import { $ } from 'bun'
import { CORPORA } from '@/claude/skills-audit'
import { gitEnv } from '@/git-env'
import { resolveBaseRef } from '@/git-files'

export type ArrivalsRefusal = 'no-base' | 'unreadable'

export interface SkillArrival {
  readonly name: string
  readonly path: string
}

export type SkillArrivals =
  | {
      readonly kind: 'measured'
      readonly base: string
      readonly arrivals: readonly SkillArrival[]
    }
  | {
      readonly kind: 'refused'
      readonly reason: ArrivalsRefusal
      readonly message: string
    }

const BODY = /^(?:\.claude|claude)\/skills\/([^/]+)\/SKILL\.md$/

/**
 * Skill bodies present in the working tree and absent at the merge base, across
 * both corpora.
 *
 * Rename detection is off so a folder moved or split into the corpus counts as
 * an arrival, since the creation-time questions apply to it the same way. An
 * unreadable base refuses rather than reporting none, because an empty list
 * reads as a branch that added nothing.
 */
export async function readArrivals(
  root: string,
  ref?: string,
): Promise<SkillArrivals> {
  const base = await resolveBaseRef(root, ref)
  if (base === undefined) {
    return {
      kind: 'refused',
      reason: 'no-base',
      message: 'No diff baseline against main. Fetch origin, then re-run.',
    }
  }

  const [added, untracked] = await Promise.all([
    $`git -C ${root} diff --no-renames --name-only --diff-filter=A ${base} -- ${CORPORA}`
      .env(gitEnv())
      .quiet()
      .nothrow(),
    $`git -C ${root} ls-files --others --exclude-standard -- ${CORPORA}`
      .env(gitEnv())
      .quiet()
      .nothrow(),
  ])

  if (added.exitCode !== 0 || untracked.exitCode !== 0) {
    return {
      kind: 'refused',
      reason: 'unreadable',
      message: `git could not read the diff against ${base.slice(0, 8)}.`,
    }
  }

  const paths = new Set(
    [...added.text().split('\n'), ...untracked.text().split('\n')].filter(
      Boolean,
    ),
  )
  const arrivals: SkillArrival[] = []
  for (const path of [...paths].sort()) {
    const match = BODY.exec(path)
    if (match) arrivals.push({ name: match[1], path })
  }

  return { kind: 'measured', base, arrivals }
}
