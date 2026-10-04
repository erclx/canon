import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { creationRel, recordDir } from '@/record-root'
import { readDeck } from '@/slides/convert/deck'

/**
 * A deck is a folder under the record root's `slides/`, holding its `.html`
 * slides, an optional `deck.json`, and its assets. `layouts/` beside the decks
 * holds the project's shared layouts and is never a deck itself.
 */
export const SLIDES_FOLDER = 'slides'

export const LAYOUTS_FOLDER = 'layouts'

export interface Deck {
  readonly name: string
  /** From `deck.json`, falling back to the folder name as the export does. */
  readonly title: string
  readonly slides: number
  /** Relative to the project root. */
  readonly path: string
}

export type DeckRefusal = 'no-decks' | 'ambiguous' | 'no-deck'

export type DeckResolution =
  | { readonly status: 'resolved'; readonly dir: string }
  | {
      readonly status: 'refused'
      readonly reason: DeckRefusal
      readonly message: string
    }

/** Every `.html` file directly in the folder, in filename order. */
export function slideFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((name) => join(dir, name))
}

export function listDecks(root: string): Deck[] {
  const dir = recordDir(root, SLIDES_FOLDER)
  if (!isDirectory(dir)) return []

  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== LAYOUTS_FOLDER)
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))
    .flatMap((name) => {
      const deckDir = join(dir, name)
      const slides = slideFiles(deckDir).length
      if (slides === 0) return []
      const read = readDeck(deckDir)
      const title = read.status === 'read' ? read.deck.title : name
      return [{ name, title, slides, path: relative(root, deckDir) }]
    })
}

/**
 * The folder `render` reads. A deck name wins over a folder of the same name
 * relative to the root, and no name at all takes the only deck there is.
 */
export function resolveDeck(
  root: string,
  target: string | undefined,
): DeckResolution {
  const decks = listDecks(root)
  const at = creationRel(root, SLIDES_FOLDER)

  if (target === undefined) {
    const [only, ...rest] = decks
    if (only === undefined) {
      return refuse('no-decks', `No deck under ${at}/. Draw one there first.`)
    }
    if (rest.length > 0) {
      return refuse(
        'ambiguous',
        `${decks.length} decks under ${at}/, name one: ${names(decks)}`,
      )
    }
    return { status: 'resolved', dir: join(root, only.path) }
  }

  const named = decks.find((deck) => deck.name === target)
  if (named) return { status: 'resolved', dir: join(root, named.path) }

  const folder = resolve(root, target)
  if (isDirectory(folder)) return { status: 'resolved', dir: folder }

  return refuse(
    'no-deck',
    decks.length === 0
      ? `${target} is neither a deck under ${at}/ nor a folder`
      : `${target} is neither a deck nor a folder. Decks: ${names(decks)}`,
  )
}

function names(decks: readonly Deck[]): string {
  return decks.map((deck) => deck.name).join(', ')
}

function refuse(reason: DeckRefusal, message: string): DeckResolution {
  return { status: 'refused', reason, message }
}

function isDirectory(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory()
}
