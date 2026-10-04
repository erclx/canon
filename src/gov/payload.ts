import { readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { stripFrontmatter } from '@/markdown/frontmatter'

/**
 * Lists installed rules in the order the payload concatenates them. Sorting by
 * path keeps the numeric filename prefixes ordered inside each subdirectory,
 * which is how the rule bands are meant to read.
 */
export function listRuleFiles(rulesDir: string): string[] {
  return [
    ...new Bun.Glob('**/*.md').scanSync({
      cwd: rulesDir,
      onlyFiles: true,
      dot: true,
    }),
  ]
    .sort()
    .map((path) => resolve(rulesDir, path))
}

/**
 * Wraps each rule in a named tag so a model reading the payload can tell the
 * rules apart without the file boundaries. Bodies are trimmed of blank lines
 * at both ends and separated by exactly one blank line.
 */
export function buildRulesPayload(files: readonly string[]): string {
  const blocks = files.map((file) => {
    const name = basename(file, '.md')
    const body = trimBlankLines(stripFrontmatter(readFileSync(file, 'utf8')))
    return `<rule name="${name}">\n${body}\n</rule>`
  })

  return `${blocks.join('\n\n')}\n`
}

function trimBlankLines(source: string): string {
  return source.replace(/^(?:[ \t]*\n)+/, '').replace(/(?:\n[ \t]*)+$/, '')
}
