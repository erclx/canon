import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  TEACH_SIDEBAR_BREAKPOINT,
  TEACH_STYLESHEET_COMPONENTS,
} from '@/design/components'
import { buildDesignCss } from '@/design/css'
import { FAVICON_COLORS } from '@/design/favicon'
import { focusLine, generateNav } from '@/teach/nav'
import {
  listWorkspaces,
  openWorkspace,
  teachDir,
  writeStylesheet,
} from '@/teach/workspace'

let ROOT: string

const REQUEST = {
  topic: 'regular-expressions',
  subject: 'Reading and writing regular expressions',
  startingPoint: 'Comfortable with the shell, has never written a group',
  success: ['Write a pattern matching a date', 'Explain a backreference'],
  outOfScope: [],
  date: '2026-08-19',
}

function workspaceDir(slug: string): string {
  return join(teachDir(ROOT), slug)
}

/** The exact link the authoring skill used to have a session write into every page. */
const HAND_WRITTEN_ICON = `<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='10 10 80 80'%3E%3Cpath d='M34,20 L15,28 L15,72 L34,80 Z M66,20 L85,28 L85,72 L66,80 Z' fill='rgb(224,114,75)' /%3E%3Crect x='44' y='15' width='12' height='70' rx='2' fill='rgb(224,114,75)' /%3E%3C/svg%3E" />`

/** The shape the stepper gates, which the skill body now states in full. */
const RADIO_QUIZ = `<div class="quiz">
<div class="q"><p class="q-stem">1. What does a caret anchor?</p>
<label class="opt" data-k="A"><input type="radio" name="q1"><span>The end of the subject</span></label>
<label class="opt" data-k="B"><input type="radio" name="q1" data-a="1"><span>The start of the subject</span></label>
<div class="fb"><b>Correct: the start.</b> The dollar anchors the end.</div></div>
</div>`

/** The shape the four lessons already written carry, kept working by a script. */
const BUTTON_QUIZ = `<div class="quiz">
<div class="q"><p class="q-stem">1. What does a caret anchor?</p>
<button class="opt" data-k="A" data-a="0">The end of the subject</button>
<button class="opt" data-k="B" data-a="1">The start of the subject</button>
<div class="fb"><b>Correct: the start.</b> The dollar anchors the end.</div></div>
</div>`

function lessonSkeleton(h1: string, lede: string, body = ''): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${h1}</title>
<!-- canon:teach:style -->
<!-- /canon:teach:style -->
</head>
<body>
<!-- canon:teach:header -->
<!-- /canon:teach:header -->
<main>
<h1>${h1}</h1>
<p class="lede">${lede}</p>
${body}
</main>
<!-- canon:teach:footnav -->
<!-- /canon:teach:footnav -->
<!-- canon:teach:scripts -->
<!-- /canon:teach:scripts -->
</body>
</html>
`
}

async function seedLesson(
  slug: string,
  file: string,
  h1: string,
  lede: string,
  body = '',
): Promise<string> {
  const dir = join(workspaceDir(slug), 'lessons')
  mkdirSync(dir, { recursive: true })
  const path = join(dir, file)
  await writeFile(path, lessonSkeleton(h1, lede, body))
  return path
}

async function seedGlossary(
  slug: string,
  entries: readonly string[],
): Promise<void> {
  const path = join(workspaceDir(slug), 'GLOSSARY.md')
  await writeFile(path, `${entries.map((entry) => `- ${entry}`).join('\n')}\n`)
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-teach-nav-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('focusLine', () => {
  it('should reach the very bottom of the viewport at max scroll', () => {
    for (const innerHeight of [400, 600, 900, 1200, 2000]) {
      expect(focusLine(1000, 1000, innerHeight)).toBe(innerHeight)
    }
  })

  it('should reach a heading with under 120px of trailing content across several viewport heights', () => {
    for (const innerHeight of [400, 600, 900, 1200, 2000]) {
      const max = 3000
      const trailing = 40
      const lastHeadingTopAtRest = max + innerHeight - trailing

      let reached = false
      for (let scrollY = 0; scrollY <= max; scrollY += 5) {
        const top = lastHeadingTopAtRest - scrollY
        if (top <= focusLine(scrollY, max, innerHeight)) {
          reached = true
          break
        }
      }

      expect(reached).toBe(true)
    }
  })

  it('should stay at innerHeight when the page does not scroll', () => {
    expect(focusLine(0, 0, 800)).toBe(800)
  })
})

describe('generateNav', () => {
  it('should refuse a root carrying no teach folder', async () => {
    expect(await generateNav(ROOT)).toMatchObject({
      ok: false,
      reason: 'no-teach',
    })
  })

  it('should create a contents page for a workspace carrying none yet', async () => {
    await openWorkspace(ROOT, REQUEST)
    const path = join(workspaceDir('01-regular-expressions'), 'index.html')
    expect(existsSync(path)).toBe(false)

    const outcome = await generateNav(ROOT)

    expect(outcome).toMatchObject({ ok: true, lessons: 0 })
    expect(existsSync(path)).toBe(true)

    const text = await readFile(path, 'utf8')
    expect(text).toContain('Write a pattern matching a date')
  })

  it('should render the breadcrumb ancestors as links and the current page as plain text', async () => {
    await openWorkspace(ROOT, REQUEST)
    await generateNav(ROOT)

    const root = await readFile(join(teachDir(ROOT), 'index.html'), 'utf8')
    expect(root).toContain('<span class="crumb crumb-here">Workspaces</span>')
    expect(root).not.toContain('<a class="crumb" href="index.html">')

    const contents = await readFile(
      join(workspaceDir('01-regular-expressions'), 'index.html'),
      'utf8',
    )
    expect(contents).toContain(
      '<a class="crumb" href="../index.html"><span class="crumb-t">Workspaces</span></a>',
    )
    expect(contents).toContain(
      '<span class="crumb crumb-here">Regular expressions</span>',
    )
  })

  it('should wrap a crumb link label in its own span, since the cap trim is ignored on the inline-flex link', async () => {
    await openWorkspace(ROOT, REQUEST)
    await generateNav(ROOT)

    const contents = await readFile(
      join(workspaceDir('01-regular-expressions'), 'index.html'),
      'utf8',
    )
    expect(contents).toMatch(
      /<a class="crumb" href="[^"]+"><span class="crumb-t">[^<]+<\/span><\/a>/,
    )
    expect(contents).not.toMatch(/<a class="crumb" href="[^"]+">[^<]/)
  })

  it('should link a generated course.css from the root page rather than embedding it', async () => {
    await openWorkspace(ROOT, REQUEST)
    await generateNav(ROOT)

    const root = await readFile(join(teachDir(ROOT), 'index.html'), 'utf8')
    expect(root).toContain('<link rel="stylesheet" href="course.css">')
    expect(root).not.toContain('<style>')

    const css = await readFile(join(teachDir(ROOT), 'course.css'), 'utf8')
    expect(css).toContain('.bar {')
    expect(css).toContain('.status::before')
  })

  it('should still list exactly one workspace after the root stylesheet is written', async () => {
    await openWorkspace(ROOT, REQUEST)
    await generateNav(ROOT)
    await generateNav(ROOT)

    const listed = await listWorkspaces(ROOT)

    expect(listed).toMatchObject({ ok: true })
    expect(listed.ok && listed.workspaces).toHaveLength(1)
  })

  it('should carry the close-on-outside-click script on every generated page', async () => {
    await openWorkspace(ROOT, REQUEST)
    await writeStylesheet(ROOT, 'regular-expressions')
    await seedLesson(
      '01-regular-expressions',
      '0001-anchors.html',
      'Anchors',
      'Where a pattern starts and ends.',
    )

    await generateNav(ROOT)

    const root = await readFile(join(teachDir(ROOT), 'index.html'), 'utf8')
    const contents = await readFile(
      join(workspaceDir('01-regular-expressions'), 'index.html'),
      'utf8',
    )
    const lesson = await readFile(
      join(
        workspaceDir('01-regular-expressions'),
        'lessons',
        '0001-anchors.html',
      ),
      'utf8',
    )

    for (const page of [root, contents, lesson]) {
      expect(page).toContain('details.jump[open]')
    }
  })

  it('should refuse a lesson missing a chrome marker, leaving it untouched', async () => {
    await openWorkspace(ROOT, REQUEST)
    await writeStylesheet(ROOT, 'regular-expressions')
    const path = join(
      workspaceDir('01-regular-expressions'),
      'lessons',
      '0001-anchors.html',
    )
    mkdirSync(join(workspaceDir('01-regular-expressions'), 'lessons'), {
      recursive: true,
    })
    const original = lessonSkeleton(
      'Anchors',
      'Where a pattern starts.',
    ).replace(
      '<!-- canon:teach:footnav -->\n<!-- /canon:teach:footnav -->\n',
      '',
    )
    await writeFile(path, original)

    const outcome = await generateNav(ROOT)

    expect(outcome).toMatchObject({
      ok: true,
      lessons: 0,
      skipped: [{ missing: 'canon:teach:footnav' }],
    })
    expect(await readFile(path, 'utf8')).toBe(original)
  })

  it('should embed a rule appended to course.css after the lesson was written', async () => {
    await openWorkspace(ROOT, REQUEST)
    await writeStylesheet(ROOT, 'regular-expressions')
    await seedLesson(
      '01-regular-expressions',
      '0001-anchors.html',
      'Anchors',
      'Where a pattern starts and ends.',
    )

    await generateNav(ROOT)

    const cssPath = join(
      workspaceDir('01-regular-expressions'),
      'assets',
      'course.css',
    )
    const css = await readFile(cssPath, 'utf8')
    await writeFile(cssPath, `${css}\n.added-later { color: red; }\n`)

    await generateNav(ROOT)

    const lesson = await readFile(
      join(
        workspaceDir('01-regular-expressions'),
        'lessons',
        '0001-anchors.html',
      ),
      'utf8',
    )
    expect(lesson).toContain('.added-later { color: red; }')
  })

  it('should drop the unresolvable @import from a lesson inlining course.css', async () => {
    await openWorkspace(ROOT, REQUEST)
    await writeStylesheet(ROOT, 'regular-expressions')
    const path = await seedLesson(
      '01-regular-expressions',
      '0001-anchors.html',
      'Anchors',
      'Where a pattern starts and ends.',
    )

    await generateNav(ROOT)

    const lesson = await readFile(path, 'utf8')
    expect(lesson).not.toContain('@import')
    expect(lesson).toContain('<style>')
  })

  it('should seed the stylesheet pair a contents page links when the workspace has none', async () => {
    await openWorkspace(ROOT, REQUEST)
    const assets = join(workspaceDir('01-regular-expressions'), 'assets')
    expect(existsSync(join(assets, 'course.css'))).toBe(false)

    await generateNav(ROOT)

    expect(existsSync(join(assets, 'course.css'))).toBe(true)
    expect(existsSync(join(assets, 'base.css'))).toBe(true)
  })

  it('should keep a workspace course.css it already holds when seeding', async () => {
    await openWorkspace(ROOT, REQUEST)
    await writeStylesheet(ROOT, 'regular-expressions')
    const cssPath = join(
      workspaceDir('01-regular-expressions'),
      'assets',
      'course.css',
    )
    await writeFile(cssPath, '.mine { color: red; }\n')

    await generateNav(ROOT)

    expect(await readFile(cssPath, 'utf8')).toBe('.mine { color: red; }\n')
  })

  it('should place the quiz stepper after the embedded stylesheet', async () => {
    await openWorkspace(ROOT, REQUEST)
    await writeStylesheet(ROOT, 'regular-expressions')
    await seedLesson(
      '01-regular-expressions',
      '0001-anchors.html',
      'Anchors',
      'Where a pattern starts and ends.',
      RADIO_QUIZ,
    )

    await generateNav(ROOT)

    const lesson = await readFile(
      join(
        workspaceDir('01-regular-expressions'),
        'lessons',
        '0001-anchors.html',
      ),
      'utf8',
    )

    const stepper = lesson.indexOf('@supports selector(:has(*))')
    expect(stepper).toBeGreaterThan(-1)
    expect(stepper).toBeGreaterThan(lesson.indexOf('--ink'))
    expect(stepper).toBeLessThan(lesson.indexOf('</style>'))
  })

  it('should gate on every later question rather than the next one alone', async () => {
    await openWorkspace(ROOT, REQUEST)
    await seedLesson(
      '01-regular-expressions',
      '0001-anchors.html',
      'Anchors',
      'Where a pattern starts and ends.',
      RADIO_QUIZ,
    )

    await generateNav(ROOT)

    const lesson = await readFile(
      join(
        workspaceDir('01-regular-expressions'),
        'lessons',
        '0001-anchors.html',
      ),
      'utf8',
    )

    // The general sibling combinator keeps gating when something sits between
    // two questions, where the adjacent one matches nothing and shows them all.
    expect(lesson).toContain(
      '.quiz .q:not(:has(input[type="radio"]:checked)) ~ .q',
    )
    expect(lesson).not.toContain(
      '.quiz .q:not(:has(input[type="radio"]:checked)) + .q',
    )
  })

  it('should carry the stepper on a lesson holding no quiz at all', async () => {
    await openWorkspace(ROOT, REQUEST)
    await writeStylesheet(ROOT, 'regular-expressions')
    await seedLesson(
      '01-regular-expressions',
      '0001-anchors.html',
      'Anchors',
      'Where a pattern starts and ends.',
    )

    await generateNav(ROOT)

    const lesson = await readFile(
      join(
        workspaceDir('01-regular-expressions'),
        'lessons',
        '0001-anchors.html',
      ),
      'utf8',
    )
    expect(lesson).toContain('@supports selector(:has(*))')
  })

  it('should give a radio quiz no script, since the stepper needs none', async () => {
    await openWorkspace(ROOT, REQUEST)
    await seedLesson(
      '01-regular-expressions',
      '0001-anchors.html',
      'Anchors',
      'Where a pattern starts and ends.',
      RADIO_QUIZ,
    )

    await generateNav(ROOT)

    const lesson = await readFile(
      join(
        workspaceDir('01-regular-expressions'),
        'lessons',
        '0001-anchors.html',
      ),
      'utf8',
    )
    expect(lesson).not.toContain('classList.add("show")')
  })

  it('should still script a lesson written against the button shape', async () => {
    await openWorkspace(ROOT, REQUEST)
    await seedLesson(
      '01-regular-expressions',
      '0001-anchors.html',
      'Anchors',
      'Where a pattern starts and ends.',
      BUTTON_QUIZ,
    )

    await generateNav(ROOT)

    const lesson = await readFile(
      join(
        workspaceDir('01-regular-expressions'),
        'lessons',
        '0001-anchors.html',
      ),
      'utf8',
    )
    expect(lesson).toContain('classList.add("show")')
  })

  it('should keep the stepper off a lesson written against the button shape', async () => {
    await openWorkspace(ROOT, REQUEST)
    await seedLesson(
      '01-regular-expressions',
      '0001-anchors.html',
      'Anchors',
      'Where a pattern starts and ends.',
      BUTTON_QUIZ,
    )

    await generateNav(ROOT)

    const lesson = await readFile(
      join(
        workspaceDir('01-regular-expressions'),
        'lessons',
        '0001-anchors.html',
      ),
      'utf8',
    )
    expect(lesson).not.toContain('@supports selector(:has(*))')
  })

  it('should be byte-identical on a second run against unchanged sources', async () => {
    await openWorkspace(ROOT, REQUEST)
    await writeStylesheet(ROOT, 'regular-expressions')
    await seedLesson(
      '01-regular-expressions',
      '0001-anchors.html',
      'Anchors',
      'Where a pattern starts and ends.',
    )
    await seedLesson(
      '01-regular-expressions',
      '0002-groups.html',
      'Capture groups',
      'A parenthesised part of a pattern whose match is kept.',
      RADIO_QUIZ,
    )

    await generateNav(ROOT)

    const paths = [
      join(teachDir(ROOT), 'index.html'),
      join(workspaceDir('01-regular-expressions'), 'index.html'),
      join(
        workspaceDir('01-regular-expressions'),
        'lessons',
        '0001-anchors.html',
      ),
      join(
        workspaceDir('01-regular-expressions'),
        'lessons',
        '0002-groups.html',
      ),
    ]
    const first = await Promise.all(paths.map((path) => readFile(path, 'utf8')))

    await generateNav(ROOT)

    const second = await Promise.all(
      paths.map((path) => readFile(path, 'utf8')),
    )

    expect(second).toEqual(first)
  })

  it('should write the previous and next links between two lessons', async () => {
    await openWorkspace(ROOT, REQUEST)
    await writeStylesheet(ROOT, 'regular-expressions')
    await seedLesson(
      '01-regular-expressions',
      '0001-anchors.html',
      'Anchors',
      'Where a pattern starts and ends.',
    )
    await seedLesson(
      '01-regular-expressions',
      '0002-groups.html',
      'Capture groups',
      'A parenthesised part of a pattern whose match is kept.',
    )

    await generateNav(ROOT)

    const first = await readFile(
      join(
        workspaceDir('01-regular-expressions'),
        'lessons',
        '0001-anchors.html',
      ),
      'utf8',
    )
    const second = await readFile(
      join(
        workspaceDir('01-regular-expressions'),
        'lessons',
        '0002-groups.html',
      ),
      'utf8',
    )

    expect(first).toContain('href="0002-groups.html"')
    expect(second).toContain('<span class="end">')
    expect(second).toContain('href="0001-anchors.html"')
    expect(second).toContain('Anchors')
  })

  it('should group glossary entries by lesson, in lesson order, under the lesson title', async () => {
    await openWorkspace(ROOT, REQUEST)
    await seedLesson(
      '01-regular-expressions',
      '0001-anchors.html',
      'Anchors',
      'Where a pattern starts and ends.',
    )
    await seedLesson(
      '01-regular-expressions',
      '0002-groups.html',
      'Capture groups',
      'A parenthesised part of a pattern whose match is kept.',
    )
    await seedGlossary('01-regular-expressions', [
      '**anchor**: Marks a fixed position in the subject. First seen in 0001-anchors.html.',
      '**backreference**: Refers to an earlier capture group. First seen in 0002-groups.html.',
      '**capture group**: A parenthesised part of a pattern whose match is kept. First seen in 0002-groups.html.',
    ])

    await generateNav(ROOT)

    const contents = await readFile(
      join(workspaceDir('01-regular-expressions'), 'index.html'),
      'utf8',
    )

    const anchorsHeading = contents.indexOf(
      '<h3 class="gloss-group">Anchors</h3>',
    )
    const groupsHeading = contents.indexOf(
      '<h3 class="gloss-group">Capture groups</h3>',
    )
    const anchorTerm = contents.indexOf('<b>anchor</b>')
    const backreferenceTerm = contents.indexOf('<b>backreference</b>')
    const captureGroupTerm = contents.indexOf('<b>capture group</b>')

    expect(anchorsHeading).toBeGreaterThan(-1)
    expect(groupsHeading).toBeGreaterThan(anchorsHeading)
    expect(anchorTerm).toBeGreaterThan(anchorsHeading)
    expect(anchorTerm).toBeLessThan(groupsHeading)
    expect(backreferenceTerm).toBeGreaterThan(groupsHeading)
    expect(captureGroupTerm).toBeGreaterThan(groupsHeading)
  })

  it('should collect an entry with no First seen citation under a trailing Other terms group', async () => {
    await openWorkspace(ROOT, REQUEST)
    await seedLesson(
      '01-regular-expressions',
      '0001-anchors.html',
      'Anchors',
      'Where a pattern starts and ends.',
    )
    await seedGlossary('01-regular-expressions', [
      '**anchor**: Marks a fixed position in the subject. First seen in 0001-anchors.html.',
      '**delimiter**: The character marking a pattern boundary.',
    ])

    await generateNav(ROOT)

    const contents = await readFile(
      join(workspaceDir('01-regular-expressions'), 'index.html'),
      'utf8',
    )

    const anchorsHeading = contents.indexOf(
      '<h3 class="gloss-group">Anchors</h3>',
    )
    const otherHeading = contents.indexOf(
      '<h3 class="gloss-group">Other terms</h3>',
    )
    const delimiterTerm = contents.indexOf('<b>delimiter</b>')

    expect(otherHeading).toBeGreaterThan(anchorsHeading)
    expect(delimiterTerm).toBeGreaterThan(otherHeading)
  })

  it('should report a state on the root listing only where it differs, and none on a lesson row', async () => {
    await openWorkspace(ROOT, REQUEST)
    await seedLesson(
      '01-regular-expressions',
      '0001-anchors.html',
      'Anchors',
      'Where a pattern starts and ends.',
    )

    await generateNav(ROOT)

    const root = await readFile(join(teachDir(ROOT), 'index.html'), 'utf8')
    const contents = await readFile(
      join(workspaceDir('01-regular-expressions'), 'index.html'),
      'utf8',
    )

    expect(root).not.toContain('state done')
    expect(contents).not.toContain('class="state')
  })

  it('should put the term count beside the glossary filter', async () => {
    await openWorkspace(ROOT, REQUEST)
    await seedLesson(
      '01-regular-expressions',
      '0001-anchors.html',
      'Anchors',
      'Where a pattern starts and ends.',
    )
    await seedGlossary('01-regular-expressions', [
      '**anchor**: Marks a fixed position. First seen in 0001-anchors.html.',
    ])

    await generateNav(ROOT)

    const contents = await readFile(
      join(workspaceDir('01-regular-expressions'), 'index.html'),
      'utf8',
    )

    expect(contents).toContain('<h2>Glossary</h2>')
    expect(contents).toMatch(
      /<div class="filter-row"><input class="filter"[^>]*id="gfilter"[^>]*><span class="filter-count" id="gloss-count"[^>]*>1 term<\/span><\/div>/,
    )
  })

  it('should render every term as a flat .gterm sibling so the workspace-wide filter still matches across every group', async () => {
    await openWorkspace(ROOT, REQUEST)
    await seedLesson(
      '01-regular-expressions',
      '0001-anchors.html',
      'Anchors',
      'Where a pattern starts and ends.',
    )
    await seedLesson(
      '01-regular-expressions',
      '0002-groups.html',
      'Capture groups',
      'A parenthesised part of a pattern whose match is kept.',
    )
    const entries = [
      '**anchor**: Marks a fixed position in the subject. First seen in 0001-anchors.html.',
      '**capture group**: A parenthesised part of a pattern whose match is kept. First seen in 0002-groups.html.',
      '**delimiter**: The character marking a pattern boundary.',
    ]
    await seedGlossary('01-regular-expressions', entries)

    await generateNav(ROOT)

    const contents = await readFile(
      join(workspaceDir('01-regular-expressions'), 'index.html'),
      'utf8',
    )

    expect(contents.match(/class="gterm"/g)).toHaveLength(entries.length)
    expect(contents).toContain('list.querySelectorAll(".gterm")')
    expect(contents).toContain('updateGroups()')
  })
})

describe('course sidebar', () => {
  function basename(file: string): string {
    return file.replace(/^\d+-/, '').replace(/\.html$/, '')
  }

  /** The three page kinds the chrome renders, read back off one generated tree. */
  async function generateThreePages(
    lessonFiles: readonly string[] = ['0001-anchors.html'],
  ): Promise<{ root: string; contents: string; lesson: string }> {
    await openWorkspace(ROOT, REQUEST)
    await writeStylesheet(ROOT, 'regular-expressions')

    for (const file of lessonFiles) {
      await seedLesson(
        '01-regular-expressions',
        file,
        basename(file),
        'Where a pattern starts and ends.',
        '<h2>First</h2><p>One.</p><h2>Second</h2><p>Two.</p>',
      )
    }

    await generateNav(ROOT)

    return {
      root: await readFile(join(teachDir(ROOT), 'index.html'), 'utf8'),
      contents: await readFile(
        join(workspaceDir('01-regular-expressions'), 'index.html'),
        'utf8',
      ),
      lesson: await readFile(
        join(workspaceDir('01-regular-expressions'), 'lessons', lessonFiles[0]),
        'utf8',
      ),
    }
  }

  it('should carry the sidebar and its content pane on every page kind', async () => {
    const pages = await generateThreePages()

    for (const page of [pages.root, pages.contents, pages.lesson]) {
      expect(page).toContain('<aside class="sb">')
      expect(page).toContain('<div class="pane">')
      expect(page).toContain('class="sb-fold"')
    }
  })

  it('should close the content pane after the footer navigation on a lesson', async () => {
    const { lesson } = await generateThreePages()

    expect(lesson.indexOf('<div class="pane">')).toBeLessThan(
      lesson.indexOf('<main'),
    )
    expect(lesson.indexOf('</nav>\n</div>')).toBeGreaterThan(
      lesson.indexOf('</main>'),
    )
  })

  it('should retire the segmented progress track from all three page kinds', async () => {
    const pages = await generateThreePages()

    for (const page of [pages.root, pages.contents, pages.lesson]) {
      expect(page).not.toContain('class="track"')
    }
  })

  it('should list every lesson in the sidebar and mark the one being read', async () => {
    const { lesson } = await generateThreePages([
      '0001-anchors.html',
      '0002-groups.html',
    ])

    expect(lesson.match(/class="sb-l(?: sb-on)?"/g)).toHaveLength(2)
    expect(lesson.match(/class="sb-l sb-on"/g)).toHaveLength(1)
  })

  it('should fold the outline under the lesson being read rather than beside it', async () => {
    const { lesson, contents } = await generateThreePages()

    expect(lesson.indexOf('<div class="sb-out-slot"></div>')).toBeGreaterThan(
      lesson.indexOf('class="sb-l sb-on"'),
    )
    expect(contents).not.toContain('<div class="sb-out-slot"></div>')
  })

  it('should retire the fixed outline rail the lesson used to build after the body', async () => {
    const { lesson } = await generateThreePages()

    expect(lesson).not.toContain('nav.className = "outline"')
    expect(lesson).not.toContain('class="outline"')
  })

  it('should carry a lesson count in the workspace menu and nothing in the lesson menu', async () => {
    const { lesson } = await generateThreePages([
      '0001-anchors.html',
      '0002-groups.html',
    ])

    expect(lesson).toContain('<span class="ct">2</span>')
    expect(lesson).not.toContain('class="dot"')
  })

  it('should show the filter only once the list is longer than a reader can scan', async () => {
    const short = await generateThreePages(['0001-anchors.html'])

    expect(short.lesson).not.toContain('class="sb-filter"')

    rmSync(ROOT, { recursive: true, force: true })
    ROOT = mkdtempSync(join(tmpdir(), 'canon-teach-nav-'))

    const many = await generateThreePages(
      Array.from(
        { length: 9 },
        (_, index) => `${String(index + 1).padStart(4, '0')}-lesson.html`,
      ),
    )

    expect(many.lesson).toContain('class="sb-filter"')
  })

  it('should declare the page kind, which is what the pre-paint script branches on', async () => {
    const pages = await generateThreePages()

    expect(pages.contents).toContain('r.dataset.page="index"')
    expect(pages.lesson).toContain('r.dataset.page="lesson"')
    expect(pages.lesson).not.toContain('r.dataset.lessons')
  })

  it('should switch both scripts at the width the stylesheet switches at', async () => {
    const { lesson } = await generateThreePages()
    const css = buildDesignCss(undefined, {
      components: TEACH_STYLESHEET_COMPONENTS,
    })

    const query = `(max-width: ${TEACH_SIDEBAR_BREAKPOINT}px)`
    expect(
      lesson.match(
        new RegExp(`matchMedia\\("${query.replace(/[()]/g, '\\$&')}"\\)`, 'g'),
      ),
    ).toHaveLength(2)
    expect(css).toContain(`@media ${query} {`)
  })

  it('should settle the panel state in the head, before anything paints', async () => {
    const { lesson } = await generateThreePages()

    const head = lesson.slice(0, lesson.indexOf('<body'))
    expect(head).toContain('r.classList.add("sb-shut")')
    expect(head).toContain('s==="shut"||(s===null&&idx)')
    expect(head).toContain('localStorage.getItem("teach-sb-w")')
  })

  it('should return focus to the toggle from every route that shuts the overlay', async () => {
    const { lesson } = await generateThreePages()

    const shutBody = /function shut\(\) \{([\s\S]*?)\n  \}/.exec(lesson)?.[1]
    expect(shutBody).toContain('panel.contains(document.activeElement)')
    expect(shutBody).toContain('fold.focus()')

    // The close control returns focus by calling shut(), not on its own, so
    // Escape and the scrim cannot diverge from it.
    expect(lesson).toContain('close.addEventListener("click", shut)')
  })

  it('should contain Tab within the overlay while it is open', async () => {
    const { lesson } = await generateThreePages()

    expect(lesson).toContain('if (e.key !== "Tab") return;')
    expect(lesson).toContain('panelStops()')
    expect(lesson).toContain('last.focus()')
    expect(lesson).toContain('first.focus()')
    expect(lesson).toContain('e.preventDefault()')
  })

  it('should open the panel as an overlay below the breakpoint, with a scrim and an escape', async () => {
    const { lesson } = await generateThreePages()

    expect(lesson).toContain('matchMedia("(max-width: 1100px)")')
    expect(lesson).toContain('scrim.className = "sb-scrim"')
    expect(lesson).toContain('e.key === "Escape" && narrow.matches')
    expect(lesson).toContain('first.focus()')
  })

  it('should carry exactly one icon link in the head of every page kind, built from the favicon pair', async () => {
    const pages = await generateThreePages()

    for (const page of [pages.root, pages.contents, pages.lesson]) {
      const head = page.slice(0, page.indexOf('</head>'))
      const icons = [...head.matchAll(/<link rel="icon" href="([^"]+)"/g)]
      expect(icons).toHaveLength(1)

      const svg = decodeURIComponent(icons[0][1])
      expect(svg).toContain(FAVICON_COLORS.light)
      expect(svg).toContain(FAVICON_COLORS.dark)
      expect(svg).toContain('prefers-color-scheme: dark')
      expect(page).not.toContain('rgb(224,114,75)')
    }
  })

  it('should drop the icon link the skill once had a lesson write by hand', async () => {
    await openWorkspace(ROOT, REQUEST)
    await writeStylesheet(ROOT, 'regular-expressions')
    const path = await seedLesson(
      '01-regular-expressions',
      '0001-anchors.html',
      'Anchors',
      'Where a pattern starts and ends.',
    )
    const seeded = await readFile(path, 'utf8')
    await writeFile(
      path,
      seeded.replace(
        '<!-- canon:teach:style -->',
        `${HAND_WRITTEN_ICON}\n<!-- canon:teach:style -->`,
      ),
    )

    await generateNav(ROOT)

    const head = (await readFile(path, 'utf8')).split('</head>')[0]
    expect(head.match(/<link rel="icon"/g)).toHaveLength(1)
    expect(head).not.toContain('rgb(224,114,75)')
  })
})
