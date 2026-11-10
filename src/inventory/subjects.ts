/**
 * The readers an inventory can run, one per treatment.
 *
 * A reader runs inside the page rather than here, so each one is serialized to
 * source and evaluated by the browser. That is why every helper a reader needs
 * is declared inside its own body: a reference to anything at module scope
 * survives typechecking and throws once the page tries to call it.
 *
 * `focus` reads an element query the project declares. The five value
 * subjects read every rendered element, so they run over board frames as well
 * as routes, and their one reader lives in `values.ts`.
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
 * Reports what each element changes about itself when it takes focus, which is
 * the reading the `ui-craft` keyboard reference states three rules against and
 * nothing measures.
 *
 * The difference between rest and focus is the treatment, rather than the
 * focused style on its own. A card carrying a resting shadow computes a shadow
 * either way, so reading only the focused state would report a ring on an
 * element whose appearance never moves.
 *
 * An element the browser refuses to focus is named as such rather than folded
 * into the no-treatment row, since a disabled control and a control with no
 * ring are different findings with different remedies.
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

  // The walk presses Tab before this runs, which leaves one element focused.
  // Reading that element's rest state while it holds focus reports no
  // difference and hides whatever ring it actually draws, so the page starts
  // from nothing focused and every element is blurred again after its turn.
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
