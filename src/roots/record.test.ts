import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  CREATION_ROOT,
  creationRel,
  isRecordEntry,
  RECORD_ROOTS,
  recordDir,
  recordDirs,
  recordRoot,
  SCRATCH,
} from '@/roots/record'

let ROOT = ''

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-record-root-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

function seed(...segments: string[]): void {
  mkdirSync(join(ROOT, ...segments), { recursive: true })
}

describe('RECORD_ROOTS', () => {
  it('should read the new root ahead of the old one', () => {
    expect(RECORD_ROOTS).toEqual(['.canon', '.claude'])
  })

  it('should create at the new root now the move has landed', () => {
    expect(CREATION_ROOT).toBe('.canon')
  })
})

describe('recordDir', () => {
  it('should resolve at the new root when only it carries the folder', () => {
    seed('.canon', 'plans')

    expect(recordDir(ROOT, 'plans')).toBe(join(ROOT, '.canon', 'plans'))
  })

  it('should resolve at the old root when only it carries the folder', () => {
    seed('.claude', 'plans')

    expect(recordDir(ROOT, 'plans')).toBe(join(ROOT, '.claude', 'plans'))
  })

  it('should prefer the new root when both carry the folder', () => {
    seed('.canon', 'plans')
    seed('.claude', 'plans')

    expect(recordDir(ROOT, 'plans')).toBe(join(ROOT, '.canon', 'plans'))
  })

  it('should fall back to the creation default when neither carries it', () => {
    expect(recordDir(ROOT, 'plans')).toBe(join(ROOT, '.canon', 'plans'))
  })

  it('should read presence on the record folder rather than on what sits inside it', () => {
    seed('.canon', 'plans')

    expect(recordDir(ROOT, 'plans', 'archive')).toBe(
      join(ROOT, '.canon', 'plans', 'archive'),
    )
  })

  it('should drop the scratch folder dot at the new root', () => {
    seed('.canon', 'tmp')

    expect(recordDir(ROOT, SCRATCH, 'gov', 'rules.md')).toBe(
      join(ROOT, '.canon', 'tmp', 'gov', 'rules.md'),
    )
  })

  it('should resolve scratch at the new root when only the old one carries it', () => {
    seed('.claude', '.tmp')

    expect(recordDir(ROOT, SCRATCH, 'gov', 'rules.md')).toBe(
      join(ROOT, '.canon', 'tmp', 'gov', 'rules.md'),
    )
  })

  it('should not read a new root that carries the old scratch spelling', () => {
    seed('.canon', '.tmp')

    expect(recordDir(ROOT, SCRATCH)).toBe(join(ROOT, '.canon', 'tmp'))
  })
})

describe('recordDirs', () => {
  it('should name both roots in precedence order whatever is on disk', () => {
    expect(recordDirs(ROOT, 'plans', 'archive')).toEqual([
      join(ROOT, '.canon', 'plans', 'archive'),
      join(ROOT, '.claude', 'plans', 'archive'),
    ])
  })

  it('should name the new root alone for scratch', () => {
    expect(recordDirs(ROOT, SCRATCH)).toEqual([join(ROOT, '.canon', 'tmp')])
  })
})

describe('creationRel', () => {
  it('should spell the destination relative to the project root', () => {
    expect(creationRel(ROOT, 'review', 'slides')).toBe(
      join('.canon', 'review', 'slides'),
    )
  })

  it('should write beside records a tree has not migrated yet', () => {
    seed('.claude', 'review')

    expect(creationRel(ROOT, 'review', 'feedback')).toBe(
      join('.claude', 'review', 'feedback'),
    )
  })

  it('should take the new root once the tree carries it', () => {
    seed('.canon', 'review')
    seed('.claude', 'review')

    expect(creationRel(ROOT, 'review', 'feedback')).toBe(
      join('.canon', 'review', 'feedback'),
    )
  })

  it('should rename the scratch folder at the new root', () => {
    expect(creationRel(ROOT, SCRATCH, 'gov', 'rules.md')).toBe(
      join('.canon', 'tmp', 'gov', 'rules.md'),
    )
  })
})

describe('recordRoot', () => {
  it('should take the new root when it holds records', () => {
    seed('.canon', 'plans')
    seed('.claude', 'plans')

    expect(recordRoot(ROOT)).toBe(join(ROOT, '.canon'))
  })

  it('should take the old root when only it holds records', () => {
    seed('.claude', 'plans')

    expect(recordRoot(ROOT)).toBe(join(ROOT, '.claude'))
  })

  it('should take the old root when it holds only a records history', () => {
    seed('.claude', '.records.git')

    expect(recordRoot(ROOT)).toBe(join(ROOT, '.claude'))
  })

  it('should take the old root when the new one is empty', () => {
    seed('.canon')
    seed('.claude', 'tasks')

    expect(recordRoot(ROOT)).toBe(join(ROOT, '.claude'))
  })

  it.each(['hooks', 'rules', 'skills', 'worktrees'])(
    'should not read .claude/%s as a record folder',
    (folder) => {
      seed('.claude', folder)

      expect(recordRoot(ROOT)).toBe(join(ROOT, '.canon'))
    },
  )

  it('should not read a settings file as records', () => {
    seed('.claude')
    writeFileSync(join(ROOT, '.claude', 'settings.json'), '{}\n')

    expect(recordRoot(ROOT)).toBe(join(ROOT, '.canon'))
  })

  it('should not read a lone README as records at either root', () => {
    seed('.claude')
    writeFileSync(join(ROOT, '.claude', 'README.md'), '# records\n')

    expect(recordRoot(ROOT)).toBe(join(ROOT, '.canon'))
  })

  it('should not read a lone scratch folder as records', () => {
    seed('.claude', SCRATCH)

    expect(recordRoot(ROOT)).toBe(join(ROOT, '.canon'))
  })

  it('should not read a lone scratch folder at the new root as records', () => {
    seed('.canon', 'tmp')
    seed('.claude', 'tasks')

    expect(recordRoot(ROOT)).toBe(join(ROOT, '.claude'))
  })

  it('should fall back to the creation default when neither exists', () => {
    expect(recordRoot(ROOT)).toBe(join(ROOT, '.canon'))
  })
})

describe('isRecordEntry', () => {
  it('should claim the canvas content folder for the record root', () => {
    expect(isRecordEntry('canvas')).toBe(true)
  })

  it('should claim the slides deck folder for the record root', () => {
    expect(isRecordEntry('slides')).toBe(true)
  })
})
