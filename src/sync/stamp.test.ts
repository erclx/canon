import {
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
  hashContent,
  hashFile,
  isLegacyStamped,
  legacyStampPath,
  readStamp,
  retiredNameStampPath,
  type StampSource,
  stampedChain,
  stampedCommit,
  stampedHashes,
  stampPath,
  toStampKey,
  writeChainStamp,
  writeStamp,
} from '@/sync/stamp'
import { readTargetRegistry } from '@/targets/registry'

let TARGET: string

const NOW = new Date('2026-07-30T12:00:00.000Z')

/** The toolkit root only dates the stamp, so a non-repo path exercises the fallback. */
const GOVERNANCE: StampSource = {
  domain: 'governance',
  toolkitRoot: '/nowhere',
}
const TOOLING: StampSource = { domain: 'tooling', toolkitRoot: '/nowhere' }

function writeFixture(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

function readRaw(target: string): Record<string, unknown> {
  return JSON.parse(readFileSync(stampPath(target), 'utf8'))
}

beforeEach(() => {
  TARGET = mkdtempSync(join(tmpdir(), 'canon-stamp-'))
})

afterEach(() => {
  rmSync(TARGET, { recursive: true, force: true })
})

describe('hashFile', () => {
  it('should hash file bytes to the same digest as their content', () => {
    const path = join(TARGET, 'a.md')
    writeFixture(path, 'body\n')

    expect(hashFile(path)).toBe(hashContent('body\n'))
  })

  it('should produce a different digest for different content', () => {
    expect(hashContent('a')).not.toBe(hashContent('b'))
  })
})

describe('toStampKey', () => {
  it('should leave a posix path unchanged', () => {
    expect(toStampKey('.claude/standards/prose.md')).toBe(
      '.claude/standards/prose.md',
    )
  })
})

describe('readStamp', () => {
  it('should return undefined when no stamp exists', () => {
    expect(readStamp(TARGET)).toBeUndefined()
  })

  it('should return undefined for a corrupt stamp rather than throwing', () => {
    writeFixture(stampPath(TARGET), '{ not json')

    expect(readStamp(TARGET)).toBeUndefined()
  })

  it('should return undefined when required fields are missing', () => {
    writeFixture(stampPath(TARGET), JSON.stringify({ commit: 'abc' }))

    expect(readStamp(TARGET)).toBeUndefined()
  })

  it('should return undefined when a domain record is the wrong shape', () => {
    writeFixture(
      stampPath(TARGET),
      JSON.stringify({ covers: [], domains: { governance: 'not-a-record' } }),
    )

    expect(readStamp(TARGET)).toBeUndefined()
  })

  it('should return undefined when a file hash is not a string', () => {
    writeFixture(
      stampPath(TARGET),
      JSON.stringify({
        covers: [],
        domains: {
          governance: { syncedAt: 'now', files: { 'a.md': 42 } },
        },
      }),
    )

    expect(readStamp(TARGET)).toBeUndefined()
  })

  it('should ignore an unknown domain key rather than discarding the stamp', () => {
    writeFixture(
      stampPath(TARGET),
      JSON.stringify({
        covers: ['governance'],
        domains: {
          standards: { syncedAt: 'then', files: {} },
          governance: { syncedAt: 'now', files: {} },
        },
      }),
    )

    const stamp = readStamp(TARGET)

    expect(stamp?.domains.governance?.syncedAt).toBe('now')
  })

  it('should drop a retired domain key on the next write', async () => {
    writeFixture(
      stampPath(TARGET),
      JSON.stringify({
        covers: ['governance'],
        domains: {
          standards: { syncedAt: 'then', files: {} },
          governance: { syncedAt: 'then', files: {} },
        },
      }),
    )

    await writeStamp(TARGET, TOOLING, {}, NOW)

    expect(Object.keys(readRaw(TARGET).domains as object)).toEqual([
      'governance',
      'tooling',
    ])
  })

  it('should return undefined when a chain entry is not a string', () => {
    writeFixture(
      stampPath(TARGET),
      JSON.stringify({
        covers: ['tooling'],
        domains: {
          tooling: { syncedAt: 'now', files: {}, chain: ['base', 7] },
        },
      }),
    )

    expect(readStamp(TARGET)).toBeUndefined()
  })

  it('should read a stamp written before tooling joined the domains', () => {
    writeFixture(
      stampPath(TARGET),
      JSON.stringify({
        covers: ['governance'],
        domains: { governance: { syncedAt: 'then', files: {} } },
      }),
    )

    expect(readStamp(TARGET)?.domains.governance?.syncedAt).toBe('then')
  })

  it('should read back a stamp that was written', async () => {
    await writeStamp(TARGET, GOVERNANCE, { 'a.md': 'sha256:aa' }, NOW)

    expect(readStamp(TARGET)?.domains.governance?.syncedAt).toBe(
      NOW.toISOString(),
    )
  })

  it('should read as absent rather than falling back when the current path exists but is corrupt', () => {
    writeFixture(
      legacyStampPath(TARGET),
      JSON.stringify({
        covers: ['governance'],
        domains: { governance: { syncedAt: 'stale', files: {} } },
      }),
    )
    writeFixture(stampPath(TARGET), '{ not json')

    expect(readStamp(TARGET)).toBeUndefined()
  })

  it('should fall back to the retired .claude/aitk.json when the current path is absent', () => {
    writeFixture(
      legacyStampPath(TARGET),
      JSON.stringify({
        covers: ['governance'],
        domains: { governance: { syncedAt: 'then', files: {} } },
      }),
    )

    expect(readStamp(TARGET)?.domains.governance?.syncedAt).toBe('then')
  })

  it('should fall back to the stamp folder under the retired tool name', () => {
    writeFixture(
      retiredNameStampPath(TARGET),
      JSON.stringify({
        covers: ['governance'],
        domains: { governance: { syncedAt: 'renamed', files: {} } },
      }),
    )

    expect(readStamp(TARGET)?.domains.governance?.syncedAt).toBe('renamed')
  })

  it('should prefer the retired tool name over the flat path when both exist', () => {
    writeFixture(
      legacyStampPath(TARGET),
      JSON.stringify({
        covers: ['governance'],
        domains: { governance: { syncedAt: 'oldest', files: {} } },
      }),
    )
    writeFixture(
      retiredNameStampPath(TARGET),
      JSON.stringify({
        covers: ['governance'],
        domains: { governance: { syncedAt: 'newer', files: {} } },
      }),
    )

    expect(readStamp(TARGET)?.domains.governance?.syncedAt).toBe('newer')
  })

  it('should report a stamp at the retired tool name as legacy', () => {
    writeFixture(
      retiredNameStampPath(TARGET),
      JSON.stringify({ covers: [], domains: {} }),
    )

    expect(isLegacyStamped(TARGET)).toBe(true)
  })

  it('should prefer the current path over the retired one when both exist', () => {
    writeFixture(
      legacyStampPath(TARGET),
      JSON.stringify({
        covers: ['governance'],
        domains: { governance: { syncedAt: 'old', files: {} } },
      }),
    )
    writeFixture(
      stampPath(TARGET),
      JSON.stringify({
        covers: ['governance'],
        domains: { governance: { syncedAt: 'new', files: {} } },
      }),
    )

    expect(readStamp(TARGET)?.domains.governance?.syncedAt).toBe('new')
  })

  it('should resolve at canon/config/config.json when the project has moved', () => {
    writeFixture(
      join(TARGET, 'canon', 'config', 'config.json'),
      JSON.stringify({
        covers: ['governance'],
        domains: { governance: { syncedAt: 'moved', files: {} } },
      }),
    )

    expect(readStamp(TARGET)?.domains.governance?.syncedAt).toBe('moved')
  })

  it('should still resolve the .claude/ spelling when the project has not moved', () => {
    writeFixture(
      stampPath(TARGET),
      JSON.stringify({
        covers: ['governance'],
        domains: { governance: { syncedAt: 'unmoved', files: {} } },
      }),
    )

    expect(readStamp(TARGET)?.domains.governance?.syncedAt).toBe('unmoved')
  })

  it('should prefer canon/config/config.json over every .claude/ spelling', () => {
    writeFixture(
      stampPath(TARGET),
      JSON.stringify({
        covers: ['governance'],
        domains: { governance: { syncedAt: 'old-root', files: {} } },
      }),
    )
    writeFixture(
      join(TARGET, 'canon', 'config', 'config.json'),
      JSON.stringify({
        covers: ['governance'],
        domains: { governance: { syncedAt: 'new-root', files: {} } },
      }),
    )

    expect(readStamp(TARGET)?.domains.governance?.syncedAt).toBe('new-root')
  })
})

describe('isLegacyStamped', () => {
  it('should return false when neither path exists', () => {
    expect(isLegacyStamped(TARGET)).toBe(false)
  })

  it('should return false when only the current path exists', async () => {
    await writeStamp(TARGET, GOVERNANCE, {}, NOW)

    expect(isLegacyStamped(TARGET)).toBe(false)
  })

  it('should return true when only the retired path exists', () => {
    writeFixture(
      legacyStampPath(TARGET),
      JSON.stringify({ covers: [], domains: {} }),
    )

    expect(isLegacyStamped(TARGET)).toBe(true)
  })

  it('should return false when both paths exist', async () => {
    await writeStamp(TARGET, GOVERNANCE, {}, NOW)
    writeFixture(
      legacyStampPath(TARGET),
      JSON.stringify({ covers: [], domains: {} }),
    )

    expect(isLegacyStamped(TARGET)).toBe(false)
  })

  it('should return false when only the surface-root path exists', () => {
    writeFixture(
      join(TARGET, 'canon', 'config', 'config.json'),
      JSON.stringify({ covers: [], domains: {} }),
    )

    expect(isLegacyStamped(TARGET)).toBe(false)
  })

  it('should return false when the surface-root path exists alongside a retired one', () => {
    writeFixture(
      join(TARGET, 'canon', 'config', 'config.json'),
      JSON.stringify({ covers: [], domains: {} }),
    )
    writeFixture(
      legacyStampPath(TARGET),
      JSON.stringify({ covers: [], domains: {} }),
    )

    expect(isLegacyStamped(TARGET)).toBe(false)
  })
})

// The machine-level index is what lets a rollout enumerate the projects the
// toolkit installed into. Writing it from here is what keeps it in step without
// each install command remembering to, so the coupling is asserted rather than
// left to the comment that explains it.
describe('the machine-level target index', () => {
  it('should gain the target on any stamp write', async () => {
    await writeStamp(TARGET, GOVERNANCE, { 'a.md': 'sha256:aa' }, NOW)

    const registry = readTargetRegistry()

    expect(registry.kind).toBe('read')
    expect(
      registry.kind === 'read' ? registry.targets.map((row) => row.path) : [],
    ).toContain(TARGET)
  })

  it('should gain the target on a chain stamp that records no files', async () => {
    await writeChainStamp(TARGET, TOOLING, ['next'], NOW)

    const registry = readTargetRegistry()

    expect(
      registry.kind === 'read' ? registry.targets.map((row) => row.path) : [],
    ).toContain(TARGET)
  })
})

describe('writeStamp', () => {
  it('should record the hashes under the domain key', async () => {
    await writeStamp(TARGET, GOVERNANCE, { 'a.md': 'sha256:aa' }, NOW)

    expect(readStamp(TARGET)?.domains.governance?.files).toEqual({
      'a.md': 'sha256:aa',
    })
  })

  it('should preserve other domains when one domain is rewritten', async () => {
    await writeStamp(TARGET, GOVERNANCE, { 'a.md': 'sha256:aa' }, NOW)
    await writeStamp(TARGET, TOOLING, { 'b.md': 'sha256:bb' }, NOW)

    const stamp = readStamp(TARGET)

    expect(stamp?.domains.governance?.files).toEqual({ 'a.md': 'sha256:aa' })
    expect(stamp?.domains.tooling?.files).toEqual({ 'b.md': 'sha256:bb' })
  })

  it('should replace a domain rather than merge into it', async () => {
    await writeStamp(TARGET, GOVERNANCE, { 'old.md': 'sha256:aa' }, NOW)
    await writeStamp(TARGET, GOVERNANCE, { 'new.md': 'sha256:bb' }, NOW)

    expect(readStamp(TARGET)?.domains.governance?.files).toEqual({
      'new.md': 'sha256:bb',
    })
  })

  it('should sort file keys so a re-sync produces no diff', async () => {
    await writeStamp(
      TARGET,
      GOVERNANCE,
      { 'z.md': 'sha256:zz', 'a.md': 'sha256:aa' },
      NOW,
    )

    const domains = readRaw(TARGET).domains as Record<
      string,
      { files: Record<string, string> }
    >

    expect(Object.keys(domains.governance.files)).toEqual(['a.md', 'z.md'])
  })

  it('should name only the domains actually stamped', async () => {
    await writeStamp(TARGET, GOVERNANCE, {}, NOW)

    expect(readStamp(TARGET)?.covers).toEqual(['governance'])
  })

  it('should grow covers as each domain is stamped', async () => {
    await writeStamp(TARGET, TOOLING, {}, NOW)
    await writeStamp(TARGET, GOVERNANCE, {}, NOW)

    expect(readStamp(TARGET)?.covers).toEqual(['governance', 'tooling'])
  })

  it('should end the file with a newline', async () => {
    await writeStamp(TARGET, GOVERNANCE, {}, NOW)

    expect(readFileSync(stampPath(TARGET), 'utf8').endsWith('}\n')).toBe(true)
  })
})

describe('writeChainStamp', () => {
  it('should record the chain in the order it was given', async () => {
    await writeChainStamp(TARGET, TOOLING, ['vite-react', 'base'], NOW)

    expect(readStamp(TARGET)?.domains.tooling?.chain).toEqual([
      'vite-react',
      'base',
    ])
  })

  it('should record no file hashes, since tooling attributes none', async () => {
    await writeChainStamp(TARGET, TOOLING, ['base'], NOW)

    expect(readStamp(TARGET)?.domains.tooling?.files).toEqual({})
  })

  it('should add tooling to covers', async () => {
    await writeChainStamp(TARGET, TOOLING, ['base'], NOW)

    expect(readStamp(TARGET)?.covers).toEqual(['tooling'])
  })

  it('should leave the other domain records untouched', async () => {
    await writeStamp(TARGET, GOVERNANCE, { 'a.md': 'sha256:aa' }, NOW)
    await writeChainStamp(TARGET, TOOLING, ['base'], NOW)

    const stamp = readStamp(TARGET)

    expect(stamp?.domains.governance?.files).toEqual({ 'a.md': 'sha256:aa' })
    expect(stamp?.covers).toEqual(['governance', 'tooling'])
  })

  it('should replace an earlier chain rather than merge into it', async () => {
    await writeChainStamp(TARGET, TOOLING, ['vite-react', 'base'], NOW)
    await writeChainStamp(TARGET, TOOLING, ['base'], NOW)

    expect(readStamp(TARGET)?.domains.tooling?.chain).toEqual(['base'])
  })

  it('should record a single-stack chain for a domain other than tooling', async () => {
    await writeChainStamp(TARGET, GOVERNANCE, ['astro'], NOW)

    expect(readStamp(TARGET)?.domains.governance?.chain).toEqual(['astro'])
  })

  it('should preserve a file-only domain when the chain is written after', async () => {
    await writeStamp(TARGET, GOVERNANCE, { 'a.md': 'sha256:aa' }, NOW)
    await writeChainStamp(TARGET, GOVERNANCE, ['astro'], NOW)

    expect(readStamp(TARGET)?.domains.governance?.files).toEqual({
      'a.md': 'sha256:aa',
    })
  })

  it('should preserve a chain when a later file-only write does not name one', async () => {
    await writeChainStamp(TARGET, GOVERNANCE, ['astro'], NOW)
    await writeStamp(TARGET, GOVERNANCE, { 'a.md': 'sha256:aa' }, NOW)

    expect(readStamp(TARGET)?.domains.governance?.chain).toEqual(['astro'])
  })
})

describe('stampedChain', () => {
  it('should return an empty chain when the stamp is absent', () => {
    expect(stampedChain(undefined, 'tooling')).toEqual([])
  })

  it('should return an empty chain when only other domains are stamped', async () => {
    await writeStamp(TARGET, GOVERNANCE, {}, NOW)

    expect(stampedChain(readStamp(TARGET), 'tooling')).toEqual([])
  })

  it('should return the recorded chain', async () => {
    await writeChainStamp(TARGET, TOOLING, ['vite-react', 'base'], NOW)

    expect(stampedChain(readStamp(TARGET), 'tooling')).toEqual([
      'vite-react',
      'base',
    ])
  })
})

describe('stampedCommit', () => {
  it('should keep each domain anchor independent of the others', () => {
    writeFixture(
      stampPath(TARGET),
      JSON.stringify({
        covers: ['governance', 'tooling'],
        domains: {
          tooling: { commit: 'old1111', syncedAt: 'then', files: {} },
          governance: { commit: 'new2222', syncedAt: 'now', files: {} },
        },
      }),
    )

    const stamp = readStamp(TARGET)

    expect(stampedCommit(stamp, 'tooling')).toBe('old1111')
    expect(stampedCommit(stamp, 'governance')).toBe('new2222')
  })

  it('should not advance one domain anchor when another is rewritten', async () => {
    writeFixture(
      stampPath(TARGET),
      JSON.stringify({
        covers: ['governance'],
        domains: {
          governance: { commit: 'old1111', syncedAt: 'then', files: {} },
        },
      }),
    )

    await writeStamp(TARGET, TOOLING, {}, NOW)

    expect(stampedCommit(readStamp(TARGET), 'governance')).toBe('old1111')
  })

  it('should return undefined for an unstamped domain', () => {
    expect(stampedCommit(undefined, 'governance')).toBeUndefined()
  })
})

describe('stampedHashes', () => {
  it('should return an empty map when the stamp is absent', () => {
    expect(stampedHashes(undefined, 'governance')).toEqual({})
  })

  it('should return an empty map when the domain is unstamped', async () => {
    await writeStamp(TARGET, TOOLING, { 'a.md': 'sha256:aa' }, NOW)

    expect(stampedHashes(readStamp(TARGET), 'governance')).toEqual({})
  })

  it('should return an empty map for an adapter with no stamp domain', async () => {
    await writeStamp(TARGET, GOVERNANCE, { 'a.md': 'sha256:aa' }, NOW)

    expect(stampedHashes(readStamp(TARGET), undefined)).toEqual({})
  })
})
