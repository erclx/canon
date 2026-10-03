---
title: Teach
description: Learning workspace layout, the chrome splice, the committed fixture, and the canon teach verbs
---

# Teach

## Overview

A learning workspace is a folder of standalone HTML lessons a learner opens directly, with a mission, a glossary, resource pages and learning records beside them. `canon teach` opens a workspace, resolves what the next lesson needs, seeds a stylesheet from the design tokens, and splices navigation chrome into every lesson.

Two standards fix the artifact and one skill drives the pedagogy. `standards/teach.md` fixes layout, ordinal naming, frontmatter, and the mission and learning-record formats. `standards/glossary.md` fixes the glossary. The shipped `teach-workspace` skill decides what to teach next, which is deliberately not a standard.

## Layout

- `src/teach/` owns the workspace reader, the chrome splice, lesson resolution, and the body renderer
- `examples/teach/` owns the committed fixture, rooted at `00-fixture/`, which development renders against
- `.canon/teach/` owns the operator's live workspaces, gitignored and backed through `canon records push`
- `canon/context/features/teach-chrome.md` owns the chrome's build and style decisions and the page scripts

## Decisions

**A workspace is named `<nn>-<topic>` rather than by a bare slug**, so a listing sorts by when each opened. It is the first record folder to take that shape, which was free because the surface was greenfield. `canon/context/standards/per-standard/surfaces.md` carries the decision and the groundwork and intake folders' shared sequence beside it.

**Quiz option order is drawn by `canon teach lesson` rather than chosen by the author.** An author told to vary a position still varies it by judgment, and a verb is a check where an instruction is a hope. What the split cannot close is that the body remains free to reorder what the verb reports, since nothing downstream compares the two, which is recorded rather than fixed.

**The chrome is spliced into each lesson rather than inserted by a template.** A lesson is a standalone file a learner opens with no build step, so a template would introduce one and a copied header would drift per lesson. The splice keeps the file directly openable and the chrome uniform, at the cost that an authored file and a generated one share a path.

**`nav` supplies the lesson skeleton outside the markers rather than a fifth marker.** The authoring skill has a session write four empty marker pairs and a bare body, and the page also needs a `<main>` for the column width and the base stylesheet link. `nav` links the sheet from the `style` region and wraps the authored body in `<main>` when it holds none, which is markup outside every region, as dropping the hand-written icon and `course.css` link already was. A fifth marker was the alternative, and every lesson already written would lack it.

**A reference page is rendered by `nav` to an HTML sibling rather than by the server.** `canon serve` hands `.md` over as plain text, so the contents page linked a page meant for rereading as raw frontmatter and pipe tables. `nav` renders each `reference/<slug>.md` to `reference/<slug>.html` through `Bun.markdown.html`, escaping raw HTML, and links that instead, leaving the markdown as the promotable half. A markdown renderer inside `canon serve` was the alternative, and it would put a teach-specific concern into a verb that also serves slides and design previews. The cost is the lesson splice's own: the HTML is stale until the next `nav` run after the markdown changes, and a hand edit to it is lost with nothing reporting it.

**Code is highlighted at build time, where it is authored or generated, and never as a pass over written markup.** `canon teach render` takes a `code` block and the Code component runs it through `src/teach/highlight.ts`, and `nav` runs the fences `Bun.markdown` emits on a reference page through the same function after decoding them once. Both emit `hljs-*` class spans that the article rules color from `--teach-syntax-*` tokens, so a page carries no script. highlight.js was taken over Shiki because it is synchronous, which keeps `renderLessonBody` sync, and lighter, at the cost of coarser grammars. It registers a fixed set of about a dozen languages from `lib/core`, and an unregistered one renders plain rather than refusing. The module is loaded by dynamic import from `runRender` and from the reference render, so a verb that reaches neither never loads its grammars. A `<pre><code>` already in a lesson body stays untouched, since `nav` has never rewritten authored content beyond the `<main>` wrap and lesson links.

**The syntax colors are teach-local hex tokens rather than design-record roles.** `TEACH_SYNTAX` in `src/design/components.ts` holds a dark and a light value per token, declared under `:root` and `[data-theme='light']`, the same switch the ground they sit on uses. Hex rather than `color-mix` is what lets `src/design/contrast.test.ts` hold every value to AA against `surface` and `light-surface`. `keyword`, `comment` and `meta` repeat the accent, muted and secondary values. They move to the design record when a second surface renders highlighted code.

**`canon teach list` prints the `canon serve` line with the teach folder it read, rather than a literal `.canon/teach`.** `canon serve` resolves its directory against the cwd while the list verb reads the main worktree root, so the literal serves an absent folder from a linked worktree. The folder prints relative to the cwd when it sits under it and absolute otherwise, since a `../` path climbing out of a worktree reads as a mistake. The JSON record carries no serve field. That line is the route that serves without rewriting anything.

**Viewing goes through `canon teach up`, which runs `nav` and then serves.** It serves through the same `startServer` as `canon serve`, so serving a directory stays general and the teach-specific part is the refresh in front of it. A `--serve` flag on `nav` was the alternative, and it lost because viewing is what a reader reaches for, while `nav` names a write. It prints the URL rather than launching a browser. The cost is that viewing writes, so `--root examples/teach` dirties the committed fixture. The shared serve reporting sits in `src/serve/report.ts`.

**`up` watches the teach root and reloads open pages after a refresh.** A change under the root starts a `nav` pass, passes run one at a time with a change arriving mid-pass coalesced into one more, and a pass that changed what is served sends a reload over the shared change stream in `src/serve/live.ts`. The reload script is spliced into each page by the static server's live mode at serve time, so a page on disk, a promoted lesson, and the committed fixture never carry it. Writing the script into `nav` output was the alternative, and it lost because every page `nav` writes would then hold a hook pointing at a server that is not running when the page is read later. The loop settles because `nav` writes through `src/teach/write-if-changed.ts`, so a pass over unchanged sources touches no file and raises no event, and a refused pass sends no reload, which keeps a page from reloading onto a half-written state. The canvas keeps its own copy of the stream until it moves onto the shared one.

**Which sources qualify is stated over `RESOURCES.md` rather than over lesson content.** The standard's `### Choosing sources` ladder says what may stand behind the material, and the `teach-workspace` skill enforces the lesson half, choosing by the ladder in its research step and checking a lesson's `refs` in its writing step. Stating what stays out of a lesson was the alternative, and it contradicts the standard's own `## Layout` and `## Scope`, which leave lesson content to the driving surface.

Recording a source's rung as a field was rejected too, since a `canon teach resource` schema change buys a check only a reader can make, so a third-rung source carries its reason in the free-text title.

**A durable page promoted out of a workspace routes through a file of its own**, at `.canon/tmp/handoff/teach-promotion/<slug>.md`, which `context-fold` folds and deletes. Sharing the memory-routing handoff was the obvious reuse and is what the pattern cannot take, since that file already has two writers and a reader that deletes it.

## Gotchas

- `canon teach nav` rewrites lessons in place and refuses a lesson missing its four marker pairs, `canon:teach:style`, `canon:teach:header`, `canon:teach:footnav` and `canon:teach:scripts`. A hand-edit inside a pair is overwritten by the next run with nothing reporting it. The authored heading, lede, body and quiz sit between the header and footnav markers and are left untouched, apart from a `<main>` wrap where they hold none and a link on each "lesson NNNN" mention. Nav owns only a link carrying `data-lesson-ref`, so it re-points one after a slug rename and unwraps one whose number stopped resolving, and it reports that number under `unresolved` rather than rewriting it.
- One `nav` run rewrites the teach root, the contents pages, and every lesson's chrome, so its diff reaches files the change did not name. That is the verb working rather than a defect, and the diff is still the cheapest place to notice a wrong pipeline change.
- `canon teach nav` rewrites `assets/base.css` only where the workspace already holds one or holds no `course.css`. A legacy workspace carrying a hand-authored `course.css` and no `base.css` keeps rendering from its own sheet, so a change to `TEACH_CHROME` never reaches it until `canon teach stylesheet <topic>` seeds the base half.
- No browser harness in this repository reaches a generated teach page. `web/playwright.config.ts` is the only browser config that is not a seed for a target, and nothing under `web/e2e/` names teach, so what a rendered lesson does has nowhere to be asserted above the unit layer. A change carrying collapse, resize, filter, focus, or overlay work therefore ships it named as untested rather than covered, and what is missing is the harness rather than a person to look.
- Regenerating the fixture takes `bun src/cli.ts teach ...` rather than an installed `canon`. The installed binary carries the components it was published with, so a branch that changes `src/design/components.ts` regenerates the older stylesheet and reverts whatever landed since, with nothing failing.
- The committed fixture is prettier-formatted after a `nav` run, and prettier closes a void tag as `/>`. Anything `nav` later matches in a page it generated, such as the reference page's generator meta tag that the orphan sweep keys on, has to accept both `>` and `/>`. Prettier also wraps a closing tag across a line as `</a\n>`, so the lesson-link pass matches a nav-owned link's close as `</a\s*>`, or a formatted lesson never re-points after a slug rename.
- `Bun.markdown` is writable but not configurable, so a test stubbing its absence sets it with `Reflect.set` and restores it after. `Object.defineProperty` throws there.
- `canon teach stylesheet <topic>` rewrites the generated half, `assets/base.css`, unconditionally, and `nav` now rewrites it too wherever it exists. Only the workspace's own `course.css` rules are embedded in a lesson, so an edit there takes a `nav` run before a lesson shows it.
- `workspace.ts` resolves a root whose basename is already `teach` as that root rather than nesting a second `teach` below it, so a path ending in `teach` behaves differently from one that does not.
- A bare `canon teach list` reads the operator's live workspaces. Reaching the committed fixture takes `--root examples/teach`, and a claim about the fixture made without the flag describes a different tree.
- `governance/rules/canon/661-teach.md` is scoped to `.canon/teach/**`, which is workspace content. It reaches neither `src/teach/` nor `examples/teach/`, so an implementation or fixture edit is routed by the `internal-teach` skill rather than by that rule. Widening the rule is wrong, since it ships to targets through governance sync and a target has no `src/teach/`.
- The captures under `examples/teach/evidence/` are taken with `canon capture <url> -o <png> --selector body` against `canon serve examples/teach --port 8766`, since a URL source refuses without `--selector`. The capture rewrites the `.stamp` beside each image, and two runs with no change between them come back byte-identical.
- The shipped `claude/skills/teach-workspace/SKILL.md` sat at 300 rendered lines on 2026-09-30, exactly the Document ceiling stage's limit, which fails a push past it. An addition there has to displace text or fold into a line with wrap slack, and a rule needing more room goes to the standard or a reference the body points at.
- Renders committed under `examples/` are disclaimed rather than gated, because nothing outside `examples/` depends on them staying current. `canon/context/web/assets.md` draws that line between `assets/` and `examples/` on who each folder addresses.

## Related

- `canon standards teach`: the workspace artifact
- `canon standards glossary`: the glossary every workspace carries
- `claude/skills/teach-workspace/`: the pedagogy and the promotion handoff
- `canon/context/design/tokens.md`: the token values a workspace stylesheet is seeded from
