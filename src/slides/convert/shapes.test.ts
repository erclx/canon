import { describe, expect, it } from 'vitest'
import {
  type BoxStyle,
  type DrawOp,
  type ElementRecord,
  type Fallback,
  planSlide,
  type RawStyle,
  type Rect,
  rotationOf,
  type TableCellRecord,
  type TextContent,
  type TextRun,
  UNMAPPED_PROPERTIES,
  type UnmappedProperty,
} from '@/slides/convert/shapes'

const BOX: Rect = { x: 96, y: 192, w: 480, h: 96 }
const CONTEXT = { slideCount: 3 }

function color(hex = '2C2C29', alpha = 1) {
  return { hex, alpha }
}

function edges(value = 0) {
  return { top: value, right: value, bottom: value, left: value }
}

function raw(overrides: Partial<RawStyle> = {}): RawStyle {
  return {
    backgroundImage: 'none',
    transform: 'none',
    filter: 'none',
    clipPath: 'none',
    mask: 'none',
    mixBlendMode: 'normal',
    backdropFilter: 'none',
    borderWidth: '0px',
    borderColor: 'rgb(0, 0, 0)',
    borderStyle: 'none',
    borderRadius: '0px',
    ...overrides,
  }
}

function style(overrides: Partial<BoxStyle> = {}): BoxStyle {
  return {
    background: color('000000', 0),
    borderWidth: edges(),
    borderColor: color('000000', 0),
    borderStyle: 'none',
    radius: 0,
    padding: edges(),
    shadows: [],
    raw: raw(),
    ...overrides,
  }
}

function run(overrides: Partial<TextRun> = {}): TextRun {
  return {
    text: 'Quarterly results',
    color: color(),
    fontSize: 32,
    fontWeight: 400,
    italic: false,
    underline: false,
    fontFamily: '"Geist Variable", system-ui, sans-serif',
    letterSpacing: 0,
    ...overrides,
  }
}

function content(overrides: Partial<TextContent> = {}): TextContent {
  return {
    runs: [run()],
    align: 'left',
    lineHeight: 40,
    fontSize: 32,
    ...overrides,
  }
}

type Kind<K extends ElementRecord['kind']> = Extract<ElementRecord, { kind: K }>

function base(id: number) {
  return {
    id,
    parent: null,
    selector: `div#e${id}`,
    box: BOX,
    bounds: BOX,
    style: style(),
    text: 'Quarterly results',
  }
}

function textRecord(overrides: Partial<Kind<'text'>> = {}): Kind<'text'> {
  return {
    ...base(1),
    kind: 'text',
    content: content(),
    inlineStyles: [],
    ...overrides,
  }
}

function boxRecord(overrides: Partial<Kind<'box'>> = {}): Kind<'box'> {
  return { ...base(1), kind: 'box', ...overrides }
}

function imageRecord(overrides: Partial<Kind<'image'>> = {}): Kind<'image'> {
  return {
    ...base(1),
    kind: 'image',
    src: '/deck/photo.png',
    alt: 'The team at launch',
    ...overrides,
  }
}

function cell(overrides: Partial<TableCellRecord> = {}): TableCellRecord {
  return {
    ...content({ runs: [run({ text: 'Cell', fontSize: 16 })], fontSize: 16 }),
    box: { x: 0, y: 0, w: 100, h: 40 },
    colspan: 1,
    rowspan: 1,
    style: style({ padding: edges(8) }),
    verticalAlign: 'middle',
    ...overrides,
  }
}

function only(records: ElementRecord[]): DrawOp {
  const [op] = planSlide(records, CONTEXT).ops
  if (!op) throw new Error('no op planned')
  return op
}

function textOf(records: ElementRecord[]): Extract<DrawOp, { kind: 'text' }> {
  const op = only(records)
  if (op.kind !== 'text') throw new Error(`planned ${op.kind}, not text`)
  return op
}

describe('planSlide', () => {
  it('should carry padding and border width as the text inset, left right bottom top', () => {
    const record = textRecord({
      style: style({
        padding: { top: 24, right: 28, bottom: 24, left: 28 },
        borderWidth: edges(1),
        borderColor: color('D6D3CE'),
        borderStyle: 'solid',
      }),
      content: content({ lineHeight: 32 }),
    })

    const { options } = textOf([record])

    expect(options.margin).toEqual([21.75, 21.75, 18.75, 18.75])
  })

  it('should draw the border as the line of the text box', () => {
    const record = textRecord({
      style: style({
        borderWidth: edges(2),
        borderColor: color('D6D3CE'),
        borderStyle: 'solid',
      }),
    })

    const { options } = textOf([record])

    expect(options.line).toMatchObject({ color: 'D6D3CE', width: 1.5 })
  })

  it('should round a box with a radius', () => {
    const record = boxRecord({
      style: style({ background: color('F4F1EC'), radius: 12 }),
    })

    const op = only([record])

    expect(op).toMatchObject({
      kind: 'shape',
      shape: 'roundRect',
      options: { rectRadius: 0.125 },
    })
  })

  it('should frame a bordered image and carry its radius', () => {
    const record = imageRecord({
      style: style({
        borderWidth: edges(1),
        borderColor: color('D6D3CE'),
        borderStyle: 'solid',
        radius: 12,
      }),
    })

    const op = only([record])

    expect(op).toMatchObject({
      kind: 'image',
      radius: 0.125,
      frame: { line: { color: 'D6D3CE', width: 0.75 }, rectRadius: 0.125 },
    })
  })

  it('should lift the first line by half the leading', () => {
    const record = textRecord({
      style: style({ padding: edges(24) }),
      content: content({ fontSize: 32, lineHeight: 48 }),
    })

    const { options } = textOf([record])

    expect(options.margin).toEqual([18, 18, 18, 12])
  })

  it('should move the box up when the half-leading exceeds the inset', () => {
    const record = textRecord({
      content: content({ fontSize: 32, lineHeight: 48 }),
    })

    const { options } = textOf([record])

    expect(options.y).toBeCloseTo((192 - 8) / 96)
  })

  it('should set an exact line spacing from the computed line height', () => {
    const { options } = textOf([textRecord()])

    expect(options.lineSpacing).toBe(30)
  })

  it('should keep nested inline runs in one text shape', () => {
    const record = textRecord({
      content: content({
        runs: [run({ text: 'Revenue ' }), run({ text: 'up', fontWeight: 700 })],
      }),
    })

    const op = textOf([record])

    expect(op.runs.map((each) => each.options?.bold)).toEqual([false, true])
  })

  it('should take the bullet glyph from the depth when the style names none', () => {
    const record = textRecord({
      list: { style: 'none-given', depth: 2, ordinal: 1 },
    })

    const { options } = textOf([record])

    expect(options.bullet).toMatchObject({ characterCode: '25E6' })
  })

  it('should take the bullet glyph from the list style', () => {
    const record = textRecord({
      list: { style: 'square', depth: 1, ordinal: 1 },
    })

    const { options } = textOf([record])

    expect(options.bullet).toMatchObject({ characterCode: '25AA' })
  })

  it('should number a decimal list item from its ordinal', () => {
    const record = textRecord({
      list: { style: 'decimal', depth: 1, ordinal: 3 },
    })

    const { options } = textOf([record])

    expect(options.bullet).toMatchObject({ type: 'number', numberStartAt: 3 })
  })

  it('should widen a list item left by the marker gap', () => {
    const record = textRecord({ list: { style: 'disc', depth: 1, ordinal: 1 } })

    const { options } = textOf([record])

    expect(options.x).toBeCloseTo((96 - 32) / 96)
  })

  it('should map an inline background to a run highlight', () => {
    const record = textRecord({
      content: content({ runs: [run({ highlight: color('FDE68A') })] }),
    })

    const op = textOf([record])

    expect(op.runs[0]?.options?.highlight).toBe('FDE68A')
  })

  it('should map letter-spacing to character spacing in points', () => {
    const record = textRecord({
      content: content({ runs: [run({ letterSpacing: 2 })] }),
    })

    const op = textOf([record])

    expect(op.runs[0]?.options?.charSpacing).toBe(1.5)
  })

  it('should write an absolute href as a URL link', () => {
    const record = textRecord({
      content: content({ runs: [run({ href: 'https://example.com/report' })] }),
    })

    const op = textOf([record])

    expect(op.runs[0]?.options?.hyperlink).toEqual({
      url: 'https://example.com/report',
    })
  })

  it('should write a slide anchor as a slide link', () => {
    const record = textRecord({
      content: content({ runs: [run({ href: '#slide-2' })] }),
    })

    const op = textOf([record])

    expect(op.runs[0]?.options?.hyperlink).toEqual({ slide: 2 })
  })

  it('should refuse a slide anchor past the end of the deck', () => {
    const record = textRecord({
      content: content({ runs: [run({ href: '#slide-9' })] }),
    })

    const plan = planSlide([record], CONTEXT)

    expect(plan.refusedLinks).toEqual([
      expect.objectContaining({ href: '#slide-9' }),
    ])
  })

  it('should write no link for a refused slide anchor', () => {
    const record = textRecord({
      content: content({ runs: [run({ href: '#slide-9' })] }),
    })

    const op = textOf([record])

    expect(op.runs[0]?.options?.hyperlink).toBeUndefined()
  })

  it('should map the first box-shadow to an outer shadow', () => {
    const record = boxRecord({
      style: style({
        background: color('FFFFFF'),
        shadows: [
          { x: 0, y: 8, blur: 24, color: color('000000', 0.2), inset: false },
        ],
      }),
    })

    const op = only([record])

    expect(op).toMatchObject({
      options: {
        shadow: { type: 'outer', offset: 6, angle: 90, blur: 18, opacity: 0.2 },
      },
    })
  })

  it('should carry the alt text of an image', () => {
    const op = only([imageRecord()])

    expect(op).toMatchObject({ options: { altText: 'The team at launch' } })
  })

  it('should size table columns from the cell boxes', () => {
    const record: Kind<'table'> = {
      ...base(1),
      kind: 'table',
      rows: [
        [
          cell({ box: { x: 96, y: 96, w: 192, h: 48 } }),
          cell({ box: { x: 288, y: 96, w: 96, h: 48 } }),
        ],
      ],
    }

    const op = only([record])

    expect(op).toMatchObject({ kind: 'table', options: { colW: [2, 1] } })
  })

  it('should carry rowspan and colspan on a merged cell', () => {
    const record: Kind<'table'> = {
      ...base(1),
      kind: 'table',
      rows: [
        [cell({ box: { x: 0, y: 0, w: 200, h: 80 }, colspan: 2, rowspan: 2 })],
        [],
      ],
    }

    const op = only([record])

    expect(op).toMatchObject({
      rows: [[{ options: { colspan: 2, rowspan: 2 } }], []],
    })
  })

  it('should keep the parent native when a child falls back', () => {
    const parent = boxRecord({ style: style({ background: color('F4F1EC') }) })
    const child = boxRecord({
      ...base(2),
      parent: 1,
      style: style({ raw: raw({ filter: 'blur(4px)' }) }),
    })

    const kinds = planSlide([parent, child], CONTEXT).ops.map((op) => op.kind)

    expect(kinds).toEqual(['shape', 'fallback'])
  })

  it('should emit nothing beneath a fallback element', () => {
    const parent = boxRecord({
      style: style({ raw: raw({ filter: 'blur(4px)' }) }),
    })
    const child = textRecord({ ...base(2), parent: 1 })
    const grandchild = textRecord({ ...base(3), parent: 2 })

    const kinds = planSlide([parent, child, grandchild], CONTEXT).ops.map(
      (op) => op.kind,
    )

    expect(kinds).toEqual(['fallback'])
  })

  it('should send a text block to a picture when an inline run is unmapped', () => {
    const record = textRecord({
      inlineStyles: [style({ raw: raw({ filter: 'blur(4px)' }) })],
    })

    const plan = planSlide([record], CONTEXT)

    expect(plan.fallbacks).toEqual([
      expect.objectContaining({ properties: ['filter'] }),
    ])
  })

  it('should send a table to a picture when a cell is unmapped', () => {
    const record: Kind<'table'> = {
      ...base(1),
      kind: 'table',
      rows: [
        [
          cell({
            style: style({
              raw: raw({ backgroundImage: 'linear-gradient(red, blue)' }),
            }),
          }),
        ],
      ],
    }

    const plan = planSlide([record], CONTEXT)

    expect(plan.fallbacks).toEqual([
      expect.objectContaining({ properties: ['background-image'] }),
    ])
  })

  it('should give a fallback picture the element text as alt text', () => {
    const record = boxRecord({
      text: 'Growth chart',
      style: style({ raw: raw({ filter: 'blur(4px)' }) }),
    })

    const op = only([record])

    expect(op).toMatchObject({
      kind: 'fallback',
      options: { altText: 'Growth chart' },
    })
  })
})

describe('rotationOf', () => {
  it('should read a plain rotate out of its matrix', () => {
    const quarter = 'matrix(0, 1, -1, 0, 0, 0)'

    expect(rotationOf(quarter)).toBe(90)
  })

  it('should refuse a scale', () => {
    expect(rotationOf('matrix(2, 0, 0, 2, 0, 0)')).toBeUndefined()
  })
})

const UNMAPPED_STYLES: Readonly<Record<UnmappedProperty, Partial<BoxStyle>>> = {
  'background-image': {
    raw: raw({ backgroundImage: 'linear-gradient(red, blue)' }),
  },
  transform: { raw: raw({ transform: 'matrix(1, 0, 0.5, 1, 0, 0)' }) },
  filter: { raw: raw({ filter: 'blur(4px)' }) },
  'clip-path': { raw: raw({ clipPath: 'circle(50%)' }) },
  mask: { raw: raw({ mask: 'url("#m")' }) },
  'mix-blend-mode': { raw: raw({ mixBlendMode: 'multiply' }) },
  'backdrop-filter': { raw: raw({ backdropFilter: 'blur(8px)' }) },
  border: {
    raw: raw({
      borderWidth: '0px 0px 0px 4px',
      borderStyle: 'none none none solid',
    }),
  },
  'border-radius': { raw: raw({ borderRadius: '12px 12px 0px 0px' }) },
  'box-shadow': {
    shadows: [
      { x: 0, y: 2, blur: 4, color: color('000000', 0.2), inset: false },
      { x: 0, y: 8, blur: 24, color: color('000000', 0.1), inset: false },
    ],
  },
}

function fallbackFor(property: UnmappedProperty): Fallback | undefined {
  const record = boxRecord({ style: style(UNMAPPED_STYLES[property]) })
  return planSlide([record], CONTEXT).fallbacks[0]
}

describe('UNMAPPED_PROPERTIES', () => {
  it('should list a style for every unmapped property', () => {
    expect(Object.keys(UNMAPPED_STYLES).sort()).toEqual(
      [...UNMAPPED_PROPERTIES].sort(),
    )
  })

  it('should name background-image in the fallback reason', () => {
    expect(fallbackFor('background-image')?.properties).toEqual([
      'background-image',
    ])
  })

  it('should name transform in the fallback reason', () => {
    expect(fallbackFor('transform')?.properties).toEqual(['transform'])
  })

  it('should name filter in the fallback reason', () => {
    expect(fallbackFor('filter')?.properties).toEqual(['filter'])
  })

  it('should name clip-path in the fallback reason', () => {
    expect(fallbackFor('clip-path')?.properties).toEqual(['clip-path'])
  })

  it('should name mask in the fallback reason', () => {
    expect(fallbackFor('mask')?.properties).toEqual(['mask'])
  })

  it('should name mix-blend-mode in the fallback reason', () => {
    expect(fallbackFor('mix-blend-mode')?.properties).toEqual([
      'mix-blend-mode',
    ])
  })

  it('should name backdrop-filter in the fallback reason', () => {
    expect(fallbackFor('backdrop-filter')?.properties).toEqual([
      'backdrop-filter',
    ])
  })

  it('should name a second box-shadow in the fallback reason', () => {
    expect(fallbackFor('box-shadow')?.properties).toEqual(['box-shadow'])
  })

  it('should name a one-sided border in the fallback reason', () => {
    expect(fallbackFor('border')?.properties).toEqual(['border'])
  })

  it('should name corners of differing radius in the fallback reason', () => {
    expect(fallbackFor('border-radius')?.properties).toEqual(['border-radius'])
  })

  it('should keep a table native when a cell draws only its bottom edge', () => {
    const record: Kind<'table'> = {
      ...base(1),
      kind: 'table',
      rows: [
        [
          cell({
            style: style({
              raw: raw({
                borderWidth: '0px 0px 1px',
                borderStyle: 'none none solid',
              }),
            }),
          }),
        ],
      ],
    }

    expect(planSlide([record], CONTEXT).fallbacks).toEqual([])
  })

  it('should send a table to a picture when its cell edges differ in color', () => {
    const record: Kind<'table'> = {
      ...base(1),
      kind: 'table',
      rows: [
        [
          cell({
            style: style({
              raw: raw({
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'rgb(255, 0, 0) rgb(0, 0, 255)',
              }),
            }),
          }),
        ],
      ],
    }

    expect(planSlide([record], CONTEXT).fallbacks[0]?.properties).toEqual([
      'border',
    ])
  })
})
