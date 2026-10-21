import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  detectDomains,
  domainPaths,
  installedDomains,
  isTreeClean,
  shouldSync,
} from '@/sync/target'

const dirs: string[] = []

async function makeTarget(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'canon-sync-target-'))
  dirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  )
})

describe('detectDomains', () => {
  it('should report every domain as absent in an empty target', async () => {
    const target = await makeTarget()

    expect(installedDomains(detectDomains(target))).toEqual([])
  })

  it('should not read a leftover standards folder as an installed domain', async () => {
    const target = await makeTarget()
    await mkdir(join(target, '.claude', 'standards'), { recursive: true })

    expect(installedDomains(detectDomains(target))).toEqual(['claude'])
  })

  it('should not read a leftover snippets folder as an installed domain', async () => {
    const target = await makeTarget()
    await mkdir(join(target, '.claude', 'snippets'), { recursive: true })

    expect(installedDomains(detectDomains(target))).toEqual(['claude'])
  })

  it('should map governance onto .claude/rules/ rather than a rules root', async () => {
    const target = await makeTarget()
    await mkdir(join(target, '.claude', 'rules'), { recursive: true })

    expect(installedDomains(detectDomains(target))).toEqual([
      'governance',
      'claude',
    ])
  })

  it('should keep the domains in report order', async () => {
    const target = await makeTarget()
    await mkdir(join(target, '.claude', 'rules'), { recursive: true })

    expect(detectDomains(target).map((state) => state.domain)).toEqual([
      'governance',
      'claude',
    ])
  })
})

describe('shouldSync', () => {
  it('should sync governance when only the retired GOV.md remains', async () => {
    const target = await makeTarget()
    await mkdir(join(target, '.claude'), { recursive: true })
    await writeFile(join(target, '.claude', 'GOV.md'), '# gov\n')

    expect(shouldSync(target, 'governance')).toBe(true)
  })

  it('should not report that governance is installed for GOV.md alone', async () => {
    const target = await makeTarget()
    await mkdir(join(target, '.claude'), { recursive: true })
    await writeFile(join(target, '.claude', 'GOV.md'), '# gov\n')

    expect(installedDomains(detectDomains(target))).toEqual(['claude'])
  })

  it('should skip a domain with neither marker nor retired surface', async () => {
    const target = await makeTarget()

    expect(shouldSync(target, 'governance')).toBe(false)
  })
})

describe('domainPaths', () => {
  it('should watch .gitignore for the claude domain', () => {
    expect(domainPaths('claude')).toEqual(['.gitignore'])
  })

  it('should watch the retired GOV.md alongside the rules tree', () => {
    expect(domainPaths('governance')).toEqual([
      '.claude/rules/',
      '.claude/GOV.md',
    ])
  })
})

describe('isTreeClean', () => {
  it('should treat empty status output as clean', () => {
    expect(isTreeClean('')).toBe(true)
  })

  it('should treat whitespace-only output as clean', () => {
    expect(isTreeClean('\n')).toBe(true)
  })

  it('should treat any entry as dirty', () => {
    expect(isTreeClean(' M src/cli.ts\n')).toBe(false)
  })
})
