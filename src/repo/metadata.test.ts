import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  compareMetadata,
  type CurrentMetadata,
  extractOpeningLine,
  isValidTopic,
  proposeMetadata,
} from '@/repo/metadata'

let ROOT: string

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-repo-metadata-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

function seedReadme(text: string): void {
  writeFileSync(join(ROOT, 'README.md'), text)
}

function seedManifest(manifest: unknown): void {
  writeFileSync(join(ROOT, 'package.json'), JSON.stringify(manifest))
}

describe('extractOpeningLine', () => {
  it('should skip the title and badges to reach the opening sentence', () => {
    const readme = [
      '# canon',
      '',
      '[![npm version](https://img.shields.io/npm/v/x)](https://npmjs.com/x)',
      '',
      'One source for your repos conventions.',
      '',
      '![hero](assets/evidence/hero.png)',
    ].join('\n')

    expect(extractOpeningLine(readme)).toBe(
      'One source for your repos conventions.',
    )
  })

  it('should strip inline markdown from the opening line', () => {
    expect(
      extractOpeningLine('# x\n\n**Bold** and `code` and [a link](x).'),
    ).toBe('Bold and code and a link.')
  })

  it('should return undefined for a file carrying only a title', () => {
    expect(extractOpeningLine('# canon\n')).toBeUndefined()
  })

  it('should return undefined for a title followed only by badges', () => {
    const readme = [
      '# canon',
      '',
      '[![npm](https://img.shields.io/npm/v/x)](https://npmjs.com/x)',
    ].join('\n')

    expect(extractOpeningLine(readme)).toBeUndefined()
  })

  it('should truncate a line past the About field length', () => {
    const line = 'x'.repeat(400)
    const result = extractOpeningLine(`# t\n\n${line}`)
    expect(result?.length).toBe(350)
    expect(result?.endsWith('…')).toBe(true)
  })
})

describe('isValidTopic', () => {
  it('should accept lowercase alphanumeric and internal hyphens', () => {
    expect(isValidTopic('cli-tool')).toBe(true)
  })

  it('should reject a space', () => {
    expect(isValidTopic('foo bar')).toBe(false)
  })

  it('should reject an uppercase letter', () => {
    expect(isValidTopic('Governance')).toBe(false)
  })

  it('should reject an empty string', () => {
    expect(isValidTopic('')).toBe(false)
  })
})

describe('proposeMetadata', () => {
  it('should propose nothing when the tree carries neither file', async () => {
    expect(await proposeMetadata(ROOT)).toEqual({})
  })

  it('should propose a description from the README alone', async () => {
    seedReadme('# canon\n\nOne source for conventions.\n')

    expect(await proposeMetadata(ROOT)).toEqual({
      description: 'One source for conventions.',
    })
  })

  it('should propose a homepage and topics from package.json keywords', async () => {
    seedManifest({
      name: 'x',
      homepage: ' https://erclx.dev ',
      keywords: ['CLI-Tool', 'governance', 'not a topic', 'governance'],
    })

    expect(await proposeMetadata(ROOT)).toEqual({
      homepage: 'https://erclx.dev',
      topics: ['cli-tool', 'governance'],
    })
  })

  it('should propose no topics from an empty or absent keywords field', async () => {
    seedManifest({ name: 'x' })
    expect(await proposeMetadata(ROOT)).toEqual({})
  })

  it('should propose no homepage from a blank field', async () => {
    seedManifest({ name: 'x', homepage: '   ' })
    expect(await proposeMetadata(ROOT)).toEqual({})
  })

  it('should propose no homepage from a non-string field', async () => {
    seedManifest({ name: 'x', homepage: 42 })
    expect(await proposeMetadata(ROOT)).toEqual({})
  })
})

describe('compareMetadata', () => {
  const current: CurrentMetadata = {
    description: 'old text',
    homepage: 'https://old.example',
    topics: ['old-topic', 'shared'],
  }

  it('should report no difference when nothing was proposed', () => {
    expect(compareMetadata(current, {})).toEqual({})
  })

  it('should report no difference when the proposal already matches', () => {
    expect(
      compareMetadata(current, {
        description: 'old text',
        homepage: 'https://old.example',
        topics: ['shared', 'old-topic'],
      }),
    ).toEqual({})
  })

  it('should report a description and homepage change', () => {
    expect(
      compareMetadata(current, {
        description: 'new text',
        homepage: 'https://new.example',
      }),
    ).toEqual({
      description: { current: 'old text', proposed: 'new text' },
      homepage: {
        current: 'https://old.example',
        proposed: 'https://new.example',
      },
    })
  })

  it('should report added and removed topics without touching an unmentioned field', () => {
    expect(
      compareMetadata(current, { topics: ['shared', 'new-topic'] }),
    ).toEqual({
      topics: { added: ['new-topic'], removed: ['old-topic'] },
    })
  })

  it('should never propose clearing topics the remote carries when the manifest declares none', () => {
    expect(compareMetadata(current, {})).toEqual({})
  })
})
