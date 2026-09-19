---
title: Design
description: DESIGN.md token shape, extract skill and its two paths, render command
---

# Design

## Overview

`canon/DESIGN.md` holds visual intent as prose and token tables. The toolkit treats it as the tool-agnostic source of truth for any project's design system. Two surfaces sit around it: a Claude Code skill drafts the file from existing project signals, and a CLI command renders a token preview for human inspection.

This repository's own record is the one that is generated rather than authored. `src/design/tokens.ts` holds the values and `canon design regen` renders both the record and `src/design/base.css` from it, which the `design` gate stage asserts for drift. A target keeps the hand-authored shape, so the markdown parser serves that reader and this repository reads the module instead.

## Layout

- `src/design/tokens.ts` owns the values, and `components.ts` beside it owns the component layer built on them
- `src/design/board.ts` owns the board generator, and `WIREFRAME_DIR` there is the one named site the wireframe corpus's root move retargets
- `src/design/document.ts` renders the record, `css.ts` renders the stylesheet, and `regen.ts` writes both through `canon design regen`
- `src/design/parse.ts` and `render.ts` own the markdown parser and the preview renderer, which serve a target's hand-authored record
- `src/design/adapter.ts` owns the sync adapter, and `src/design/base.css` is the generated file it installs
- `src/design/contrast.ts` owns the WCAG reading, asserted over the record in `contrast.test.ts`
- `claude/skills/design-extract/` owns the skill that drafts the file, from an existing codebase or from a greenfield project
- `claude/skills/design-taste/` owns the layer model, the coherence locks, and grey-boxing, and `governance/rules/ui/460-design-taste.md` routes stylesheet and `canon/DESIGN.md` edits to it. Building an already-decided surface stays outside the glob, so a project styling entirely in utility classes is not reached
- `.canon/tmp/render/design/` owns the rendered preview, gitignored
- `.claude/design/base.css` is where an install lands in a target, and `.claude/design/project/` is where that target's own values go

## Decisions

- One skill covers both paths. They shared a seed, a render pipeline, and two byte-identical steps, and the split cost a caller a choice the project already answers.
- The skill picks its path from whether UI code exists, never from a flag. The general ban on dispatch flags in `standards/skill.md` targets a toggle the model reads and misapplies. A test against the tree has no such failure.
- Switching paths later is a rewrite of `DESIGN.md`, not a migration.
- Output is one-way. DESIGN.md is source, the preview is a derived artifact. The renderer does not mutate target-project stylesheets. It regenerates on demand, not on save.
- The toolkit's own record is rendered from `src/design/tokens.ts` rather than authored. Leaving the document as the source was the alternative, and it costs more: a table a person edits is one a parser has to be taught to read back, where a module is checked by the compiler. The cost of the module approach is two artifacts from one source, and the `design` gate stage is the only thing that catches them disagreeing.
- Three surfaces consume that module. The slide theme takes bare hex through `bareHex`, since `PptxGenJS` receives `{ color: theme.background }` and PowerPoint has no concept of a custom property. The token preview's own chrome and a teach workspace stylesheet take custom properties through `@/design/css`. The hero and the terminal framing carry their own copies still, so the record is the source for three surfaces and a description of two.
- The consolidated dark set is the palette the hero already draws, so no capture needs to move. It also clears one of the two contrast failures: the hero's rust reads 5.77 and 5.36 against the two dark grounds, while the slide theme's reads 4.36 and 3.99.
- The component layer lives in `src/design/components.ts` rather than in the record, because `standards/design.md` keeps CSS class names out of that document and says they live in code. `TEACH_COMPONENTS`, the six-entry teach chrome (masthead, article, quiz, glossary, outline, references), sits beside the generic default rather than inside it, a caller opts into by passing an explicit list to `buildDesignCss`'s `components` option, which keeps a masthead and a quiz out of a project that never asked for teach.
- `COMPONENTS` holds three: a status marker, a scrollbar, and `HAND_DRAWN_FIGURE`, which needs none of teach's quiz or schedule machinery to draw one hand-drawn-styled figure. It declares its own `--figure-hand` and `--figure-wide` defaults rather than reading `TEACH_CHROME`'s undeclared `--teach-hand` and `--teach-wide`, which keeps it independent of teach. `src/design/fonts.ts` exports `HAND_DRAWN_FONT_FACES`, Virgil then Excalifont, beside `FONT_FACES`, which holds the two Noto Sans Mono statics and the `Geist Variable` face declaring `font-weight: 100 900`, so `FontFace.weight` carries a range as well as a single weight. No token names Geist yet. `TEACH_FONT_FACES` spreads it in rather than holding its own copy of the Virgil face.
- The light theme is a remap of the roles the record declares a `light-` counterpart for, and `unmappedOnLight` names the ones it does not. Filling those in was the alternative and it would put a color in the system that no surface ever read off anything, so the emitted stylesheet names the gap in a comment instead.
- The parser carries the uncertainty tag instead of discarding it. A parsed cell is a `{ value, tagged }` pair rather than a string, so `Row` is a map of cells and every swatch, sample, bar, and custom property is built from the value while the marker renders beside it as its own element. Leaving the marker inside the string was the alternative, and it puts the strip back in every emitter where one that forgets writes the tag into a `style` attribute.
- A tagged cell wrapping itself in a code span keeps the span. The tag is matched against the cell with any surrounding span removed, then the span is restored around the clean value, because dropping it outright would change how an untagged code-span cell renders. Holding an untagged record byte-identical is what decides that, and it is checked against the module as it stood before the tag survived.
- The confidence count reads the columns a source could anchor rather than every cell. Each table's first column names its row, and `Multiplier` and `When used` restate what the row already carries, so none of the four is counted. A cell tagged outside that set counts anyway, which keeps a marker the preview draws from sitting outside the ratio beside it.
- Counting every non-blank cell is the rejected alternative: it shipped a denominator of 120 against the toolkit's own record, 43 of which could only ever be anchored, reading 93 percent confidence over a record carrying eight proposals. The scoped count reads 64 of 72.
- A record with no tagged cell gets neither the count nor the marker style, so nothing about it moves.

## Gotchas

- `tokenProperties` in `src/design/css.ts` emits `--type-<role>-family` beside `--type-<role>-size` and `--type-<role>-lh`, so a rendered surface can consume the font identity rather than restate it.
- `src/design/base.css` has two writers that disagree past 80 columns. `canon design regen` writes each declaration flat and prettier wraps anything longer, so the `design` stage fails on the drift between them rather than on a stale value. Any value added to `src/design/tokens.ts` has to render inside that width, which is why the proportional stack for `page-display` stops at two names and a generic.
- The record no longer claims one family. Every role but `code` is Geist, embedded through `FONT_FACES`, and `code` plus any terminal frame a surface embeds is monospace, stated as a role the page uses rather than a carve-out from a rule. Teach follows the same rule: `TEACH_CHROME` in `src/design/components.ts` points `--teach-sans` and `--teach-mono` at `--type-body-family` and `--type-code-family`, and keeps only the hand-drawn pair as its own.
- The seven type steps and the roles are separate sets. `typeScale` in `src/design/tokens.ts` holds `t0` through `t6` and `tokenProperties` emits them as `--t0`..`--t6`, while each role's size is one of those values. A step scheme answers what sizes exist and a role scheme answers what a stylesheet asks for, so collapsing them would force every consumer to know which step its text is. The steps stay out of the `Typography` table because `table()` in `src/design/parse.ts` reads every pipe row in a section as one table, so a second table there would parse as extra role rows. `t3` and `t6` have no role yet.
- The space steps are `xs` through `3xl` at 0.25, 0.5, 0.875, 1.5, 2.5, 4 and 6 rem, replacing the six-pixel scale, and the three-value frame register is retired since no consumer read it. The capture templates hardcode their own sizes and padding, so the re-render moved each `.stamp` and left every `.png` byte-identical.
- The vendored Geist subset has no box-drawing, arrow, check or diamond glyphs, which teach and terminal copy print. The fallback is accepted rather than a fresh subset: the stack names `DejaVu Sans` second, which carries all four ranges, and a larger subset would grow the base64 every embedding stylesheet ships to cover glyphs those surfaces mostly set in monospace anyway. Revisit if a surface shows the fallback mismatching Geist in weight.
- The accent anchors now carry two chroma steps rather than one, at 0.13 light and 0.12 dark for a mark and 0.095 light and 0.09 dark for a fill. Only the mark step landed in `accent`, which already does fill duty in `assets/captures/hero.html`'s `.cmd` button, painting the whole background rather than marking a small area. The fill chroma step sits in the module's colorNote as a recorded anchor with no token of its own, which a lower-saturation `accent-fill` would give that button rather than a new consumer.
- A role declaring more than one ground needs its OKLCH derivation solved against the tighter of the two, not either one. `muted` and `light-muted` each declare `background` and `surface`, and a lightness solved against `background` alone cleared 4.6 there while reading 4.40 dark and 4.24 light against `surface`, which `src/design/contrast.test.ts` catches since it measures every declared ground. Solving against `surface` instead clears both.
- A code-span cell still emits its backticks. `` `#E4DCD0` `` reaches `design.css` and the `style` attribute with the backticks intact, so that swatch paints nothing whether or not the cell carries a tag. Write a token cell as a bare value, which is what the seed shows.
- The greenfield extract path tags nearly every cell, so the confidence count there reads near-total uncertainty. That is the path reporting itself accurately rather than a defect in the record.
- The slide theme and the two rendered captures now agree by construction rather than by value. `scripts/core/regen-hero.sh` fills a `{{TOKENS}}` placeholder in each `assets/captures/*.html.tmpl` with what `canon design css --no-components` emits, so a value moved in the module moves both frames and the next capture renders it. The slide theme also sets Arial and Calibri where every other surface is monospace, so a single-family claim describes the captures and the terminal rather than the whole tree.
- The component half is left out of both frames on purpose. `canon design css` emits a status marker and a webkit scrollbar beside the token block, and a static capture renders neither, so inlining the whole output would put dead rules in two committed files.
- The toolkit's one authored icon, `assets/brand/mark.svg`, is not a design token. `regen-hero.sh` reads it directly and fills a separate `{{MARK_SVG}}` placeholder beside `{{TOKENS}}`, landing in `assets/captures/hero.html.tmpl`'s topbar `.mark` slot as inline markup rather than a linked file. The `iconography` field in `src/design/tokens.ts` names it, so a reader of `.claude/DESIGN.md` alone does not have to find the SVG source separately.
- The same mark ships as a favicon in three independently-maintained copies rather than through one shared verb. `regen-hero.sh` derives its copy from the live SVG and the live accent token on every run, so it never goes stale. `src/design/render.ts`'s hardcoded path data and `teach-workspace`'s `SKILL.md` prose are both static text nothing checks, so a future change to the mark's shape updates one copy and silently leaves the other two behind. The trade was taken because this is the first surface asking for a shared icon, and the codebase's own bias is to wait for a second concrete case before lifting a helper into shared infrastructure.
- The three copies carry different colors on purpose, which is not a fourth thing nothing checks. `regen-hero.sh` colors its copy with the dark `accent` role (`#e0724b`), matching the dark chrome the capture frames render on. `src/design/render.ts` colors its copy with `light-accent` (`#a4471c`), since the design token preview renders on light chrome and a data URI has no CSS context to resolve a role by. `teach-workspace`'s literal writes the same dark accent as `rgb(224,114,75)` rather than as hex, to clear the shipped-references gate's commit-sha check. A reader unifying the three onto one color, or "fixing" the one that looks drifted, breaks the fit each was chosen for.
- `canon design regen` resolves its outputs from `PROJECT_ROOT`, which is the installed package directory in a target. It refuses where `.claude/DESIGN.md` is absent at that root, which is what an installed package looks like, rather than writing two files into `node_modules` and reporting success.
- Two terminal color rows emit a token no consumer resolves. `--color-warning: ANSI 33` is not a color and the matching `style` attribute is dropped, so those swatches paint nothing in the preview. Recording the ANSI code is still right for those two, since no rendered surface implements an equivalent, and the gap is that the render has no answer for a non-hex token.
- `success` is the one of the three roles that has a rendered equivalent. `assets/captures/install.html` marks every confirmed step with it, so the role carries `#61c454`, emits a property, and earns a contrast reading against `background`, which is the only ground it is drawn on. The shell still writes `ANSI 32` for the same role, so the two are one role in two registers and no reading claims the terminal renders that hex.
- `src/design/css.test.ts`'s coverage of `TEACH_STYLESHEET_COMPONENTS` cannot rely on each component's own `reads` array alone, since that is self-satisfying for a name a component both declares and reads. `TEACH_CHROME` also declares seven legacy alias properties (`--panel`, `--rule`, `--ink`, `--ink-soft`, `--ink-faint`, `--accent`, `--accent-bg`) that no component's CSS reads, since a hand-authored lesson diagram consumes them by name instead, so a `reads`-driven test cannot see that block at all. A second test derives its required names from a fixture shaped like a real lesson diagram's `var(--name)` references, which catches a name going undeclared regardless of whether any component claims to read it.

## Seed shape

The seed at `tooling/claude/seeds/canon/DESIGN.md` defines the target structure:

- **Personality**, one paragraph describing voice and tone
- **Color**, a table with `Role | Intent | Value` rows covering background, surface, text, muted, accent, success, warning, error
- **Typography**, a table with `Role | Family | Weight | Size | Line height` rows covering display, heading, body, label, code
- **Spacing**, a table with `Step | Multiplier | Value` rows covering xs through xl
- **Borders**, a table with `Role | Radius | Width | When used` rows
- **Motion**, one line on whether motion is used
- **Iconography**, one line on icon style and source

Table headers are load-bearing. The `canon design render` parser matches columns by header name, so keep them intact during edits.

## Extract skill

`canon:design-extract` drafts `canon/DESIGN.md` and picks one of two paths from what the project has. Both read `CLAUDE.md`, `canon/REQUIREMENTS.md`, and `standards/markdown.md`, load the `write-human` skill for tone, fill the same seed, and end at the same render.

The source path runs when the project has UI code. It reads CLI UI modules like `src/ui.ts` or `scripts/lib/ui.sh` plus any stylesheet or theme config, sources values from them, and tags an inferred cell with a trailing `? verify`. `standards/design.md` specifies that tag, its two spellings, and what the renderer does with it.

The skill is judgment-driven, not deterministic. It does not parse CSS or compiled styles. It codifies what the project already says about itself. For extraction from raw compiled code, reach for Claude Design instead.

The greenfield path runs when nothing matches. It requires a `## Personality` paragraph in `canon/REQUIREMENTS.md`, reads `canon/ARCHITECTURE.md` for platform signals, and proposes token values from those inputs. Nearly every cell carries `? verify`, since the values are speculative until code or a designer anchors them. This path avoids the Claude Design onboarding quota cost for a greenfield project, and a first render commonly shifts several tokens after review.

Install in a target project via `canon claude install` and invoke with `/canon:design-extract`.

### The scenario picker

`design-extract.sh` covers both paths through `select_or_route_scenario`, picking between `source`, which stages the tokenized notes app, and `greenfield`, which stages a focus timer with a `## Personality` paragraph and no code. `source` is listed first, so a caller routing past the picker lands on that path.

## Render command

`canon design render` reads `canon/DESIGN.md` and writes an HTML plus CSS preview to `.canon/tmp/render/design/`. The HTML shows color swatches, typography samples, spacing bars, and border exemplars. The CSS holds tokens as custom properties for copy-paste into a project stylesheet.

A cell no source anchors shows a `? verify` marker beside its value, and a confidence line above the sections names how many cells are anchored against how many are tagged. `src/design/parse.test.ts` and `src/design/render.test.ts` cover both tag spellings, the count and the columns it reads, and the untagged render.

Flags:

| Option            | Default                    | Behavior                 |
| ----------------- | -------------------------- | ------------------------ |
| `--source <path>` | `canon/DESIGN.md`          | Source markdown to parse |
| `--out <path>`    | `.canon/tmp/render/design` | Output directory         |

The output directory sits under `.canon/tmp/render/`, gitignored scratch the command regenerates and `canon records push` never carries. Do not stage the preview.

## Board

`canon design board` generates a static page set into a gitignored record folder, defaulting to `.canon/tmp/render/board/` through `creationRel`, and reports the path a reader opens with `canon serve`. `src/design/board.ts` writes it, following `src/teach/workspace.ts`'s shape of TypeScript emitting self-contained HTML with no framework and no build step.

It reads from a caller-resolved `--root`, defaulting through `mainWorktreeRoot()` to the main worktree the way `canon teach`'s verbs resolve their own root, rather than from `PROJECT_ROOT`. `generateBoard` takes an `isToolkitCheckout` boolean the CLI layer computes by calling `isOwnCheckout(root)` (`@/project-root`), since a panel function comparing the constant internally would make every existing unit test, which passes a throwaway tmp directory as `root`, silently start exercising the "not toolkit" branch. `isOwnCheckout` reads `root`'s own `package.json` name rather than comparing the path against `PROJECT_ROOT`, since the CLI's own `PROJECT_ROOT` is wherever its running source sits, which is a linked worktree's own path when a worker runs the board from inside one, and literal equality there reported the main toolkit checkout `--root` correctly resolved to as not-toolkit. It gates the surfaces panel's landing-page half and the whole components panel, both of which read this repository's own build output. The command still carries the same `checkoutMismatchWarning` a stale global install needs, since `.claude/`, `.canon/`, and `web/` are absent from the published package's `files` list.

Six panels read sources that already exist on disk. Tokens calls `renderDesignDoc` against `surfaceDir(root, 'DESIGN.md')` rather than building a second renderer. Surfaces copies `web/dist` and `.canon/teach/` whole into the board's own tree and iframes each, reporting a missing build, an absent workspace, or (for the landing-page half alone, outside this toolkit's own checkout) a toolkit-only notice rather than rendering a broken frame. Wireframes reads every `**/*.md` under `surfaceDir(root, 'wireframes')`, excluding `index.md` at any depth, and renders each file as-is inside a `<pre>`, since `standards/wireframes.md` makes the ASCII proportions load-bearing and any parse would reinterpret them. `surfaceDir` (`@/surface-root`) is what lets tokens and wireframes reach a target that has not run `canon migrate surface-roots`, the same `.claude/`-or-`canon/` fallback `recordDir` already gives the surfaces panel's teach half. Each wireframe's label comes from the file's own `description` frontmatter field via `@/indexes/frontmatter`, and an empty or absent directory reports the whole panel empty rather than per file. Past candidates lists an arm capture image under `.canon/picks/` per folder, stepping over `references/`, and states the corpus is empty rather than rendering an empty grid when none carries one. Components copies `web/gallery-dist` the same way surfaces copies `web/dist`, reporting a missing build outside a build and a toolkit-only notice outside this toolkit's own checkout. References lists whatever image an operator has dropped flat under `.canon/picks/references/` via the same `imagesIn` helper Past candidates uses, with no fetching and no second token source, reporting the folder as absent or as present but empty rather than rendering nothing.

The header states the hand-off groundwork 89 named rather than building a control for it: one static line naming `canon:draft-and-pick` as the drafting owner and `canon:ux-audit` as the auditing owner, since a static page cannot invoke a skill and anything calling this a button would be describing a label.

The gallery build is `web/gallery.config.mjs`, a second Astro config whose `srcDir` points at `web/gallery-src` and whose `outDir` is `web/gallery-dist`, run through `bun run web:gallery`. `web/gallery-src/pages/index.astro` imports every component under `web/src/components/` and renders each in a labeled section, except `panel-group` and `panel-row`, whose props (`label`, and `name`/`value`) carry no defaults. Those two render as a named notice instead of invented data. The exclusion this depends on is structural rather than a filename convention: `web:build`'s own config never reads `gallery-src`, so a published build emits no gallery route and no gallery string, confirmed by grepping `web/dist` after a build rather than by relying on Astro's underscore-prefix convention, since an underscore-excluded page emits no output at all for the board to read either. `scripts/core/check-gallery-exclusion.sh` turns that grep into a standing guard rather than a one-time proof, run in `deploy-site.yml` and `pr-visual-checks.yml` right after `bun run web:build` and `bun run web:gallery`, since the property a later config change or a moved file could quietly break is the one thing worth re-checking on every build that reaches a live domain. It greps for a fixed `canon-gallery-marker` meta tag rather than the page's own prose, and asserts that marker survives inside `web/gallery-dist` before ever checking `web/dist` for it, so a rewritten notice fails there instead of quietly disarming the leak check reading the same string.

The board is never installed or synced. It is repository-local, measured against the one project rich enough to fill it, and a target that installs every domain receives no board at all. The generator is the directory's only writer, so `canon serve` and a later `canon capture` pass both read the result without assuming it exists ahead of a run.

## Workflow

Typical sequence in a new project:

1. Run the extract skill to draft `canon/DESIGN.md`. It sources tokens from an existing codebase, or proposes them against a greenfield project with a personality paragraph.
2. Review `? verify` cells and edit the file directly. The preview marks each one and counts them, so step 4 below is where they are found rather than the source file.
3. Run `canon design render` to regenerate the preview
4. Open `.canon/tmp/render/design/index.html` in a browser
5. Iterate on DESIGN.md until the preview matches intent

The Stitch integration (`canon design sync`, `generate`, `edit`, `variants`, `list`) sits on top of the same DESIGN.md file, consuming its tables via MCP. Stitch is Google's Gemini-powered design product, addressed through a remote MCP server at `stitch.googleapis.com/mcp` that exposes project, screen, generation, and design-system tools, and `DesignTheme`, the theme schema those tools read and write, sits beside the same object's free-text `designMd` field.

## Related

- `docs/agents/commands.md`: CLI flags and invocation contract for `canon design`
- `docs/workflow/visual-design-workflow.md`: tier framework for prose-only, visual companion, and graphical source of truth
