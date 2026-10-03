/** @jsxImportSource preact */
import type { JSX } from 'preact'
import { addressOf, documentElements, excerpt } from '@/canvas/address'
import {
  type FrameRef,
  frameDocuments,
  hoveredElement,
  selectElement,
  selection,
} from '@/canvas/client/state'

/** Elements that never render, so a layer for one points at nothing. */
const HIDDEN = new Set(['script', 'style', 'template', 'noscript'])

const LABEL_TEXT = 24

export interface LayersProps {
  readonly frame: FrameRef
  /** The frame's key, which its loaded document is registered under. */
  readonly frameKey: string
}

/** `tag.first-class`, then a short excerpt of a leaf's own text. */
function layerLabel(element: Element): { name: string; text: string } {
  const tag = element.tagName.toLowerCase()
  const first = element.classList[0]
  const text =
    element.children.length === 0
      ? excerpt(element.textContent ?? '').slice(0, LABEL_TEXT)
      : ''
  return { name: first ? `${tag}.${first}` : tag, text }
}

function LayerNode({
  doc,
  element,
  indexes,
  props,
}: {
  readonly doc: Document
  readonly element: Element
  readonly indexes: ReadonlyMap<Element, number>
  readonly props: LayersProps
}): JSX.Element {
  const index = indexes.get(element) ?? -1
  const chosen = selection.value
  const isCurrent =
    chosen?.page === props.frame.page &&
    chosen.frame === props.frame.frame &&
    chosen.element?.index === index
  const { name, text } = layerLabel(element)
  const children = [...element.children].filter(
    (child) => !HIDDEN.has(child.tagName.toLowerCase()),
  )

  return (
    <li>
      <button
        type="button"
        class="row layer"
        title={text ? `${name} ${text}` : name}
        aria-current={isCurrent ? 'true' : undefined}
        onClick={() => {
          const address = addressOf(doc, element)
          if (address) void selectElement(props.frame, props.frameKey, address)
        }}
        onMouseEnter={() => {
          hoveredElement.value = { key: props.frameKey, index }
        }}
        onMouseLeave={() => {
          hoveredElement.value = undefined
        }}
      >
        <span class="row-label">{name}</span>
        {text ? <span class="row-meta layer-text">{text}</span> : null}
      </button>
      {children.length > 0 ? (
        <ul class="layers">
          {children.map((child, at) => (
            <LayerNode
              key={at}
              doc={doc}
              element={child}
              indexes={indexes}
              props={props}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

/**
 * The element tree of one frame, read from its loaded document, so it shows
 * what the browser built rather than what the file states. Each row selects by
 * the same address a click on the surface records.
 */
export function Layers(props: LayersProps): JSX.Element {
  const doc = frameDocuments.value.get(props.frameKey)
  const label = `Layers of ${props.frame.frame}`
  if (!doc?.body) {
    return (
      <p class="empty" aria-label={label}>
        Loading layers
      </p>
    )
  }
  const indexes = new Map(
    documentElements(doc).map((element, index) => [element, index]),
  )
  return (
    <ul class="layers layers-root" aria-label={label}>
      <LayerNode doc={doc} element={doc.body} indexes={indexes} props={props} />
    </ul>
  )
}
