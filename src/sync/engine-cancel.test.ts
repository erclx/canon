import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runDomainSync, type SyncAdapter } from '@/sync/engine'

vi.mock('@/cli/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/cli/ui')>()),
  select: async () => false,
}))

let root: string
let written: string[]
let original: typeof process.stdout.write

function writeFixture(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-engine-cancel-'))
  written = []
  original = process.stdout.write
  process.stdout.write = ((chunk: string | Uint8Array) => {
    written.push(String(chunk))
    return true
  }) as typeof process.stdout.write
})

afterEach(() => {
  process.stdout.write = original
  rmSync(root, { recursive: true, force: true })
})

describe('runDomainSync when the apply is cancelled', () => {
  it('should write an empty record and leave the rule unwritten', async () => {
    writeFixture(join(root, 'source/core/000-const.md'), 'new\n')
    const dest = join(root, 'target/.claude/rules/core/000-const.md')
    writeFixture(dest, 'old\n')
    const adapter: SyncAdapter = {
      banner: 'canon test sync',
      label: 'rules',
      missingMessage: 'Nothing installed',
      unit: 'changes',
      installedRoot: (target) => join(target, '.claude', 'rules'),
      locateSource: (file) => join(root, 'source', file.relToRoot),
      coverage: async () => [
        { rule: 'a.md', paths: [], files: undefined, ui: false },
      ],
    }

    const code = await runDomainSync(adapter, join(root, 'target'), {
      protectedRoot: '/nowhere',
      json: true,
    })

    expect(code).toBe(0)
    expect(written.map((chunk) => JSON.parse(chunk))).toEqual([
      { coverage: [] },
    ])
    expect(await Bun.file(dest).text()).toBe('old\n')
  })
})
