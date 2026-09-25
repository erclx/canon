---
title: Drafting
description: The proposal, candidate, docs, context, and wireframe draft surfaces, the identity surface, and the walkthrough surface, with the boundary each holds against its neighbors
---

# Drafting

## The proposal surface

`markdown-propose` closes a gap three shipped surfaces sit beside without covering: nothing else drafts a markdown replacement, carries an answer slot, and waits. `standards-audit` maps changed files to standards and reports, ending on its own description, `Do NOT fix violations. Reporting only.` `canon markdown audit` measures bans and structural checkpoints from package data. `review-branch` reports findings on a diff someone already wrote. All three report, and none drafts or waits for an answer.

It is a recombination rather than a new design. Its phases are an external content-audit skill's five passes, generalized down to what describes a governing document rather than a person: inflation, staleness, contradiction, and duplication survive the generalization, and register drift does not, since this repository's docs carry no spoken-versus-written split for a word to drift across.

Its answer contract is `plan-intake`'s `You:` slot rather than a new one, chosen because it already ships toolkit-wide with the same empty-means-unread rule this surface needs. The plan file's blank-means-accept contract would read the wrong way on a folder read over days rather than one sitting.

The folder is `.canon/proposals/<nn>-<slug>/`, named for what it holds rather than leaning on a singular-versus-plural distinction against a sibling folder that reads the same at a glance. `src/records/backup.ts` carries it in `BACKED_FOLDERS`, since a proposal carries an unanswered decision and that list holds what a disk loss would take rather than regenerate.

The skill takes the concern and the surface it audits as invocation inputs rather than constants, which is what lets a second concern reuse the skill rather than fork it.

The format spec that would ordinarily be a standard, on the pattern `standards/teach.md` set for a workspace shape, stays inside the skill's own `references/format.md` instead, since this repository's own citation rule says a file only one skill reads ships inside it rather than into a corpus a second reader would have to find.

The variant format states `### N.` for a change and `#### A/B/C` for a variant explicitly, which is the shape that holds across a run producing several labelled bets on an invented change against one replacement on a corrected claim.

## The candidate surface

`draft-and-pick` covers work where several drafts are produced, looked at, and iterated until one is good enough. The four nearest surfaces all miss it by assuming the answer is known: `plan-feature` plans one answer, `ux-audit` reports roughness from source in one pass, `ux-measure` reads numbers off a running interface, and `ui-checklist` writes what to look at on a change already made. Each takes one pass at one answer, so a decision settled by looking lands on whichever of them matches the word "UI".

The name carries no ownership prefix, on the ownership axis in `canon/context/claude-plugin/skill-strategy/axes.md`: this skill writes candidates to `.canon/tmp/<slug>/` and deletes them with the pick, so a bare verb phrase places it beside `restate-plainly` and `decision-escalate` rather than beside a workflow-surface family. A noun with no act in it was the alternative and was declined.

A run with several rounds also writes `<dest>/frame.html` from the skill's `references/frame.html`: a page picker over every round's files and a theme toggle, with a hint pointing at the browser's device toolbar for width rather than a width control of its own. The arm list is baked in when the frame is written, since `canon serve --index` answers with a directory page a frame cannot read back, and the frame stays skill-local until a second skill needs it.

### The composed sheet has no verb

`captureSources` renders one image per source and composes nothing, so the contact sheet the source skill relied on has no counterpart verb here. What replaces it is authoring every arm side by side on one self-contained page and capturing that once, which gives the comparison the sheet existed for and needs no new verb. One file per arm was the alternative and hands the operator several images to hold against each other in memory, which is the comparison the page makes visible instead.

The measurement rules are cited rather than restated. `canon drive` ships the probes carrying most of the source skill's nine, and the body keeps the three no probe reaches: composite alpha before reading a color, sample inside the shape rather than at a bounding-box corner, and ask whether a reader would see the thing at all. The three stay in the body, well under the fifteen-line move checkpoint.

What travels and what does not is stated in the skill's own `REQUIREMENT.md` rather than in the plan or the task. Both of those are archived or gitignored at ship, so the requirement is the only one of the three a later reader opens. Three source capabilities stay behind, and a verb answers two of them: an arm switcher compiled into a project's own page gives way to `canon serve` over a scratch page, a site-wide treatment walker gives way to `canon drive` reading one page, and a copy cycle keyed to canonical text in a second repository is replaced by nothing at all, since no toolkit surface has that shape.

The pull request boundary rule lives in `plan-feature` and not in `standards/plan.md`. It is the whole of the source skill's phase 1, and a session decides scope while writing the plan, so it lands in the skill that writes one rather than in the document standard that plan follows. A rule stated in both is two sources for one rule.

### What the arm reaches

The sandbox arm resolves `canon capture` through `playwright-core` and the installed `canon` binary rather than `@playwright/test`, since the latter resolves out of a `node_modules` no target installs. A headless run has no operator to confirm a pick is right, so waiting would spend turns up to the cap with nobody to answer. Closing on a pre-supplied pick is the only terminal behavior available to it.

What the arm cannot reach is the loop, the pick, and the hand-off, and that is a property of the harness rather than a gap a later fixture closes. The stop condition is a person and no fixture supplies one, so a green verdict is not coverage of the half the skill exists for. What is left to assert is the blast radius and the scope of the edit: a `write_scope` admitting the two surfaces a close legitimately reaches, and content pins holding the lines of the seeded page a treatment change must leave alone.

`canon capture` refuses a page that would rewrap against a substituted font, so a candidate page naming no font is refused on whatever the default font resolves to. Step 2 tells a run to declare a stack the machine resolves, since a page that carries everything it needs and a page that renders are not the same requirement.

A close records the decision wherever it was stated as open, in the same step that writes the design note, a path the write scope admits. The losing arms are deleted by the next step, so a pick that records nothing about why leaves the next reader re-deriving it from a diff.

## The docs draft surface

`draft-docs` covers a page under `docs/` that does not exist yet, which is the gap `docs-sync` was never built to close: that skill classifies and rewrites existing sections against a diff since main, and a page with no prior version has no diff to classify. Reaching for it on a brand-new topic reports the page as unrelated to any change, which reads as a clean pass over a request nobody served.

The two skills stay separate rather than widening `docs-sync` to cover both, keeping a drafting branch out of a skill whose contract already reads as a rewrite. The split is by whether a diff exists to classify, the same axis `standards/docs.md` already sits behind `standards/context.md` and `standards/readme.md` on.

What it borrows from `create-standard` rather than from its nearer neighbor is the confirm step. `docs-sync` writes immediately after its preview, since the tool permission dialog is confirmation enough over a rewrite bounded by a diff. A new page carries no such bound, since placement is a judgment call weighed against the catalog's existing shelves rather than a change the branch already made, so the skill confirms the resolved path and the full content with the user before writing, the way `create-standard` confirms a slug and a body against no diff of its own.

Placement reads the catalog rather than assuming a folder. A `category` value already carried by a sibling page is reused verbatim, since a near-miss spelling opens a second shelf holding one page, and a topic matching no shelf lands at the `docs/` root, since a subfolder earns itself only once a shelf of pages already sits there. The guard against redrafting a covered topic runs the derived slug through `canon docs <slug>` and points at `docs-sync` on a hit, which is a heuristic gate rather than an exhaustive one, since the slug is guessed from the topic phrase rather than confirmed against every page's frontmatter.

## The context and wireframe draft surfaces

`draft-context` and `draft-wireframes` close the same gap `draft-docs` closes, for the two surfaces `docs-fold` refreshes but never originates. That skill declines outright to create a new `canon/context/` entry, and its wireframe sweep only writes a bare `TODO` stub for a surface a diff touched. Neither is a draft, so a domain or a surface with no file yet is reached by nothing that reads the owning standard, checks the catalog for a name collision, or confirms a placement judgment before writing.

Both skills take `draft-docs`'s shape whole rather than inventing a second one: read the owning standard, check for a name-or-topic collision, decide placement, draft against the template, confirm, write. `draft-context` defaults every new domain to a flat file, since a fresh domain never holds the three or more sub-areas the context standard requires before it earns a folder. `draft-wireframes` walks the whole `canon/wireframes/` tree rather than its top level alone, since a collision can sit nested inside a grouped surface's own subfolder.

`standards/wireframes.md` documents only the per-surface ASCII shape. A three-tier framework deciding ASCII-only, ASCII-plus-render, or visual-as-source-of-truth lives in the project-wide visual design workflow guide instead, a once-per-project four-question call rather than a per-draft decision, and `draft-wireframes` reads it from there rather than from the wireframe standard.

`draft-wireframes` reads `canon/DESIGN.md` and the wireframes tree for an existing tier signal and reports what it finds, since no shipped mechanism turns a detected tier 1 or tier 2 into a companion render. Detecting and reporting is the ceiling for a skill mirroring `draft-docs` rather than a scoped-down version of something more ambitious.

## The identity surface

`draft-identity` covers a project's logo mark and the social card composed from it, reached through `draft-and-pick`'s own render-and-pick loop rather than a second implementation of one. Without it, a project reaching for either output redoes the work by hand each time. `canon/context/claude-plugin/social-card-route.md` covers the card route it writes.

The name passed over two candidates. `logo` names one of the two outputs and leaves the card unaccounted for, and `assets` collides twice, with `canon capture`'s own `DEFAULT_SOURCE = 'assets'` and with this repository's top-level `assets/` folder of README captures. It takes the `draft-` prefix, joining `draft-screencast` and `draft-slides`, since the bare-word rule applies here too: it writes candidates to scratch and a final deliverable outside `.claude/`, so it is neither a Claude workflow surface nor a toolkit-subject skill, and a prefix-free name would misstate that.

One skill covers both outputs rather than two. The mark and the card are one identity rendered twice, and two skills each reading the other's pick can settle on shapes that do not compose. Drafting every arm already inside the card frame is what makes that real rather than aspirational, since the pick settling the mark's shape settles its composition in the same choice.

## The walkthrough surface

`ux-walkthrough` turns what an operator sees in a running app into findings and picks a builder can act on without the conversation. It closes the operator-observed corner no other catalog entry answers.

The boundary against `draft-and-pick` sits inside the render step rather than around the whole flow. `ux-walkthrough` takes `draft-and-pick`'s own live-app branch of Step 2, which lifts the rendered markup and links a copy of the built stylesheet rather than inlining, and departs only from Step 6's apply-and-delete, per its own `## What this delegates`, capturing arms into the walkthrough's own numbered evidence folder and leaving `candidates.html` in place rather than applying the winning arm.

The boundary against `ux-audit` runs on where the judgment happens. `ux-audit` reads source for roughness the code alone reveals. `ux-walkthrough` measures a finding off the built page and hands the operator the link before every pick question, so a record carries what a person saw rather than what a reading of the source predicted.

The boundary against `plan-feature` and a worker runs on who builds. `ux-walkthrough` records a pick with the arms it beat and the numbers behind it. Turning that record into a plan and code belongs to `plan-feature` and a worker, never to this skill.

No redundancy audit entry names it, because it carries no plausible community counterpart. Pairing an operator's live look at a running build against a recorded batch of picks is a shape `canon/context/claude-plugin/skill-strategy/catalog-health.md` skips outright rather than one that was compared and cleared.
