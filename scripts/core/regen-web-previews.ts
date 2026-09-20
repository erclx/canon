/**
 * Writes `web/public/previews/design-tokens/index.html` and `design.css` by
 * calling `renderDesignDoc` directly, the in-process pattern
 * `regen-web-favicon.ts` already takes rather than spawning a subprocess.
 * Writes `web/public/previews/teach-workspace/` the same way, calling
 * `generateNav` over an isolated copy of one workspace.
 *
 * Both are embedded live in a landing section as an `<iframe>` rather than a
 * screenshot, since `web/e2e/home.spec.ts` asserts no `<img>` renders inside
 * `<main>`.
 */
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DESIGN_DOCUMENT } from '@/design/regen'
import { renderDesignDoc } from '@/design/render'
import { generateNav } from '@/teach/nav'

const root = new URL('../..', import.meta.url).pathname

const { cssPath } = renderDesignDoc(
  `${root}${DESIGN_DOCUMENT}`,
  `${root}web/public/previews/design-tokens`,
  { embedFonts: true },
)

const css = readFileSync(cssPath, 'utf8')
if (!/--(color|space|type|radius)-/.test(css)) {
  console.error(
    'regen-web-previews: design-tokens render carries no custom properties, refusing an empty preview',
  )
  process.exit(1)
}

console.log('regen-web-previews: wrote web/public/previews/design-tokens/')

/**
 * The workspace ships alone, on its own isolated nav tree, rather than
 * copied straight out of `.canon/teach/`. That folder cross-links every
 * sibling workspace by relative path, including the operator's own personal
 * study notes, so a copy carrying its live chrome would ship either dead
 * links or a path into content never meant to be public. Regenerating the
 * chrome over a scratch copy holding this one workspace alone is what keeps
 * the jump menus from naming anything else.
 *
 * `.canon/teach/` is gitignored session scratch, per `standards/teach.md`, so
 * it exists on the machine that authored the lesson and nowhere else,
 * including CI. `web/public/previews/teach-workspace/` is therefore the
 * durable copy: committed once the workspace exists, regenerated here as a
 * local convenience when authoring continues, and left untouched by a build
 * that cannot see the source, the same way a target without Playwright still
 * builds against a committed capture.
 */
const TEACH_SLUG = '04-governance-rule-loading'
const teachSource = `${root}.canon/teach/${TEACH_SLUG}`

if (!existsSync(teachSource)) {
  console.log(
    `regen-web-previews: no workspace at .canon/teach/${TEACH_SLUG} on this machine, leaving the committed web/public/previews/teach-workspace/ as is`,
  )
} else {
  const scratchRoot = mkdtempSync(join(tmpdir(), 'canon-teach-preview-'))
  try {
    cpSync(teachSource, join(scratchRoot, '.canon', 'teach', TEACH_SLUG), {
      recursive: true,
    })

    const nav = await generateNav(scratchRoot)
    if (!nav.ok) {
      console.error(`regen-web-previews: ${nav.message}`)
      process.exit(1)
    }
    if (nav.lessons === 0) {
      console.error(
        'regen-web-previews: teach-workspace render carries no lesson, refusing an empty preview',
      )
      process.exit(1)
    }

    const dest = `${root}web/public/previews/teach-workspace`
    rmSync(dest, { recursive: true, force: true })
    cpSync(join(scratchRoot, '.canon', 'teach'), dest, {
      recursive: true,
      // Only the rendered chrome ships. MISSION.md, RESOURCES.md, and
      // GLOSSARY.md carry links relative to `.canon/teach/`, which resolve to
      // nothing once copied under `web/public/`, and nothing links to them
      // from the rendered pages anyway.
      filter: (path) => !path.endsWith('.md'),
    })
  } finally {
    rmSync(scratchRoot, { recursive: true, force: true })
  }

  console.log('regen-web-previews: wrote web/public/previews/teach-workspace/')
}
