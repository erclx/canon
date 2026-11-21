/**
 * The readers an inventory can run, one per treatment. Each is serialized to
 * source and evaluated in the page, so every helper is declared inside its body.
 * `focus` reads the project's element query, and the five value subjects share `values.ts`.
 */

import { VALUE_SUBJECTS } from '@/inventory/scale'
import { readValues } from '@/inventory/values'

/** One element as a reader saw it, before any grouping. */
export interface SubjectReading {
  readonly selector: string
  readonly treatment: string
}

/**
 * What `page.evaluate` hands a reader. One object rather than two arguments,
 * because the browser passes a reader exactly one serialized value.
 */
export interface ReaderArgs {
  readonly query: string
  readonly subject: string
}

export interface Subject {
  readonly name: string
  /** What the listing means, printed above the rows so a count reads correctly. */
  readonly summary: string
  readonly read: (args: ReaderArgs) => SubjectReading[]
}

/**
 * Reports what each element changes about itself when it takes focus, the reading
 * the `ui-craft` keyboard reference states three rules against. An element the
 * browser refuses to focus is named as such, since a disabled control and a missing ring differ.
 */
function readFocusTreatments({ query }: ReaderArgs): SubjectReading[] {
  const PROPERTIES = [
    'outlineStyle',
    'outlineWidth',
    'outlineColor',
    'outlineOffset',
    'boxShadow',
    'borderColor',
    'backgroundColor',
    'color',
  ] as const

  const describe = (element: Element): string => {
    const tag = element.tagName.toLowerCase()
    if (element.id) return `${tag}#${element.id}`
    const className = element.getAttribute('class')?.trim().split(/\s+/)[0]
    return className ? `${tag}.${className}` : tag
  }

  const snapshot = (element: Element): Record<string, string> => {
    const computed = getComputedStyle(element)
    const values: Record<string, string> = {}
    for (const property of PROPERTIES) values[property] = computed[property]
    return values
  }

  const rows: SubjectReading[] = []

  // The walk's Tab press left one element focused, which would hide its ring, so the page starts blurred.
  const entryFocus = document.activeElement
  if (entryFocus instanceof HTMLElement) entryFocus.blur()

  for (const element of Array.from(document.querySelectorAll(query))) {
    if (!(element instanceof HTMLElement)) continue

    const rest = snapshot(element)
    element.focus()
    if (document.activeElement !== element) {
      rows.push({ selector: describe(element), treatment: 'not focusable' })
      continue
    }

    const focused = snapshot(element)
    const changed = PROPERTIES.filter(
      (property) => rest[property] !== focused[property],
    ).map((property) => `${property} ${focused[property]}`)

    rows.push({
      selector: describe(element),
      treatment:
        changed.length === 0 ? 'no visible change' : changed.join(', '),
    })
    element.blur()
  }

  return rows
}

const FOCUS: Subject = {
  name: 'focus',
  summary: 'what each element changes about itself when it takes focus',
  read: readFocusTreatments,
}

const VALUE_SUMMARIES: Record<(typeof VALUE_SUBJECTS)[number], string> = {
  color: 'each distinct background, border, outline, and text color painted',
  'font-size': 'each distinct font size on an element carrying its own text',
  radius: 'each distinct corner radius, all four corners when they differ',
  shadow: 'each distinct box shadow',
  duration: 'each distinct transition and animation duration',
}

export const SUBJECTS: readonly Subject[] = [
  FOCUS,
  ...VALUE_SUBJECTS.map((name): Subject => ({
    name,
    summary: VALUE_SUMMARIES[name],
    read: readValues,
  })),
]

/** Resolves a subject by name, so an unknown one is the caller's to report. */
export function findSubject(name: string): Subject | undefined {
  return SUBJECTS.find((subject) => subject.name === name)
}
