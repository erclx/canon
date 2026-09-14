import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { measureWireframeStates } from '@/context/wireframe-states'

let ROOT: string

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-wireframe-states-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

const FRONTMATTER = '---\ntitle: Header\ndescription: Site header\n---\n\n'

function seedFolder(state: string): void {
  mkdirSync(join(ROOT, 'web', 'evidence', state), { recursive: true })
}

function wireframe(statesTable: string, extra = ''): string {
  return [
    `${FRONTMATTER}# Header`,
    '',
    '## Regions',
    '',
    '- Nav: the top of the page, full width',
    '',
    extra,
    '## States',
    '',
    statesTable,
    '',
    '## Behavior',
    '',
    '- Nothing changes on scroll.',
    '',
  ].join('\n')
}

describe('parsing the States table', () => {
  it('should match a table whose evidence folder exists', async () => {
    seedFolder('empty')
    const source = wireframe(
      [
        '| State   | Reached when | Shows      | Evidence                |',
        '| ------- | ------------ | ---------- | ------------------------ |',
        '| empty   | on load      | a spinner  | `web/evidence/empty/`    |',
      ].join('\n'),
    )

    const report = await measureWireframeStates(
      ROOT,
      'canon/wireframes/header.md',
      source,
    )

    expect(report.rows).toEqual([
      {
        line: expect.any(Number),
        state: 'empty',
        evidence: '`web/evidence/empty/`',
      },
    ])
    expect(report.missingFolders).toEqual([])
    expect(report.unlistedFolders).toEqual([])
  })

  it('should match columns reordered from the template, by header text', async () => {
    seedFolder('empty')
    const source = wireframe(
      [
        '| Evidence               | State   | Reached when | Shows     |',
        '| ------------------------ | ------- | ------------ | --------- |',
        '| `web/evidence/empty/`    | empty   | on load      | a spinner |',
      ].join('\n'),
    )

    const report = await measureWireframeStates(ROOT, 'header.md', source)

    expect(report.rows[0]?.state).toBe('empty')
    expect(report.missingFolders).toEqual([])
  })

  it('should report a state whose evidence folder does not exist', async () => {
    const source = wireframe(
      [
        '| State   | Reached when | Shows      | Evidence                |',
        '| ------- | ------------ | ---------- | ------------------------ |',
        '| empty   | on load      | a spinner  | `web/evidence/empty/`    |',
      ].join('\n'),
    )

    const report = await measureWireframeStates(ROOT, 'header.md', source)

    expect(report.missingFolders).toEqual([
      { line: expect.any(Number), state: 'empty', path: 'web/evidence/empty' },
    ])
  })

  it('should report a folder under a cited root that no row names', async () => {
    seedFolder('empty')
    seedFolder('answered')
    const source = wireframe(
      [
        '| State   | Reached when | Shows      | Evidence                |',
        '| ------- | ------------ | ---------- | ------------------------ |',
        '| empty   | on load      | a spinner  | `web/evidence/empty/`    |',
      ].join('\n'),
    )

    const report = await measureWireframeStates(ROOT, 'header.md', source)

    expect(report.unlistedFolders).toEqual([
      { root: 'web/evidence', folder: 'answered' },
    ])
  })

  it('should leave a not captured cell out of both readings', async () => {
    const source = wireframe(
      [
        '| State   | Reached when | Shows      | Evidence      |',
        '| ------- | ------------ | ---------- | -------------- |',
        '| empty   | on load      | a spinner  | not captured   |',
      ].join('\n'),
    )

    const report = await measureWireframeStates(ROOT, 'header.md', source)

    expect(report.missingFolders).toEqual([])
    expect(report.unlistedFolders).toEqual([])
  })

  it('should read nothing from an entry carrying no States heading', async () => {
    const source = `${FRONTMATTER}# Header\n\n## Regions\n\n- Nav: full width\n`

    const report = await measureWireframeStates(ROOT, 'header.md', source)

    expect(report.rows).toEqual([])
  })
})

describe('the sketch-with-evidence check', () => {
  it('should report a plaintext sketch sitting beside existing evidence', async () => {
    seedFolder('empty')
    const source = wireframe(
      [
        '| State   | Reached when | Shows      | Evidence                |',
        '| ------- | ------------ | ---------- | ------------------------ |',
        '| empty   | on load      | a spinner  | `web/evidence/empty/`    |',
      ].join('\n'),
      ['```plaintext', '| Nav |', '```', ''].join('\n'),
    )

    const report = await measureWireframeStates(ROOT, 'header.md', source)

    expect(report.sketchWithEvidence).toBe(true)
    expect(report.sketchLine).toBeDefined()
  })

  it('should not report a sketch for a layout with no captured evidence yet', async () => {
    const source = wireframe(
      [
        '| State   | Reached when | Shows      | Evidence      |',
        '| ------- | ------------ | ---------- | -------------- |',
        '| empty   | on load      | a spinner  | not captured   |',
      ].join('\n'),
      ['```plaintext', '| Nav |', '```', ''].join('\n'),
    )

    const report = await measureWireframeStates(ROOT, 'header.md', source)

    expect(report.sketchWithEvidence).toBe(false)
  })

  it('should read no sketch line from an entry with no plaintext fence', async () => {
    const source = wireframe(
      [
        '| State   | Reached when | Shows      | Evidence      |',
        '| ------- | ------------ | ---------- | -------------- |',
        '| empty   | on load      | a spinner  | not captured   |',
      ].join('\n'),
    )

    const report = await measureWireframeStates(ROOT, 'header.md', source)

    expect(report.sketchLine).toBeUndefined()
    expect(report.sketchWithEvidence).toBe(false)
  })
})
