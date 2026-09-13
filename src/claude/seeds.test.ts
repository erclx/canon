import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  applySeeds,
  countByScope,
  pendingSeeds,
  planSeeds,
} from '@/claude/seeds'

const dirs: string[] = []

async function makeDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'canon-seeds-'))
  dirs.push(dir)
  return dir
}

/**
 * Builds a stand-in for `tooling/claude/seeds/`, so the tests assert on the
 * scan rules rather than on whichever files the real seed folder holds today.
 */
async function makeRoot(): Promise<string> {
  const root = await makeDir()
  const seeds = join(root, 'tooling', 'claude', 'seeds')
  const claude = join(seeds, '.claude')
  const surface = join(seeds, 'canon')

  await mkdir(join(claude, 'hooks'), { recursive: true })
  await mkdir(join(claude, 'tasks'), { recursive: true })
  await mkdir(join(surface, 'context'), { recursive: true })
  await mkdir(join(surface, 'wireframes'), { recursive: true })

  await writeFile(join(seeds, 'CLAUDE.md'), '# Project\n')
  await writeFile(join(claude, 'settings.json'), '{}\n')
  await writeFile(join(claude, 'hooks', 'guard.sh'), '#!/bin/sh\n')
  await writeFile(join(claude, 'tasks', 'index.md'), '# Tasks\n')
  await writeFile(join(surface, 'ARCHITECTURE.md'), '# Architecture\n')
  await writeFile(join(surface, 'context', 'index.md'), '# Context\n')
  await writeFile(join(surface, 'wireframes', 'index.md'), '# Wireframes\n')

  return root
}

afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  )
})

describe('planSeeds', () => {
  it('should scan the claude root level before its subdirectories', async () => {
    const root = await makeRoot()
    const target = await makeDir()

    const labels = planSeeds(root, target).map((entry) => entry.seed.scanLabel)

    expect(labels).toEqual([
      'settings.json',
      'ARCHITECTURE.md',
      'hooks/guard.sh',
      'context/index.md',
      'tasks/index.md',
      'wireframes/index.md',
      'CLAUDE.md',
    ])
  })

  it('should report every seed as pending against an empty target', async () => {
    const root = await makeRoot()
    const target = await makeDir()

    const entries = planSeeds(root, target)

    expect(entries.every((entry) => !entry.present)).toBe(true)
  })

  it('should report a seed the target already carries as present', async () => {
    const root = await makeRoot()
    const target = await makeDir()
    await mkdir(join(target, '.claude'), { recursive: true })
    await writeFile(join(target, '.claude', 'ARCHITECTURE.md'), '# Mine\n')

    const entries = planSeeds(root, target)

    expect(
      entries.find((e) => e.seed.scanLabel === 'ARCHITECTURE.md')?.present,
    ).toBe(true)
  })

  it('should place CLAUDE.md at the project root rather than under .claude', async () => {
    const root = await makeRoot()
    const target = await makeDir()

    const entries = planSeeds(root, target)
    const claudeMd = entries.find((e) => e.seed.scanLabel === 'CLAUDE.md')

    expect(claudeMd?.seed.dest).toBe(join(target, 'CLAUDE.md'))
  })

  it('should mark only hooks as executable', async () => {
    const root = await makeRoot()
    const target = await makeDir()

    const executable = planSeeds(root, target)
      .filter((entry) => entry.seed.executable)
      .map((entry) => entry.seed.scanLabel)

    expect(executable).toEqual(['hooks/guard.sh'])
  })

  it('should omit CLAUDE.md when the seed folder has none', async () => {
    const root = await makeRoot()
    const target = await makeDir()
    await rm(join(root, 'tooling', 'claude', 'seeds', 'CLAUDE.md'))

    const labels = planSeeds(root, target).map((entry) => entry.seed.scanLabel)

    expect(labels).not.toContain('CLAUDE.md')
  })
})

describe('countByScope', () => {
  it('should split the claude directory count from the project root count', async () => {
    const root = await makeRoot()
    const target = await makeDir()

    const counts = countByScope(pendingSeeds(planSeeds(root, target)))

    expect(counts).toEqual({ claude: 6, root: 1 })
  })
})

describe('applySeeds', () => {
  it('should report the destination relative labels it wrote', async () => {
    const root = await makeRoot()
    const target = await makeDir()

    const applied = await applySeeds(pendingSeeds(planSeeds(root, target)))

    expect(applied).toEqual([
      '.claude/settings.json',
      'canon/ARCHITECTURE.md',
      '.claude/hooks/guard.sh',
      'canon/context/index.md',
      '.canon/tasks/index.md',
      'canon/wireframes/index.md',
      'CLAUDE.md',
    ])
  })

  it('should seed a surface beside the copy an unmoved target already holds', async () => {
    const root = await makeRoot()
    const target = await makeDir()
    await mkdir(join(target, '.claude', 'context'), { recursive: true })

    const applied = await applySeeds(pendingSeeds(planSeeds(root, target)))

    // canon-keep-surface-root
    expect(applied).toContain('.claude/context/index.md')
    expect(existsSync(join(target, 'canon', 'context'))).toBe(false)
  })

  it('should create the nested directories a seed needs', async () => {
    const root = await makeRoot()
    const target = await makeDir()

    await applySeeds(pendingSeeds(planSeeds(root, target)))

    expect(existsSync(join(target, '.claude', 'hooks', 'guard.sh'))).toBe(true)
  })

  it('should leave a hook executable', async () => {
    const root = await makeRoot()
    const target = await makeDir()

    await applySeeds(pendingSeeds(planSeeds(root, target)))

    const mode = (await stat(join(target, '.claude', 'hooks', 'guard.sh'))).mode
    expect(mode & 0o111).toBe(0o111)
  })

  it('should skip a seed the target already has', async () => {
    const root = await makeRoot()
    const target = await makeDir()
    await mkdir(join(target, '.claude'), { recursive: true })
    await writeFile(join(target, '.claude', 'ARCHITECTURE.md'), '# Mine\n')

    const applied = await applySeeds(pendingSeeds(planSeeds(root, target)))

    expect(applied).not.toContain('canon/ARCHITECTURE.md')
  })
})
