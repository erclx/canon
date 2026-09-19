---
title: Web
description: The canon.erclx.dev landing page, its Astro build, and the CI and layout gaps that follow from that
---

# Web

## Overview

Owns `web/`, the Astro app behind the `canon.erclx.dev` landing page: one route, read as one agent session from the ask to the merge across eleven sections. This is the toolkit's own public site rather than code shipped to a target project, so the application-code non-goal in `canon/REQUIREMENTS.md` does not reach it. See `canon/wireframes/landing-page.md` for the regions and states and `canon/context/tooling.md` for the astro-stack mechanics this domain inherits.

## Layout

- `web/src/pages/` owns the one route, assembling the sections in reading order
- `web/src/components/beats/` owns the eleven beats of the session, one component each, plus the turn and band primitives they render through
- `web/src/components/sections/` owns the sections around the beats: the fold, the proof band, the beat group, the provenance ledger, the install steps, the field, and the close
- `web/src/components/` owns the site chrome, being the nav and the footer, and the shared panel primitives the gallery renders
- `web/src/content/` owns page copy, each string tied to a `README.md` citation or a paraphrase marker
- `web/src/lib/` owns the build-time reads, split into the pure derivations and the CLI and file reads that feed them
- `web/src/fixtures/` owns the agent-view session snapshot, which no section renders since this page shipped
- `web/src/layouts/` owns the shared page shell
- `web/src/styles/` owns the page stylesheet and the generated design tokens
- `web/e2e/` owns the Playwright suite
- `web/public/assets/` owns `hero.png`, symlinked from the repository's own `assets/`
- `web/public/evidence/` owns the two fixed captures of one pull request the evidence beat shows
- `web/public/previews/` owns build-time renders embedded live as `<iframe>` sources: `design-tokens/` and `teach-workspace/`
- `web/gallery.config.mjs` and `web/gallery-src/` are a second Astro config over this domain's own components, owned by the design board rather than the landing page. See `canon/context/design.md`'s Board section for the mechanism and the exclusion proof.
- `scripts/core/check-gallery-exclusion.sh` runs in both `deploy-site.yml` and `pr-visual-checks.yml`'s capture job, right after `bun run web:build` and `bun run web:gallery`, failing the build on a gallery-named file or a `canon-gallery-marker` meta tag reaching `web/dist`. It exists because the one-time proof the gallery config's exclusion was checked against does not re-run on a later config change or a moved file. The marker is a fixed `<meta>` tag in `web/gallery-src/pages/index.astro` rather than the page's own prose, since the script also asserts the marker survives in `web/gallery-dist` first, so a rewritten notice fails loudly there instead of silently retiring the leak check that reads the same string.

## Decisions

**Composition**

- The page is one agent session read top to bottom: the ask, the rules whose globs match the path it touches, the skill loaded, the plan, the dispatch, the workers, the test gate, the memory routing, the review from a session that did not write the change, and the merge. The provenance ledger, the install steps, a field of every command and skill name with the used ones lit, and the close follow. Cause precedes effect throughout, which is why the skill beat sits ahead of the plan. The composition is the reference build `.canon/groundwork/95-visual-direction/evidence/system-15/`, locked 2026-09-19, and no earlier build in that folder is a source to build from.
- Every claim on the page names something the tool did in that session, and every figure that can derive does, from a real file or a CLI read at build time. Drawing figures from real data is what falsified three claims prose review had read past: a numerator nobody counted, a denominator read from the wrong root, and a hook action the hook does not perform.
- A redesign pass works the layers in this order, lowest first: content, composition, layout, space, type, surface, palette, imagery, motion, states. A lower layer constrains every layer above it, so a decision taken at the wrong altitude is overturned by one below it.
- The reference holds eleven sections in eight layout families: the fold, the proof band, `grp`, `arc`, the provenance ledger, the install steps, the field, and the close. A tint on a family is a modifier and not a family. The structural rule is the tint alternation, and `arc` exists so the two machine beats do not become a fourth and fifth `grp`. `sections/group.astro` carries the family and the tint as props, so a beat never knows which family it sits in.
- Each beat is its own component and `index.astro` only arranges them, so two builds touching different beats touch different files. Shared type, the section families, the actions, and the build treatment sit in `global.css`, and each figure's internals sit scoped in its own component.
- `global.css` maps the reference's role names onto the generated tokens rather than inlining its values. Five roles map directly. The figure card is the background in light and the chrome step in dark, because the dark surface ladder climbs where the light one descends, so one token cannot sit one step above the ground in both themes.

**Build-time reads**

- `web/src/lib/derive.ts` holds every rule about what a read means as a pure function, unit tested beside it, and `session.ts` spawns the CLI and reads files and hands the text over. Every reader refuses rather than falling back, since a figure drawn from nothing still renders. The rules figure reads the installed folder under `.claude/rules/canon/` for which rules the depicted session loaded and the `gov list` catalog for what each carries. The command field reads `canon --help` rather than `gov counts`, since the help is the surface a reader meets and it omits one registered command, which keeps the heading's count and the names under it one reading.
- `canon-cli.ts` spawns `bun` against this checkout's own `src/cli.ts` rather than `canon` on PATH. A PATH-resolved `canon` can be a different install than the checkout the build is running from, so a build in a linked worktree could read the main checkout's catalogs while the rest of the page rendered from the branch. It checks `stdout` rather than the exit code, since `canon gov counts` can exit 2 for drift elsewhere in the tree that this page's build did not cause.
- The branch graph, the review exchange, the provenance roster, and the lit names in the field are authored against the depicted session rather than read, since nothing on a build machine records which files four sessions held. The footer says so, which is the labelling repair the track named for an authored figure. The lit names are still checked against the catalog they sit in, so a renamed skill fails the build rather than lighting nothing.
- The version dot lights only when the npm registry's latest matches the version the build carries. It reports state rather than a count, so an unreachable registry reads as unconfirmed and the build continues.
- Every string in `copy.ts` carries an inline citation to `README.md` or a paraphrase marker, gated by `readmeCitations` in `src/gate/measures.ts`. The citation discipline itself is stated in `internal/rules/claude/593-landing-page.md`.

**Motion, type, and styling**

- Two figures build on arrival, the merge fan and the provenance ledger, since they are the only two whose shape is a cause and its consequences: the node appears and each consequence follows 90ms later. Bands do not rise, because a page partly invisible until scrolled is the shape that once returned a whole-page capture of the hero and ten thousand blank pixels. The class lands whatever the motion preference and the stylesheet decides whether it animates, so reduced motion or `?still` reaches the end state without a scroll. Every control takes a 160ms hover, press, and focus response.
- Monospace is retired as a role on this page, so `code` inherits Geist like everything else. `base.astro` embeds the vendored Geist face from `src/design/fonts.ts`, since `tokens.css` names Geist for every role and nothing served it, so the page rendered in the visitor's system sans.
- `global.css`'s rules sit inside `@layer base`, not unlayered, since Tailwind v4 generates its utilities inside `@layer utilities`, where an unlayered rule always wins regardless of specificity.
- The nav is a sticky flat bar rather than a floating pill. A pill floats over a centred headline and reads wrong there, and the bands alternate tints, so the bar takes the ground as its own surface. It measures its rendered height into `--nav-height`, re-measured by a `ResizeObserver`, because `scroll-padding-top` derives an anchor's landing from it and a hand-written height goes stale silently.

**Build and deploy**

- No `web/package.json` exists, since the repository declares no Bun workspaces. `bun run` invoked from elsewhere walks up to the repository root to run `web:build` and `web:preview`, pulling Playwright's cwd-relative output defaults with it, so `web/playwright.config.ts` anchors `outputDir` and its report folder to its own directory instead (`fileURLToPath(new URL('.', import.meta.url))`).
- Every `web:*` script in `package.json` runs `cd web` before invoking astro, rather than passing `astro --root web`. The mechanism, the golden astro config's `@` alias resolving against the invoking process's cwd, is recorded in `canon/context/tooling.md`'s Gotchas. This is that domain's instance of the choice.
- The `design` gate stage regenerates and drift-checks `web/src/styles/tokens.css` and `web/public/favicon.svg` alongside `canon/DESIGN.md` and `src/design/base.css`, since a value moved in `src/design/tokens.ts` would otherwise leave the web stylesheet and the tab icon stale with the gate reporting green.
- `.github/workflows/deploy-site.yml` runs no `bun link` step before the build, since `web/src/lib/canon-cli.ts` spawns `bun` against this checkout's own `src/cli.ts` directly and nothing in the build path touches PATH.
- `deploy-site.yml`'s push-trigger path globs and `.github/workflows/pr-visual-checks.yml`'s pull-request-trigger path globs are two literal copies of the same eight-entry list, compared live by the `visual-path-globs` gate stage (`src/gate/measures.ts`, `visualPathGlobs`). `pr-visual-checks.yml` runs an e2e job (`bun run web:e2e`) and a capture job on every qualifying pull request. The capture job builds via `bun run web:build`, serves via `bun run web:preview`, runs `tooling/web/configs/e2e/screenshot.ts` against it, copies its two `home` cases into `assets/evidence/home/{light,dark}.png`, and pushes a commit back onto the PR branch when the baseline moved. `web/screenshots/` and `web/evidence/` are gitignored, and `assets/evidence/home/` is the only committed baseline.
- `astro.config.mjs`'s `site` value reads `process.env.ASTRO_SITE || site.origin` from `content/copy.ts`, rather than the reverse, since `copy.ts` carries the real deployed origin that `og:url` and the card image already depend on.

**Assets and previews**

- `web/public/assets/hero.png` is a symlink into the repository's own `assets/evidence/`, not a copy, for one image source, and it serves only as the social card now. The Windows-checkout cost this carries, materializing it as a plain-text path with no build error, is recorded in `canon/context/tooling.md`'s Gotchas.
- The evidence beat's two captures under `web/public/evidence/pr-1699/` are fixed renders of one pull request's merge base and head, by `canon design render` at one viewport and one crop. Both commits are history, so no script regenerates them, and the caption says how they were made. A window mockup drawn from boxes was the alternative, and two real captures of one change answer the question with more force.
- `web/public/favicon.svg` is written by `scripts/core/regen-web-favicon.ts` from `assets/brand/mark.svg` and the two accent values in `web/src/styles/tokens.css`, rather than symlinked the way `hero.png` is. The source keeps `currentColor` because the nav embeds the same mark inline and wants it to inherit, and a favicon loads with no CSS context, so a symlinked source resolved `currentColor` against the initial value of `color` and painted the tab icon pure black on every surface.
- `assets/` and `examples/` both hold a hand-authored source, a render step, and output, so a source-versus-output rule cannot separate them and sorts within `assets/` instead. What separates the two folders is the reader: `assets/` is this repository's self-portrait for a visitor who never opens the source, and `examples/` is sample input for a reader about to copy and run it. A render gates only when something else committed depends on it staying current, which is `assets/`'s case through `captureStamps` and not `examples/`'s.
- `bun run web:build` runs `web:previews` (`scripts/core/regen-web-previews.ts`) between `web:favicon` and `astro build`. It writes `web/public/previews/<name>/{index.html,design.css}`, committed rather than gitignored, and the merge beat embeds the design-token render live via `<iframe>` as the change that session merged. The `teach-workspace` render is written and embedded nowhere, since the page carries the session and nothing else.
- The `teach-workspace` preview copies only rendered HTML and CSS, never a workspace's own `MISSION.md`, `RESOURCES.md`, or `GLOSSARY.md`, whose links are relative to `.canon/teach/` and resolve to nothing once copied under `web/public/`. It skips the whole regeneration when `.canon/teach/<slug>` is absent, since that folder is gitignored session scratch and no CI machine has it.

**Accepted costs**

- Accepted cost: the `grp` family appears three times. What holds it is the tint alternation and three distinct figure shapes, which separate the instances by surface and content. A section shape that changed every time would read as chapters, and the page's argument is one continuous session.
- Accepted cost: the install section is three equal cards, the page's one instance of a shape the rules split was redrawn to avoid. Three parallel install routes are the one place on the page where three equal things are three equal things.
- Accepted cost: the authored figures do not meet the page's own derivation rule. The footer labels them, and the other repairs are a record of the session that produced them or retiring them.
- Accepted cost: `error` and `warning` share a register with the accent, the most repeated element on every page. Both need a lightness or an icon carrying the meaning, since hue alone no longer separates them. The work is unscheduled.
- Undecided: a glass treatment on the sticky bar, the one element with content passing under it. Glass as a system was rejected, because it needs something moving behind it and makes the ground variable.

## Gotchas

- `web:tokens` and `web:favicon` invoke `bun src/cli.ts`, never the globally linked `canon`. A global binary resolves to the main checkout whatever worktree runs it, so `web:build` once overwrote a regenerated `web/src/styles/tokens.css` with output from a CLI that lacked the branch's own token changes.
- A design-token change moves the capture markup and the stamps and leaves the PNGs byte-identical, because the frames render on the dark ground and never set `data-theme`. The Hero stage is a drift check over `assets/captures/*.html`, so it fails until the regenerated frames are committed, which is the stage working rather than a defect.
- `web/` has no typecheck in the automated gate, in three layers. `src/gate/stages.ts`'s `types` stage scopes to `/^src\/|^tsconfig\.json$|^package\.json$/`, the root `tsconfig.json` sets `include` to `["src"]` alone, and only the manual `bun run web:build`, through `astro check`, type-checks `web/` against `astro/tsconfigs/strict`. The unit tests under `web/src/lib/` do run in the root suite, through the `web/src/**/*.test.ts` include in `vitest.config.ts`.
- Playwright takes reduced motion as a context option, `use.contextOptions.reducedMotion`. Written as a top-level `use.reducedMotion` it type-checks nowhere, since the config file sits outside every typecheck, and reaches no page, which is how the suite ran with full motion for a release while its config said otherwise.
- An `<img loading="lazy">` or `<iframe loading="lazy">` stays unloaded until it nears the viewport, so a full-page capture that scrolls nothing shows the evidence pair and the token preview empty, and a Playwright assertion against the frame reads it as empty on a bare `page.goto('/')`. Scroll the beat into view first.
- `tooling/web/configs/e2e/screenshot.ts` captures full-page with neither reduced motion nor `?still`, so the committed `assets/evidence/home/` baseline shows the merge fan and the provenance ledger at their start state. Any other capture of this page takes one of the two escapes.
