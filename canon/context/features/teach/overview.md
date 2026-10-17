---
title: Overview
description: Learning workspace layout, the chrome splice, the committed fixture, and the canon teach verbs
---

# Overview

## Overview

A learning workspace is a folder of standalone HTML lessons a learner opens directly, with a mission, a glossary, resource pages and learning records beside them. `canon teach` opens a workspace, resolves what the next lesson needs, seeds a stylesheet from the design tokens, and splices navigation chrome into every lesson.

Two standards fix the artifact and one skill drives the pedagogy. `claude/skills/teach-workspace/references/teach.md` fixes layout, ordinal naming, frontmatter, and the mission and learning-record formats, and `glossary.md` beside it fixes the glossary. The `teach-workspace` skill decides what to teach next, which is deliberately not a standard.

## Layout

- `src/teach/` owns the workspace reader, the chrome splice, lesson resolution, and the body renderer
- `examples/teach/` owns the committed fixture, rooted at `00-fixture/`, which development renders against
- `.canon/teach/` owns the operator's live workspaces, gitignored and backed through `canon records push`
- `chrome.md` beside this entry owns the chrome's build and style decisions and the page scripts
- `pages.md` beside this entry owns what the root, contents, lesson, and reference pages show and do

### Related

The artifact is `claude/skills/teach-workspace/references/teach.md`, with `glossary.md` beside it. `claude/skills/teach-workspace/` holds the pedagogy and promotion handoff, and `canon/context/design.md` the token values a workspace stylesheet is seeded from.

## Decisions

### Workspace naming

A workspace is named `<nn>-<topic>` rather than a bare slug, so a listing sorts by when each opened. It is the first record folder to take that shape, which was free because the surface was greenfield. `canon/context/claude-plugin/skill-references/surfaces.md` carries the decision and the groundwork and intake folders' shared sequence.

### Quiz option order

`canon teach lesson` draws quiz option order rather than the author choosing it. An author told to vary a position still varies it by judgment, and a verb is a check where an instruction is a hope.

What the split cannot close is that the body remains free to reorder what the verb reports, since nothing downstream compares the two. That is recorded rather than fixed.

### The chrome is spliced

The chrome is spliced into each lesson rather than inserted by a template. A lesson is a standalone file a learner opens with no build step, so a template would introduce one and a copied header would drift per lesson.

The splice keeps the file directly openable and the chrome uniform, at the cost that an authored file and a generated one share a path.

### The skeleton outside the markers

`nav` supplies the lesson skeleton outside the markers rather than a fifth marker. The authoring skill has a session write four empty marker pairs and a bare body, and the page also needs a `<main>` for the column width and the base stylesheet link.

- `nav` links the sheet from the `style` region and wraps the authored body in `<main>` when it holds none
- That is markup outside every region, as dropping the hand-written icon and `course.css` link already was
- A fifth marker was the rejected alternative, and every lesson already written would lack it

### Reference pages render in `nav`

`nav` renders each `reference/<slug>.md` to `reference/<slug>.html` through `Bun.markdown.html`, escaping raw HTML, and links that instead, leaving the markdown as the promotable half. `canon serve` hands `.md` over as plain text, so the contents page had linked raw frontmatter and pipe tables.

- A markdown renderer inside `canon serve` was rejected, since it would put a teach-specific concern into a verb that also serves slides and design previews
- The cost is the lesson splice's own. The HTML is stale until the next `nav` run, and a hand edit to it is lost with nothing reporting it.

### Code is highlighted at build time

Code is highlighted where it is authored or generated, never as a pass over written markup. `canon teach render` takes a `code` block and the Code component runs it through `src/teach/highlight.ts`. `nav` runs the fences `Bun.markdown` emits on a reference page through the same function after decoding them once.

- Both emit `hljs-*` class spans that the article rules color from `--teach-syntax-*` tokens, so a page carries no script
- A `<pre><code>` already in a lesson body stays untouched, since `nav` has never rewritten authored content beyond the `<main>` wrap and lesson links

### Highlighter choice

The highlighter is highlight.js rather than Shiki because it is synchronous, which keeps `renderLessonBody` sync, and lighter, at the cost of coarser grammars.

- It registers a fixed set of about a dozen languages from `lib/core`, and an unregistered one renders plain rather than refusing
- The module loads by dynamic import from `runRender` and the reference render, so a verb reaching neither never loads its grammars

### Syntax colors are teach-local

The syntax colors are teach-local hex tokens rather than design-record roles. `TEACH_SYNTAX` in `src/design/components.ts` holds a dark and a light value per token, declared under `:root` and `[data-theme='light']`.

Hex rather than `color-mix` lets `src/design/contrast.test.ts` hold every value to AA against `surface` and `light-surface`. `keyword`, `comment`, and `meta` repeat the accent, muted, and secondary values, and move to the design record when a second surface renders highlighted code.

### `list` prints the serve line

`canon teach list` prints the `canon serve` line with the teach folder it read, rather than a literal `.canon/teach`. `canon serve` resolves its directory against the cwd while the list verb reads the main worktree root, so the literal serves an absent folder from a linked worktree.

The folder prints relative to the cwd when it sits under it and absolute otherwise, since a `../` path climbing out of a worktree reads as a mistake. The JSON record carries no serve field.

### Viewing goes through `up`

`canon teach up` runs `nav` and then serves through the same `startServer` as `canon serve`, so serving a directory stays general and the teach-specific part is the refresh in front of it. It prints the URL rather than launching a browser. Shared serve reporting sits in `src/serve/report.ts`.

- A `--serve` flag on `nav` lost, because viewing is what a reader reaches for while `nav` names a write
- The cost is that viewing writes, so `--root examples/teach` dirties the committed fixture

### `up` reloads open pages

`up` watches the teach root and reloads open pages after a refresh. A change starts a `nav` pass, passes run one at a time with a change mid-pass coalesced into one more, and a pass that changed what is served sends a reload over the shared change stream in `src/serve/live.ts`.

- The static server's live mode splices the reload script in at serve time, so a page on disk, a promoted lesson, and the committed fixture never carry it
- Writing it into `nav` output lost, since every page `nav` writes would hold a hook pointing at a server that is not running when read later
- The canvas keeps its own copy of the stream until it moves onto the shared one

### The loop settles

`nav` writes through `src/teach/write-if-changed.ts`, so a pass over unchanged sources touches no file and raises no event. A refused pass sends no reload, which keeps a page from reloading onto a half-written state.

### Which sources qualify

Source quality is stated over `RESOURCES.md` rather than lesson content. The standard's `### Choosing sources` ladder says what may stand behind the material, and the `teach-workspace` skill enforces the lesson half. It chooses by the ladder in its research step and checks a lesson's `refs` in its writing step.

- Stating what stays out of a lesson contradicts the standard's own `## Layout` and `## Scope`, which leave lesson content to the driving surface
- Recording a source's rung as a field was rejected too, since a `canon teach resource` schema change buys a check only a reader can make. A third-rung source carries its reason in the free-text title.

### Promotion handoff

A durable page promoted out of a workspace routes through its own file at `.canon/tmp/handoff/teach-promotion/<slug>.md`, which `teach-workspace`'s fold mode lands from a branch and deletes. A second producer of a handoff needs a file of its own, since a reader that deletes it would discard whatever another writer left.

## Gotchas

### Nav rewrites in place

`canon teach nav` rewrites lessons in place and refuses a lesson missing its four marker pairs, `canon:teach:style`, `canon:teach:header`, `canon:teach:footnav` and `canon:teach:scripts`. A hand-edit inside a pair is overwritten by the next run with nothing reporting it.

- The authored heading, lede, body and quiz sit between the header and footnav markers and are left untouched, apart from a `<main>` wrap where they hold none and a link on each "lesson NNNN" mention
- Nav owns only a link carrying `data-lesson-ref`, so it re-points one after a slug rename and unwraps one whose number stopped resolving, reporting that number under `unresolved`
- One run rewrites the teach root, the contents pages, and every lesson's chrome, so its diff reaches files the change did not name
- That is the verb working, and the diff is the cheapest place to notice a wrong pipeline change

### Stylesheets and legacy workspaces

`canon teach nav` rewrites `assets/base.css` only where the workspace already holds one or holds no `course.css`. A legacy workspace with a hand-authored `course.css` and no `base.css` keeps rendering from its own sheet, so a change to `TEACH_CHROME` never reaches it until `canon teach stylesheet <topic>` seeds the base half.

### No browser harness

No browser harness in this repository reaches a generated teach page. `web/playwright.config.ts` is the only browser config that is not a seed for a target, and nothing under `web/e2e/` names teach, so what a rendered lesson does has nowhere to be asserted above the unit layer.

A change carrying collapse, resize, filter, focus, or overlay work ships named as untested rather than covered. What is missing is the harness rather than a person to look.

### Regenerating the fixture

Regenerating the fixture takes `bun src/cli.ts teach ...` rather than an installed `canon`. The installed binary carries the components it was published with, so a branch that changes `src/design/components.ts` regenerates the older stylesheet and reverts whatever landed since, with nothing failing.

### Fixture and test traps

A `canon teach nav --root examples/teach` run rewrites the committed fixture pages across about 1,800 lines, since they predate the current browser-script emitter. `01-sparse` and `02-unopened` sit about 70 lines short of the syntax tokens in their base sheets.

A change needing only the chrome stylesheet regenerates the sheets and keeps the page diff out.

- The fixture is formatted after a `nav` run, and the formatter closes a void tag as `/>`. Anything `nav` matches in a generated page, such as the generator meta tag, must accept both.
- The formatter wraps a closing tag as `</a\n>`, so the lesson-link pass matches a nav-owned link's close as `</a\s*>`, or a lesson never re-points after a slug rename
- `Bun.markdown` is writable but not configurable, so a test stubbing its absence sets it with `Reflect.set` and restores it. `Object.defineProperty` throws there.

`canon teach stylesheet <topic>` rewrites `assets/base.css` unconditionally, and `nav` rewrites it wherever it exists. Only the workspace's own `course.css` rules are embedded in a lesson, so an edit there takes a `nav` run.

- `workspace.ts` resolves a root whose basename is already `teach` as that root, so a path ending in `teach` behaves differently from one that does not

### Roots and captures

A bare `canon teach list` reads the operator's live workspaces. Reaching the committed fixture takes `--root examples/teach`, and a claim about the fixture made without the flag describes a different tree.

- No rule scopes `.canon/teach/**`, since `teach-workspace` owns workspace content and ships its standards as references
- The `internal-teach` skill routes an edit under `src/teach/` or `examples/teach/`, and a target has no `src/teach/`
- Captures under `examples/teach/evidence/` use `canon capture <url> -o <png> --selector body` against `canon serve examples/teach --port 8766`. A URL source refuses without `--selector`.
- The capture rewrites the `.stamp` beside each image, and two runs with no change between them come back byte-identical

### Evidence and ceiling

The shipped `claude/skills/teach-workspace/SKILL.md` sits at 300 rendered lines, exactly the Document ceiling stage's limit, which fails a push past it. An addition there has to displace text or fold into a line with wrap slack, and a rule needing more room goes to the standard or a reference the body points at.

- The frames under `examples/teach/evidence/` are prod evidence, shown to a reader of the examples. No dev baseline exists, and one would sit at `assets/evidence/teach/`.
- Two defects are measured against the captures, being no phone or tablet frames (v113.0) and a URL capture stamp that hashes the address rather than the page (v116.1)
- `canon/context/development/evidence.md` owns the boundary
- Renders committed under `examples/` are disclaimed rather than gated, because nothing outside `examples/` depends on them staying current
- `canon/context/web.md` draws that line on who each folder addresses
