import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join, relative, sep } from 'node:path'
import { DESIGN_DOCUMENT } from '@/design/regen'
import { renderDesignDoc } from '@/design/render'
import { colorValue } from '@/design/tokens'
import { recordDir } from '@/record-root'

/**
 * The one named site for this repository's wireframe corpus. `standards/`
 * moves it to `canon/wireframes/` under the answered
 * `.canon/intake/88-surface-roots-and-corpus-debt/` item 1, and that move
 * retargets this constant alone rather than a literal repeated per panel.
 */
export const WIREFRAME_DIR = join('.claude', 'wireframes')

/** Landing page for the built site the surfaces panel iframes when present. */
const WEB_DIST = join('web', 'dist')
const WEB_DIST_ENTRY = 'index.html'

interface WireframeEntry {
  readonly path: string
  readonly describes: string
}

/**
 * The six files the wireframes panel renders, each beside the surface it
 * describes. `index.md` at either level is a catalog rather than a wireframe
 * and is excluded, which is why this list holds six rather than the eight
 * files the corpus carries today.
 */
const WIREFRAMES: readonly WireframeEntry[] = [
  { path: 'landing-page.md', describes: 'The canon.erclx.dev landing page' },
  { path: 'slides.md', describes: 'The SLIDES.md render' },
  { path: 'teach/root.md', describes: 'A teach workspace root listing' },
  { path: 'teach/contents.md', describes: 'A workspace contents page' },
  { path: 'teach/lesson.md', describes: 'A lesson page and quiz stepper' },
  { path: 'teach/chrome.md', describes: 'The shared teach chrome' },
]

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.svg', '.webp']

export interface BoardPanel {
  readonly id: string
  readonly title: string
  /** Relative to the board's own output directory. */
  readonly path: string
}

export interface BoardResult {
  readonly ok: true
  readonly outDir: string
  readonly indexPath: string
  readonly panels: readonly BoardPanel[]
}

export interface BoardRefused {
  readonly ok: false
  readonly reason: 'unsafe-out'
  readonly detail: string
}

export type BoardOutcome = BoardResult | BoardRefused

/**
 * Whether clearing `outDir` would take a protected directory down with it:
 * the directory equals one of them, or contains one.
 *
 * `generateBoard` clears its output directory on every run, and `--out` is
 * resolved against the caller's cwd while the panels read from `PROJECT_ROOT`.
 * Those agree in the ordinary case and diverge in exactly one: a second
 * checkout, where a global `canon` resolves `PROJECT_ROOT` to a different
 * tree than the one the caller stands in. Guarding `PROJECT_ROOT` alone misses
 * that case, since `--out .` then resolves under the caller's own cwd, which
 * shares no containment with the unrelated root the guard compared it to.
 */
function wouldDeleteRoot(protect: readonly string[], outDir: string): boolean {
  return protect.some((dir) => dir === outDir || dir.startsWith(outDir + sep))
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const THEME_TOGGLE_SCRIPT = [
  '<script>(function(){',
  'var r=document.documentElement;',
  'try{var s=localStorage.getItem("board-theme");if(s)r.dataset.theme=s;}catch(e){}',
  'document.addEventListener("click",function(e){',
  'var b=e.target.closest(".theme-toggle");if(!b)return;',
  'var dark=r.dataset.theme==="dark"||(!r.dataset.theme&&matchMedia("(prefers-color-scheme: dark)").matches);',
  'r.dataset.theme=dark?"light":"dark";',
  'try{localStorage.setItem("board-theme",r.dataset.theme);}catch(e){}',
  '});',
  '})();</script>',
].join('')

/** The board shell's own chrome, read off the toolkit's design source. */
function shellChrome(): string {
  const roles: ReadonlyArray<readonly [string, string]> = [
    ['background', 'background'],
    ['surface', 'surface'],
    ['text', 'text'],
    ['muted', 'muted'],
    ['border', 'border'],
    ['accent', 'accent'],
  ]
  const dark = roles
    .map(([name, role]) => {
      const value = colorValue(role)
      return value === undefined ? '' : `  --board-${name}: ${value};`
    })
    .filter((line) => line !== '')
  const light = roles
    .map(([name, role]) => {
      const value = colorValue(`light-${role}`)
      return value === undefined ? '' : `  --board-${name}: ${value};`
    })
    .filter((line) => line !== '')

  return `:root {\n${dark.join('\n')}\n}\n[data-theme='light'] {\n${light.join('\n')}\n}`
}

function shellHtml(panels: readonly BoardPanel[]): string {
  const sections = panels
    .map(
      (panel) =>
        `<section id="${panel.id}">\n<h2>${escapeHtml(panel.title)}</h2>\n<iframe src="${panel.path}" loading="lazy"></iframe>\n</section>`,
    )
    .join('\n')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Design board</title>
<style>
${shellChrome()}
body { font-family: system-ui, sans-serif; margin: 0; padding: 2rem; color: var(--board-text); background: var(--board-background); }
h1 { display: flex; align-items: center; justify-content: space-between; }
section { margin-top: 2rem; }
section h2 { border-bottom: 1px solid var(--board-border); padding-bottom: 0.25rem; }
iframe { width: 100%; height: 480px; border: 1px solid var(--board-border); border-radius: 4px; background: var(--board-surface); }
.theme-toggle { background: var(--board-surface); color: var(--board-text); border: 1px solid var(--board-border); border-radius: 4px; padding: 0.4rem 0.8rem; cursor: pointer; }
</style>
</head>
<body>
<h1>Design board<button class="theme-toggle" type="button">Toggle theme</button></h1>
<p>Generated by <code>canon design board</code>. Repository-local, never installed into a target.</p>
${sections}
${THEME_TOGGLE_SCRIPT}
</body>
</html>
`
}

function panelPage(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
body { font-family: system-ui, sans-serif; margin: 1.5rem; color: #191512; background: #fbf6ef; }
h2 { margin-top: 2rem; }
pre { white-space: pre-wrap; background: #f0e9df; border-radius: 4px; padding: 1rem; }
.empty { color: #726b62; font-style: italic; }
</style>
</head>
<body>
${body}
</body>
</html>
`
}

function writeTokensPanel(root: string, outDir: string): void {
  const sourcePath = join(root, DESIGN_DOCUMENT)
  const dir = join(outDir, 'tokens')

  if (!existsSync(sourcePath)) {
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, 'index.html'),
      panelPage(
        'Tokens',
        `<p class="empty">No ${DESIGN_DOCUMENT} at the repository root.</p>`,
      ),
    )
    return
  }

  renderDesignDoc(sourcePath, dir)
}

function writeWireframesPanel(root: string, outDir: string): void {
  const dir = join(outDir, 'wireframes')
  mkdirSync(dir, { recursive: true })

  const sections = WIREFRAMES.map((entry) => {
    const sourcePath = join(root, WIREFRAME_DIR, entry.path)
    if (!existsSync(sourcePath)) {
      return `<h2>${escapeHtml(entry.path)}</h2>\n<p class="empty">Missing from ${WIREFRAME_DIR}/.</p>`
    }
    const text = readFileSync(sourcePath, 'utf8')
    return `<h2>${escapeHtml(entry.path)}</h2>\n<p>${escapeHtml(entry.describes)}</p>\n<pre>${escapeHtml(text)}</pre>`
  }).join('\n')

  writeFileSync(join(dir, 'index.html'), panelPage('Wireframes', sections))
}

/** Copies a built directory whole, filtering nothing, into the board's own tree. */
function copyBuilt(source: string, dest: string): void {
  rmSync(dest, { recursive: true, force: true })
  cpSync(source, dest, { recursive: true })
}

function writeSurfacesPanel(root: string, outDir: string): void {
  const dir = join(outDir, 'surfaces')
  mkdirSync(dir, { recursive: true })

  const distSource = join(root, WEB_DIST)
  const landingBody = existsSync(join(distSource, WEB_DIST_ENTRY))
    ? (copyBuilt(distSource, join(dir, 'landing')),
      '<iframe src="landing/index.html" loading="lazy"></iframe>')
    : `<p class="empty">No ${WEB_DIST}/ build. Run bun run web:build, then regenerate the board.</p>`

  const teachSource = recordDir(root, 'teach')
  const teachBody = existsSync(join(teachSource, 'index.html'))
    ? (copyBuilt(teachSource, join(dir, 'teach')),
      '<iframe src="teach/index.html" loading="lazy"></iframe>')
    : `<p class="empty">${relative(root, teachSource)} is gitignored and machine-local, so this panel renders empty in a fresh clone and on CI.</p>`

  writeFileSync(
    join(dir, 'index.html'),
    panelPage(
      'Surfaces',
      `<h2>Landing page</h2>\n${landingBody}\n<h2>Teach workspaces</h2>\n${teachBody}`,
    ),
  )
}

function isImage(name: string): boolean {
  return IMAGE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))
}

/** Every image file directly inside an evidence arm folder, one level deep. */
function imagesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isImage(entry.name))
    .map((entry) => entry.name)
    .sort()
}

function writeCandidatesPanel(root: string, outDir: string): void {
  const dir = join(outDir, 'candidates')
  mkdirSync(dir, { recursive: true })

  const evidenceDir = recordDir(root, 'review', 'evidence')
  if (!existsSync(evidenceDir)) {
    writeFileSync(
      join(dir, 'index.html'),
      panelPage(
        'Past candidates',
        `<p class="empty">No ${relative(root, evidenceDir)} folder yet.</p>`,
      ),
    )
    return
  }

  const folders = readdirSync(evidenceDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

  const found: Array<{ folder: string; images: string[] }> = []
  for (const folder of folders) {
    const images = imagesIn(join(evidenceDir, folder))
    if (images.length > 0) {
      cpSync(join(evidenceDir, folder), join(dir, folder), { recursive: true })
      found.push({ folder, images })
    }
  }

  if (found.length === 0) {
    writeFileSync(
      join(dir, 'index.html'),
      panelPage(
        'Past candidates',
        `<p class="empty">${folders.length} folders under ${relative(root, evidenceDir)}/ and none carries a draft-and-pick arm capture. The archival capture step has not run since it shipped.</p>`,
      ),
    )
    return
  }

  const sections = found
    .map(
      ({ folder, images }) =>
        `<h2>${escapeHtml(folder)}</h2>\n${images.map((image) => `<img src="${folder}/${image}" alt="${escapeHtml(image)}">`).join('\n')}`,
    )
    .join('\n')

  writeFileSync(join(dir, 'index.html'), panelPage('Past candidates', sections))
}

/**
 * Generates the board's page set into `outDir`, clearing whatever was there.
 *
 * This function is the directory's only writer, per the constraint every
 * caller shares it under: `canon serve` and a future `canon capture` pass
 * both read the result and neither may assume it exists ahead of a run.
 *
 * `cwd` is the caller's own working directory, resolved and passed in
 * explicitly rather than read here, so a test can exercise the checkout-
 * mismatch case without touching the process's real cwd.
 */
export function generateBoard(
  root: string,
  outDir: string,
  cwd: string,
): BoardOutcome {
  if (wouldDeleteRoot([root, cwd], outDir)) {
    return {
      ok: false,
      reason: 'unsafe-out',
      detail: `${outDir} is or contains ${root} or ${cwd}. Refusing to clear it.`,
    }
  }

  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })

  const panels: readonly BoardPanel[] = [
    { id: 'tokens', title: 'Tokens', path: 'tokens/index.html' },
    { id: 'surfaces', title: 'Surfaces', path: 'surfaces/index.html' },
    { id: 'wireframes', title: 'Wireframes', path: 'wireframes/index.html' },
    {
      id: 'candidates',
      title: 'Past candidates',
      path: 'candidates/index.html',
    },
  ]

  writeTokensPanel(root, outDir)
  writeSurfacesPanel(root, outDir)
  writeWireframesPanel(root, outDir)
  writeCandidatesPanel(root, outDir)

  const indexPath = join(outDir, 'index.html')
  writeFileSync(indexPath, shellHtml(panels))

  return { ok: true, outDir, indexPath, panels }
}
