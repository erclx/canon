---
title: Teaching and writing
description: The teaching surface and why it sorts by what the reader is doing, the writing surface a rule delivers, and the restatement surface asked for by name
---

# Teaching and writing

## The teaching surface

`teach-workspace` runs a learning workspace on one subject across sessions. It sits beside the wiki rather than against it, because the two sort on independent axes: a workspace sorts by what the reader is doing, learning rather than looking up, and the wiki test sorts by who owns the subject. A workspace on how a system measures pronunciation accuracy and a workspace on how a feature is implemented here are the same surface with different subjects, which is why the wiki test needs no amendment.

The name follows the same pattern every skill owning a record folder takes, naming that folder behind a prefix, which `plan-groundwork`, `plan-intake`, `task-board`, and `draft-diagram` all follow. A workspace at `.canon/teach/<nn>-<topic>/` names its skill `teach-workspace`. It carries `disable-model-invocation: true`, so opening a workspace is the learner's call rather than a description match.

The output splits by lifetime and the format follows the split. A lesson is worked through once, carries a quiz with immediate feedback, and is never committed, so it is markup. A reference page is looked up later and is the half a promotion pass would move into a gated corpus, so it is markdown and passes those gates the day it is written rather than at the moment someone tries to promote it. Authoring both as markup was the source's own choice and it puts the promotable half in a format no stage reads.

### Promotion

The durable half leaves through a promote step in the same skill, sorted by who owns the subject rather than by what the reader was doing. That is the wiki test unamended, so an Anthropic-owned subject goes to the wiki, an internal one to the matching context entry, and everything else, including a subject owned by another vendor, goes to the public docs. The step proposes and waits, and it writes nothing to a destination: a confirmed page lands in `.canon/tmp/handoff/teach-promotion/<slug>.md` and `context-fold` folds it in from a branch, which is the handoff shape `memory-capture` already runs. The file is a sibling of the routed-facts one rather than the same file, because that one is deleted by whichever pass folds it and a third writer on a destructive reader loses another producer's unread work.

Two things carry a cost worth naming. The step is the first caller of the wiki scaffolding verb, and it refuses rather than scaffolds when a project has no wiki, so the verb stays the operator's call. The fold reaches the public docs corpus, which `docs-sync` otherwise owns, and the carve-out is narrow: `context-fold` lands a page whose destination is already confirmed and reconciles nothing there against a diff.

### The rendered layer

The rendered layer is the half a session works through rather than consults, and three of its rules live in code rather than in the body. Quiz option order is drawn by `canon teach lesson` rather than instructed, because the source this design departs from reports answers defaulting to the first option while its stated mitigation addresses a formatting leak instead, so porting the instruction ports the defect. The same verb reports the numbered path the lesson takes, the shared stylesheet with whether it is on disk yet, and the mission's success lines, which is what turns those lines into exit criteria a session reports progress against rather than a list nothing reads.

The verb writes nothing, and the stylesheet is the reason. Every lesson after the first links what the first one wrote, so a verb that wrote the file on each lesson would discard what the last one added. Reporting `stylesheetExists` puts the write on the one lesson that needs it and leaves the rest linking.

The third is the chrome itself. `canon teach nav` splices the header, breadcrumb, jump menus, footer nav, and the embedded stylesheet into four marker comment pairs a lesson leaves empty, rather than a session composing them by hand, which is the judgment that lets one hand-authored workspace carry a contents page while its sibling carries none. A lesson missing a marker pair is refused by name and left untouched, and the same run rewrites the root listing and every contents page from what the workspace holds on disk.

What the split cannot close is that the body is still free to reorder what the verb reports. The sandbox arm for this layer asserts the ordinal, the link, and the stylesheet, and the ordering is a property over many runs that one arm cannot see, so it is recorded as manual rather than claimed.

### Retrieval and spacing

The pedagogy reference prefers three things the lesson carries, and each costs a different thing:

- A produced answer beside a selected one. A lesson carries a teach-back block beside its quiz, which costs nothing mechanical since a `<details>` needs no styles the workspace does not already give one.
- A schedule. `## Revisit` carries a fixed shape and `canon teach list <topic> --json` reports `due`, which costs a listing one read per learning record and puts the spacing ladder in code where an author told to widen a gap would pick the number by judgment.
- One question at a time. The stepper gates on `:has()` so a later stem cannot answer an earlier question, at the price of a markup contract a lesson author writes by hand with nothing checking it until a quiz in the wrong shape renders flat.

The teach-back miss lands under what the learner got wrong rather than under a heading of its own, since a produced answer and a selected one are both retrieval failures the next session places from, and two headings split one placement input.

## The writing surface

`write-human` carries voice, word choice, rhythm, sentence construction, and information density. The character bans and the frontmatter wording live in `markdown.md`, and a command reads the bans. This skill carries the half no check settles, and it is a skill because nothing reads a standard nobody opens.

The name follows the job rather than the medium. `prose` names what is being written and every other candidate named the defect, where the job is removing machine tells and putting a person back into the writing. It is model-invocable, unlike the bodies carrying `disable-model-invocation`, since each of those is a workflow a person starts and this is guidance a session should reach for mid-draft.

Delivery is the load-bearing half rather than the body. `500-prose` fires on every markdown edit and carries an explicit instruction to load the skill, so the guidance arrives on a glob match. A skill reachable only by description match reproduces the defect it was built against.

Three references hold what a body cannot. `machine-tells.md` is a diagnostic catalog behind a stated trigger, so a short original draft pays no read for it. `density.md` splits what a compression pass may cut from what it may not, which is the layer a terse register has no answer for. `source-material.md` records what was adopted from outside and what was declined, including the ban on abstract metaphor nouns: `surface` alone appears 593 times in tracked markdown at `57ee7467`, so adopting that item rewrites the corpus or is ignored in silence.

What stays open is the same gap `teach-workspace` records about option order. Cadence is a property of a passage over many sentences, nothing compares the output against these rules, and the sandbox arm therefore carries its rhythm claims as manual entries rather than asserting them.

## The restatement surface

`restate-plainly` takes a dense answer or a named markdown document and returns the plain version. It is asked for by name, which is what separates it from its two neighbors. `write-human` governs a passage being drafted or revised and arrives on a markdown edit, and `canon markdown audit` reports sentence spread and repeated openings from package data. One writes and one measures, and a reader who stopped to decode an answer is served by neither.

The name is the decision the row owns. `simplify` is the obvious pick and is a built-in whose subject is code cleanup, so taking it makes a description match ambiguous even though the slash form disambiguates. `plain-language` describes the output where the skill is named for the act. Model invocation stays on, unlike the bodies carrying `disable-model-invocation`, because the ask arrives in ordinary words far more often than as a command, and the description bars the one case it rules out: the skill never fires on the model's own opinion of its own output.

The body writes no file. A restatement is read once to reach a decision, and rewriting a document into a file is a proposal against the source rather than a restatement of it. That keeps the arm's mechanical half small, since what it can assert is that the tree was left alone and the reply named the source path and the `Cut:` label. Whether the plain version kept the deciding half is the judgment the skill exists to make and nothing checks it, so every claim about the content sits under `manual` rather than being padded into the count.
