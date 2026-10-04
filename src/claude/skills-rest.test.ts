import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/** The repository root, resolved the way `src/ui.test.ts` resolves it. */
const ROOT = join(import.meta.dirname, '..', '..')

/**
 * Every `gh pr` subcommand and `gh repo view` run on GraphQL, which a cloud
 * session's GitHub proxy refuses. A cloud session runs each body below, so a
 * read or a write through any of them breaks it there.
 */
const ANY_GRAPHQL = /\bgh (pr [a-z]+|repo view)\b/

/**
 * Paths under `claude/skills/`, each a whole skill folder or one file. The
 * review-address leg borrows `git-pr`'s evidence reference to mint a preview,
 * so that file sits on it while the rest of `git-pr` does not.
 */
const CLOUD_PATHS: readonly string[] = [
  'review-address',
  'git-followup',
  'git-pr/references/evidence.md',
  'review-ui',
  'git-split',
]

function filesUnder(dir: string): string[] {
  if (!statSync(dir).isDirectory()) return [dir]
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return filesUnder(path)
    return name.endsWith('.md') ? [path] : []
  })
}

function hitsIn(target: string): string[] {
  return filesUnder(join(ROOT, 'claude', 'skills', target)).flatMap((path) =>
    readFileSync(path, 'utf8')
      .split('\n')
      .flatMap((line, index) =>
        ANY_GRAPHQL.test(line)
          ? [`${relative(ROOT, path)}:${index + 1}: ${line.trim()}`]
          : [],
      ),
  )
}

describe('the skills a cloud session runs', () => {
  it.each(CLOUD_PATHS)(
    'should call no GraphQL-backed gh subcommand in %s',
    (target) => {
      expect(hitsIn(target)).toEqual([])
    },
  )
})
