---
title: Drafting
description: The proposal, candidate, and document draft surfaces, the identity surface, and the walkthrough surface, with the boundary each holds against its neighbors
---

# Drafting

## The proposal surface

`markdown-propose` closes a gap two shipped surfaces sit beside without covering: nothing else drafts a markdown replacement, carries an answer slot, and waits. `canon markdown audit` measures bans and structural checkpoints from package data. `review-branch` reports findings on a diff someone already wrote. Both report, and neither drafts or waits for an answer.

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

## The document draft surface

`draft-doc` covers a document that does not exist yet, in any of five kinds: a `docs/` page, a `canon/context/` entry, a `canon/wireframes/` surface, a wiki reference page, and a `README.md`. Each kind sits beside a surface that rewrites or refreshes an existing document and was never built to originate one.

`docs-sync` classifies and rewrites existing sections against a diff since main, and `context-fold` refreshes context entries and only stubs a wireframe a diff touched. A document with no prior version has no diff to classify, so reaching for either on a brand-new subject reports it as unrelated to any change, which reads as a clean pass over a request nobody served.

### One skill rather than five

The five kinds ran one procedure: read the owning standard, check for a name or topic collision, place the file, draft against the template, confirm, write. They shipped as five skills sharing that shape by convention, and that was the alternative this one beat. Each restated the shared steps, so a fix to one drifted from the other four, and five descriptions competed for the one trigger of writing a new document.

The body now holds the shared procedure, and each kind carries one reference under `references/`, loaded alone once the kind resolves from the destination the request names. A request naming no destination is asked rather than defaulted to `docs/`.

The merge was measured against `canon claude skills rank` before it shipped, since one description now covers five triggers. Against trunk, rank one held at 85 of 105 cases and top three rose from 95 to 96, with all five former drafter cases still at rank one.

The gain was `index-lookup`, which the retired docs drafter had pushed to rank 5 and `draft-doc` pushes only to rank 3. A trial description ending "where no file covers it yet" pulled the `test-first` case, which says "nothing covers it yet", so the shipped description keeps that phrase out.

The measure is TF-IDF over descriptions rather than Claude Code's own router, and one case per kind is a thin sample, so a real routing loss would show only as a session that never loads the skill.

### The confirm step

`draft-doc` borrows its confirm step from `create-standard` rather than from `docs-sync`. `docs-sync` writes at once after its preview, since the tool permission dialog is confirmation enough over a rewrite bounded by a diff. A new document carries no such bound, because its kind, its placement, and every detection a kind runs are judgment calls weighed against the catalog rather than a change the branch already made. The skill waits for the user to confirm the path and the full content, the way `create-standard` confirms a slug and a body against no diff of its own.

### What each kind settles

- Docs placement reads the catalog rather than assuming a folder. A `category` a sibling page carries is reused verbatim, and a topic matching no shelf lands at the `docs/` root.
- The docs `canon docs <slug>` guard is a heuristic, since the slug is guessed from the topic phrase, so the title and description check behind it catches the wider case.
- A context entry defaults to a flat file, since a fresh domain never holds the three or more sub-areas the context standard requires before it earns a folder.
- A wireframe check walks the whole tree rather than its top level, since a collision can sit nested inside a grouped surface's own subfolder.
- `standards/wireframes.md` documents only the per-surface ASCII shape. The three-tier call between ASCII only, ASCII plus a render, and visual as the source of truth is made once per project in the visual design workflow guide. The wireframes kind reads `canon/DESIGN.md` and the tree for a tier signal and reports it, since no shipped mechanism turns a detected tier into a companion render.
- The wiki kind's ownership refusal offers the docs or context kind of the same skill, so a subject this project owns is redirected without leaving the skill.

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
