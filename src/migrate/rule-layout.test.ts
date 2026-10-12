import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  applyRuleLayout,
  classifyRule,
  destinationRel,
  planRuleLayout,
  RENUMBERED_RULES,
  type RuleLayoutPlan,
  walkFlatRules,
} from '@/migrate/rule-layout'
import {
  type DomainHashes,
  hashContent,
  readStamp,
  stampedHashes,
  writeStamp,
} from '@/sync/stamp'

let root: string

function write(relative: string, text: string): void {
  const path = join(root, relative)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text)
}

const CATALOG = new Set(['040-catalog-only'])

const HASHES: DomainHashes = {
  '.claude/rules/core/005-behavior.md': hashContent('clean content\n'),
  '.claude/rules/core/010-testing.md': hashContent('original content\n'),
  '.claude/rules/core/020-dup.md': hashContent('dup content\n'),
  '.claude/rules/core/030-collide.md': hashContent('flat version\n'),
}

/**
 * One flat file of each class the verb has to separate: clean by stamp,
 * edited by stamp, clean by catalog fallback, the one renumbered rule, an
 * unclaimed name, a byte-identical duplicate, a real collision, and a
 * project-authored file the walk must never reach.
 */
function seed(): void {
  write('.claude/rules/core/005-behavior.md', 'clean content\n')
  write('.claude/rules/core/010-testing.md', 'edited content\n')
  write('.claude/rules/core/040-catalog-only.md', 'catalog content\n')
  write('.claude/rules/snippets/505-at-references.md', 'renumbered content\n')
  write('.claude/rules/core/999-unclaimed.md', 'mystery content\n')
  write('.claude/rules/core/020-dup.md', 'dup content\n')
  write('.claude/rules/canon/core/020-dup.md', 'dup content\n')
  write('.claude/rules/core/030-collide.md', 'flat version\n')
  write('.claude/rules/canon/core/030-collide.md', 'canon version\n')
  write('.claude/rules/project/900-custom.md', 'project content\n')
  write('.claude/rules/internal/core/095-internal.md', 'internal content\n')
}

async function plan(): Promise<RuleLayoutPlan> {
  const files = await walkFlatRules(root)
  const hashes = stampedHashes(readStamp(root), 'governance')
  return planRuleLayout(root, files, hashes, CATALOG)
}

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'canon-rule-layout-'))
  seed()
  await writeStamp(
    root,
    { domain: 'governance', toolkitRoot: root },
    HASHES,
    new Date(),
  )
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('RENUMBERED_RULES', () => {
  it('should carry the one rule #1446 renumbered', () => {
    expect(RENUMBERED_RULES['snippets/505-at-references']).toBe(
      'snippets/600-at-references',
    )
  })
})

describe('walkFlatRules', () => {
  it('should find a file sitting directly under a flat rule folder', async () => {
    const files = await walkFlatRules(root)
    expect(files.map((f) => f.rel)).toContain(
      '.claude/rules/core/005-behavior.md',
    )
  })

  it('should skip project/, canon/, and internal/ by name', async () => {
    const files = await walkFlatRules(root)
    for (const subdir of ['project', 'canon', 'internal']) {
      expect(files.some((f) => f.subdir === subdir)).toBe(false)
    }
  })
})

describe('destinationRel', () => {
  it('should insert canon/ ahead of an ordinary rule’s folder', () => {
    expect(
      destinationRel({ rel: '', subdir: 'core', name: '005-behavior' }),
    ).toBe('.claude/rules/canon/core/005-behavior.md')
  })

  it('should read the renumbered rule’s destination from the table', () => {
    expect(
      destinationRel({
        rel: '',
        subdir: 'snippets',
        name: '505-at-references',
      }),
    ).toBe('.claude/rules/canon/snippets/600-at-references.md')
  })
})

describe('classifyRule', () => {
  it('should classify a hash match against the stamp as clean', () => {
    const file = {
      rel: '.claude/rules/core/005-behavior.md',
      subdir: 'core',
      name: '005-behavior',
    }
    expect(classifyRule(root, file, HASHES, CATALOG)).toBe('clean')
  })

  it('should classify a stamp mismatch as edited', () => {
    const file = {
      rel: '.claude/rules/core/010-testing.md',
      subdir: 'core',
      name: '010-testing',
    }
    expect(classifyRule(root, file, HASHES, CATALOG)).toBe('edited')
  })

  it('should classify a name the catalog recognizes as clean with no stamp entry', () => {
    const file = {
      rel: '.claude/rules/core/040-catalog-only.md',
      subdir: 'core',
      name: '040-catalog-only',
    }
    expect(classifyRule(root, file, {}, CATALOG)).toBe('clean')
  })

  it('should classify the renumbered rule as clean through the table alone', () => {
    const file = {
      rel: '.claude/rules/snippets/505-at-references.md',
      subdir: 'snippets',
      name: '505-at-references',
    }
    expect(classifyRule(root, file, {}, new Set())).toBe('clean')
  })

  it('should classify a name neither the stamp nor the catalog nor the table recognizes as unclaimed', () => {
    const file = {
      rel: '.claude/rules/core/999-unclaimed.md',
      subdir: 'core',
      name: '999-unclaimed',
    }
    expect(classifyRule(root, file, {}, CATALOG)).toBe('unclaimed')
  })
})

describe('planRuleLayout', () => {
  it('should move a clean file to its canon/ destination', async () => {
    const result = await plan()
    expect(result.moves).toContainEqual({
      from: '.claude/rules/core/005-behavior.md',
      to: '.claude/rules/canon/core/005-behavior.md',
      status: 'clean',
    })
  })

  it('should move an edited file without changing what status it reports', async () => {
    const result = await plan()
    expect(result.moves).toContainEqual({
      from: '.claude/rules/core/010-testing.md',
      to: '.claude/rules/canon/core/010-testing.md',
      status: 'edited',
    })
  })

  it('should move the renumbered rule to its table destination and never to a 505-named copy', async () => {
    const result = await plan()
    expect(result.moves).toContainEqual({
      from: '.claude/rules/snippets/505-at-references.md',
      to: '.claude/rules/canon/snippets/600-at-references.md',
      status: 'clean',
    })
    expect(
      result.moves.some((move) => move.to.includes('505-at-references')),
    ).toBe(false)
  })

  it('should report an unclaimed name and never plan to move it', async () => {
    const result = await plan()
    expect(result.unclaimed).toContain('.claude/rules/core/999-unclaimed.md')
    expect(
      result.moves.some((move) => move.from.includes('999-unclaimed')),
    ).toBe(false)
  })

  it('should mark a byte-identical destination as a duplicate rather than a move', async () => {
    const result = await plan()
    expect(result.duplicates).toContainEqual({
      path: '.claude/rules/core/020-dup.md',
      destination: '.claude/rules/canon/core/020-dup.md',
    })
    expect(result.moves.some((move) => move.from.includes('020-dup'))).toBe(
      false,
    )
  })

  it('should report a real collision and plan to move neither side', async () => {
    const result = await plan()
    expect(result.collisions).toContainEqual({
      path: '.claude/rules/core/030-collide.md',
      destination: '.claude/rules/canon/core/030-collide.md',
    })
    expect(result.moves.some((move) => move.from.includes('030-collide'))).toBe(
      false,
    )
  })

  it('should leave a project-authored rule out of the plan entirely', async () => {
    const result = await plan()
    expect(result.moves.some((move) => move.from.includes('project'))).toBe(
      false,
    )
  })
})

describe('applyRuleLayout', () => {
  it('should carry the edited file’s old hash forward at its new key rather than re-hashing it', async () => {
    const result = await plan()
    await applyRuleLayout(root, result, root)

    const hashes = stampedHashes(readStamp(root), 'governance')
    expect(hashes['.claude/rules/canon/core/010-testing.md']).toBe(
      HASHES['.claude/rules/core/010-testing.md'],
    )
    expect(hashes['.claude/rules/core/010-testing.md']).toBeUndefined()
  })

  it('should leave a catalog-matched file with no stamp entry unstamped at its new key rather than hashing it fresh', async () => {
    const result = await plan()
    await applyRuleLayout(root, result, root)

    expect(
      existsSync(join(root, '.claude/rules/canon/core/040-catalog-only.md')),
    ).toBe(true)

    const hashes = stampedHashes(readStamp(root), 'governance')
    expect(
      hashes['.claude/rules/canon/core/040-catalog-only.md'],
    ).toBeUndefined()
  })

  it('should delete a byte-identical duplicate and leave the canon/ copy untouched', async () => {
    const result = await plan()
    await applyRuleLayout(root, result, root)

    expect(existsSync(join(root, '.claude/rules/core/020-dup.md'))).toBe(false)
    expect(
      readFileSync(join(root, '.claude/rules/canon/core/020-dup.md'), 'utf8'),
    ).toBe('dup content\n')
  })

  it('should leave both sides of a real collision on disk untouched', async () => {
    const result = await plan()
    await applyRuleLayout(root, result, root)

    expect(
      readFileSync(join(root, '.claude/rules/core/030-collide.md'), 'utf8'),
    ).toBe('flat version\n')
    expect(
      readFileSync(
        join(root, '.claude/rules/canon/core/030-collide.md'),
        'utf8',
      ),
    ).toBe('canon version\n')
  })

  it('should leave the project-authored rule on disk untouched', async () => {
    const result = await plan()
    await applyRuleLayout(root, result, root)

    expect(
      readFileSync(join(root, '.claude/rules/project/900-custom.md'), 'utf8'),
    ).toBe('project content\n')
  })

  it('should report what it moved and deleted', async () => {
    const result = await plan()
    const applied = await applyRuleLayout(root, result, root)

    expect(applied.moved).toBe(result.moves.length)
    expect(applied.deleted).toBe(result.duplicates.length)
    expect(applied.failed).toEqual([])
  })
})
