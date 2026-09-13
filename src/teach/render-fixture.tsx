/** @jsxImportSource ./html */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { TEACH_STYLESHEET_COMPONENTS } from '@/design/components'
import { buildDesignCss } from '@/design/css'
import { TEACH_FONT_FACES } from '@/teach/fonts'
import { Heading } from '@/teach/components/heading'
import { List } from '@/teach/components/list'
import { Paragraph } from '@/teach/components/paragraph'
import { render } from '@/teach/html/jsx-runtime'

/**
 * Regenerates the committed fixture lesson under
 * `examples/teach/00-fixture/`, the same shape `examples/slides/showcase.md`
 * takes against its own hand-rendered snapshot. Run with
 * `bun src/teach/render-fixture.tsx` after a component changes shape.
 */

const FIXTURE_ROOT = join(
  import.meta.dir,
  '..',
  '..',
  'examples',
  'teach',
  '00-fixture',
)
const LESSON_TITLE = 'Compass bearings'
const LESSON_FILE = '0001-compass-bearings.html'

const STEPS = [
  'Point the direction-of-travel arrow at the landmark.',
  'Rotate the bezel until the orienting arrow lines up with the needle.',
  'Read the bearing where the direction-of-travel arrow meets the bezel.',
]

const body = (
  <>
    <Heading level={1}>{LESSON_TITLE}</Heading>
    <Paragraph lede>
      A bearing is the compass direction from where you stand to whatever you
      are aiming at, measured clockwise from north.
    </Paragraph>
    <Paragraph>
      Hold the compass level and let the needle settle before reading anything
      off it. A bearing taken while walking or tilted reads confidently and
      wrong.
    </Paragraph>
    <Paragraph>
      Three steps turn a sighted landmark into a number you can act on:
    </Paragraph>
    <List ordered items={STEPS} />
    <Paragraph>
      The same three steps run in reverse turn a bearing on a map into a
      direction to walk, which is the only reason to learn them in this order.
    </Paragraph>
  </>
)

function page(title: string, main: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="../assets/course.css">
</head>
<body>
<main class="wide-body">
${main}
</main>
</body>
</html>
`
}

async function main(): Promise<void> {
  await mkdir(join(FIXTURE_ROOT, 'lessons'), { recursive: true })
  await mkdir(join(FIXTURE_ROOT, 'assets'), { recursive: true })

  await writeFile(
    join(FIXTURE_ROOT, 'assets', 'course.css'),
    buildDesignCss(undefined, {
      embedFonts: TEACH_FONT_FACES,
      components: TEACH_STYLESHEET_COMPONENTS,
    }),
  )

  await writeFile(
    join(FIXTURE_ROOT, 'lessons', LESSON_FILE),
    page(LESSON_TITLE, render(body)),
  )
}

await main()
