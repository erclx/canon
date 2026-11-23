import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { checkCallers, readCallersRoot } from '@/records/callers'

let root: string

function write(rel: string, text: string): void {
  const path = join(root, rel)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text)
}

function files(...paths: string[]): string[] {
  return paths.map((path) => `- \`${path}\`: changes it`)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'plan-callers-'))
  write(
    'src/commands/pr/drive-copy.ts',
    "pr.command('drive-copy').description('x')\n",
  )
  write(
    'claude/skills/review-ui/SKILL.md',
    '```bash\ncanon pr drive-copy --stop\n```\n',
  )
  write(
    'claude/skills/pr-evidence/references/copy.md',
    'Run `canon pr drive-copy` first.\n',
  )
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('readCallersRoot', () => {
  it('reads nothing in a project shipping no skills', () => {
    const bare = mkdtempSync(join(tmpdir(), 'plan-callers-bare-'))

    expect(readCallersRoot(bare)).toBeUndefined()
    rmSync(bare, { recursive: true, force: true })
  })
})

describe('checkCallers', () => {
  it('reports each calling skill a plan touching a command leaves unstated', () => {
    const context = readCallersRoot(root)!

    const found = checkCallers(
      files('src/commands/pr/drive-copy.ts'),
      undefined,
      context,
    )

    expect(found.map((one) => [one.kind, one.subject])).toEqual([
      ['callers-unstated', 'claude/skills/pr-evidence'],
      ['callers-unstated', 'claude/skills/review-ui'],
    ])
  })

  it('counts a skill bullet as covering its skill and only its skill', () => {
    const context = readCallersRoot(root)!
    const section = [
      '- `claude/skills/review-ui/SKILL.md`: here, close-out calls --stop',
    ]

    const found = checkCallers(
      files('src/commands/pr/drive-copy.ts'),
      section,
      context,
    )

    expect(found.map((one) => one.subject)).toEqual([
      'claude/skills/pr-evidence',
    ])
  })

  it('counts one verb bullet as covering every caller of the verb', () => {
    const context = readCallersRoot(root)!
    const section = ['- `canon pr drive-copy`: none, the flag is additive']

    expect(
      checkCallers(files('src/commands/pr/drive-copy.ts'), section, context),
    ).toEqual([])
  })

  it('counts a family bullet as covering each verb under it', () => {
    const context = readCallersRoot(root)!
    const section = ['- `canon pr`: none, no pr caller changes']

    expect(
      checkCallers(files('src/commands/pr/drive-copy.ts'), section, context),
    ).toEqual([])
  })

  it('reports a bullet with no verdict reading here or none with a reason', () => {
    const context = readCallersRoot(root)!
    const section = [
      '- `claude/skills/review-ui`: later',
      '- `claude/skills/pr-evidence`: none',
    ]

    const found = checkCallers(
      files('src/commands/pr/drive-copy.ts'),
      section,
      context,
    )

    expect(found.map((one) => one.kind)).toEqual([
      'callers-malformed',
      'callers-malformed',
    ])
  })

  it('ignores a test file and a path outside src/commands', () => {
    const context = readCallersRoot(root)!

    expect(
      checkCallers(
        files('src/commands/pr/drive-copy.test.ts', 'src/records/validate.ts'),
        undefined,
        context,
      ),
    ).toEqual([])
  })

  it('reads a command file with no caller as clean', () => {
    write('src/commands/pr/quiet.ts', "pr.command('quiet')\n")
    const context = readCallersRoot(root)!

    expect(
      checkCallers(files('src/commands/pr/quiet.ts'), undefined, context),
    ).toEqual([])
  })
})
