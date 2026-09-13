import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readShipEntries, selectShipped } from '@/secrets/shipped'

let ROOT: string

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-shipped-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

function seedManifest(manifest: unknown): void {
  writeFileSync(join(ROOT, 'package.json'), JSON.stringify(manifest))
}

describe('readShipEntries', () => {
  it('should read the files field the package publishes', async () => {
    seedManifest({ name: 'x', files: ['src', 'docs', '!**/*.test.ts'] })

    expect(await readShipEntries(ROOT)).toEqual({
      kind: 'entries',
      entries: ['src', 'docs', '!**/*.test.ts'],
    })
  })

  /**
   * npm packs the whole tree when the field is absent, so this is the package
   * that ships the most rather than one that ships nothing. It reports its own
   * reason so no caller can turn it into an empty corpus.
   */
  it('should separate a manifest carrying no files field', async () => {
    seedManifest({ name: 'x' })

    expect(await readShipEntries(ROOT)).toEqual({ kind: 'no-files-field' })
  })

  it('should read an empty files list the same way as an absent one', async () => {
    seedManifest({ name: 'x', files: [] })

    expect(await readShipEntries(ROOT)).toEqual({ kind: 'no-files-field' })
  })

  /**
   * The one declaration that means a project publishes nothing, which the
   * files field alone cannot separate from one publishing everything.
   */
  it('should read a private manifest as publishing nothing', async () => {
    seedManifest({ name: 'x', private: true })

    expect(await readShipEntries(ROOT)).toEqual({ kind: 'no-publish' })
  })

  it('should read private ahead of a declared files field', async () => {
    seedManifest({ name: 'x', private: true, files: ['src'] })

    expect(await readShipEntries(ROOT)).toEqual({ kind: 'no-publish' })
  })

  it('should not read a non-boolean private as a declaration', async () => {
    seedManifest({ name: 'x', private: 'yes', files: ['src'] })

    expect(await readShipEntries(ROOT)).toEqual({
      kind: 'entries',
      entries: ['src'],
    })
  })

  it('should report a manifest that is not there', async () => {
    expect(await readShipEntries(ROOT)).toEqual({ kind: 'no-manifest' })
  })

  it('should report a manifest that does not parse', async () => {
    writeFileSync(join(ROOT, 'package.json'), '{ not json')

    expect(await readShipEntries(ROOT)).toEqual({ kind: 'no-manifest' })
  })
})

describe('selectShipped', () => {
  const FILES = [
    'src/cli.ts',
    'src/secrets/scan.ts',
    'src/secrets/scan.test.ts',
    'src/capture/run.ts',
    'scripts/core/regen-hero.sh',
    'scripts/sandbox/run.sh',
    'docs/index.md',
    'tsconfig.json',
    'canon/context/cli/audits.md',
  ]

  it('should keep a file under a shipped directory', () => {
    expect(selectShipped(FILES, ['docs'])).toEqual(['docs/index.md'])
  })

  it('should drop a file under no shipped entry', () => {
    expect(selectShipped(FILES, ['docs'])).not.toContain(
      'canon/context/cli/audits.md',
    )
  })

  it('should drop what a negated directory entry excludes', () => {
    expect(selectShipped(FILES, ['scripts', '!scripts/sandbox'])).toEqual([
      'scripts/core/regen-hero.sh',
    ])
  })

  it('should drop what a negated glob excludes', () => {
    expect(selectShipped(FILES, ['src/secrets', '!**/*.test.ts'])).toEqual([
      'src/secrets/scan.ts',
    ])
  })

  it('should keep a named file as well as a directory', () => {
    expect(selectShipped(FILES, ['tsconfig.json'])).toEqual(['tsconfig.json'])
  })

  it('should not treat a directory name as a prefix of a longer sibling', () => {
    expect(selectShipped(['source/a.ts', 'src/a.ts'], ['src'])).toEqual([
      'src/a.ts',
    ])
  })

  it('should apply every negation regardless of where it sits', () => {
    const entries = ['!**/*.test.ts', 'src']

    expect(selectShipped(FILES, entries)).toEqual([
      'src/capture/run.ts',
      'src/cli.ts',
      'src/secrets/scan.ts',
    ])
  })

  it('should report nothing when no entry matches', () => {
    expect(selectShipped(FILES, ['missing'])).toEqual([])
  })

  /**
   * npm packs these whether or not the field names them, so a corpus built
   * from the field alone would let a credential in one of them ship unseen.
   */
  it('should keep the root files npm packs regardless of the field', () => {
    const roots = ['package.json', 'README.md', 'LICENSE', 'src/a.ts']

    expect(selectShipped(roots, ['src'])).toEqual([
      'LICENSE',
      'README.md',
      'package.json',
      'src/a.ts',
    ])
  })

  it('should not treat a nested file of the same name as always packed', () => {
    expect(selectShipped(['docs/README.md'], ['src'])).toEqual([])
  })

  it('should still drop an always-packed file a negation excludes', () => {
    expect(selectShipped(['README.md'], ['src', '!README.md'])).toEqual([])
  })
})
