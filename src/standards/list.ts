import { readFileSync } from 'node:fs'
import { parseFrontmatter, readField } from '@/indexes/frontmatter'
import { resolveAllStandards } from '@/standards/read'
import { appliesTo } from '@/standards/scope'

export interface StandardEntry {
  readonly name: string
  readonly description: string
  readonly appliesTo: string[]
  /** The whole file, frontmatter included. */
  readonly content: string
  /** The root-labeled path `canon standards <name>` would read. */
  readonly source: string
}

/**
 * Lists every standard a resolve reaches, the first root winning, so a project
 * standard shows beside the toolkit's and a local override of a package name
 * shows once, as the local copy.
 */
export function listStandardEntries(root: string): StandardEntry[] {
  return resolveAllStandards(root).map(({ name, path, source }) => {
    const content = readFileSync(path, 'utf8')

    return {
      name,
      description: readField(parseFrontmatter(content), 'description') ?? '',
      appliesTo: appliesTo(content),
      content,
      source,
    }
  })
}
