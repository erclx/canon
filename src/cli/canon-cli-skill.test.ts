import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COMMAND_GROUPS } from '@/cli/help'

const SKILL_PATH = join(
  import.meta.dirname,
  '../../claude/skills/canon-cli/SKILL.md',
)

// Verbs a target session has no job for, because their docs tie them to this
// repository's own tree or to a hook it never calls by hand. `hooks` is the
// edge: the base stack ships its post-merge call, which a target runs without
// routing to it. Each name is confirmed against its docs/agents page, and the
// second test fails when one stops being a verb.
export const TOOLKIT_ONLY = new Set([
  'sandbox',
  'gate',
  'upstream',
  'hooks',
  'audits',
])

function registeredVerbs(): string[] {
  return COMMAND_GROUPS.flatMap((group) =>
    group.rows.map(([signature]) => signature.split(' ')[0]),
  )
}

// Only a backticked `canon <verb>` on a table row counts. A verb named in
// prose, in the frontmatter, or in the destructive list is not a route, so
// deleting its row fails the test.
function carriedVerbs(body: string): Set<string> {
  const rows = body.split('\n').filter((line) => line.startsWith('|'))
  const verbs = rows.flatMap((row) =>
    [...row.matchAll(/`canon ([a-z][a-z-]*)[^`]*`/g)].map((match) => match[1]),
  )
  return new Set(verbs)
}

describe('canon-cli skill coverage', () => {
  const body = readFileSync(SKILL_PATH, 'utf8')

  it('should carry a line for every target-usable top-level verb', () => {
    const carried = carriedVerbs(body)

    const missing = registeredVerbs()
      .filter((verb) => !TOOLKIT_ONLY.has(verb))
      .filter((verb) => !carried.has(verb))

    expect(missing).toEqual([])
  })

  it('should list no exemption that is no longer a verb', () => {
    const verbs = new Set(registeredVerbs())

    const stale = [...TOOLKIT_ONLY].filter((name) => !verbs.has(name))

    expect(stale).toEqual([])
  })
})
