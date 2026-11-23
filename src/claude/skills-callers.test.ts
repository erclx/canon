import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  callersOf,
  readCallerIndex,
  verbsOfCommandFile,
} from '@/claude/skills-callers'

let root: string

function write(rel: string, text: string): void {
  const path = join(root, rel)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'skills-callers-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('verbsOfCommandFile', () => {
  it('names each verb a family file registers under its family', () => {
    write(
      'src/commands/tasks/board.ts',
      "tasks.command('place')\n  .description('x')\ntasks\n  .command(\n    'promote <row>',\n  )\n",
    )

    expect(verbsOfCommandFile(root, 'src/commands/tasks/board.ts')).toEqual([
      'tasks place',
      'tasks promote',
    ])
  })

  it('names a top-level file by its family and each verb it registers', () => {
    write(
      'src/commands/claude.ts',
      "claude.command('claude')\nclaude.command('skills')\nclaude.command('plugin-update')\n",
    )

    expect(verbsOfCommandFile(root, 'src/commands/claude.ts')).toEqual([
      'claude skills',
      'claude plugin-update',
    ])
  })

  it('names a top-level file registering no verb by its own name', () => {
    write('src/commands/census.ts', 'export const x = 1\n')

    expect(verbsOfCommandFile(root, 'src/commands/census.ts')).toEqual([
      'census',
    ])
  })

  it('falls back to the path for a file not written yet', () => {
    expect(verbsOfCommandFile(root, 'src/commands/pr/new-verb.ts')).toEqual([
      'pr new-verb',
    ])
  })
})

describe('callersOf', () => {
  it('finds a verb in a shipped skill and an internal one', () => {
    write(
      'claude/skills/target-scaffold/SKILL.md',
      'Run it.\n\n```bash\ncanon tooling scaffold base --json\n```\n',
    )
    write(
      '.claude/skills/internal-tooling/SKILL.md',
      'Use `canon tooling scaffold` here.\n',
    )

    expect(
      callersOf(readCallerIndex(root), 'tooling scaffold').map(
        (caller) => `${caller.skill}:${caller.file}:${caller.line}`,
      ),
    ).toEqual([
      'target-scaffold:claude/skills/target-scaffold/SKILL.md:4',
      'internal-tooling:.claude/skills/internal-tooling/SKILL.md:1',
    ])
  })

  it('skips a fenced sample that is not a shell block', () => {
    write(
      'claude/skills/a/SKILL.md',
      '```plaintext\ncanon pr lift 12\n```\n\n```text\ncanon pr lift 13\n```\n',
    )

    expect(callersOf(readCallerIndex(root), 'pr lift')).toEqual([])
  })

  it('reads a reference file and does not match a longer verb name', () => {
    write(
      'claude/skills/a/references/r.md',
      'canon pr lifted and canon pr lift\n',
    )
    write('claude/skills/a/SKILL.md', 'canon pr lift-all\n')

    expect(
      callersOf(readCallerIndex(root), 'pr lift').map((caller) => caller.file),
    ).toEqual(['claude/skills/a/references/r.md'])
  })

  it('matches a family verb against its subverbs', () => {
    write('claude/skills/a/SKILL.md', 'canon claude skills list\n')

    expect(callersOf(readCallerIndex(root), 'claude skills')).toHaveLength(1)
  })
})
