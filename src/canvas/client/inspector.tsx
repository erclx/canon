/** @jsxImportSource preact */
import type { JSX } from 'preact'
import { useState } from 'preact/hooks'
import { addressOf, elementAt, excerpt, isRawText } from '@/canvas/address'
import { AlignGrid } from '@/canvas/client/inspector/align-grid'
import { ColorField } from '@/canvas/client/inspector/color-field'
import {
  Field,
  ReadOnlyField,
  type Scrub,
  SelectField,
} from '@/canvas/client/inspector/field'
import { Section } from '@/canvas/client/inspector/section'
import { SizeField } from '@/canvas/client/inspector/size-field'
import { TokenSelect } from '@/canvas/client/inspector/token-select'
import {
  clampScrub,
  declarationValue,
  displayValue,
  firstFamily,
  lineHeightValue,
  opacityToCss,
  parseColor,
  sharedRadius,
  textAlignOf,
  toCssValue,
  tokenOf,
} from '@/canvas/client/inspector/values'
import {
  currentPage,
  editElement,
  editRefusal,
  type FrameRef,
  frameDocuments,
  frameKey,
  frameVersions,
  newStep,
  pendingEdit,
  savedEdit,
  selectedElement,
  selectedFrame,
  tokens,
  writeError,
} from '@/canvas/client/state'
import type { TokenKind } from '@/canvas/tokens'
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

const DIRECTION_FIELD: StyleField = {
  label: 'direction',
  glyph: 'Dir',
  property: 'flex-direction',
}

const FLEX_FIELDS: readonly StyleField[] = [
  { label: 'gap', glyph: 'Gap', property: 'gap', placeholder: '0' },
]

/** Padding applies to any box, so it sits in Layout rather than Flex. */
const PADDING_FIELD: StyleField = {
  label: 'padding',
  glyph: 'Pad',
  property: 'padding',
  isWide: true,
}

/** The corners in the order the radius shorthand lists them. */
const CORNER_FIELDS: readonly StyleField[] = [
  { label: 'top left radius', glyph: 'TL', property: 'border-top-left-radius' },
  {
    label: 'top right radius',
    glyph: 'TR',
    property: 'border-top-right-radius',
  },
  {
    label: 'bottom right radius',
    glyph: 'BR',
    property: 'border-bottom-right-radius',
  },
  {
    label: 'bottom left radius',
    glyph: 'BL',
    property: 'border-bottom-left-radius',
  },
]

const FLEX_DISPLAYS = new Set(['flex', 'inline-flex'])
const GRID_DISPLAYS = new Set(['grid', 'inline-grid'])

const WEIGHTS = ['100', '200', '300', '400', '500', '600', '700', '800', '900']

/** Line height and letter spacing move in tenths, since their range is small. */
const SPACING_FIELDS: readonly StyleField[] = [
  { label: 'line height', glyph: 'LH', property: 'line-height' },
  {
    label: 'letter spacing',
    glyph: 'LS',
    property: 'letter-spacing',
    placeholder: '0',
  },
]

const TEXT_ALIGNS = [
  { value: 'left', path: 'M2.5 4h11M2.5 8h7M2.5 12h9' },
  { value: 'center', path: 'M2.5 4h11M4.5 8h7M3.5 12h9' },
  { value: 'right', path: 'M2.5 4h11M6.5 8h7M4.5 12h9' },
  { value: 'justify', path: 'M2.5 4h11M2.5 8h11M2.5 12h11' },
] as const

const FILL_FIELDS = [
  { label: 'color', property: 'color' },
  { label: 'background', property: 'background-color' },
] as const

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
  return inlineValue(element, property) || computedValue(element, property)
}

function computedValue(element: Element, property: string): string {
  return (
    element.ownerDocument.defaultView
      ?.getComputedStyle(element)
      .getPropertyValue(property) ?? ''
  )
}

/**
 * The color a token paints in the frame, read off a probe rather than the
 * token's text, since a token's value may itself be a `var()` or a mix.
 */
function tokenPaint(doc: Document, name: string): string {
  const probe = doc.createElement('span')
  probe.style.setProperty('color', `var(${name})`)
  ;(doc.body ?? doc.documentElement).append(probe)
  const painted = computedValue(probe, 'color')
  probe.remove()
  return painted
}

function holdsTextAlone(element: Element): boolean {
  const tag = element.tagName.toLowerCase()
  return element.children.length === 0 && !VOID.has(tag) && !isRawText(tag)
}

function elementName(element: Element): string {
  const tag = element.tagName.toLowerCase()
  return [tag, ...element.classList].join('.')
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
  /*
   * The writer takes one property an edit, so a control setting two posts
   * them in turn and stops at the first refusal, under one step so they undo
   * as one. Each carries the hash the last answered with in its own address,
   * since a frame reloading between the two clears the stored one.
   */
  const commitAll = async (
    changes: readonly (readonly [string, string])[],
  ): Promise<void> => {
    const step = newStep()
    let current = address
    for (const [property, value] of changes) {
      if (!current) return
      const written = await editElement(
        frameRef,
        key,
        current,
        property,
        value,
        step,
      )
      if (!written) return
      if (written.hash) current = { ...current, hash: written.hash }
    }
  }
  const corners = CORNER_FIELDS.map((field) =>
    currentValue(node, field.property).trim(),
  )
  const radius = sharedRadius(corners)
  const [isPerCorner, setPerCorner] = useState(radius === undefined)
  const display = computedValue(node, 'display').trim()
  const isFlex = FLEX_DISPLAYS.has(display)
  const isWrapped = computedValue(node, 'flex-wrap').trim() === 'wrap'
  const rect = node.getBoundingClientRect()
  const text = node.textContent ?? ''
  const groupTokens = (kind: TokenKind): readonly string[] =>
    tokens.value?.groups
      ?.find((group) => group.kind === kind)
      ?.tokens.map((token) => token.name) ?? []
  const colorTokens = groupTokens('color')
  const family = currentValue(node, 'font-family')
  const familyToken = tokenOf(family)
  const size = currentValue(node, 'font-size')
  const sizeToken = tokenOf(size)
  const textAlign = textAlignOf(
    computedValue(node, 'text-align'),
    computedValue(node, 'direction'),
  )

  /**
   * Previews into the frame's own inline style and writes through the same
   * edit as typing. A reload mid-drag replaces the document, so a release
   * against one no longer on screen posts nothing.
   */
  const scrubOf = (property: string, step?: number): Scrub => ({
    clamp: (value) => clampScrub(property, value),
    step,
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
        {SIZE_FIELDS.map((field) => (
          <SizeField
            key={field.property}
            label={field.label}
            glyph={field.glyph}
            initial={displayValue(
              field.property,
              currentValue(node, field.property),
            )}
            isBusy={isBusy}
            onCommit={(typed) =>
              commit(field.property)(toCssValue(field.property, typed))
            }
            scrub={'style' in node ? scrubOf(field.property) : undefined}
          />
        ))}
        {styleField(PADDING_FIELD)}
      </Section>
      <Section
        title="Flex"
        action={
          isFlex || GRID_DISPLAYS.has(display) ? null : (
            <button
              type="button"
              class="section-icon"
              aria-label="Add flex layout"
              title="Add flex layout"
              disabled={isBusy}
              onClick={() => commit('display')('flex')}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M8 3.5v9M3.5 8h9" />
              </svg>
            </button>
          )
        }
      >
        {isFlex ? (
          <>
            <div class="flex-layout is-wide">
              <AlignGrid
                direction={computedValue(node, 'flex-direction').trim()}
                justifyContent={computedValue(node, 'justify-content')}
                alignItems={computedValue(node, 'align-items')}
                isBusy={isBusy}
                onPick={(alignment) =>
                  void commitAll([
                    ['justify-content', alignment.justifyContent],
                    ['align-items', alignment.alignItems],
                  ])
                }
              />
              <div class="flex-layout-side">
                {styleField(DIRECTION_FIELD)}
                <button
                  type="button"
                  class="section-icon"
                  aria-label="Wrap"
                  title="Wrap"
                  aria-pressed={isWrapped}
                  disabled={isBusy}
                  onClick={() =>
                    commit('flex-wrap')(isWrapped ? 'nowrap' : 'wrap')
                  }
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M2.5 4.5h9a2.5 2.5 0 0 1 0 5h-6M7.5 7.5l-2 2 2 2M2.5 12.5h1" />
                  </svg>
                </button>
              </div>
            </div>
            {FLEX_FIELDS.map(styleField)}
          </>
        ) : null}
      </Section>
      <Section
        title="Appearance"
        action={
          <button
            type="button"
            class="section-icon"
            aria-label="Per-corner radius"
            title="Per-corner radius"
            aria-pressed={isPerCorner}
            onClick={() => setPerCorner(!isPerCorner)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 6.5V5a2 2 0 0 1 2-2h1.5M9.5 3H11a2 2 0 0 1 2 2v1.5M13 9.5V11a2 2 0 0 1-2 2H9.5M6.5 13H5a2 2 0 0 1-2-2V9.5" />
            </svg>
          </button>
        }
      >
        <Field
          label="opacity"
          glyph="Op"
          initial={displayValue('opacity', computedValue(node, 'opacity'))}
          isBusy={isBusy}
          isWide={isPerCorner}
          onCommit={(typed) => {
            const value = opacityToCss(typed)
            if (value !== undefined) commit('opacity')(value)
          }}
        />
        {isPerCorner ? (
          CORNER_FIELDS.map(styleField)
        ) : (
          <Field
            label="radius"
            glyph="R"
            initial={displayValue('border-radius', radius ?? '')}
            isBusy={isBusy}
            placeholder="0"
            onCommit={(typed) =>
              commit('border-radius')(toCssValue('border-radius', typed))
            }
            scrub={'style' in node ? scrubOf('border-radius') : undefined}
          />
        )}
      </Section>
      <Section title="Typography">
        <TokenSelect
          label="family"
          glyph="Aa"
          initial={familyToken ?? firstFamily(family)}
          tokens={groupTokens('font-family')}
          token={familyToken}
          isRaw={isRawInline(node, 'font-family')}
          isBusy={isBusy}
          isWide
          onCommit={(typed) =>
            commit('font-family')(declarationValue('font-family', typed))
          }
          onPick={(name) => commit('font-family')(`var(${name})`)}
        />
        <TokenSelect
          label="size"
          glyph="Size"
          initial={sizeToken ?? displayValue('font-size', size)}
          tokens={groupTokens('font-size')}
          token={sizeToken}
          isRaw={isRawInline(node, 'font-size')}
          isBusy={isBusy}
          onCommit={(typed) =>
            commit('font-size')(toCssValue('font-size', typed))
          }
          onPick={(name) => commit('font-size')(`var(${name})`)}
          scrub={'style' in node ? scrubOf('font-size') : undefined}
        />
        <SelectField
          label="weight"
          glyph="Wt"
          options={WEIGHTS}
          value={currentValue(node, 'font-weight').trim()}
          isBusy={isBusy}
          onCommit={commit('font-weight')}
        />
        {SPACING_FIELDS.map((field) => (
          <Field
            key={field.property}
            label={field.label}
            glyph={field.glyph}
            initial={
              field.property === 'line-height'
                ? lineHeightValue(
                    currentValue(node, 'line-height'),
                    computedValue(node, 'font-size'),
                  )
                : displayValue(
                    field.property,
                    currentValue(node, field.property),
                  )
            }
            isBusy={isBusy}
            placeholder={field.placeholder}
            onCommit={(typed) =>
              commit(field.property)(toCssValue(field.property, typed))
            }
            scrub={'style' in node ? scrubOf(field.property, 0.1) : undefined}
          />
        ))}
        <div class="segmented is-wide" role="group" aria-label="text alignment">
          {TEXT_ALIGNS.map((align) => (
            <button
              key={align.value}
              type="button"
              class="segment"
              aria-label={`Align ${align.value}`}
              title={`Align ${align.value}`}
              aria-pressed={textAlign === align.value}
              disabled={isBusy}
              onClick={() => {
                if (textAlign !== align.value) {
                  commit('text-align')(align.value)
                }
              }}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d={align.path} />
              </svg>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Fill">
        {FILL_FIELDS.map((field) => {
          const painted = computedValue(node, field.property)
          const inline = inlineValue(node, field.property)
          /*
           * An inline value the picker cannot read stays as written. Reading
           * the computed color in its place would show a token-following
           * value as a literal, and an opacity edit would freeze it.
           */
          return (
            <ColorField
              key={field.property}
              label={field.label}
              color={parseColor(inline || painted)}
              text={inline || painted}
              inline={inline}
              painted={painted}
              owner={`${key}:${address?.index ?? -1}:${field.property}`}
              tokens={colorTokens}
              paint={(name) => tokenPaint(doc, name)}
              isRaw={isRawInline(node, field.property)}
              isBusy={isBusy}
              preview={
                'style' in node ? scrubOf(field.property).begin : undefined
              }
              onCommit={commit(field.property)}
            />
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
