import { describe, expect, it } from 'vitest'

import { placementReader } from '@/comments/placement'

/** The placement of the comment marked `/*@*\/` in a source. */
function placementOf(source: string, path = 'a.ts'): string {
  const offset = source.indexOf('/*@*/')
  if (offset === -1) throw new Error('no marker in the source')
  return placementReader(path, source)(offset)
}

describe('placementReader', () => {
  it.each([
    ['an arrow body', 'const a = () => {\n  /*@*/\n}\n'],
    ['a method body', 'class A {\n  b() {\n    /*@*/\n  }\n}\n'],
    [
      'a getter body',
      'class A {\n  get b() {\n    /*@*/\n    return 1\n  }\n}\n',
    ],
    ['a constructor body', 'class A {\n  constructor() {\n    /*@*/\n  }\n}\n'],
    [
      'the heading of a nested function',
      'function a() {\n  /*@*/\n  function b() {}\n}\n',
    ],
    [
      'a body after a return type object literal',
      'function a(): { b: number } {\n  /*@*/\n  return { b: 1 }\n}\n',
    ],
    [
      'a body after a string carrying a brace',
      "function a() {\n  const b = '}'\n  /*@*/\n}\n",
    ],
    [
      'a body after a template carrying a brace',
      'function a() {\n  const b = `}${1}`\n  /*@*/\n}\n',
    ],
    ['a test runner callback', "it('a', () => {\n  /*@*/\n})\n"],
  ])('should read a comment in %s as body', (_, source) => {
    expect(placementOf(source)).toBe('body')
  })

  it.each([
    [
      'a JSDoc block above a function',
      '/*@*/\nfunction a() {\n  return 1\n}\n',
    ],
    ['a class body', 'class A {\n  /*@*/\n  b = 1\n}\n'],
    ['a module-level object literal', 'const a = {\n  /*@*/\n  b: 1,\n}\n'],
    [
      'a return type object literal',
      'function a(): {\n  /*@*/\n  b: number\n} {\n  return { b: 1 }\n}\n',
    ],
    ['a module-level if block', 'if (a) {\n  /*@*/\n}\n'],
    ['the code after a body closes', 'function a() {}\n/*@*/\n'],
  ])('should read a comment in %s as head', (_, source) => {
    expect(placementOf(source)).toBe('head')
  })

  it('should read JSX in a tsx file', () => {
    const source =
      'function A() {\n  /*@*/\n  return <div style={{ a: 1 }}>{b}</div>\n}\n'

    expect(placementOf(source, 'a.tsx')).toBe('body')
  })
})
