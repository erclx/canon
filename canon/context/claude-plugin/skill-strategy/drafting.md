---
title: Drafting
description: The candidate and document draft surfaces, the identity surface, and the canvas surface, with the boundary each holds against its neighbors
---

# Drafting

## Decisions

### The candidate surface

`draft-and-pick` covers work where several drafts are produced, looked at, and iterated until one is good enough. The four nearest surfaces all assume the answer is known, so a decision settled by looking lands on whichever matches the word "UI".

- `plan-feature` plans one answer
- `ux-audit` reports roughness from source in one pass
- `ux-measure` reads numbers off a running interface
- `ui-checklist` writes what to look at on a change already made

The name carries no ownership prefix, per the ownership axis in `canon/context/claude-plugin/skill-strategy/axes.md`. It drafts candidates as canvas pages and deletes them with the pick, so a bare verb phrase places it beside `decision-escalate`. A noun with no act in it was declined.

- Each round is one canvas page and each arm one frame on it, named `arm-<id>`
- The skill ships no picker or theme control, because the canvas reaches every round from one address, sets every frame's theme at once, and renders each frame at its own width
- The run deletes only the pages it added at close, since the canvas folder also holds the operator's own pages

### The canvas page is the comparison

The contact sheet the source skill relied on is the canvas page itself, captured once with `canon canvas capture <page> --composite`. One image per arm was rejected because it makes the operator hold several images against each other in memory.

- The close captures each frame on its own into `.canon/picks/<slug>/`
- The archive therefore keeps one `arm-<id>` image per arm, while the pick is taken from the composite

The measurement rules are cited rather than restated. `canon drive` ships the probes carrying most of the source skill's nine, and the body keeps the three no probe reaches. They stay inline because they sit well under the fifteen-line move checkpoint.

- Composite alpha before reading a color
- Sample inside the shape rather than at a bounding-box corner
- Ask whether a reader would see the thing at all

What travels and what does not is stated in the skill's own `REQUIREMENT.md`, since the plan and the task are archived or gitignored at ship. Three source capabilities stay behind.

- An arm switcher compiled into a project's own page gives way to a canvas page of frames
- A site-wide treatment walker gives way to `canon drive` reading one page
- A copy cycle keyed to canonical text in a second repository has no replacement, since no toolkit surface has that shape

The pull request boundary rule lives in `plan-feature` and not in `claude/skills/plan-feature/references/plan.md`. A session decides scope while writing the plan, and a rule stated in both places is two sources for one rule.

### What the arm reaches

The sandbox arm resolves the canvas capture through `playwright-core` and the installed `canon` binary rather than `@playwright/test`, since the latter resolves out of a `node_modules` no target installs. It also starts `canon canvas serve`, which refuses with `missing-client-deps` where the installed CLI lacks the shell's client packages.

- A headless run there stops before drafting rather than closing
- It has no operator to confirm a pick, so waiting would spend turns up to the cap with nobody to answer, and closing on a pre-supplied pick is its only terminal behavior

What the arm cannot reach is the loop, the pick, and the hand-off. That is a property of the harness rather than a gap a later fixture closes, because the stop condition is a person. A green verdict is not coverage of the half the skill exists for.

- A `write_scope` admits the two surfaces a close legitimately reaches
- Content pins hold the lines of the seeded page a treatment change must leave alone

The canvas capture refuses a frame that would rewrap against a substituted font, so a candidate frame naming no font is refused on whatever the default resolves to. Step 2 tells a run to declare a stack the machine resolves, since a frame that carries everything it needs and a frame that renders are not the same requirement.

A close records the decision wherever it was stated as open, in the same step that writes the design note, a path the write scope admits. The losing arms are deleted by the next step, so a pick that records nothing about why leaves the next reader re-deriving it from a diff.

### The document draft surface

`draft-doc` covers a document that does not exist yet, in any of four kinds. Each kind sits beside a surface that rewrites or refreshes an existing document and was never built to originate one.

- A `docs/` page
- A `canon/context/` entry
- A wiki reference page
- A `README.md`

`docs-sync` classifies and rewrites existing sections against a diff since main, and `context-fold` refreshes context entries. A document with no prior version has no diff to classify, so either one reports a brand-new subject as unrelated to any change, which reads as a clean pass over a request nobody served.

### One skill rather than five

The five kinds ran one procedure, being read the owning standard, check for a collision, place the file, draft against the template, confirm, and write. They shipped as five skills sharing that shape by convention, which the single skill beat.

- Each restated the shared steps, so a fix to one drifted from the other four
- Five descriptions competed for the one trigger of writing a new document
- The body now holds the shared procedure, and each kind carries one reference under `references/`, loaded alone once the kind resolves from the destination the request names
- A request naming no destination is asked rather than defaulted to `docs/`

The merge was measured against `canon claude skills rank` before it shipped, since one description now covers five triggers.

- Against trunk, rank one held at 85 of 105 cases and top three rose from 95 to 96
- All five former drafter cases stayed at rank one
- The gain was a topic-search skill since retired, which the old docs drafter had pushed to rank 5 and `draft-doc` pushes only to rank 3
- A trial description ending "where no file covers it yet" pulled the `test-first` case, which says "nothing covers it yet", so the shipped description keeps that phrase out

The measure is TF-IDF over descriptions rather than Claude Code's own router, and one case per kind is a thin sample. A real routing loss would show only as a session that never loads the skill.

### The confirm step

`draft-doc` takes its confirm step from the standard-authoring skill's pattern rather than from `docs-sync`. `docs-sync` writes at once after its preview, since the permission dialog is confirmation enough over a rewrite bounded by a diff.

A new document has no such bound. Its kind, placement, and every detection a kind runs are judgment calls weighed against the catalog, not a change the branch already made. The skill waits for the user to confirm the path and the full content.

### What each kind settles

Each kind settles one decision a session would otherwise guess.

- Docs placement reads the catalog rather than assuming a folder, reuses a `category` a sibling page carries verbatim, and puts a topic matching no shelf at the `docs/` root
- The docs `canon docs <slug>` guard is a heuristic, since the slug is guessed from the topic phrase, so the title and description check behind it catches the wider case
- A context entry defaults to a flat file, since a fresh domain never holds the three or more sub-areas the context standard requires before it earns a folder
- The wiki kind's ownership refusal offers the docs or context kind of the same skill, so a subject this project owns is redirected without leaving the skill

### Why the readme templates sit in the skill

The readme kind carries one whole template per project type under `references/readme/`, in the skill and not in `claude/skills/docs-sync/references/readme.md`. `docs-sync` reads the standard to rewrite a section and never needs a whole page, so a template there would load for every README edit to serve only the drafting one.

The templates hold slots and structure and no rule of their own, which leaves the standard the one owner of per-type content. The types are the standard's five, being library, CLI, application, agent-facing, and plugin.

- The intake that prompted them listed an internal service type, but the standard carries none and the skill has no signal that detects one
- That type waits for the first target that needs it, as a standard change
- A project matching several types combines their templates under one header block and one description
- A project matching none falls back to the standard's generic template

### The identity surface

`draft-identity` covers a project's logo mark and the social card composed from it, reached through `draft-and-pick`'s render-and-pick loop rather than a second implementation. Without it, a project redoes the work by hand each time. `canon/context/claude-plugin/social-card-route.md` covers the card route it writes.

The name passed over two candidates, and it takes the `draft-` prefix beside `draft-screencast` and `draft-slides`.

- `logo` leaves the card unaccounted for
- `assets` collides twice, with `canon capture`'s own `DEFAULT_SOURCE = 'assets'` and with this repository's top-level `assets/` folder of README captures
- The prefix fits because it writes candidates to scratch and a final deliverable outside `.claude/`, so it is neither a Claude workflow surface nor a toolkit-subject skill

One skill covers both outputs rather than two. The mark and the card are one identity rendered twice, and two skills each reading the other's pick can settle on shapes that do not compose. Drafting every arm inside the card frame makes the composition real, since the pick settling the mark's shape settles its composition in the same choice.

### The canvas surface

`canvas-board` drives `canon canvas`, a local page of HTML frames the operator drags, selects, and edits in the browser while a session writes the files behind them. It covers a direction worked out by looking and touching over several turns, where the operator's own selection and restyle are input the session reads back.

What outlives the pick separates it from `draft-and-pick`. Both skills draft on the canvas, and `draft-identity` reaches it through `draft-and-pick`'s loop.

- `draft-and-pick` takes one pick through the question surface, archives every arm, and deletes the pages it added
- A frame the operator drew in `canvas-board` stays in its gitignored folder until somebody removes it
- Either way the pick reaches the project through its design document, a plan, or the applied surface rather than through the canvas itself

No skill reads a reference image or the project's code into design values now. The canvas is the one surface that draws a direction, and what it draws is carried into the design document by hand.
