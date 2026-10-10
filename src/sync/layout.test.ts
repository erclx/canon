import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  collectSuperseded,
  detectUnmigrated,
  detectUnmovedSurfaces,
} from '@/sync/layout'

let TARGET: string
let TOOLKIT: string

function write(root: string, rel: string, content = 'body\n'): void {
  const path = join(root, rel)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

function writeFixture(rel: string, content = 'body\n'): void {
  write(TARGET, rel, content)
}

beforeEach(() => {
  TARGET = mkdtempSync(join(tmpdir(), 'canon-layout-'))
  TOOLKIT = mkdtempSync(join(tmpdir(), 'canon-layout-toolkit-'))
  write(TOOLKIT, join('standards', 'prose.md'))
  write(TOOLKIT, join('standards', 'tasks.md'))
  write(TOOLKIT, join('snippets', 'review', 'diff.md'))
})

afterEach(() => {
  rmSync(TARGET, { recursive: true, force: true })
  rmSync(TOOLKIT, { recursive: true, force: true })
})

describe('collectSuperseded', () => {
  it('should return nothing for a target holding no retired artifact', () => {
    writeFixture(join('.claude', 'tasks', 'index.md'))

    expect(collectSuperseded(TARGET)).toEqual([])
  })

  it('should report a single file the seed folder of the same stem replaced', () => {
    writeFixture(join('.claude', 'TASKS.md'))

    expect(collectSuperseded(TARGET)).toEqual([
      {
        rel: join('.claude', 'TASKS.md'),
        replacedBy: join('.canon', 'tasks'),
      },
    ])
  })

  it('should name the old root for a target that has not migrated its board', () => {
    writeFixture(join('.claude', 'TASKS.md'))
    mkdirSync(join(TARGET, '.claude', 'tasks'), { recursive: true })

    expect(collectSuperseded(TARGET)).toEqual([
      {
        rel: join('.claude', 'TASKS.md'),
        replacedBy: join('.claude', 'tasks'),
      },
    ])
  })

  it('should report every retired artifact the target still holds', () => {
    writeFixture(join('.claude', 'TASKS.md'))
    writeFixture(join('.claude', 'MEMORY.md'))

    expect(collectSuperseded(TARGET).map((entry) => entry.rel)).toEqual([
      join('.claude', 'MEMORY.md'),
      join('.claude', 'TASKS.md'),
    ])
  })

  it('should not report a flat wireframes file, since no seeded folder replaces it', () => {
    writeFixture(join('.claude', 'WIREFRAMES.md'))

    expect(collectSuperseded(TARGET)).toEqual([])
  })

  it('should not report a flat diagrams file, since no seeded folder replaces it', () => {
    writeFixture(join('.claude', 'DIAGRAMS.md'))

    expect(collectSuperseded(TARGET)).toEqual([])
  })

  it('should not match a suffixed variant of a retired artifact', () => {
    writeFixture(join('.claude', 'TASKS-ARCHIVE.md'))

    expect(collectSuperseded(TARGET)).toEqual([])
  })

  it('should report the retired file even when its replacement folder exists', () => {
    writeFixture(join('.claude', 'TASKS.md'))
    writeFixture(join('.claude', 'tasks', 'index.md'))

    expect(collectSuperseded(TARGET)).toHaveLength(1)
  })
})

describe('detectUnmigrated', () => {
  it('should return nothing for a target with neither layout', () => {
    expect(detectUnmigrated(TOOLKIT, TARGET)).toEqual([])
  })

  it('should leave a root standards folder alone, since no corpus installs', () => {
    writeFixture(join('standards', 'prose.md'))
    writeFixture(join('standards', 'tasks.md'))

    expect(detectUnmigrated(TOOLKIT, TARGET)).toEqual([])
  })

  it('should leave a root snippets folder alone, since no corpus installs', () => {
    writeFixture(join('snippets', 'diff.md'))

    expect(detectUnmigrated(TOOLKIT, TARGET)).toEqual([])
  })
})

describe('detectUnmovedSurfaces', () => {
  it('should name a surface held only at its .claude/ spelling', () => {
    writeFixture(join('.claude', 'REQUIREMENTS.md'))
    writeFixture(join('.claude', 'context', 'cli.md'))

    expect(detectUnmovedSurfaces(TARGET)).toEqual([
      { rel: '.claude/REQUIREMENTS.md', movesTo: 'canon/REQUIREMENTS.md' },
      { rel: '.claude/context', movesTo: 'canon/context' },
    ])
  })

  it('should spell the stamp folder at its canon/config destination', () => {
    writeFixture(join('.claude', 'canon', 'config.json'), '{}\n')

    expect(detectUnmovedSurfaces(TARGET)).toEqual([
      { rel: '.claude/canon', movesTo: 'canon/config' },
    ])
  })

  it('should pass a surface that already sits under canon/', () => {
    writeFixture(join('.claude', 'DESIGN.md'))
    writeFixture(join('canon', 'DESIGN.md'))

    expect(detectUnmovedSurfaces(TARGET)).toEqual([])
  })

  it('should return nothing for a target holding no surface', () => {
    writeFixture(join('.claude', 'rules', 'canon', 'x.md'))

    expect(detectUnmovedSurfaces(TARGET)).toEqual([])
  })
})
