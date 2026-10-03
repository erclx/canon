import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/** The repository root, resolved the way `src/ui.test.ts` resolves it. */
const ROOT = join(import.meta.dirname, '..', '..')

/**
 * Every `gh pr` subcommand and `gh repo view` run on GraphQL, which a cloud
 * session's GitHub proxy refuses. The review-address leg reads and writes, so
 * any of them there breaks a cloud worker answering a review.
 */
const ANY_GRAPHQL = /\bgh (pr [a-z]+|repo view)\b/

/**
 * The bodies off the leg have moved their reads alone. Their writes, being
 * `gh pr review`, `gh pr create`, and `gh pr edit`, are a later slice.
 */
const GRAPHQL_READS = /\bgh (pr (view|list)|repo view)\b/

const TIERS: readonly {
  readonly skills: readonly string[]
  readonly pattern: RegExp
}[] = [
  { skills: [], pattern: ANY_GRAPHQL },
  { skills: ['git-split'], pattern: GRAPHQL_READS },
]

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return filesUnder(path)
    return name.endsWith('.md') ? [path] : []
  })
}

function hitsIn(skill: string, pattern: RegExp): string[] {
  return filesUnder(join(ROOT, 'claude', 'skills', skill)).flatMap((path) =>
    readFileSync(path, 'utf8')
      .split('\n')
      .flatMap((line, index) =>
        pattern.test(line)
          ? [`${relative(ROOT, path)}:${index + 1}: ${line.trim()}`]
          : [],
      ),
  )
}

describe('the cloud review-address leg', () => {
  it.each(
    TIERS.flatMap(({ skills, pattern }) =>
      skills.map((skill) => ({ skill, pattern })),
    ),
  )(
    'should call no GraphQL-backed gh subcommand in $skill',
    ({ skill, pattern }) => {
      expect(hitsIn(skill, pattern)).toEqual([])
    },
  )
})
