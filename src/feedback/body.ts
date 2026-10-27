const TITLE_MAX_LENGTH = 72

/**
 * The one place the report's field list is spelled. The GitHub issue form is
 * the other writer of this shape and enforces nothing a producer passes
 * through, so validation sits here, on the path every filed report crosses.
 */
export const REQUIRED_FIELDS = ['Surface', 'Observed', 'Proposed fix'] as const

/**
 * Fields are `###` headings under the report's own `## Toolkit feedback` title,
 * because that is the level a GitHub issue form emits for a field label. One
 * parser therefore reads a report the CLI wrote and one a person submitted
 * through the web form.
 *
 * The retired `**Surface:**` bold form is not accepted. Reading both would
 * leave a producer free to keep emitting the shape this parser exists to
 * retire, and the validator would then enforce nothing.
 */
const FIELD_HEADING = /^###\s+(.+?)\s*$/
const FENCE = /^\s*(`{3,}|~{3,})(.*)$/

interface OpenFence {
  readonly marker: string
  readonly length: number
}

export function parseSections(body: string): Map<string, string> {
  const sections = new Map<string, string>()
  let heading: string | undefined
  let lines: string[] = []
  let fence: OpenFence | undefined

  const flush = (): void => {
    if (heading === undefined) return
    sections.set(heading.toLowerCase(), lines.join('\n').trim())
  }

  for (const line of body.split('\n')) {
    // A Repro field routinely carries a fenced block, and a `###` comment
    // inside one is shell rather than the next field. Reading it as a heading
    // splits the section and drops everything under it. A Suggested shape
    // wraps a template that holds its own fence in a longer one, so a fence
    // closes only on the same marker at least as long, per CommonMark.
    const fenceMatch = line.match(FENCE)
    const run = fenceMatch?.[1]
    if (run !== undefined) {
      const marker = run.charAt(0)
      const isBare = (fenceMatch?.[2] ?? '').trim() === ''
      if (fence === undefined) {
        fence = { marker, length: run.length }
      } else if (
        isBare &&
        marker === fence.marker &&
        run.length >= fence.length
      ) {
        fence = undefined
      }
    }
    const match = fence ? null : line.match(FIELD_HEADING)
    if (match?.[1] === undefined) {
      lines.push(line)
      continue
    }
    flush()
    heading = match[1]
    lines = []
  }
  flush()

  return sections
}

export function readField(body: string, field: string): string | undefined {
  const value = parseSections(body).get(field.toLowerCase())
  return value ? value : undefined
}

/**
 * The first required field the report does not carry, or `undefined` when it
 * carries them all. One name rather than a list, because a reporter repairs one
 * field at a time and the next run names the next gap.
 */
export function missingField(body: string): string | undefined {
  const sections = parseSections(body)
  for (const field of REQUIRED_FIELDS) {
    const value = sections.get(field.toLowerCase())
    if (!value) return field
  }
  return undefined
}

export function missingFieldMessage(field: string): string {
  return `Feedback report is missing its "### ${field}" section. Every report needs ${REQUIRED_FIELDS.map((name) => `### ${name}`).join(', ')}.`
}

/**
 * The fields a follow-up comment carries. A follow-up reports what happened
 * after filing, so it names no surface and proposes no fix of its own. It says
 * whether the body's fix still stands, since triage reads the body as the
 * request and a silent overturn leaves it acting on the old one.
 */
export const FOLLOW_UP_FIELDS = [
  'Observed',
  'Changes the fix',
  'Links',
] as const

const YES_OR_NO = /^(?:yes|no)\b/i

/**
 * A URL, or an issue reference such as `#2801`, `frameboard#156`, or
 * `erclx/canon#2801`. A bare name is what the hand-written follow-up carried,
 * and nothing a reader can open from it.
 */
const REFERENCE = /https?:\/\/\S+|(?:^|[\s(])(?:[\w.-]+\/)?[\w.-]*#\d+\b/

export function missingFollowUpField(body: string): string | undefined {
  const sections = parseSections(body)
  for (const field of FOLLOW_UP_FIELDS) {
    const value = sections.get(field.toLowerCase())
    if (!value) return field
  }
  return undefined
}

/**
 * The sentence a refused follow-up reads, or `undefined` when it carries every
 * field in a checkable shape. One problem at a time, as `missingField` does.
 */
export function followUpProblem(body: string): string | undefined {
  const absent = missingFollowUpField(body)
  if (absent) {
    return `Follow-up is missing its "### ${absent}" section. Every follow-up needs ${FOLLOW_UP_FIELDS.map((name) => `### ${name}`).join(', ')}.`
  }
  const changes = readField(body, 'Changes the fix') ?? ''
  if (!YES_OR_NO.test(changes)) {
    return 'Follow-up "### Changes the fix" must open with yes or no, so triage can tell whether the issue body still holds.'
  }
  const links = readField(body, 'Links') ?? ''
  if (!REFERENCE.test(links)) {
    return 'Follow-up "### Links" carries no URL or issue reference. Write each as a URL or as owner/repo#number.'
  }
  return undefined
}

function surfaceField(body: string): string | undefined {
  return readField(body, 'Surface')?.split('\n')[0]?.trim()
}

/**
 * Each label must exist on the toolkit repository, because `gh issue create`
 * refuses the whole issue on an unknown label rather than dropping it.
 */
const DOMAIN_LABELS: readonly { pattern: RegExp; label: string }[] = [
  { pattern: /\bskills?\b/, label: 'skills' },
  { pattern: /\b(?:cli)s?\b/, label: 'cli' },
  { pattern: /\b(?:tooling|seeds?)\b/, label: 'tooling' },
  { pattern: /\b(?:governance)s?\b/, label: 'governance' },
]

/**
 * Reads only the surface type, the text before the first comma, so a path or
 * name after it never adds a label.
 */
export function deriveDomainLabels(body: string): string[] {
  const type = (surfaceField(body) ?? '').split(',')[0]?.toLowerCase() ?? ''
  const labels = DOMAIN_LABELS.filter(({ pattern }) => pattern.test(type)).map(
    ({ label }) => label,
  )
  return [...new Set(labels)]
}

export function deriveTitle(body: string): string {
  const surface = surfaceField(body)
  const title = surface ? `feedback: ${surface}` : 'toolkit feedback'
  return title.slice(0, TITLE_MAX_LENGTH)
}
