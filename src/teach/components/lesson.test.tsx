/** @jsxImportSource ../html */
import { describe, expect, it } from 'vitest'
import { Heading } from '@/teach/components/heading'
import { List } from '@/teach/components/list'
import { Paragraph } from '@/teach/components/paragraph'
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
})
