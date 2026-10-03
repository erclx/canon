/** @jsxImportSource preact */
import type { JSX } from 'preact'
import { addressOf, elementAt, excerpt, isRawText } from '@/canvas/address'
import {
  currentPage,
  editElement,
  editRefusal,
  type FrameRef,
  frameDocuments,
  frameKey,
  frameVersions,
  pendingEdit,
  savedEdit,
  selectedElement,
  selectedFrame,
  tokens,
  writeError,
} from '@/canvas/client/state'

const FIELDS = ['x', 'y', 'width', 'height'] as const

/** Elements the parser never gives content, so they hold no text to edit. */
const VOID = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
])

interface StyleField {
  readonly label: string
  readonly property: string
  readonly isColor?: boolean
}

/**
 * The basic set, in the order the panel lists it. The writer refuses any
 * property outside it, so this list and the writer's have to agree.
 */
const STYLE_FIELDS: readonly StyleField[] = [
  { label: 'color', property: 'color', isColor: true },
  { label: 'background', property: 'background-color', isColor: true },
  { label: 'size', property: 'font-size' },
  { label: 'weight', property: 'font-weight' },
  { label: 'width', property: 'width' },
  { label: 'height', property: 'height' },
  { label: 'padding', property: 'padding' },
  { label: 'gap', property: 'gap' },
  { label: 'direction', property: 'flex-direction' },
]

interface Row {
  readonly name: string
  readonly value: string
}

/** Where the element sits in its frame, which the panel shows and never edits. */
function positionRows(element: Element): Row[] {
  const rect = element.getBoundingClientRect()
  const font = element.ownerDocument.defaultView
    ?.getComputedStyle(element)
    .getPropertyValue('font-family')
  return [
    { name: 'x', value: String(Math.round(rect.left)) },
    { name: 'y', value: String(Math.round(rect.top)) },
    ...(font ? [{ name: 'font', value: font }] : []),
  ]
}

/**
 * What the element states inline, else the value the browser settled on, so
 * an edit starts from what the operator sees.
 */
function currentValue(element: Element, property: string): string {
  const inline =
    'style' in element
      ? (element as HTMLElement).style.getPropertyValue(property)
      : ''
  if (inline) return inline
  return (
    element.ownerDocument.defaultView
      ?.getComputedStyle(element)
      .getPropertyValue(property) ?? ''
  )
}

function holdsTextAlone(element: Element): boolean {
  const tag = element.tagName.toLowerCase()
  return element.children.length === 0 && !VOID.has(tag) && !isRawText(tag)
}

function elementName(element: Element): string {
  const tag = element.tagName.toLowerCase()
  return [tag, ...element.classList].join('.')
}

interface FieldProps {
  readonly label: string
  readonly initial: string
  readonly isBusy: boolean
  readonly onCommit: (value: string) => void
}

/**
 * Commits on change, which a text input fires on Enter or on leaving it, and
 * sends nothing when the value is what it started at. Escape puts it back.
 */
function Field({ label, initial, isBusy, onCommit }: FieldProps): JSX.Element {
  return (
    <input
      class="field"
      type="text"
      aria-label={label}
      title={initial}
      defaultValue={initial}
      disabled={isBusy}
      spellcheck={false}
      onChange={(event) => {
        const value = event.currentTarget.value.trim()
        if (value !== initial.trim()) onCommit(value)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') event.currentTarget.value = initial
      }}
    />
  )
}

function TokenPicker({
  label,
  initial,
  isBusy,
  onCommit,
}: FieldProps): JSX.Element | null {
  const colors =
    tokens.value?.groups?.find((group) => group.kind === 'color')?.tokens ?? []
  if (colors.length === 0) return null
  return (
    <select
      class="token-picker"
      aria-label={`${label} token`}
      title="Pick a project token"
      value={
        colors.some((token) => initial === `var(${token.name})`) ? initial : ''
      }
      disabled={isBusy}
      onChange={(event) => {
        const { value } = event.currentTarget
        if (value !== '' && value !== initial) onCommit(value)
      }}
    >
      <option value="">Token</option>
      {colors.map((token) => (
        <option key={token.name} value={`var(${token.name})`}>
          {token.name}
        </option>
      ))}
    </select>
  )
}

function ElementFields({
  node,
  doc,
  frameRef,
  frameKey: key,
}: {
  readonly node: Element
  readonly doc: Document
  readonly frameRef: FrameRef
  readonly frameKey: string
}): JSX.Element {
  const address = addressOf(doc, node)
  const pending = pendingEdit.value
  const isBusy = pending?.key === key && pending.index === address?.index
  const commit = (property: string) => (value: string) => {
    if (address) void editElement(frameRef, key, address, property, value)
  }
  const isTextOnly = holdsTextAlone(node)
  const text = node.textContent ?? ''

  return (
    <dl class="box styles">
      {positionRows(node).map((row) => (
        <div key={row.name} class="box-row">
          <dt>{row.name}</dt>
          <dd title={row.value}>{row.value}</dd>
        </div>
      ))}
      <div class="box-row">
        <dt>text</dt>
        <dd title={excerpt(text)}>
          {isTextOnly ? (
            <Field
              label="text"
              initial={text}
              isBusy={isBusy}
              onCommit={commit('text')}
            />
          ) : (
            excerpt(text)
          )}
        </dd>
      </div>
      {STYLE_FIELDS.map((field) => {
        const initial = currentValue(node, field.property)
        return (
          <div key={field.property} class="box-row">
            <dt>{field.label}</dt>
            <dd class="field-cell">
              <Field
                label={field.label}
                initial={initial}
                isBusy={isBusy}
                onCommit={commit(field.property)}
              />
              {field.isColor ? (
                <TokenPicker
                  label={field.label}
                  initial={initial}
                  isBusy={isBusy}
                  onCommit={commit(field.property)}
                />
              ) : null}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

function ElementDetails(): JSX.Element | null {
  const picked = selectedElement.value
  const page = currentPage.value
  if (!picked || !page) return null
  const { frame, element } = picked
  const key = frameKey(page.name, frame)
  const doc = frameDocuments.value.get(key)
  const node = doc && !element.stale ? elementAt(doc, element) : undefined
  const saved = savedEdit.value
  const isSaved = saved?.key === key && saved.index === element.index

  return (
    <section aria-label="Element">
      <h2 class="section-label">
        Element
        {isSaved ? (
          <span class="saved" role="status">
            Saved
          </span>
        ) : null}
      </h2>
      {element.stale ? (
        <p class="notice">
          The frame changed since this element was picked, so its index may name
          another element now. Pick it again.
        </p>
      ) : doc && node ? (
        <>
          <p class="detail" title={elementName(node)}>
            {elementName(node)}
          </p>
          {/*
           * Keyed by the frame's version and the element, so a reload drops
           * any value typed against the document it replaced.
           */}
          <ElementFields
            key={`${frameVersions.value.get(key) ?? 0}:${element.index}`}
            node={node}
            doc={doc}
            frameRef={{ page: page.name, frame: frame.name }}
            frameKey={key}
          />
        </>
      ) : (
        <p class="empty">Loading the frame to read this element</p>
      )}
    </section>
  )
}

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
      {editRefusal.value ? (
        <p class="notice" role="alert">
          {editRefusal.value}
        </p>
      ) : null}
    </>
  )
}
