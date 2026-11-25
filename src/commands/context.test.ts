import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const REPO_ROOT = join(import.meta.dirname, '..', '..')
const CLI = join(REPO_ROOT, 'src', 'cli.ts')
const SETUP_TIMEOUT_MS = 30_000
const RUN_TIMEOUT_MS = 30_000

async function audit(cwd: string, args: string[]) {
  return execa(process.execPath, [CLI, 'context', 'audit', ...args], {
    cwd,
    reject: false,
    timeout: RUN_TIMEOUT_MS,
  })
}

describe('canon context audit shape label', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'canon-context-audit-'))
    await execa('git', ['init', '-q'], { cwd: root })
    await mkdir(join(root, 'canon', 'context'), { recursive: true })
    await writeFile(
      join(root, 'canon', 'context', 'context-model.md'),
      '---\ntitle: X\ndescription: A domain\n---\n\n# X\n\n## Overview\n\nOwns x.\n\n## Layout\n\n- `a/`: one\n\n## Gotchas\n\n### A heading here\n\n- One trap\n',
    )
    await writeFile(
      join(root, 'canon', 'context', 'index.md'),
      '# Context\n\n- [X](context-model.md): A domain\n',
    )
    await execa('git', ['add', '-A'], { cwd: root })
  }, SETUP_TIMEOUT_MS)

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('says a shape break would gate when the run cannot', async () => {
    const result = await audit(root, [])
    const output = `${result.stdout}\n${result.stderr}`

    expect(output).toContain('would gate under --gate')
    expect(output).not.toMatch(/ {2}gated$/m)
  })

  it('says gated when the run widens', async () => {
    const result = await audit(root, ['--gate'])
    const output = `${result.stdout}\n${result.stderr}`

    expect(output).not.toContain('would gate under --gate')
    expect(output).toMatch(/ {2}gated$/m)
  })
})

describe('canon context audit room advice', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'canon-context-room-'))
    await execa('git', ['init', '-q'], { cwd: root })
    await mkdir(join(root, 'canon', 'context'), { recursive: true })
    const bullets = ['a', 'b', 'c', 'd', 'e', 'f'].map((n) => `- ${n}`)
    await writeFile(
      join(root, 'canon', 'context', 'context-model.md'),
      [
        '---\ntitle: X\ndescription: A domain\n---\n\n# X\n\n## Overview\n\nOwns x.\n\n## Layout\n\n### `a/`\n\nLead.\n\nSecond.\n',
        ...bullets,
        '\n## Gotchas\n',
        ...bullets,
        '',
      ].join('\n'),
    )
    await writeFile(
      join(root, 'canon', 'context', 'index.md'),
      '# Context\n\n- [X](context-model.md): A domain\n',
    )
    await execa('git', ['add', '-A'], { cwd: root })
  }, SETUP_TIMEOUT_MS)

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('prints one advice line for a block carrying two findings', async () => {
    const result = await audit(root, [])
    const output = `${result.stdout}\n${result.stderr}`

    expect(output).toContain('2 paragraphs under `a/`, past 1')
    expect(
      output.match(/`a\/` holds 6 of 5 bullets and a lead of/g),
    ).toHaveLength(1)
    expect(output).toContain('Gotchas holds 6 of 5. Remove a trap')
  })
})
