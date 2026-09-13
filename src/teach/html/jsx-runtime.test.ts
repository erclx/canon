import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { raw } from './raw'
import { Fragment, jsx, jsxs, render, type Props } from './jsx-runtime'

describe('jsx runtime', () => {
  it('should render to a string', () => {
    expect(render(jsx('p', { children: 'hi' }))).toBe('<p>hi</p>')
  })

  it('should carry no react on the import graph', async () => {
    const source = await readFile(
      new URL('./jsx-runtime.ts', import.meta.url),
      'utf8',
    )
    expect(source).not.toMatch(/from ['"]react/)
  })

  it('should escape author text', () => {
    expect(render(jsx('h1', { children: 'Failure modes & rollback' }))).toBe(
      '<h1>Failure modes &amp; rollback</h1>',
    )
  })

  it('should not double-escape an already-escaped ampersand', () => {
    const rendered = render(jsx('h1', { children: 'Failure modes & rollback' }))
    expect(rendered.match(/&amp;/g)).toHaveLength(1)
  })

  it('should render an aria attribute as its literal word', () => {
    expect(render(jsx('a', { 'aria-disabled': true, children: '' }))).toBe(
      '<a aria-disabled="true"></a>',
    )
  })

  it('should write aria false rather than dropping it', () => {
    expect(render(jsx('a', { 'aria-disabled': false, children: '' }))).toBe(
      '<a aria-disabled="false"></a>',
    )
  })

  it('should not double-escape raw markup', () => {
    expect(render(jsx('div', { children: raw('<em>hi</em>') }))).toBe(
      '<div><em>hi</em></div>',
    )
  })

  it('should escape a raw value used in attribute position', () => {
    expect(
      render(jsx('div', { title: raw('a" onload="alert(1)'), children: 'x' })),
    ).toBe('<div title="a&quot; onload=&quot;alert(1)">x</div>')
  })

  it('should escape a rendered component used in attribute position', () => {
    const Badge = (props: Props) => jsx('span', { children: props.children })
    expect(
      render(jsx('div', { title: Badge({ children: 'hi' }), children: 'x' })),
    ).toBe('<div title="&lt;span&gt;hi&lt;/span&gt;">x</div>')
  })

  it('should compose nested components', () => {
    const List = (props: Props) => jsx('ul', { children: props.children })
    const Item = (props: Props) => jsx('li', { children: props.children })

    const rendered = render(
      jsx(List, {
        children: jsxs(Fragment, {
          children: [
            jsx(Item, { children: 'one' }),
            jsx(Item, { children: 'two' }),
          ],
        }),
      }),
    )

    expect(rendered).toBe('<ul><li>one</li><li>two</li></ul>')
  })
})
