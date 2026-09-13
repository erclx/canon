import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AuditedFolder } from '@/context/folders'
import { auditFolder, listedTargets } from '@/context/index-drift'

let ROOT: string

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-index-drift-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

const INDEX = [
  '---',
  'title: Context',
  'subtitle: Per-domain narrative',
  '---',
  '',
  '# Context',
  '',
  '- [CI](ci.md): Workflow triggers',
  '- [CLI](cli.md): Entry point',
  '- [Claude plugin](claude-plugin/index.md): Plugin skills',
  '',
].join('\n')

function seedFolder(names: string[], index = INDEX): void {
  const dir = join(ROOT, 'canon', 'context')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.md'), index)

  for (const name of names) {
    writeFileSync(
      join(dir, name),
      `---\ntitle: X\ndescription: Y\n---\n\n# X\n`,
    )
  }
}

function folderAt(names: string[]): AuditedFolder {
  const dir = join(ROOT, 'canon', 'context')
  return {
    name: 'context',
    base: 'canon',
    rel: 'canon/context',
    indexPath: join(dir, 'index.md'),
    entries: names.map((name) => join(dir, name)),
    nested: false,
  }
}

describe('listedTargets', () => {
  it('should collect the link target of every catalog bullet', () => {
    expect(listedTargets(INDEX)).toEqual([
      'ci.md',
      'cli.md',
      'claude-plugin/index.md',
    ])
  })

  it('should ignore a bullet that is not a link', () => {
    expect(
      listedTargets('- Plain text bullet\n- [CI](ci.md): Triggers\n'),
    ).toEqual(['ci.md'])
  })
})

describe('auditFolder', () => {
  it('should report nothing when the index agrees with its siblings', async () => {
    seedFolder(['ci.md', 'cli.md'])
    mkdirSync(join(ROOT, 'canon/context/claude-plugin'), { recursive: true })
    writeFileSync(join(ROOT, 'canon/context/claude-plugin/index.md'), INDEX)

    const drift = await auditFolder(folderAt(['ci.md', 'cli.md']))

    expect(drift).toEqual({
      rel: 'canon/context',
      unlisted: [],
      missing: [],
    })
  })

  it('should report an entry the index does not link', async () => {
    seedFolder(['ci.md', 'cli.md', 'sandbox.md'])
    mkdirSync(join(ROOT, 'canon/context/claude-plugin'), { recursive: true })
    writeFileSync(join(ROOT, 'canon/context/claude-plugin/index.md'), INDEX)

    const drift = await auditFolder(folderAt(['ci.md', 'cli.md', 'sandbox.md']))

    expect(drift.unlisted).toEqual(['sandbox.md'])
  })

  it('should report a linked name that resolves to nothing', async () => {
    seedFolder(['ci.md'])

    const drift = await auditFolder(folderAt(['ci.md']))

    expect(drift.missing).toEqual(['cli.md', 'claude-plugin/index.md'])
  })
})
