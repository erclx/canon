/** @jsxImportSource preact */
import { type ComponentChildren, type JSX, toChildArray } from 'preact'

interface SectionProps {
  readonly title: string
  /** Sits in a fixed lane right of the title, so adding one never moves it. */
  readonly action?: ComponentChildren
  readonly children?: ComponentChildren
}

/** A titled group of fields. With no fields it renders its header alone. */
export function Section({
  title,
  action,
  children,
}: SectionProps): JSX.Element {
  const fields = toChildArray(children)
  return (
    <section class="inspector-section">
      <header class="inspector-section-head">
        <h3 class="inspector-section-title">{title}</h3>
        <span class="inspector-section-action">{action}</span>
      </header>
      {fields.length > 0 ? <div class="field-grid">{fields}</div> : null}
    </section>
  )
}
