import { describe, expect, it } from 'vitest'
import { bodyDensity } from '@/labels/density'

const LONG = 'word '.repeat(45).trim()
const PARAGRAPH_OVER = 'word '.repeat(75).trim()

function body(...lines: string[]): string {
  return `${lines.join('\n')}\n`
}

function bullets(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `- change ${index + 1}`)
}

describe('bodyDensity limits per section', () => {
  it('should report a long bullet in Key changes with its whole-body line', () => {
    const result = bodyDensity(
      body(
        '## Summary',
        '',
        'One line.',
        '',
        '## Key changes',
        '',
        `- ${LONG}`,
      ),
    )

    expect(result).toEqual([
      {
        section: 'Key changes',
        kind: 'bullet-length',
        line: 7,
        value: 224,
        limit: 200,
      },
    ])
  })

  it('should report six plain bullets in a row in Key changes', () => {
    const result = bodyDensity(body('## Key changes', '', ...bullets(6)))

    expect(result).toEqual([
      {
        section: 'Key changes',
        kind: 'bullet-run',
        line: 3,
        value: 6,
        limit: 5,
      },
    ])
  })

  it('should report three paragraphs in a row in Summary', () => {
    const result = bodyDensity(
      body('## Summary', '', 'One.', '', 'Two.', '', 'Three.'),
    )

    expect(result.map((finding) => finding.kind)).toEqual(['paragraph-run'])
  })

  it('should report a paragraph past 350 characters in For the reviewer', () => {
    const result = bodyDensity(body('## For the reviewer', '', PARAGRAPH_OVER))

    expect(result.map((finding) => [finding.section, finding.kind])).toEqual([
      ['For the reviewer', 'paragraph-length'],
    ])
  })

  it('should take no counted limit in Testing', () => {
    const result = bodyDensity(
      body('## Testing', '', ...bullets(8).map((line) => `${line} ${LONG}`)),
    )

    expect(result).toEqual([])
  })

  it('should still report a subheading inside Testing', () => {
    const result = bodyDensity(
      body('## Testing', '', '### Unit', '', '- [x] ok'),
    )

    expect(result).toEqual([
      {
        section: 'Testing',
        kind: 'subheading',
        line: 3,
        value: 3,
        limit: 2,
      },
    ])
  })

  it('should report an H4 anywhere in the body', () => {
    const result = bodyDensity(
      body('## Summary', '', 'One.', '', '#### Detail', '', 'Two.'),
    )

    expect(result.map((finding) => [finding.kind, finding.line])).toEqual([
      ['subheading', 5],
    ])
  })

  it('should leave a fenced block out of every count', () => {
    const result = bodyDensity(
      body(
        '## Summary',
        '',
        'One.',
        '',
        '```',
        '### not a heading',
        '',
        'Two.',
        '',
        'Three.',
        '```',
        '',
        'Four.',
      ),
    )

    expect(result).toEqual([])
  })
})

describe('bodyDensity in Key changes groups', () => {
  it('should break a bullet run at a bold label longer than the marker width', () => {
    const result = bodyDensity(
      body(
        '## Key changes',
        '',
        '**Live reloads and capture**',
        '',
        ...bullets(4),
        '',
        '**Another group of changes**',
        '',
        ...bullets(4),
      ),
    )

    expect(result).toEqual([])
  })

  it('should read a label directly under a bullet as that bullet, as GitHub renders it', () => {
    const result = bodyDensity(
      body(
        '## Key changes',
        '',
        `- ${'word '.repeat(36).trim()}`,
        '**A group label past twenty**',
        ...bullets(4),
      ),
    )

    expect(result).toEqual([
      {
        section: 'Key changes',
        kind: 'bullet-length',
        line: 3,
        value: 209,
        limit: 200,
      },
    ])
  })

  it('should still report a group past five bullets', () => {
    const result = bodyDensity(
      body('## Key changes', '', '**Served frames**', '', ...bullets(6)),
    )

    expect(result.map((finding) => [finding.kind, finding.line])).toEqual([
      ['bullet-run', 5],
    ])
  })
})

describe('bodyDensity in Technical context', () => {
  it('should start a new paragraph run at each bold lead-in', () => {
    const result = bodyDensity(
      body(
        '## Technical context',
        '',
        '**One.** First reason.',
        '',
        '**Two.** Second reason.',
        '',
        '**Three.** Third reason.',
      ),
    )

    expect(result).toEqual([])
  })

  it('should count two plain paragraphs after a lead-in toward its run', () => {
    const result = bodyDensity(
      body(
        '## Technical context',
        '',
        '**One.** First.',
        '',
        'Second.',
        '',
        'Third.',
      ),
    )

    expect(result).toEqual([
      {
        section: 'Technical context',
        kind: 'paragraph-run',
        line: 3,
        value: 3,
        limit: 2,
      },
    ])
  })

  it('should report bullets mixed with paragraphs at the later form', () => {
    const result = bodyDensity(
      body(
        '## Technical context',
        '',
        '- A reason.',
        '',
        '**Why.** A paragraph.',
      ),
    )

    expect(result).toEqual([
      {
        section: 'Technical context',
        kind: 'mixed-form',
        line: 5,
        value: null,
        limit: null,
      },
    ])
  })

  it('should read a lazy continuation under a bullet as part of it, not a paragraph', () => {
    const result = bodyDensity(
      body(
        '## Technical context',
        '',
        '- A reason that wraps',
        'onto a second line.',
        '- Another.',
      ),
    )

    expect(result).toEqual([])
  })

  it('should report nothing for an empty Technical context', () => {
    const result = bodyDensity(
      body('## Summary', '', 'One.', '', '## Technical context', ''),
    )

    expect(result).toEqual([])
  })

  it('should report nothing for a body with no Technical context', () => {
    const result = bodyDensity(body('## Summary', '', 'One.'))

    expect(result).toEqual([])
  })
})

/** Frameboard #27 as live, the accepted bold lead-in shape. */
const FRAMEBOARD_27 = body(
  '## Summary',
  '',
  "Serve every frame with the board's faces and token sheets in the board's theme, so frames share one look in light and dark with the file untouched. Register the theme toggle and its System, Light, and Dark rows, and fill the Theme tab with the project's tokens.",
  '',
  '## Key changes',
  '',
  '**Served frames**',
  '',
  '- Add `injectHead()` and `frameHead()` in `src/server/look/inject.ts`, splicing one `<style data-frameboard>` and a self-removing theme script into `head`.',
  "- Inject in `frameRoutes(root, look)` for a page's `.html` alone.",
  "- Serve `/frames/<project>/tokens.css` through the frame route's realpath checks.",
  '- Add `lookRoutes()` in `src/server/routes/look.ts` for `/frameboard/faces/*` and `/frameboard/tokens.css`, both `no-store`.',
  '- Add `servedFrames()` in `src/server/routes/look.ts`, mounting the look and frame routes for the board server and the capture host alike.',
  '',
  '**Faces**',
  '',
  '- Add `scripts/copy-faces.ts`, copying Geist, Geist Mono, and Caveat with their licenses into `dist/faces/` at build.',
  '- Name the faces in `src/shared/faces.ts`.',
  '',
  '**Token sheets**',
  '',
  '- Add `tokenSheetPaths()` and `boardSheetPath()` to `src/server/checks/tokens.ts`.',
  '- Add `serve --tokens <path>`, recording the sheet on the address file.',
  '- Refuse a `--tokens` path that is not a file with `tokens-not-found` at exit 3.',
  "- Report the running server's sheet when `serve` reuses it.",
  '',
  '**Theme**',
  '',
  '- Add `src/client/theme/store.ts` with `connectTheme()`, `toggleTheme()`, `chooseTheme()`, `flipFrame(ref)`, and `frameTheme(ref)`.',
  '- Add `registerThemeActions()` in `src/client/theme/actions.ts` for `theme.toggle` and the System, Light, and Dark rows.',
  "- Add `setFrameTheme()` in `src/shared/theme.ts`, setting `data-theme`, `color-scheme`, and the `.dark` or `.light` class on a frame's root.",
  "- Set each iframe's `src` through `frameThemeUrl()` in `src/client/board/frame.tsx`, and run `setFrameTheme()` on its root on every theme change.",
  '- Set `.dark` before the first paint from an inline script in `src/client/index.html`.',
  '',
  '**Theme tab**',
  '',
  '- Add `readTokenTable()` in `src/server/look/token-table.ts`.',
  '- Add `GET /api/projects/:project/tokens` and the token table record in `src/shared/records/tokens.ts`.',
  '- Draw the table in `src/client/board/left-panel/theme-tab.tsx`.',
  '',
  '**Live reloads and capture**',
  '',
  '- Reload every frame a token sheet reaches in `reloadRefs()`, and watch a `--tokens` sheet outside the board in `watchBoard()`.',
  '- Mount `servedFrames()` in `startFrameHost()` in `src/server/capture/host.ts`.',
  '- Load each captured frame through `frameThemeUrl()` in `openFrame()`.',
  "- Pass the program's faces folder to `capture` and `frame fit`.",
  '',
  '## Technical context',
  '',
  "**Where the look goes.** The look lands in the response alone, and the file on disk never changes. The splice decodes the bytes as Latin-1, one character per byte, so parse5's offsets are byte offsets and a non-ASCII character ahead of `head` can't shift it.",
  '',
  "**Faces.** Each package's sheet names its family `Geist Variable` or similar. The build rewrites that to `Geist`, `Geist Mono`, and `Caveat`, the names frames and token sheets write.",
  '',
  "**One place sets a frame's theme.** `setFrameTheme()` is the only code that themes a frame's root. The injected script embeds its source and the board calls it on every switch, so a served frame and a live one can't disagree.",
  '',
  '**The `--tokens` sheet.** The server hands its own `--tokens` path to the checks, the routes, and the watcher. Its first check runs before `serve` writes the address file, so reading the path back would race. The hook and `check` read it from that file.',
  '',
  "**Capture.** `capture` and `frame fit` render off a host mounting the board server's routes, so a PNG carries the same faces and sheets. The injected script sets the theme from the URL, so `openFrame()` no longer sets the root. Neither verb takes `--tokens`.",
  '',
  '## Testing',
  '',
  '- [x] `bun run check` passes, covering typecheck, lint, format, unit tests, build, and markdown bans.',
  '- [x] `bunx vitest run` passes, 802 tests and 1 skipped across the node and browser projects.',
  "- [x] `bun run test:e2e` passes, 47 tests and 1 skipped, including the capture spec's `font-missing` case and every case in `e2e/themes.spec.ts`.",
  '- [x] `bun run build && ls dist/faces/*/LICENSE dist/faces/*/files/*.woff2` lists 3 licenses and 26 woff2 files.',
  '- [x] `bun run screenshot` run twice with no change between, and every `e2e/evidence/` PNG matched byte for byte.',
  '- [ ] The Theme tab, toolbar toggle, and home header against `canon/design/tabs/`, `canon/design/toolbar/`, and `canon/design/home/` in both themes (operator, a judgment of look).',
  '',
  '## For the reviewer',
  '',
  "- Confirm frames showing in the chrome's theme, where the references draw them white in the dark chrome, as the requirement asks.",
  "- Confirm the Font rows showing a stack's first family, as `canon/design/tabs/theme` draws it.",
  '- Confirm the empty Theme tab capture, which stubs the tokens route, since the preview board always carries a board sheet.',
  '- Confirm outcome 3 stays open, since the per-frame flip ships as `flipFrame(ref)` with no control until the frame menu lands.',
)

/** The Key changes of frameboard #25 as shipped, flat with long bullets. */
const FRAMEBOARD_25_KEY_CHANGES = body(
  '## Key changes',
  '',
  "- Add `launchCaptureBrowser()` in `src/server/capture/browser.ts`, launching Playwright's pinned headless shell alone and refusing `browser-not-found` (exit 9) with the pinned `npx` and `bunx` install command.",
  '- Add `startFrameHost()` and `withFrameHost()` in `src/server/capture/host.ts`, a loopback host over `frameRoutes` behind the new `boardHostGuard()` from `src/server/app.ts`.',
  '- Add `openFrame()` in `src/server/capture/render.ts`, loading a frame at its layout size with `data-theme`, `color-scheme`, and `prefers-color-scheme` set, then awaiting load and `document.fonts.ready`.',
  "- Add `assertFontsPresent()` in `src/server/capture/fonts.ts`, refusing `font-missing` (exit 10) when a text element's first family neither loaded as a web face nor rendered from an installed font per `CSS.getPlatformFontsForNode`.",
  '- Add `captureFrameImages()` and `captureComposite()` in `src/server/capture/images.ts`, rendering every image before writing any, with `capture-too-large` past 16384 px.',
  "- Add `fitFrame()` in `src/server/capture/fit.ts`, measuring the furthest bottom edge of any box at a 1 px and at the frame's own viewport, and refusing `fit-unbounded` when the two differ.",
  '- Add the `capture` verb in `src/cli/commands/capture.ts` and `frame fit` in `src/cli/commands/frame.ts`, with the `capture` and `fit` records in `src/shared/records/capture.ts`.',
  '- Add `pngRoutes()` in `src/server/routes/png.ts` and `createWarmRenderer()`, which `src/server/start.ts` closes with the server.',
  '- Add `playwright-core@1.64.1` as the first runtime dependency, external in `rolldown.config.ts` and loaded through a dynamic import.',
  '- Add the `capture` fixture board under `test/fixtures/boards/capture/` with a Geist face and its OFL license in `assets/`.',
)

describe('bodyDensity against measured bodies', () => {
  it('should report the live frameboard #27 body clean', () => {
    expect(bodyDensity(FRAMEBOARD_27)).toEqual([])
  })

  it('should report the long bullets and the run in the shipped frameboard #25 Key changes', () => {
    const result = bodyDensity(FRAMEBOARD_25_KEY_CHANGES)

    expect(result.map((finding) => [finding.kind, finding.line])).toEqual([
      ['bullet-length', 3],
      ['bullet-run', 3],
      ['bullet-length', 5],
      ['bullet-length', 6],
    ])
  })
})
