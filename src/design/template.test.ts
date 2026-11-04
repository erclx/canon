import { describe, expect, it } from 'vitest'

import { fillTemplate, readTemplate } from '@/design/template'

describe('fillTemplate', () => {
  it('should fill every occurrence of a slot', () => {
    const filled = fillTemplate('{{a}} and {{a}}', { a: 'x' })

    expect(filled).toBe('x and x')
  })

  it('should insert a value verbatim, never reading slots or replacement patterns inside it', () => {
    const filled = fillTemplate('<p>{{a}}</p>{{b}}', {
      a: '{{b}} $& $1',
      b: 'y',
    })

    expect(filled).toBe('<p>{{b}} $& $1</p>y')
  })

  it('should leave single braces in the template alone', () => {
    const filled = fillTemplate('.a { color: {{c}}; }', { c: 'red' })

    expect(filled).toBe('.a { color: red; }')
  })

  it('should throw naming a slot the caller gave no value', () => {
    expect(() => fillTemplate('{{a}} {{b}}', { a: 'x' })).toThrow('{{b}}')
  })

  it('should throw naming a value no slot asks for', () => {
    expect(() => fillTemplate('{{a}}', { a: 'x', stray: 'y' })).toThrow('stray')
  })
})

describe('readTemplate', () => {
  it('should drop the one newline a template file ends on', () => {
    const svg = readTemplate('favicon.svg')

    expect(svg.endsWith('</svg>\n')).toBe(true)
    expect(svg.endsWith('\n\n')).toBe(false)
  })
})
