import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

/**
 * The heading a rule carries to publish its degradation list. Discovery is
 * anchored on it rather than a numbered filename, since a renumber would
 * silently empty the vocabulary while the sweep kept reporting clean.
 */
export const VOCABULARY_HEADING = '## Degradation vocabulary'

/**
 * Roots searched in order. The installed copy wins over the toolkit source, so
 * a target project measures against the rule it actually has rather than one
 * only the toolkit carries.
 */
const RULE_ROOTS = ['.claude/rules', 'governance/rules']

/**
 * Absent is a distinct state from empty. A sweep with no vocabulary finds
 * nothing, and reporting that as zero hits would claim a clean codebase when
 * nothing was looked for, so the command reports it as skipped.
 */
export type Vocabulary =
  | {
      readonly kind: 'loaded'
      readonly source: string
      readonly terms: string[]
    }
  | { readonly kind: 'absent' }

/** Pulls the backticked terms out of the bullets under the vocabulary heading. */
export function parseVocabulary(markdown: string): string[] | undefined {
  const lines = markdown.split('\n')
  const start = lines.findIndex((line) => line.trim() === VOCABULARY_HEADING)
  if (start === -1) return undefined

  const terms: string[] = []

  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) break
    for (const match of line.matchAll(/`([^`]+)`/g)) {
      const term = match[1].trim()
      if (term && !terms.includes(term)) terms.push(term)
    }
  }

  return terms
}

/**
 * Finds the rule publishing the vocabulary under `root`. Reading the list out of
 * the rule keeps one definition when the rule installs into a target, as
 * `canon markdown audit` owns one copy of the ban sets.
 */
export async function loadVocabulary(root: string): Promise<Vocabulary> {
  for (const ruleRoot of RULE_ROOTS) {
    const dir = resolve(root, ruleRoot)
    if (!existsSync(dir)) continue

    const paths: string[] = []
    for await (const rel of new Bun.Glob('**/*.md').scan({
      cwd: dir,
      onlyFiles: true,
    })) {
      paths.push(rel)
    }
    paths.sort()

    for (const rel of paths) {
      const parsed = parseVocabulary(await readFile(resolve(dir, rel), 'utf8'))
      if (parsed && parsed.length > 0) {
        return { kind: 'loaded', source: `${ruleRoot}/${rel}`, terms: parsed }
      }
    }
  }

  return { kind: 'absent' }
}
