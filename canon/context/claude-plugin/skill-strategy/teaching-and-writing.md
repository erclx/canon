---
title: Teaching and writing
description: The teaching surface and why it sorts by what the reader is doing, the writing surface a rule delivers
---

# Teaching and writing

## Decisions

### The teaching surface

`teach-workspace` runs a learning workspace on one subject across sessions. It sits beside the wiki rather than against it, because the two sort on independent axes. A workspace sorts by what the reader is doing, learning rather than looking up, and the wiki test sorts by who owns the subject.

A workspace on how a system measures pronunciation accuracy and one on how a feature is implemented here are the same surface with different subjects, so the wiki test needs no amendment.

- The name follows the pattern every skill owning a record folder takes, naming that folder behind a prefix as `plan-groundwork`, `plan-intake`, and `task-board` do
- A workspace at `.canon/teach/<nn>-<topic>/` names its skill `teach-workspace`
- It carries `disable-model-invocation: true`, so opening a workspace is the learner's call rather than a description match

The output splits by lifetime and the format follows the split. A lesson is worked through once, carries a quiz with immediate feedback, and is never committed, so it is markup. A reference page is looked up later and is the half a promotion pass would move into a gated corpus, so it is markdown and passes those gates the day it is written.

Authoring both as markup was the source's own choice, and it puts the promotable half in a format no stage reads.

### Promotion

The durable half leaves through a promote step in the same skill, sorted by who owns the subject rather than by what the reader was doing. That is the wiki test unamended.

- An Anthropic-owned subject goes to the wiki
- An internal one goes to the matching context entry
- Everything else, including a subject owned by another vendor, goes to the public docs

The step proposes and waits, and writes nothing to a destination. A confirmed page lands in `.canon/tmp/handoff/teach-promotion/<slug>.md`, and the skill's own fold mode lands it from a branch, deleting the handoff once it has read it.

Two things carry a cost worth naming.

- The step is the first caller of the wiki scaffolding verb, and it refuses rather than scaffolds when a project has no wiki, so the verb stays the operator's call
- The fold reaches the public docs corpus, which `docs-sync` otherwise owns
- The carve-out is narrow, since `context-fold` lands a page whose destination is already confirmed and reconciles nothing there against a diff

### The rendered layer

The rendered layer is the half a session works through rather than consults, and three of its rules live in code rather than in the body. The first is quiz option order, which `canon teach lesson` draws rather than instructs.

- The source this design departs from reports answers defaulting to the first option
- Its stated mitigation addresses a formatting leak instead, so porting the instruction ports the defect

The same verb reports three more things.

- The numbered path the lesson takes
- The shared stylesheet, with whether it is on disk yet
- The mission's success lines, which turns them into exit criteria a session reports progress against rather than a list nothing reads

The verb writes nothing, and the stylesheet is the reason. Every lesson after the first links what the first one wrote, so a verb that wrote the file on each lesson would discard what the last one added. Reporting `stylesheetExists` puts the write on the one lesson that needs it.

The third rule is the chrome itself. `canon teach nav` splices the header, breadcrumb, jump menus, footer nav, and embedded stylesheet into four marker comment pairs a lesson leaves empty. A session no longer composes them by hand, which is the judgment that let one hand-authored workspace carry a contents page while its sibling carried none.

- A lesson missing a marker pair is refused by name and left untouched
- The same run rewrites the root listing and every contents page from what the workspace holds on disk

The body is still free to reorder what the verb reports. The sandbox arm for this layer asserts the ordinal, the link, and the stylesheet, and ordering is a property over many runs that one arm cannot see, so it is recorded as manual rather than claimed.

### Retrieval and spacing

The pedagogy reference prefers three things the lesson carries, and each costs a different thing.

- A teach-back block beside the quiz gives a produced answer beside a selected one, and costs nothing mechanical since a `<details>` needs no new styles
- A schedule lives in `## Revisit` with a fixed shape, and `canon teach list <topic> --json` reports `due`
- That costs a listing one read per learning record, and puts the spacing ladder in code where an author told to widen a gap would pick the number by judgment
- The stepper shows one question at a time, gating on `:has()` so a later stem cannot answer an earlier question
- That costs a markup contract a lesson author writes by hand, with nothing checking it until a quiz in the wrong shape renders flat

The teach-back miss lands under what the learner got wrong rather than under a heading of its own. A produced answer and a selected one are both retrieval failures the next session places from, and two headings split one placement input.

### The writing surface

`write-human` carries voice, word choice, rhythm, sentence construction, and information density. The character bans and the frontmatter wording live in `markdown.md`, and a command reads the bans. This skill carries the half no check settles, and it is a skill because nothing reads a standard nobody opens.

- The name follows the job rather than the medium, since `prose` names what is being written and every other candidate named the defect
- The job is removing machine tells and putting a person back into the writing
- It is model-invocable, unlike the bodies carrying `disable-model-invocation`, because those are workflows a person starts and this is guidance a session should reach for mid-draft

Delivery is the load-bearing half rather than the body. The `writing/markdown` rule fires on every markdown edit and carries an explicit instruction to load the skill, so the guidance arrives on a glob match. A skill reachable only by description match reproduces the defect it was built against.

### The writing references

Three references hold what a body cannot.

- `machine-tells.md` is a diagnostic catalog behind a stated trigger, so a short original draft pays no read for it
- `density.md` splits what a compression pass may cut from what it may not, the layer a terse register has no answer for
- `adopted.md` records what was adopted from outside and what was declined, including the ban on abstract metaphor nouns
- That ban stays unadopted, since `surface` alone appears 593 times in tracked markdown at `57ee7467`
- Adopting it would rewrite the corpus or be ignored in silence

What stays open is the same gap `teach-workspace` records about option order. Cadence is a property of a passage over many sentences. Nothing compares the output against these rules, so the sandbox arm carries its rhythm claims as manual entries rather than asserting them.
