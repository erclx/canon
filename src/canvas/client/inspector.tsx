/** @jsxImportSource preact */
import type { JSX } from 'preact'
import { addressOf, elementAt, excerpt, isRawText } from '@/canvas/address'
import {
  Field,
  ReadOnlyField,
  type Scrub,
} from '@/canvas/client/inspector/field'
import { Section } from '@/canvas/client/inspector/section'
import {
  clampScrub,
  displayValue,
  toCssValue,
} from '@/canvas/client/inspector/values'
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
import '@/canvas/client/inspector/fields.css'

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
  /** The full word, which names the field. */
  readonly label: string
  readonly glyph: string
  readonly property: string
  readonly isWide?: boolean
  readonly placeholder?: string
}

/**
 * The basic set, grouped as the panel lists it. The writer refuses any
 * property outside it, so these lists and the writer's have to agree.
 */
const SIZE_FIELDS: readonly StyleField[] = [
  { label: 'width', glyph: 'W', property: 'width' },
  { label: 'height', glyph: 'H', property: 'height' },
]

const FLEX_FIELDS: readonly StyleField[] = [
  { label: 'direction', glyph: 'Dir', property: 'flex-direction' },
  { label: 'gap', glyph: 'Gap', property: 'gap', placeholder: '0' },
  { label: 'padding', glyph: 'Pad', property: 'padding', isWide: true },
]

const TYPE_FIELDS: readonly StyleField[] = [
  { label: 'size', glyph: 'Size', property: 'font-size' },
  { label: 'weight', glyph: 'Wt', property: 'font-weight' },
]

const FILL_FIELDS: readonly StyleField[] = [
  { label: 'color', glyph: 'Fg', property: 'color' },
  {
    label: 'background',
    glyph: 'Bg',
    property: 'background-color',
    placeholder: 'None',
  },
]

function inlineValue(element: Element, property: string): string {
  return 'style' in element
    ? (element as HTMLElement).style.getPropertyValue(property)
    : ''
}

/** Values that defer to something else, so they follow the theme as it does. */
const DEFERRING = new Set([
  'currentcolor',
  'inherit',
  'initial',
  'unset',
  'revert',
  'revert-layer',
])

/**
 * A color that stays put when the theme changes: one naming no token anywhere
 * in it and deferring to nothing, so `color-mix()` over a `var()` is not raw.
 */
export function isRawValue(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return (
    normalized !== '' &&
    !normalized.includes('var(') &&
    !DEFERRING.has(normalized)
  )
}

/**
 * Inherited and stylesheet values are not the element's own, so only an
 * inline value counts.
 */
function isRawInline(element: Element, property: string): boolean {
  return isRawValue(inlineValue(element, property))
}

/**
 * What the element states inline, else the value the browser settled on, so
 * an edit starts from what the operator sees.
 */
function currentValue(element: Element, property: string): string {
  const inline = inlineValue(element, property)
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

interface TokenPickerProps {
  readonly label: string
  readonly initial: string
  readonly isBusy: boolean
  readonly onCommit: (value: string) => void
}

function TokenPicker({
  label,
  initial,
  isBusy,
  onCommit,
}: TokenPickerProps): JSX.Element | null {
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
  const rect = node.getBoundingClientRect()
  const font = currentValue(node, 'font-family')
  const text = node.textContent ?? ''

  /**
   * Previews into the frame's own inline style and writes through the same
   * edit as typing. A reload mid-drag replaces the document, so a release
   * against one no longer on screen posts nothing.
   */
  const scrubOf = (property: string): Scrub => ({
    clamp: (value) => clampScrub(property, value),
    begin: () => {
      const original = inlineValue(node, property)
      const style = (node as HTMLElement).style
      return {
        preview: (shown) =>
          style.setProperty(property, toCssValue(property, shown)),
        restore: () =>
          original
            ? style.setProperty(property, original)
            : style.removeProperty(property),
        commit: (shown) => {
          if (frameDocuments.value.get(key) !== doc || !node.isConnected) return
          commit(property)(toCssValue(property, shown))
        },
      }
    },
  })

  const styleField = (field: StyleField): JSX.Element => (
    <Field
      key={field.property}
      label={field.label}
      glyph={field.glyph}
      initial={displayValue(field.property, currentValue(node, field.property))}
      isBusy={isBusy}
      isWide={field.isWide}
      placeholder={field.placeholder}
      onCommit={(typed) =>
        commit(field.property)(toCssValue(field.property, typed))
      }
      scrub={'style' in node ? scrubOf(field.property) : undefined}
    />
  )

  return (
    <>
      <Section title="Layout">
        <ReadOnlyField
          label="x"
          glyph="X"
          value={String(Math.round(rect.left))}
        />
        <ReadOnlyField
          label="y"
          glyph="Y"
          value={String(Math.round(rect.top))}
        />
        {SIZE_FIELDS.map(styleField)}
      </Section>
      <Section title="Flex">{FLEX_FIELDS.map(styleField)}</Section>
      <Section title="Typography">
        {TYPE_FIELDS.map(styleField)}
        {font ? (
          <ReadOnlyField label="font" glyph="Font" value={font} isWide />
        ) : null}
      </Section>
      <Section title="Fill">
        {FILL_FIELDS.map((field) => {
          const initial = currentValue(node, field.property)
          return (
            <div key={field.property} class="fill-row is-wide">
              {styleField(field)}
              {isRawInline(node, field.property) ? (
                <span
                  class="raw"
                  title="Set as a raw value, so it will not follow the theme. Pick a token to fix it"
                >
                  raw
                </span>
              ) : null}
              <TokenPicker
                label={field.label}
                initial={initial}
                isBusy={isBusy}
                onCommit={commit(field.property)}
              />
            </div>
          )
        })}
      </Section>
      <Section title="Text">
        {holdsTextAlone(node) ? (
          <Field
            label="text"
            glyph="T"
            initial={text}
            isBusy={isBusy}
            isWide
            onCommit={commit('text')}
          />
        ) : (
          <p class="text-excerpt is-wide" title={excerpt(text)}>
            {excerpt(text)}
          </p>
        )}
      </Section>
    </>
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
            <div class="field-grid">
              <ReadOnlyField label="x" glyph="X" value={String(frame.x)} />
              <ReadOnlyField label="y" glyph="Y" value={String(frame.y)} />
              <ReadOnlyField
                label="width"
                glyph="W"
                value={String(frame.width)}
              />
              <ReadOnlyField
                label="height"
                glyph="H"
                value={String(frame.height)}
              />
            </div>
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
