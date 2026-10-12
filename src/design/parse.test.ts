import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseDesignDoc } from '@/design/parse'

let root: string

const write = (body: string): string => {
  const path = join(root, 'DESIGN.md')
  writeFileSync(path, body)
  return path
}

const colorDoc = (rows: string[]): string =>
  [
    '# Design',
    '',
    '## Colors',
    '',
    '| Role | Intent | Value |',
    '| ---- | ------ | ----- |',
    ...rows,
    '',
  ].join('\n')

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'design-parse-'))
})

afterEach(() => {
  rmSync(root, { force: true, recursive: true })
})

describe('parseDesignDoc', () => {
  it('should keep an untagged cell as its literal value', () => {
    const path = write(colorDoc(['| accent | primary action | #e0724b |']))

    const doc = parseDesignDoc(path)

    expect(doc.color[0]['Value']).toEqual({
      tagged: false,
      value: '#e0724b',
    })
  })

  it('should split the bare tag off the value it marks', () => {
    const path = write(
      colorDoc(['| border | panel edges | #E4DCD0 ? verify |']),
    )

    const doc = parseDesignDoc(path)

    expect(doc.color[0]['Value']).toEqual({
      tagged: true,
      value: '#E4DCD0',
    })
  })

  it('should detect the tag inside a code span rather than passing it through', () => {
    const path = write(
      colorDoc(['| border | panel edges | `#E4DCD0 ? verify` |']),
    )

    const doc = parseDesignDoc(path)

    expect(doc.color[0]['Value']).toEqual({
      tagged: true,
      value: '`#E4DCD0`',
    })
  })

  it('should tag a cell whose whole content is the marker', () => {
    const path = write(colorDoc(['| pill | status chips | ? verify |']))

    const doc = parseDesignDoc(path)

    expect(doc.color[0]['Value']).toEqual({ tagged: true, value: '' })
  })

  it('should tag any column, not only the value column', () => {
    const path = write(
      colorDoc(['| pill ? verify | status chips ? verify | #ffffff |']),
    )

    const doc = parseDesignDoc(path)

    expect(doc.color[0]['Role'].tagged).toBe(true)
    expect(doc.color[0]['Intent'].tagged).toBe(true)
    expect(doc.color[0]['Value'].tagged).toBe(false)
  })

  it('should strip a tag from a header so the column key stays readable', () => {
    const path = write(
      [
        '# Design',
        '',
        '## Colors',
        '',
        '| Role | Intent | Value ? verify |',
        '| ---- | ------ | -------------- |',
        '| accent | primary action | #e0724b |',
        '',
      ].join('\n'),
    )

    const doc = parseDesignDoc(path)

    expect(doc.color[0]['Value'].value).toBe('#e0724b')
  })

  it('should tag two cells in one row independently of each other', () => {
    const path = write(
      [
        '# Design',
        '',
        '## Typography',
        '',
        '| Role | Family | Weight | Size | Line height |',
        '| ---- | ------ | ------ | ---- | ----------- |',
        '| label | monospace | 400 ? verify | 12px | 1.45 ? verify |',
        '',
      ].join('\n'),
    )

    const doc = parseDesignDoc(path)

    expect(doc.typography[0]['Weight']).toEqual({ tagged: true, value: '400' })
    expect(doc.typography[0]['Line height']).toEqual({
      tagged: true,
      value: '1.45',
    })
    expect(doc.typography[0]['Size']).toEqual({ tagged: false, value: '12px' })
  })

  it('should leave a prose section untouched by the table parse', () => {
    const path = write(
      ['# Design', '', '## Motion', '', 'Motion is not used.', ''].join('\n'),
    )

    const doc = parseDesignDoc(path)

    expect(doc.motion).toBe('Motion is not used.')
  })

  it('should keep the prose of a record carrying no table', () => {
    const path = write(
      [
        '# Design',
        '',
        '## Overview',
        '',
        'Calm and exact.',
        '',
        '## Colors',
        '',
        '- One accent, used for the primary action alone.',
        '',
        '## Typography',
        '',
        '- Two sizes on any one screen.',
        '',
      ].join('\n'),
    )

    const doc = parseDesignDoc(path)

    expect(doc.personality).toBe('Calm and exact.')
    expect(doc.color).toEqual([])
    expect(doc.typography).toEqual([])
    expect(doc.spacing).toEqual([])
    expect(doc.borders).toEqual([])
  })

  it('should read an intent table that carries no value column', () => {
    const path = write(
      [
        '# Design',
        '',
        '## Colors',
        '',
        '| Role | Intent |',
        '| ---- | ------ |',
        '| accent | primary action |',
        '',
      ].join('\n'),
    )

    const doc = parseDesignDoc(path)

    expect(doc.color[0]['Intent'].value).toBe('primary action')
    expect(doc.color[0]['Value']).toBeUndefined()
  })

  it('should resolve the legacy headings to the sections they were renamed to', () => {
    const path = write(
      [
        '# Design',
        '',
        '## Personality',
        '',
        'Calm and exact.',
        '',
        '## Color',
        '',
        '| Role | Intent | Value |',
        '| ---- | ------ | ----- |',
        '| accent | primary action | #e0724b |',
        '',
        '## Borders',
        '',
        '| Role | When used |',
        '| ---- | --------- |',
        '| panel | cards |',
        '',
      ].join('\n'),
    )

    const doc = parseDesignDoc(path)

    expect(doc.personality).toBe('Calm and exact.')
    expect(doc.color[0]['Value'].value).toBe('#e0724b')
    expect(doc.borders[0]['When used'].value).toBe('cards')
  })
})
