import { describe, expect, it } from 'vitest'
import {
  addMotion,
  type EntranceSpec,
  entranceShapes,
  type SlideMotion,
} from '@/slides/package/motion'

const shape = (id: number, name: string): string =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr></p:sp>`

function slideXml(names: readonly string[] = ['canon-1', 'canon-2']): string {
  const shapes = names.map((name, index) => shape(index + 2, name)).join('')
  return `<p:sld><p:cSld><p:spTree>${shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`
}

function entrance(overrides: Partial<EntranceSpec> = {}): EntranceSpec {
  return {
    selector: 'h2',
    effect: 'fade',
    shapes: ['canon-1'],
    ...overrides,
  }
}

function motion(overrides: Partial<SlideMotion> = {}): SlideMotion {
  return { entrances: [], ...overrides }
}

const spTargets = (xml: string): string[] =>
  [...xml.matchAll(/<p:spTgt spid="(\d+)"\/>/g)].map((match) => match[1] ?? '')

const clickTargets = (xml: string): string[] =>
  [...xml.matchAll(/nodeType="clickEffect">.*?<p:spTgt spid="(\d+)"\/>/g)].map(
    (match) => match[1] ?? '',
  )

describe('entranceShapes', () => {
  const records = [
    { id: 1, parent: null },
    { id: 2, parent: 1 },
    { id: 3, parent: 2 },
    { id: 4, parent: null },
  ]
  const names = records.map((record) => ({
    record: record.id,
    name: `canon-${record.id}`,
  }))

  it('should take every shape drawn from the element and its descendants', () => {
    expect(entranceShapes(1, records, names, new Set([1]))).toEqual([
      'canon-1',
      'canon-2',
      'canon-3',
    ])
  })

  it('should leave out a descendant that declares its own entrance', () => {
    expect(entranceShapes(1, records, names, new Set([1, 2]))).toEqual([
      'canon-1',
    ])
  })

  it('should take nothing for an element that was never walked', () => {
    expect(entranceShapes(null, records, names, new Set())).toEqual([])
  })
})

describe('addMotion', () => {
  it('should give a target sharing its id with another shape an id of its own', () => {
    const xml = `<p:sld><p:cSld><p:spTree>${shape(2, 'canon-1')}${shape(3, 'canon-2')}${shape(2, 'canon-3')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`

    const result = addMotion(
      xml,
      motion({ entrances: [entrance({ shapes: ['canon-3'] })] }),
    )

    expect(result.xml).toContain('<p:cNvPr id="4" name="canon-3"/>')
    expect(spTargets(result.xml)).toEqual(['4', '4'])
  })

  it('should leave a slide with no motion untouched', () => {
    const xml = slideXml()

    const result = addMotion(xml, motion())

    expect(result).toEqual({ xml, notices: [] })
  })

  it('should write the transition after the color map override', () => {
    const result = addMotion(
      slideXml(),
      motion({ transition: { effect: 'fade' } }),
    )

    expect(result.xml).toContain(
      '</p:clrMapOvr><p:transition spd="med"><p:fade/></p:transition>',
    )
  })

  it.each([
    ['push', '<p:push/>'],
    ['wipe', '<p:wipe/>'],
    ['cover', '<p:cover/>'],
  ])('should write the %s transition', (effect, element) => {
    const result = addMotion(slideXml(), motion({ transition: { effect } }))

    expect(result.xml).toContain(`${element}</p:transition>`)
  })

  it.each([
    ['400', 'fast'],
    ['750ms', 'med'],
    ['1.2s', 'slow'],
  ])('should round a %s transition to %s speed', (duration, speed) => {
    const result = addMotion(
      slideXml(),
      motion({ transition: { effect: 'fade', duration } }),
    )

    expect(result.xml).toContain(`<p:transition spd="${speed}">`)
  })

  it('should target the shape the entrance names', () => {
    const result = addMotion(
      slideXml(),
      motion({ entrances: [entrance({ shapes: ['canon-2'] })] }),
    )

    expect(spTargets(result.xml)).toEqual(['3', '3'])
  })

  it('should write the timing after the transition', () => {
    const result = addMotion(
      slideXml(),
      motion({ transition: { effect: 'fade' }, entrances: [entrance()] }),
    )

    expect(result.xml).toMatch(
      /<\/p:transition><p:timing>.*<\/p:timing><\/p:sld>$/,
    )
  })

  it.each([
    ['fade', 'presetID="10"', 'filter="fade"'],
    ['fly', 'presetID="2"', '<p:attrName>ppt_y</p:attrName>'],
    ['wipe', 'presetID="22"', 'filter="wipe(right)"'],
    ['zoom', 'presetID="53"', '<p:attrName>ppt_w</p:attrName>'],
  ])('should write the %s entrance', (effect, preset, behavior) => {
    const result = addMotion(
      slideXml(),
      motion({ entrances: [entrance({ effect })] }),
    )

    expect(result.xml).toContain(preset)
    expect(result.xml).toContain(behavior)
  })

  it('should make every entrance appear before it animates', () => {
    const result = addMotion(slideXml(), motion({ entrances: [entrance()] }))

    expect(result.xml).toContain('<p:strVal val="visible"/>')
  })

  it('should take the entrance duration in milliseconds', () => {
    const result = addMotion(
      slideXml(),
      motion({ entrances: [entrance({ duration: '0.8s' })] }),
    )

    expect(result.xml).toContain('<p:cTn id="7" dur="800"/>')
  })

  it('should play three entrances in their declared order across clicks', () => {
    const entrances = [
      entrance({ selector: 'p.c', shapes: ['canon-3'], order: '3' }),
      entrance({ selector: 'p.a', shapes: ['canon-1'], order: '1' }),
      entrance({ selector: 'p.b', shapes: ['canon-2'], order: '2' }),
    ]

    const result = addMotion(
      slideXml(['canon-1', 'canon-2', 'canon-3']),
      motion({ entrances }),
    )

    expect(clickTargets(result.xml)).toEqual(['2', '3', '4'])
  })

  it('should play an unordered entrance after the ordered ones', () => {
    const entrances = [
      entrance({ selector: 'p.a', shapes: ['canon-1'] }),
      entrance({ selector: 'p.b', shapes: ['canon-2'], order: '1' }),
    ]

    const result = addMotion(slideXml(), motion({ entrances }))

    expect(clickTargets(result.xml)).toEqual(['3', '2'])
  })

  it('should bring every shape of one element in on the same click', () => {
    const result = addMotion(
      slideXml(),
      motion({ entrances: [entrance({ shapes: ['canon-1', 'canon-2'] })] }),
    )

    expect(result.xml.match(/nodeType="clickEffect"/g)).toHaveLength(1)
    expect(result.xml.match(/nodeType="withEffect"/g)).toHaveLength(1)
  })

  it('should number every timing node once', () => {
    const entrances = [
      entrance({ shapes: ['canon-1'] }),
      entrance({ selector: 'p', effect: 'fly', shapes: ['canon-2'] }),
    ]

    const result = addMotion(slideXml(), motion({ entrances }))

    const ids = [...result.xml.matchAll(/<p:cTn id="(\d+)"/g)].map(
      (match) => match[1],
    )
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('should refuse an unknown entrance by name and keep the rest', () => {
    const entrances = [
      entrance({ selector: 'p.spin', effect: 'spin', shapes: ['canon-1'] }),
      entrance({ selector: 'p.ok', shapes: ['canon-2'] }),
    ]

    const result = addMotion(slideXml(), motion({ entrances }))

    expect(result.notices).toEqual([
      'p.spin: unknown entrance spin. Use fade, fly, wipe, or zoom',
    ])
    expect(clickTargets(result.xml)).toEqual(['3'])
  })

  it('should refuse an unknown transition by name', () => {
    const result = addMotion(
      slideXml(),
      motion({ transition: { effect: 'morph' } }),
    )

    expect(result.notices).toEqual([
      'unknown transition morph. Use fade, push, wipe, or cover',
    ])
    expect(result.xml).not.toContain('<p:transition')
  })

  it('should report an entrance on an element that drew no shape', () => {
    const result = addMotion(
      slideXml(),
      motion({ entrances: [entrance({ selector: 'div.empty', shapes: [] })] }),
    )

    expect(result.notices).toEqual([
      'div.empty: draws no shape, so its entrance has nothing to animate',
    ])
    expect(result.xml).not.toContain('<p:timing>')
  })

  it('should refuse a slide with no color map override', () => {
    const xml = '<p:sld><p:cSld><p:spTree/></p:cSld></p:sld>'

    const result = addMotion(xml, motion({ transition: { effect: 'fade' } }))

    expect(result).toEqual({
      xml,
      notices: [
        'no </p:clrMapOvr> to anchor motion after, so none was written',
      ],
    })
  })
})
