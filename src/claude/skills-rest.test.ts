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

/**
 * Paths under `claude/skills/`, each a whole skill folder or one file. The
 * leg borrows `git-pr`'s evidence reference to mint a preview, so that file
 * sits on it while the rest of `git-pr` does not.
 */
const TIERS: readonly {
  readonly paths: readonly string[]
  readonly pattern: RegExp
}[] = [
  {
    paths: ['review-address', 'git-followup', 'git-pr/references/evidence.md'],
    pattern: ANY_GRAPHQL,
  },
  { paths: ['review-ui', 'git-split'], pattern: GRAPHQL_READS },
]

function filesUnder(dir: string): string[] {
  if (!statSync(dir).isDirectory()) return [dir]
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return filesUnder(path)
    return name.endsWith('.md') ? [path] : []
  })
}

function hitsIn(target: string, pattern: RegExp): string[] {
  return filesUnder(join(ROOT, 'claude', 'skills', target)).flatMap((path) =>
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
    TIERS.flatMap(({ paths, pattern }) =>
      paths.map((target) => ({ target, pattern })),
    ),
  )(
    'should call no GraphQL-backed gh subcommand in $target',
    ({ target, pattern }) => {
      expect(hitsIn(target, pattern)).toEqual([])
    },
  )
})
