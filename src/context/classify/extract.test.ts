import { execaSync } from 'execa'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  docTypeOf,
  extractDiffChunks,
  extractSweepSections,
  MIN_ADDED_WORDS,
  sectionAround,
  sweepSections,
} from '@/context/classify/extract'
import { gitEnv } from '@/git-env'

const LONG_PARAGRAPH = Array.from(
  { length: MIN_ADDED_WORDS + 5 },
  (_, i) => `word${i}`,
).join(' ')

describe('docTypeOf', () => {
  it('should classify each of the five canonical doc paths', () => {
    expect(docTypeOf('canon/context/cli/audits.md')).toBe('context')
    expect(docTypeOf('canon/ARCHITECTURE.md')).toBe('architecture')
    expect(docTypeOf('.claude/wireframes/answer.md')).toBe('wireframes')
    expect(docTypeOf('canon/DESIGN.md')).toBe('design')
    expect(docTypeOf('canon/REQUIREMENTS.md')).toBe('requirements')
  })

  it('should exclude an index.md even under a matching folder', () => {
    expect(docTypeOf('canon/context/index.md')).toBeUndefined()
  })

  it('should classify no doc type for a path outside the five surfaces', () => {
    expect(docTypeOf('src/context/classify/extract.ts')).toBeUndefined()
    expect(docTypeOf('README.md')).toBeUndefined()
  })
})

describe('sectionAround', () => {
  it('should return the enclosing heading through the next same-level heading', () => {
    const lines = ['# Title', '', '## First', 'a', '## Second', 'b', 'c']

    expect(sectionAround(lines, 3)).toBe('## First\na')
  })

  it('should stop at a shallower heading, not a deeper one', () => {
    const lines = ['## Second', 'intro', '### Sub', 'body', '## Third']

    expect(sectionAround(lines, 3)).toBe('### Sub\nbody')
  })

  it('should return an empty string above the first heading', () => {
    expect(sectionAround(['no heading here', 'still none'], 1)).toBe('')
  })
})

describe('sweepSections', () => {
  it('should treat each H2 as one section when it carries no H3 children', () => {
    const lines = ['## First', 'a', 'b', '## Second', 'c']

    const sections = sweepSections(lines)

    expect(sections).toEqual([
      { heading: 'First', body: '## First\na\nb' },
      { heading: 'Second', body: '## Second\nc' },
    ])
  })

  it('should split at H3 when the H2 carries children, dropping an empty H2 preamble', () => {
    const lines = ['## Parent', '### A', 'a', '### B', 'b']

    const sections = sweepSections(lines)

    expect(sections).toEqual([
      { heading: 'A', body: '### A\na' },
      { heading: 'B', body: '### B\nb' },
    ])
  })

  it('should keep an H2 preamble as its own section when it carries content', () => {
    const lines = ['## Parent', 'intro text', '### A', 'a']

    const sections = sweepSections(lines)

    expect(sections).toEqual([
      { heading: 'Parent', body: '## Parent\nintro text' },
      { heading: 'A', body: '### A\na' },
    ])
  })

  it('should sweep every H3 as its own section in a document with no H2 at all', () => {
    const lines = ['# Title', '', '### First', 'a', '### Second', 'b']

    const sections = sweepSections(lines)

    expect(sections).toEqual([
      { heading: 'First', body: '### First\na' },
      { heading: 'Second', body: '### Second\nb' },
    ])
  })

  it('should sweep an H3 that sits before the first H2 in the document', () => {
    const lines = ['### Early', 'a', '## Two', 'b']

    const sections = sweepSections(lines)

    expect(sections).toEqual([
      { heading: 'Early', body: '### Early\na' },
      { heading: 'Two', body: '## Two\nb' },
    ])
  })
})

let ROOT: string

function git(...args: string[]): string {
  return execaSync('git', ['-C', ROOT, ...args], {
    env: gitEnv(),
    extendEnv: false,
  }).stdout
}

function write(path: string, body: string): void {
  const full = join(ROOT, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, `${body}\n`)
}

function commit(message: string, files: Record<string, string>): void {
  for (const [path, body] of Object.entries(files)) write(path, body)
  git('add', '--all')
  git('commit', '-m', message)
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-classify-extract-'))
  git('init', '--initial-branch=main')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'Test')
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('extractDiffChunks', () => {
  it('should refuse a range with no resolvable base', async () => {
    commit('chore: init', { 'README.md': 'seed' })

    const result = await extractDiffChunks(ROOT, 'not-a-real-ref')

    expect(result.kind).toBe('refused')
    if (result.kind === 'refused') expect(result.reason).toBe('bad-range')
  })

  it('should extract an added chunk with its enclosing section', async () => {
    commit('chore: init', {
      'canon/context/example.md': '## Overview\nOriginal line.\n',
    })
    write(
      'canon/context/example.md',
      `## Overview\nOriginal line.\n\n${LONG_PARAGRAPH}\n`,
    )

    const result = await extractDiffChunks(ROOT, 'HEAD')

    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    expect(result.chunks).toHaveLength(1)
    expect(result.chunks[0].file).toBe('canon/context/example.md')
    expect(result.chunks[0].docType).toBe('context')
    expect(result.chunks[0].added).toContain('word0')
    expect(result.chunks[0].sectionAfter).toContain('## Overview')
  })

  it('should drop a hunk shorter than the minimum added word count', async () => {
    commit('chore: init', {
      'canon/context/example.md': '## Overview\nOriginal line.\n',
    })
    write(
      'canon/context/example.md',
      '## Overview\nOriginal line.\ntiny addition\n',
    )

    const result = await extractDiffChunks(ROOT, 'HEAD')

    expect(result.kind).toBe('ok')
    if (result.kind === 'ok') expect(result.chunks).toHaveLength(0)
  })

  it('should ignore a change outside the five canonical doc types', async () => {
    commit('chore: init', { 'src/index.ts': 'export const x = 1\n' })
    write('src/index.ts', `export const x = 1\n// ${LONG_PARAGRAPH}\n`)

    const result = await extractDiffChunks(ROOT, 'HEAD')

    expect(result.kind).toBe('ok')
    if (result.kind === 'ok') expect(result.chunks).toHaveLength(0)
  })

  it('should narrow to the requested doc types', async () => {
    commit('chore: init', {
      'canon/context/example.md': '## Overview\nOriginal.\n',
      'canon/DESIGN.md': '## Spacing\nOriginal.\n',
    })
    write('canon/context/example.md', `## Overview\n${LONG_PARAGRAPH}\n`)
    write('canon/DESIGN.md', `## Spacing\n${LONG_PARAGRAPH}\n`)

    const result = await extractDiffChunks(ROOT, 'HEAD', ['design'])

    expect(result.kind).toBe('ok')
    if (result.kind === 'ok') {
      expect(result.chunks).toHaveLength(1)
      expect(result.chunks[0].docType).toBe('design')
    }
  })
})

describe('extractSweepSections', () => {
  it('should sweep every requested doc type across the project', async () => {
    mkdirSync(join(ROOT, 'canon', 'context'), { recursive: true })
    writeFileSync(join(ROOT, 'canon', 'context', 'index.md'), '# Context\n')
    writeFileSync(
      join(ROOT, 'canon', 'context', 'example.md'),
      '# Example\n\n## Overview\nCurrent state.\n\n## Layout\nMore.\n',
    )
    writeFileSync(
      join(ROOT, 'canon', 'ARCHITECTURE.md'),
      '## Decision\nText.\n',
    )
    writeFileSync(join(ROOT, 'canon', 'DESIGN.md'), '## Spacing\nTokens.\n')
    writeFileSync(join(ROOT, 'canon', 'REQUIREMENTS.md'), '## Goals\nText.\n')

    const result = await extractSweepSections(ROOT)

    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    const headings = result.sections.map((s) => `${s.docType}:${s.heading}`)
    expect(headings).toContain('context:Overview')
    expect(headings).toContain('context:Layout')
    expect(headings).toContain('architecture:Decision')
    expect(headings).toContain('design:Spacing')
    expect(headings).toContain('requirements:Goals')
  })

  it('should narrow the sweep to the requested doc types', async () => {
    mkdirSync(join(ROOT, 'canon'), { recursive: true })
    writeFileSync(join(ROOT, 'canon', 'DESIGN.md'), '## Spacing\nTokens.\n')
    writeFileSync(join(ROOT, 'canon', 'REQUIREMENTS.md'), '## Goals\nText.\n')

    const result = await extractSweepSections(ROOT, ['design'])

    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    expect(result.sections.every((s) => s.docType === 'design')).toBe(true)
    expect(result.sections.length).toBeGreaterThan(0)
  })
})
