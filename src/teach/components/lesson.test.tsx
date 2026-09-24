/** @jsxImportSource ../html */
import { describe, expect, it } from 'vitest'
import { Heading } from '@/teach/components/heading'
import { List } from '@/teach/components/list'
import { Paragraph } from '@/teach/components/paragraph'
import { Refs } from '@/teach/components/refs'
import { render } from '@/teach/html/jsx-runtime'

describe('lesson components composed as JSX', () => {
  it('should render a heading, both paragraph shapes, and an ordered list in order', () => {
    const body = (
      <>
        <Heading level={1}>Compass bearings</Heading>
        <Paragraph lede>A bearing is a direction.</Paragraph>
        <Paragraph>Hold the compass level.</Paragraph>
        <List ordered items={['Point.', 'Rotate.']} />
      </>
    )

    const html = render(body)

    expect(html).toBe(
      '<h1>Compass bearings</h1>' +
        '<p class="lede">A bearing is a direction.</p>' +
        '<p>Hold the compass level.</p>' +
        '<ol><li>Point.</li><li>Rotate.</li></ol>',
    )
  })

  it('should render a cited paragraph and the reference list it links to', () => {
    const body = (
      <>
        <Paragraph cites={[1]}>North is fixed.</Paragraph>
        <Refs
          items={[
            {
              title: 'Compass manual',
              note: 'Chapter two',
              url: 'https://example.com/compass',
            },
          ]}
        />
      </>
    )

    const html = render(body)

    expect(html).toBe(
      '<p>North is fixed.<sup class="cite"><a href="#r1">1</a></sup></p>' +
        '<ol class="refs"><li id="r1"><cite>Compass manual</cite>. Chapter two' +
        ' <a href="https://example.com/compass">example.com</a></li></ol>',
    )
  })
})
