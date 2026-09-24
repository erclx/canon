export interface LessonReferencesLinked {
  readonly html: string
  /** Four-digit numbers naming no lesson, each once, in first-seen order. */
  readonly unresolved: readonly string[]
}

/**
 * A mention a learner would read as pointing at another lesson. The whitespace
 * is captured rather than normalized, since a prettier-wrapped lesson can break
 * a mention across a line.
 */
const MENTION = /\b(lesson|Lesson)(\s+)(\d{4})\b/g

/**
 * A link nav wrote on an earlier run, and the only kind it may rewrite. The
 * close tag allows whitespace before its `>`, which is how prettier wraps it.
 */
const OWNED_LINK = /<a\s[^>]*\bdata-lesson-ref\b[^>]*>([\s\S]*?)<\/a\s*>/g

/**
 * A comment, a raw-text element taken whole so a `<` inside a script never
 * reads as a tag, any other tag, or the text between tags.
 */
const TOKEN =
  /<!--[\s\S]*?-->|<(script|style)\b[\s\S]*?<\/\1\s*>|<\/?[a-zA-Z][^>]*>|[^<]+|</g

const TAG_NAME = /^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)/

/**
 * Elements whose text stays plain. A link inside a quiz `label` navigates on
 * the click meant to pick an option, and one inside `summary` fights the
 * toggle.
 */
const SKIPPED = new Set(['a', 'code', 'pre', 'label', 'summary'])

/**
 * Links every "lesson NNNN" mention in a lesson's authored region to the
 * sibling file carrying that number, and reports the numbers naming no lesson.
 * A link carrying `data-lesson-ref` is nav's own, so it is unwrapped and
 * resolved again from its text, which re-points it after a slug rename and
 * drops it once its target is gone. An author's own `<a>` is never touched.
 */
export function linkLessonReferences(
  html: string,
  targets: ReadonlyMap<string, string>,
  current: string,
): LessonReferencesLinked {
  const unresolved: string[] = []
  let depth = 0

  const linkText = (text: string): string =>
    text.replace(MENTION, (mention, word, space, number: string) => {
      const target = targets.get(number)
      if (target === current) return mention
      if (target === undefined) {
        if (!unresolved.includes(number)) unresolved.push(number)
        return mention
      }
      return `<a href="${target}" data-lesson-ref>${word}${space}${number}</a>`
    })

  const unwrapped = html.replace(OWNED_LINK, (_link, text: string) => text)

  const rewritten = unwrapped.replace(TOKEN, (token) => {
    if (!token.startsWith('<') || token === '<') {
      return depth === 0 ? linkText(token) : token
    }

    const tag = TAG_NAME.exec(token)
    if (tag === null || !SKIPPED.has(tag[2].toLowerCase())) return token

    if (tag[1] === '/') depth = Math.max(0, depth - 1)
    else if (!token.endsWith('/>')) depth += 1
    return token
  })

  return { html: rewritten, unresolved }
}
