/** @jsxImportSource preact */
import type { JSX } from 'preact'
import { elementAt } from '@/canvas/address'
import {
  currentPage,
  frameDocuments,
  frameKey,
  selectedElement,
  selectedFrame,
  writeError,
} from '@/canvas/client/state'

const FIELDS = ['x', 'y', 'width', 'height'] as const

interface Row {
  readonly name: string
  readonly value: string
}

/**
 * The computed values the browser settled on, which is what the operator sees
 * rather than what any one stylesheet states.
 */
function styleRows(element: Element): Row[] {
  const rect = element.getBoundingClientRect()
  const view = element.ownerDocument.defaultView
  const style = view?.getComputedStyle(element)
  const rows: Row[] = [
    { name: 'x', value: String(Math.round(rect.left)) },
    { name: 'y', value: String(Math.round(rect.top)) },
    { name: 'width', value: String(Math.round(rect.width)) },
    { name: 'height', value: String(Math.round(rect.height)) },
  ]
  if (!style) return rows
  return [
    ...rows,
    { name: 'color', value: style.color },
    { name: 'background', value: style.backgroundColor },
    { name: 'font', value: style.fontFamily },
    { name: 'size', value: style.fontSize },
    { name: 'weight', value: style.fontWeight },
  ]
}

function elementName(element: Element): string {
  const tag = element.tagName.toLowerCase()
  return [tag, ...element.classList].join('.')
}

/** Read-only in this slice, since editing an element is the edit slice's work. */
function ElementDetails(): JSX.Element | null {
  const picked = selectedElement.value
  const page = currentPage.value
  if (!picked || !page) return null
  const { frame, element } = picked
  const doc = frameDocuments.value.get(frameKey(page.name, frame))
  const node = doc && !element.stale ? elementAt(doc, element) : undefined

  return (
    <section aria-label="Element">
      <h2 class="section-label">Element</h2>
      {element.stale ? (
        <p class="notice">
          The frame changed since this element was picked, so its index may name
          another element now. Pick it again.
        </p>
      ) : node ? (
        <>
          <p class="detail" title={elementName(node)}>
            {elementName(node)}
          </p>
          <dl class="box styles">
            {styleRows(node).map((row) => (
              <div key={row.name} class="box-row">
                <dt>{row.name}</dt>
                <dd title={row.value}>{row.value}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <p class="empty">Loading the frame to read this element</p>
      )}
    </section>
  )
}

/** Read-only in this slice, since editing a box is the edit slice's work. */
export function Inspector(): JSX.Element {
  const frame = selectedFrame.value
  return (
    <>
      <section aria-label="Frame">
        <h2 class="section-label">Frame</h2>
        {frame ? (
          <>
            <p class="detail" title={frame.name}>
              {frame.name}
            </p>
            <dl class="box">
              {FIELDS.map((field) => (
                <div key={field} class="box-row">
                  <dt>{field}</dt>
                  <dd>{frame[field]}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <p class="empty">Select a frame to see its box</p>
        )}
        {writeError.value ? (
          <p class="notice" role="alert">
            {writeError.value}
          </p>
        ) : null}
      </section>
      <ElementDetails />
    </>
  )
}
