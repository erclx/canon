import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { execa } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GATED_CONFIG_REL } from '@/markdown/gated'

const CLI = join(import.meta.dirname, '..', 'cli.ts')
const RUN_TIMEOUT_MS = 30_000

const LONG_PARAGRAPH = `${'A sentence long enough to count here. '.repeat(12)}\n`

let target: string

beforeEach(async () => {
  target = mkdtempSync(join(tmpdir(), 'canon-markdown-'))
  await execa('git', ['init', '-q'], { cwd: target })
})

afterEach(() => {
  rmSync(target, { recursive: true, force: true })
})

function write(rel: string, text: string): void {
  mkdirSync(dirname(join(target, rel)), { recursive: true })
  writeFileSync(join(target, rel), text)
}

/**
 * Spawns the CLI rather than importing it, since the exit code is the
 * assertion and an in-process action would set it on the test runner.
 */
async function run(
  args: string[],
  cwd: string = target,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const result = await execa(process.execPath, [CLI, ...args], {
    cwd,
    reject: false,
    timeout: RUN_TIMEOUT_MS,
  })
  return {
    exitCode: result.exitCode ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

function config(): string {
  return readFileSync(join(target, GATED_CONFIG_REL), 'utf8')
}

describe('markdown audit', () => {
  it('should hold a docs page to the docs cap when audited from inside docs/', async () => {
    const lines = Array.from(
      { length: 126 },
      (_, index) => `Line ${index + 1}.`,
    ).join('\n\n')
    write('docs/guide.md', `${lines}\n`)

    const result = await run(
      ['markdown', 'audit', 'guide.md'],
      join(target, 'docs'),
    )

    expect(result.stderr).toContain('guide.md  251 rendered lines past 200')
  })

  it('should list a consumer doc past the docs cap and leave a skill reference under the ceiling', async () => {
    const lines = (count: number): string =>
      Array.from({ length: count }, (_, index) => `Line ${index + 1}.`).join(
        '\n\n',
      )
    write('docs/guide.md', `${lines(101)}\n`)
    write('claude/skills/a/references/guide.md', `${lines(126)}\n`)

    const result = await run(['markdown', 'audit', '.'])

    expect(result.stderr).toContain(
      'docs/guide.md  201 rendered lines past 200',
    )
    expect(result.stderr).not.toContain(
      'claude/skills/a/references/guide.md  251 rendered lines',
    )
  })

  it('should carry each entry its own cap in the json record', async () => {
    write('docs/guide.md', '# Guide\n\nShort.\n')
    write('pkg/docs/guide.md', '# Nested\n\nShort.\n')
    write('notes/scratch.md', '# Notes\n\nShort.\n')

    const result = await run(['markdown', 'audit', '--json'])

    expect(JSON.parse(result.stdout).entries).toMatchObject([
      { path: 'docs/guide.md', ceiling: 200 },
      { path: 'notes/scratch.md', ceiling: 300 },
      { path: 'pkg/docs/guide.md', ceiling: 300 },
    ])
  })

  it('should report a density finding in a target with no config', async () => {
    write('docs/guide.md', `# Guide\n\n${LONG_PARAGRAPH}`)

    expect((await run(['markdown', 'audit'])).exitCode).toBe(0)
  })

  it('should gate a density finding under a listed prefix', async () => {
    write('docs/guide.md', `# Guide\n\n${LONG_PARAGRAPH}`)
    write(GATED_CONFIG_REL, '[markdown]\ngated = ["docs/"]\n')

    expect((await run(['markdown', 'audit'])).exitCode).toBe(2)
  })

  it('should report a density finding under an unlisted prefix', async () => {
    write('docs/guide.md', `# Guide\n\n${LONG_PARAGRAPH}`)
    write(GATED_CONFIG_REL, '[markdown]\ngated = ["wiki/"]\n')

    expect((await run(['markdown', 'audit'])).exitCode).toBe(0)
  })

  it('should gate a cell and a trailing list as density kinds on a gated path', async () => {
    write(
      'docs/guide.md',
      `# Guide\n\nThe lead.\n\n| A | B |\n| - | - |\n| ${'a'.repeat(130)} | b |\n- item\n`,
    )
    write(GATED_CONFIG_REL, '[markdown]\ngated = ["docs/"]\n')

    const result = await run(['markdown', 'audit', '--json'])

    expect(result.exitCode).toBe(2)
    expect(JSON.parse(result.stdout).entries).toMatchObject([
      {
        path: 'docs/guide.md',
        tables: [],
        density: [
          {
            kind: 'table-cell',
            line: 7,
            value: 130,
            limit: 120,
            gating: true,
          },
          { kind: 'table-then-list', line: 8, gating: true },
        ],
      },
    ])
  })

  it('should report a cell finding under an unlisted prefix and exit 0', async () => {
    write(
      'docs/guide.md',
      `# Guide\n\nThe lead.\n\n| A | B |\n| - | - |\n| ${'a'.repeat(130)} | b |\n`,
    )
    write(GATED_CONFIG_REL, '[markdown]\ngated = ["wiki/"]\n')

    const result = await run(['markdown', 'audit', '--json'])

    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout).entries).toMatchObject([
      { density: [{ kind: 'table-cell', gating: false }] },
    ])
  })

  it('should keep a row count and a wide token report-only on a gated path', async () => {
    const rows = Array.from({ length: 9 }, (_, i) => `| a${i} | b |`).join('\n')
    write(
      'docs/guide.md',
      `# Guide\n\nThe lead.\n\n| A | B |\n| - | - |\n${rows}\n`,
    )
    write(GATED_CONFIG_REL, '[markdown]\ngated = ["docs/"]\n')

    const result = await run(['markdown', 'audit', '--json'])

    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout).entries).toMatchObject([
      { tables: [{ kind: 'table-rows', value: 9, limit: 8 }], density: [] },
    ])
  })

  it('should point a long cell on a table-shaped design index at the group files', async () => {
    write(
      'canon/design/index.md',
      `# Design references\n\nThe lead.\n\n| Group | States |\n| - | - |\n| \`home\` | ${'s'.repeat(130)} |\n`,
    )

    const result = await run(['markdown', 'audit'])

    expect(result.exitCode).toBe(0)
    expect(`${result.stdout}${result.stderr}`).toContain(
      '### An index in the older shape',
    )
  })

  it('should leave the group files hint out of a finding off the design index', async () => {
    write(
      'docs/guide.md',
      `# Guide\n\nThe lead.\n\n| A | B |\n| - | - |\n| ${'a'.repeat(130)} | b |\n`,
    )

    const result = await run(['markdown', 'audit'])

    expect(`${result.stdout}${result.stderr}`).not.toContain(
      '### An index in the older shape',
    )
  })

  it('should carry the room advice on a finding inside a Layout block', async () => {
    write(
      'canon/context/surfaces/cli.md',
      `# CLI\n\n## Layout\n\n### \`src/a/\`\n\nThe lead.\n\n- ${'a long bullet '.repeat(20)}\n`,
    )

    const result = await run(['markdown', 'audit'])
    const output = `${result.stdout}${result.stderr}`

    expect(output).toContain('`src/a/` holds 1 of 5 bullets and a lead of 9')
    expect(output).not.toContain('give a long list H3s')
  })

  it('should leave the room advice off a finding in a skill file', async () => {
    write(
      'claude/skills/x/SKILL.md',
      `# X\n\nThe lead.\n\n- ${'a long bullet '.repeat(20)}\n`,
    )

    const result = await run(['markdown', 'audit'])
    const output = `${result.stdout}${result.stderr}`

    expect(output).toContain('give a long list H3s')
    expect(output).not.toContain('holds 1 of 5')
  })

  it('should measure no table outside the density scope', async () => {
    write(
      'notes/scratch.md',
      `# Notes\n\n| A |\n| - |\n| ${'a'.repeat(130)} |\n`,
    )

    const result = await run(['markdown', 'audit', '--json'])

    expect(JSON.parse(result.stdout).entries).toMatchObject([
      { path: 'notes/scratch.md', tables: [] },
    ])
  })

  it('should refuse a malformed config with its path named', async () => {
    write('docs/guide.md', '# Guide\n\nShort.\n')
    write(GATED_CONFIG_REL, '[markdown\n')

    const result = await run(['markdown', 'audit', '--json'])

    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({
      reason: 'malformed-config',
    })
    expect(result.stdout).toContain(GATED_CONFIG_REL)
  })
})

describe('markdown gated add', () => {
  it('should refuse a folder with a finding left and write nothing', async () => {
    write('docs/guide.md', `# Guide\n\n${LONG_PARAGRAPH}`)
    write(GATED_CONFIG_REL, '[markdown]\ngated = ["wiki/"]\n')
    const before = config()

    const result = await run(['markdown', 'gated', 'add', 'docs/', '--json'])

    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({ reason: 'findings' })
    expect(config()).toBe(before)
  })

  it('should append a clean folder once and treat a repeat as a no-op', async () => {
    write('docs/guide.md', '# Guide\n\nShort.\n')

    const first = await run(['markdown', 'gated', 'add', 'docs/', '--json'])
    const written = config()
    const second = await run(['markdown', 'gated', 'add', 'docs/', '--json'])

    expect(first.exitCode).toBe(0)
    expect(JSON.parse(first.stdout)).toMatchObject({ action: 'appended' })
    expect(second.exitCode).toBe(0)
    expect(JSON.parse(second.stdout)).toMatchObject({ action: 'present' })
    expect(config()).toBe(written)
  })

  it('should refuse a prefix without a slash naming no file', async () => {
    const result = await run(['markdown', 'gated', 'add', 'docs', '--json'])

    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({ reason: 'bad-prefix' })
  })
})
