import { bodyLines, wordCount } from '@/markdown/scan'

/** The pre-compaction handoff takes one file per session, so its stems vary. */
export const SESSION_MAP_PREFIX = 'session-'

/**
 * The most words a session map holds, which `session.md` states as
 * `at most 350 words`. It lives here rather than being read off the standard
 * because a consumer project loads skills from the plugin cache and carries no
 * `session.md` to read, so a test pins the two to one number instead.
 */
export const SESSION_MAP_WORD_CAP = 350

/**
 * The closing block a role mandates, read by the resuming session rather than
 * written from what this one learned, so it is left out of the count by name.
 */
const RESUME_HEADING = '## Resume'

const TITLE = /^#[ \t]+\S/
const H2 = /^##[ \t]+\S/

export interface SessionMapLength {
  /** The map's filename inside the tasks folder. */
  readonly record: string
  readonly words: number
  readonly cap: number
  readonly over: boolean
}

export function isSessionMap(name: string): boolean {
  return name.startsWith(SESSION_MAP_PREFIX) && name.endsWith('.md')
}

/**
 * Counts what a resuming reader has to read: the body below the title, with
 * frontmatter and a `## Resume` section left out. A fenced block counts the way
 * it does in the requirements record, since a reader reads it too, and a
 * heading inside one neither opens nor closes a section.
 */
export function sessionMapWords(source: string): number {
  const kept: string[] = []
  let titled = false
  let resuming = false

  for (const line of bodyLines(source)) {
    const text = line.text.trim()

    if (!line.fenced && H2.test(text)) resuming = text === RESUME_HEADING
    if (resuming) continue

    if (!titled && !line.fenced && TITLE.test(text)) {
      titled = true
      continue
    }

    kept.push(line.text)
  }

  return wordCount(kept.join('\n'))
}

export function measureSessionMap(
  record: string,
  source: string,
): SessionMapLength {
  const words = sessionMapWords(source)

  return {
    record,
    words,
    cap: SESSION_MAP_WORD_CAP,
    over: words > SESSION_MAP_WORD_CAP,
  }
}
