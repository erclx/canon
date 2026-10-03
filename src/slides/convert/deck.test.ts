import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DECK_FILE, readDeck } from '@/slides/convert/deck'

let folder: string

beforeEach(() => {
  folder = join(mkdtempSync(join(tmpdir(), 'canon-deck-')), 'quarterly')
  mkdirSync(folder)
})

afterEach(() => {
  rmSync(join(folder, '..'), { recursive: true, force: true })
})

const writeDeck = (value: unknown): void => {
  writeFileSync(
    join(folder, DECK_FILE),
    typeof value === 'string' ? value : JSON.stringify(value),
  )
}

describe('readDeck', () => {
  it('should default to the folder name as the title when no deck file exists', () => {
    const result = readDeck(folder)

    expect(result).toMatchObject({
      status: 'read',
      deck: { title: basename(folder) },
    })
  })

  it('should default to a footer carrying the title on the left', () => {
    const result = readDeck(folder)

    expect(result).toMatchObject({
      status: 'read',
      deck: { footer: { show: true, left: 'quarterly' } },
    })
  })

  it('should default to slide numbers on, no header, and no mark', () => {
    const result = readDeck(folder)

    expect(result).toMatchObject({
      status: 'read',
      deck: { slideNumbers: true, header: { show: false }, mark: undefined },
    })
  })

  it('should take the title and carry it into the default footer', () => {
    writeDeck({ title: 'Q3 review' })

    const result = readDeck(folder)

    expect(result).toMatchObject({
      status: 'read',
      deck: { title: 'Q3 review', footer: { left: 'Q3 review' } },
    })
  })

  it('should merge a declared band over its default', () => {
    writeDeck({ footer: { center: 'Internal' } })

    const result = readDeck(folder)

    expect(result).toMatchObject({
      status: 'read',
      deck: { footer: { show: true, left: 'quarterly', center: 'Internal' } },
    })
  })

  it('should turn the header on when it declares text', () => {
    writeDeck({ header: { left: 'Acme' } })

    const result = readDeck(folder)

    expect(result).toMatchObject({
      status: 'read',
      deck: { header: { show: true, left: 'Acme' } },
    })
  })

  it('should keep a band off when it says so', () => {
    writeDeck({ footer: { show: false } })

    const result = readDeck(folder)

    expect(result).toMatchObject({
      status: 'read',
      deck: { footer: { show: false } },
    })
  })

  it('should take slide numbers off', () => {
    writeDeck({ slideNumbers: false })

    const result = readDeck(folder)

    expect(result).toMatchObject({
      status: 'read',
      deck: { slideNumbers: false },
    })
  })

  it('should resolve the mark against the folder', () => {
    mkdirSync(join(folder, 'assets'))
    writeFileSync(join(folder, 'assets', 'mark.svg'), '<svg/>')
    writeDeck({ mark: 'assets/mark.svg' })

    const result = readDeck(folder)

    expect(result).toMatchObject({
      status: 'read',
      deck: { mark: join(folder, 'assets', 'mark.svg') },
    })
  })

  it('should refuse a mark that does not exist and name the path', () => {
    writeDeck({ mark: 'missing.svg' })

    const result = readDeck(folder)

    expect(result).toEqual({
      status: 'refused',
      field: 'mark',
      message: `${join(folder, DECK_FILE)}: mark ${join(folder, 'missing.svg')} does not exist`,
    })
  })

  it('should refuse a file that is not JSON', () => {
    writeDeck('{ title: ')

    const result = readDeck(folder)

    expect(result).toMatchObject({ status: 'refused', field: DECK_FILE })
  })

  it('should refuse a top level that is not an object', () => {
    writeDeck([])

    const result = readDeck(folder)

    expect(result).toMatchObject({ status: 'refused', field: DECK_FILE })
  })

  it('should refuse a title that is not a string', () => {
    writeDeck({ title: 3 })

    const result = readDeck(folder)

    expect(result).toMatchObject({ status: 'refused', field: 'title' })
  })

  it('should refuse a band that is not an object', () => {
    writeDeck({ header: 'on' })

    const result = readDeck(folder)

    expect(result).toMatchObject({ status: 'refused', field: 'header' })
  })

  it('should refuse a band slot that is not a string', () => {
    writeDeck({ footer: { left: 1 } })

    const result = readDeck(folder)

    expect(result).toMatchObject({ status: 'refused', field: 'footer.left' })
  })

  it('should refuse a band show that is not a boolean', () => {
    writeDeck({ footer: { show: 'yes' } })

    const result = readDeck(folder)

    expect(result).toMatchObject({ status: 'refused', field: 'footer.show' })
  })

  it('should refuse slide numbers that are not a boolean', () => {
    writeDeck({ slideNumbers: 'on' })

    const result = readDeck(folder)

    expect(result).toMatchObject({ status: 'refused', field: 'slideNumbers' })
  })

  it('should refuse a right footer slot while slide numbers hold it', () => {
    writeDeck({ footer: { right: 'Draft' } })

    const result = readDeck(folder)

    expect(result).toMatchObject({ status: 'refused', field: 'footer.right' })
  })

  it('should refuse an unknown field and name it', () => {
    writeDeck({ slideNumber: false })

    const result = readDeck(folder)

    expect(result).toMatchObject({ status: 'refused', field: 'slideNumber' })
  })

  it('should refuse an unknown band field and name it', () => {
    writeDeck({ footer: { middle: 'x' } })

    const result = readDeck(folder)

    expect(result).toMatchObject({ status: 'refused', field: 'footer.middle' })
  })
})

describe('readDeck fonts', () => {
  const writeFace = (path: string): void => {
    mkdirSync(join(folder, 'fonts'), { recursive: true })
    writeFileSync(join(folder, path), 'face')
  }

  it('should default to no fonts', () => {
    expect(readDeck(folder)).toMatchObject({ deck: { fonts: [] } })
  })

  it('should resolve a face against the folder and keep the path as written', () => {
    writeFace('fonts/sans-bold.ttf')
    writeDeck({
      fonts: [{ family: 'Sans', weight: 700, path: 'fonts/sans-bold.ttf' }],
    })

    const result = readDeck(folder)

    expect(result).toMatchObject({
      status: 'read',
      deck: {
        fonts: [
          {
            family: 'Sans',
            weight: 700,
            style: 'normal',
            path: join(folder, 'fonts', 'sans-bold.ttf'),
            source: 'fonts/sans-bold.ttf',
          },
        ],
      },
    })
  })

  it('should default a face to weight 400', () => {
    writeFace('fonts/sans.ttf')
    writeDeck({ fonts: [{ family: 'Sans', path: 'fonts/sans.ttf' }] })

    expect(readDeck(folder)).toMatchObject({
      deck: { fonts: [{ weight: 400 }] },
    })
  })

  it('should refuse a face path outside the deck folder', () => {
    writeFileSync(join(folder, '..', 'outside.ttf'), 'face')
    writeDeck({ fonts: [{ family: 'Sans', path: '../outside.ttf' }] })

    const result = readDeck(folder)

    expect(result).toMatchObject({
      status: 'refused',
      field: 'fonts[0].path',
      message: `${join(folder, DECK_FILE)}: fonts[0].path ../outside.ttf lies outside the deck folder`,
    })
  })

  it('should refuse a face that does not exist', () => {
    writeDeck({ fonts: [{ family: 'Sans', path: 'fonts/missing.ttf' }] })

    expect(readDeck(folder)).toMatchObject({
      status: 'refused',
      field: 'fonts[0].path',
    })
  })

  it('should refuse a face with no family', () => {
    writeFace('fonts/sans.ttf')
    writeDeck({ fonts: [{ path: 'fonts/sans.ttf' }] })

    expect(readDeck(folder)).toMatchObject({
      status: 'refused',
      field: 'fonts[0].family',
    })
  })

  it('should refuse a style other than normal or italic', () => {
    writeFace('fonts/sans.ttf')
    writeDeck({
      fonts: [{ family: 'Sans', style: 'oblique', path: 'fonts/sans.ttf' }],
    })

    expect(readDeck(folder)).toMatchObject({
      status: 'refused',
      field: 'fonts[0].style',
    })
  })

  it('should refuse a weight outside 1 to 1000', () => {
    writeFace('fonts/sans.ttf')
    writeDeck({
      fonts: [{ family: 'Sans', weight: 1200, path: 'fonts/sans.ttf' }],
    })

    expect(readDeck(folder)).toMatchObject({
      status: 'refused',
      field: 'fonts[0].weight',
    })
  })

  it('should refuse an unknown face field and name it', () => {
    writeFace('fonts/sans.ttf')
    writeDeck({ fonts: [{ family: 'Sans', path: 'fonts/sans.ttf', size: 1 }] })

    expect(readDeck(folder)).toMatchObject({
      status: 'refused',
      field: 'fonts[0].size',
    })
  })
})
