import { describe, expect, it } from 'vitest'
import { bodyDensity, postDensity } from '@/labels/density'

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

const FB =
  'https://github.com/erclx/frameboard/blob/72a5268c1cc72fa28521e2a6a0aefdcdca8f35fe'
const REVIEW_MARKER =
  '<!-- review-pr: commit=72a5268c1cc72fa28521e2a6a0aefdcdca8f35fe read-at=2026-10-19T06:14:57Z -->'

/** Frameboard #27's first review as posted, trimmed to one finding and the focus run. */
const REVIEW_BEFORE = body(
  '## Review',
  '',
  '0 critical, 1 should-fix, 0 minor. Reviewed against project docs and the board.',
  '',
  '**`src/server/look/inject.ts`**',
  '',
  `- **should-fix** ([line 15](${FB}/src/server/look/inject.ts#L15)): A frame only ever gets \`data-theme\` and \`color-scheme\`. Nothing adds the \`.dark\` class to its root, and the same is true of the live write in [\`frame.tsx\` line 56](${FB}/src/client/board/frame.tsx#L56). So with a shadcn-shaped \`--tokens\` sheet, the tab lists dark values that no dark frame ever renders.`,
  '',
  '**Review focus**',
  '',
  '- Bare fragment and BOM: two cases in `inject.test.ts` cover it.',
  "- Frame's own sheet wins: `frames.test.ts` checks the import order.",
  '- `<html data-theme="light">` on disk: the byte-for-byte test shows the file stays unchanged.',
  '- Toggle with no reload: the e2e window mark shows that no frame reloaded.',
  '- Toolbar never pressed: `theme.toggle` has no `checked`.',
  '- Flipped canvas: covered by `frame.test.tsx`.',
  '',
  '🤖 Reviewed by Claude Code',
  '',
  REVIEW_MARKER,
)

/** The same review restyled to the catalog template. */
const REVIEW_AFTER = body(
  '## Review',
  '',
  '0 critical, 1 should-fix, 0 minor. Reviewed against project docs and the board.',
  '',
  '**`src/server/look/inject.ts`**',
  '',
  `- **should-fix** ([line 15](${FB}/src/server/look/inject.ts#L15)): Frames never get the \`.dark\` class, so a \`.dark\` token sheet lists dark values no frame renders.`,
  `  - \`readTokenTable\` and the Theme tab treat \`.dark\` as dark ([\`token-table.ts\` line 17](${FB}/src/server/look/token-table.ts#L17)).`,
  `  - Only \`data-theme\` and \`color-scheme\` reach a frame, here and in [\`frame.tsx\` line 56](${FB}/src/client/board/frame.tsx#L56).`,
  "  - Fix: toggle `.dark` beside `data-theme` in both places, or drop `.dark` from the table and the tab's copy.",
  '',
  '<details>',
  '<summary>Review focus, 6 checked</summary>',
  '',
  '- Bare fragment and BOM: two cases in `inject.test.ts`',
  "- Frame's own sheet wins: import order checked in `frames.test.ts`",
  '- `<html data-theme="light">` on disk: the byte-for-byte test',
  '- Toggle with no reload: the e2e window mark',
  '- Toolbar never pressed: `theme.toggle` has no `checked`',
  '- Flipped canvas: `frame.test.tsx`',
  '',
  '</details>',
  '',
  '🤖 Reviewed by Claude Code',
  '',
  REVIEW_MARKER,
)

/** Canon's closed review at `fbac6b0` as posted, trimmed. */
const CLOSED_BEFORE = body(
  '## Review closed',
  '',
  "✅ Prior findings addressed. Re-reviewed the full change, the prior pass's commit is no longer on the branch.",
  '',
  'Both should-fix findings landed at `fbac6b0`. `canon/context/scripts.md` now carries the EXIT-trap guard, the `$(helper)` precondition, the exec trap re-arm, the `bun --eval` sentinel, and the command-count import shape. `canon/context/ci.md` restores the `bootstrap-sha` and `include-component-in-tag` reasons, the `typescript` v5 pin, and the `merge_queue` 422 cause. The Testing box is ticked.',
  '',
  '🤖 Reviewed by Claude Code',
  '',
  '<!-- review-pr: commit=fbac6b00c9c1ac144a5cc9f3763667b517fa7c51 read-at=2026-10-17T19:02:40Z -->',
)

const CLOSED_AFTER = body(
  '## Review closed',
  '',
  "✅ 2 prior findings addressed at `fbac6b0`. Re-reviewed the full change, since the prior pass's commit is no longer on the branch.",
  '',
  '- **should-fix**, `canon/context/scripts.md`: carries the EXIT-trap guard, the `$(helper)` precondition, the exec trap re-arm, and the two import shapes',
  '- **should-fix**, `canon/context/ci.md`: restores the release-please reasons, the `typescript` v5 pin, and the `merge_queue` 422 cause',
  '',
  '🤖 Reviewed by Claude Code',
  '',
  '<!-- review-pr: commit=fbac6b00c9c1ac144a5cc9f3763667b517fa7c51 read-at=2026-10-17T19:02:40Z -->',
)

/** Frameboard #27's review response as posted, trimmed to its first finding. */
const RESPONSE_BEFORE = body(
  '## Review response',
  '',
  'Both findings are fixed in two commits on top of `72a5268`, with no rebase in this pass.',
  '',
  '- **should-fix, `src/server/look/inject.ts` line 15:** Frames now get the `.dark` or `.light` class beside `data-theme` and `color-scheme`, so a shadcn-shaped sheet renders what the Theme tab lists. One function, `setFrameTheme()` in `src/shared/theme.ts`, does the write.',
  '',
  '🤖 Addressed by Claude Code',
)

const RESPONSE_AFTER = body(
  '## Review response',
  '',
  'Both findings are fixed in two commits on top of `72a5268`, with no rebase.',
  '',
  '- **should-fix**, `inject.ts` line 15: fixed in `abc1234`. One function, `setFrameTheme()`, now sets `.dark` or `.light` beside `data-theme`.',
  '- **minor**, `serve.ts` line 61: fixed in `def5678`. `serve --tokens` refuses anything that is not a file with `tokens-not-found`.',
  '',
  'Docs: `canon/context/content/themes-and-tokens.md` names the class beside `data-theme`.',
  '',
  '🤖 Addressed by Claude Code',
)

/** Canon's rebase note onto `8af11ce78` as posted, trimmed. */
const REBASE_BEFORE = body(
  '## Rebase',
  '',
  'Rebased onto main at `8af11ce78`, because the branch had stopped merging.',
  '',
  '- Resolved by hand: `src/init/steps.ts` and `src/init/steps.test.ts`. The Wiki step is gone, and `Markdown gating` now runs right after Governance, the last domain that seeds files, so it measures what Claude init wrote rather than gating a folder a later step fills.',
  '- `docs/target/projects.md` replayed over #2513 with no conflict.',
  '',
  '🤖 Addressed by Claude Code',
)

const REBASE_AFTER = body(
  '## Rebase',
  '',
  'Rebased onto main at `8af11ce78`, because #2513 retired the wiki install and capture refreshes regenerated the hero.',
  '',
  '- Resolved by hand: `src/init/steps.ts` and its test. The Wiki step is gone, and Markdown gating runs right after Governance.',
  '- Rebuilt by the regen: `assets/captures/hero.html`, `assets/frames/hero.png`, and `assets/frames/hero.stamp`',
  '- Replayed with no conflict: `docs/target/projects.md`',
  '',
  '🤖 Addressed by Claude Code',
)

/** Frameboard's closed UI review, trimmed, with its H3 verdict group kept. */
const UI_CLOSED = body(
  '## UI review closed',
  '',
  '0 failed · 0 need your eyes · 1 passed · 1 not driven',
  'Driven at `729d348` on a local build served from the branch head, driven unverified.',
  '',
  '### Not driven',
  '',
  '**4. The button label renders in Geist rather than a system fallback (taste)**: the page ships one theme. The cause sits off the page.',
  '',
  '<details>',
  '<summary>Passed (1)</summary>',
  '',
  '| Box | Proof |',
  '| --- | --- |',
  `| 1. \`/\`, 1280: button centered | ${'free space read on every side, '.repeat(12)}matches \`1280--light\`. |`,
  '',
  '</details>',
  '',
  '🤖 Driven by Claude Code',
  '',
  '<!-- review-ui: head=729d34873af76a5dd3675c18889115098fc9c2ec -->',
)

describe('postDensity against restyled samples', () => {
  it.each([
    ['## Review', REVIEW_BEFORE, ['bullet-length', 'bullet-run']],
    ['## Review closed', CLOSED_BEFORE, ['paragraph-length']],
    ['## Review response', RESPONSE_BEFORE, ['bullet-length']],
    ['## Rebase', REBASE_BEFORE, ['bullet-length']],
  ])('should report the %s sample as posted', (_, post, kinds) => {
    expect(postDensity(post).map((finding) => finding.kind)).toEqual(kinds)
  })

  it.each([
    ['## Review', REVIEW_AFTER],
    ['## Review closed', CLOSED_AFTER],
    ['## Review response', RESPONSE_AFTER],
    ['## Rebase', REBASE_AFTER],
    ['## UI review closed', UI_CLOSED],
  ])('should report the %s sample restyled clean', (_, post) => {
    expect(postDensity(post)).toEqual([])
  })

  it('should name the section and the line in the whole post', () => {
    const [first] = postDensity(REVIEW_BEFORE)

    expect([first.section, first.kind, first.line, first.limit]).toEqual([
      'Review',
      'bullet-length',
      7,
      200,
    ])
  })
})

describe('postDensity exemptions', () => {
  it('should report nothing for a post whose opening heading is not a post heading', () => {
    expect(postDensity(body('## Notes', '', PARAGRAPH_OVER))).toEqual([])
  })

  it('should report nothing for a pull request body', () => {
    expect(postDensity(body('## Summary', '', ...bullets(8)))).toEqual([])
  })

  it('should report a nested bullet past 200 characters under a finding', () => {
    const result = postDensity(
      body(
        '## Review',
        '',
        '- **minor** (line 1): A subject.',
        `  - ${LONG} more`,
      ),
    )

    expect(result).toEqual([
      {
        section: 'Review',
        kind: 'bullet-length',
        line: 4,
        value: 229,
        limit: 200,
      },
    ])
  })

  it('should report a long subject on its own line, not on its nested evidence', () => {
    const result = postDensity(
      body(
        '## Review',
        '',
        `- **minor** (line 1): ${LONG}`,
        '  - Short evidence.',
        '  - Fix: short.',
      ),
    )

    expect(result.map((finding) => [finding.kind, finding.line])).toEqual([
      ['bullet-length', 3],
    ])
  })

  it('should report no run for six findings under one file label', () => {
    const findings = [1, 2, 3, 4, 5, 6].flatMap((index) => [
      `- **minor** (line ${index}): Subject ${index}.`,
      '  - Fix: short.',
    ])

    expect(
      postDensity(body('## Review', '', '**`src/a.ts`**', '', ...findings)),
    ).toEqual([])
  })

  it('should take the length limit and no run limit inside details', () => {
    const result = postDensity(
      body(
        '## Review',
        '',
        '<details>',
        '<summary>Review focus, 7 checked</summary>',
        '',
        ...bullets(6),
        `- ${LONG}`,
        `  - ${LONG}`,
        '',
        '</details>',
      ),
    )

    expect(result.map((finding) => [finding.kind, finding.line])).toEqual([
      ['bullet-length', 12],
      ['bullet-length', 13],
    ])
  })

  it('should never measure a table', () => {
    const row = `| a | ${LONG} ${LONG} |`

    expect(
      postDensity(body('## Evidence', '', '| a | b |', '| - | - |', row)),
    ).toEqual([])
  })

  it('should never measure the footer or the marker', () => {
    const result = postDensity(
      body(
        '## Rebase',
        '',
        'One.',
        '',
        'Two.',
        '',
        `🤖 ${LONG} ${LONG}`,
        '',
        `<!-- review-pr: ${LONG} -->`,
      ),
    )

    expect(result).toEqual([])
  })

  it('should report no subheading for the UI review verdict groups, but an H4', () => {
    const result = postDensity(
      body(
        '## UI review',
        '',
        '### Failed',
        '',
        '**1. Box**: read.',
        '',
        '#### Detail',
        '',
        'More.',
      ),
    )

    expect(result.map((finding) => [finding.kind, finding.line])).toEqual([
      ['heading-depth', 7],
    ])
  })

  it('should take no length limit on a checklist box, but report a group past five', () => {
    const boxes = [1, 2, 3, 4, 5, 6].map(
      (index) => `- [ ] /, 1280: box ${index} ${LONG}`,
    )
    const result = postDensity(
      body(
        '## Evidence',
        '',
        '## What to look at',
        '',
        '**Landing page**',
        '',
        ...boxes,
      ),
    )

    expect(result).toEqual([
      {
        section: 'What to look at',
        kind: 'bullet-run',
        line: 7,
        value: 6,
        limit: 5,
      },
    ])
  })

  it('should break a paragraph run at each bold lead-in', () => {
    const result = postDensity(
      body(
        '## UI review',
        '',
        '**1. Box**: one.',
        '',
        '**2. Box**: two.',
        '',
        '**3. Box**: three.',
      ),
    )

    expect(result).toEqual([])
  })
})
