import { linesOutsideFences } from '@/markdown/scan'

const SCOPE_HEADING = /^##[ \t]+Scope[ \t]*$/
const ANY_HEADING = /^#{1,6}[ \t]+\S/
const CODE_SPAN = /`([^`]+)`/g

/** What an attribute standard says of itself, since it names no path. */
export const ATTRIBUTE_MARKER = 'attribute standard'

export interface Scope {
  /** The first non-blank line under the heading, which is the statement. */
  readonly statement: string
  readonly lines: readonly string[]
}

export function readScope(text: string): Scope | undefined {
  const lines = linesOutsideFences(text)
  const opened = lines.findIndex((line) => SCOPE_HEADING.test(line.trim()))
  if (opened === -1) return undefined

  const body: string[] = []

  for (const line of lines.slice(opened + 1)) {
    if (ANY_HEADING.test(line.trim())) break
    body.push(line)
  }

  const statement = body.find((line) => line.trim().length > 0)

  return { statement: statement?.trim() ?? '', lines: body }
}

/**
 * The paths a scope statement declares: backticked spans in the first sentence
 * alone. The catalog's `appliesTo` field and the records gate both read the
 * statement through this, since one sentence read two ways would let a standard
 * pass the gate while publishing a different jurisdiction to every consumer.
 */
export function governedPaths(statement: string): string[] {
  const [sentence] = statement.split('. ')
  return [...sentence.matchAll(CODE_SPAN)].map((match) => match[1])
}

/**
 * The jurisdiction a standard publishes. The marker is read only where the
 * first sentence backticks nothing, so a statement naming a path publishes that
 * path however the rest of it describes itself. An empty array means the
 * statement did not parse, which consumers report rather than skip.
 */
export function appliesTo(text: string): string[] {
  const statement = readScope(text)?.statement ?? ''
  const paths = governedPaths(statement)

  if (paths.length === 0 && statement.includes(ATTRIBUTE_MARKER)) return ['*']
  return paths
}
