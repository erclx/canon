import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listDecks, resolveDeck, slideFiles } from '@/slides/decks'

let ROOT = ''

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-slides-decks-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

function deckDir(name: string): string {
  return join(ROOT, '.canon', 'slides', name)
}

function writeDeck(
  name: string,
  slides: readonly string[],
  deck?: Record<string, unknown>,
): string {
  const dir = deckDir(name)
  mkdirSync(dir, { recursive: true })
  for (const slide of slides) {
    writeFileSync(join(dir, slide), '<html><body></body></html>')
  }
  if (deck) writeFileSync(join(dir, 'deck.json'), JSON.stringify(deck))
  return dir
}

describe('listDecks', () => {
  it('should list nothing when the slides folder does not exist', () => {
    expect(listDecks(ROOT)).toEqual([])
  })

  it('should list each deck folder with its title, slide count, and path', () => {
    writeDeck('roadmap', ['01.html', '02.html'], { title: 'Roadmap 2027' })
    writeDeck('kickoff', ['01.html'])

    expect(listDecks(ROOT)).toEqual([
      {
        name: 'kickoff',
        title: 'kickoff',
        slides: 1,
        path: join('.canon', 'slides', 'kickoff'),
      },
      {
        name: 'roadmap',
        title: 'Roadmap 2027',
        slides: 2,
        path: join('.canon', 'slides', 'roadmap'),
      },
    ])
  })

  it('should skip the shared layouts folder even when it holds slides', () => {
    writeDeck('layouts', ['cover.html'])

    expect(listDecks(ROOT)).toEqual([])
  })

  it('should skip a folder that holds no slide', () => {
    writeDeck('assets-only', [])
    writeFileSync(join(deckDir('assets-only'), 'notes.md'), '# notes')

    expect(listDecks(ROOT)).toEqual([])
  })
})

describe('slideFiles', () => {
  it('should order slides by filename with numbers compared as numbers', () => {
    const dir = writeDeck('order', ['10.html', '2.html', '1.html'])

    expect(slideFiles(dir)).toEqual([
      join(dir, '1.html'),
      join(dir, '2.html'),
      join(dir, '10.html'),
    ])
  })
})

describe('resolveDeck', () => {
  it('should resolve the only deck when no name is given', () => {
    const dir = writeDeck('solo', ['01.html'])

    expect(resolveDeck(ROOT, undefined)).toEqual({ status: 'resolved', dir })
  })

  it('should refuse naming the slides folder when there is no deck', () => {
    expect(resolveDeck(ROOT, undefined)).toMatchObject({
      status: 'refused',
      reason: 'no-decks',
      message: expect.stringContaining(join('.canon', 'slides')),
    })
  })

  it('should refuse listing every deck when several exist and none is named', () => {
    writeDeck('alpha', ['01.html'])
    writeDeck('beta', ['01.html'])

    expect(resolveDeck(ROOT, undefined)).toMatchObject({
      status: 'refused',
      reason: 'ambiguous',
      message: expect.stringContaining('alpha, beta'),
    })
  })

  it('should resolve a deck by its name', () => {
    writeDeck('alpha', ['01.html'])
    const dir = writeDeck('beta', ['01.html'])

    expect(resolveDeck(ROOT, 'beta')).toEqual({ status: 'resolved', dir })
  })

  it('should resolve a folder path outside the slides folder', () => {
    const dir = join(ROOT, 'elsewhere')
    mkdirSync(dir)

    expect(resolveDeck(ROOT, 'elsewhere')).toEqual({ status: 'resolved', dir })
  })

  it('should refuse a name that is neither a deck nor a folder', () => {
    writeDeck('alpha', ['01.html'])

    expect(resolveDeck(ROOT, 'missing')).toMatchObject({
      status: 'refused',
      reason: 'no-deck',
    })
  })
})
