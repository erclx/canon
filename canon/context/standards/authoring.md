---
title: Authoring
description: The canonical template rule and where it stops, the meta-standard's placement, the lifecycle of a change, the sibling section a new rule falsifies, the parser that reads two standards as input, and how to add a standard
---

# Authoring

The meta-standard `standards/standard.md` governs itself, so it is both the rule and the worked example. What it asks of an author is a fenced template where the document type has one, a success criterion above the shape rules, and a failing artifact behind any change to either.

## The canonical template

A standard governing a document type carries one fenced template of that document, and an attribute standard carries none. The rule lives in `standards/standard.md` under `## Template`, and `standard.md` governs itself, so it carries the template it demands. A paragraph describing a shape is advisory and a fenced block is something a check can compare against.

The placement is not fixed to one heading. `architecture.md` and `requirements.md` carry `## Template`, and `tasks.md` carries the same block inside `## File format`. Both placements stay legal, since a template beside the rules it satisfies is one read and a fixed heading would move the `tasks.md` block away from them.

An attribute standard is exempt because it governs a scan, a string, or a label rather than a document type, so a template would have nothing to show. `publish.md`, `slug.md`, and `versioning.md` each name their own exemption in the sentence declaring them an attribute standard, which is the both-sides rule applied to a claim that would otherwise be a silence.

The template outranks the prose where they disagree. An author copies the block, so a contradiction ships as the block whatever the prose says, and naming the winner makes the drift a defect a reader can see rather than one that resolves differently per session.

## Where the template rule stops

`standards/index.md` is out of scope despite reading as a standard with no template. It is the generated catalog of the folder, rewritten by `scripts/core/regen-indexes.sh`, so a template added there is deleted by the next `bun run check`.

`design.md` is the sharpest case for the rule: the token tables carry fixed headers the renderer reads, and a standard that names the shape without spelling those headers verbatim sends an author into `src/design/parse.ts` and `src/design/render.ts` to recover them. The shape rule asks any standard for the headers and labels a tool parses, verbatim, which is the general form of what `design.md` would otherwise leave missing.

A template and a seed hold different things for the same document, which is what keeps them from drifting. `standards/design.md` carries headers and placeholder rows, and `tooling/claude/seeds/canon/DESIGN.md` carries the starting roles a scaffolded project receives. Only the headers are load-bearing, since `src/design/render.ts` reads those by exact key and slugs every row name into the variable it emits, so a project is free to rename, add, or drop a role.

## The meta-standard in the flat root

The meta-standard sits in the flat root, same as every standard it governs. That placement gives `591-standard-authoring` a path that resolves in the toolkit and in every target, so an author editing an existing standard has something to work against. The flat root installs it and indexes it too.

The rule's glob is recursive, so it governs a standard at any depth the same way it governs one at the flat root, with no exception carved out for nesting.

## Changing a standard

`standards/standard.md` carries two rules about a standard's own lifecycle, distinct from the shape rules governing what it contains.

A standard states a success criterion, near the top and above the shape rules. Specifying structure exhaustively and success nowhere leaves nothing to argue a proposed change against, so the standard gets edited on whichever input arrived most recently. `standards/context.md` states its own as `## What a working entry looks like`, and `standards/skill.md` states one under `## Requirement`, scoped to the requirement file rather than the skill.

A standard then changes on a failure rather than on a finding. A finding is that the vendor docs say X or a paper suggests Y, and it goes to the task board as a hypothesis. A failure is an artifact that satisfied every shape rule and still missed the criterion, and it edits the standard. The change cites the failing artifact.

`scripts/eval/` is how a failure gets produced on demand. It extracts a synthetic fixture outside the repo, copies the live standard in, and asks a headless session to author against it. Running outside the repo is load-bearing: a fixture under the repo would load this project's `CLAUDE.md` through the ancestor chain, and the session under test would arrive already knowing what the test is trying to measure. Writes under `.claude/` stay blocked even with `--permission-mode acceptEdits`, so the artifact comes back in the final message and stdout is what gets judged.

`canon standards audit` reads the corpus at `standards/` and reports every filename carrying the success-criterion section against every one that does not, matching either the literal `## Success criterion` heading or the templated `## What a working <document type> looks like` form the standard itself uses. `--arrivals-only` narrows the exit code to a standard new on the current branch, wired into `src/gate/stages.ts` beside the skill-requirement gate whose shape it copies, so gating the whole corpus does not fail every push until every existing standard carries the section. Only an arrival missing it fails.

## The sibling section a new rule falsifies

Adding a section to a standard can make a claim in a sibling section of that same file false. `publish.md` scoped its phase-label rule by destination and closed on the words `takes the character checks alone`, which was accurate while phase labels were the only destination-scoped rule and stopped being accurate the moment a second one landed beside it. A reader arriving at the older section first concludes the file has nothing further to say about text entering the repository, which is the reading the new section depends on being wrong.

The change checkpoint does not prompt for it. Its collision question asks which sibling standard, rule, or template the change contradicts, so a sibling section inside the file being edited falls outside what the four questions reach. Read the destination-scoped sections of that file for words such as `alone` and `only` before adding a section beside them, and rewrite the one that now claims too much rather than leaving the new section to contradict it.

The failure is invisible to every check the repository runs. Both sentences are well-formed prose citing nothing, so the drift stages, the markdown audit, and the spell check all pass over a file that now states two incompatible things.

## The parser that read a standard as input

`markdown.md` has a code reader behind it, which no other standard in the corpus does. `src/markdown/bans.ts` anchors on `## Language` and `## Punctuation`, then harvests the single lowercase backticked words and the single non-alphanumeric backticked characters out of every `- Do not use ` bullet under them. The sets ship as data in that file, and both `canon markdown audit` and the seeded audit hook read them from there, so a wording edit changes what a reader is told and nothing else.

An example chosen to illustrate a pattern becomes a literal ban on that example. A content ban shown with a bare noun bans the noun everywhere it appears rather than banning the pattern it stood for, and nothing reports the difference, because both outcomes are a term in a list. A pattern ban is written with a multi-word phrase, which the parser skips by design.

The two headings are the anchor rather than the bullet's position. Renaming one empties its set at the report's legend, where a position-based read would narrow the check and still print a count, so neither heading moves for a wording reason.

No checker ships for the content bans under `## Language`, covering inflated significance, borrowed authority, vague attribution, and fabrication introduced by a rewrite. Each is a pattern rather than a closed set, so a literal match would report the compliant text and miss the violation. `bans.test.ts` asserts the parsed sets against the shipped standards, which is the check that catches a wording edit widening the closed sets by accident.

The constraint is stated twice on purpose: `markdown.md` carries a one-line note under `## Language` so an author meets it while editing, and it is restated here because it is a fact about a code reader rather than about prose.

A second reader takes prose rather than a list. `read_applies_to` in `scripts/standards/list.sh` reads a standard's `## Scope` line, bounded to the first sentence, per the shape rules in `standards/standard.md` that require the governed path there. Ship the parser's span rule as a shape rule in the standard governing the prose, in the same change, since a silently unparsed entry is indistinguishable from a conforming one downstream.

## Authoring a new standard

Follow `standards/standard.md`. It is the meta-standard: the success criterion, the scope rules, the frontmatter contract, heading and structure conventions, imperative rule bullets, and when to include examples. It governs itself, so it is also the worked example. `591-standard-authoring` routes any edit under `standards/` to it.

Create the `.md` file in `standards/` with `title` and `description` frontmatter, then run `bun run check` to regenerate `standards/index.md` and commit both. No consumed copy follows it.

The `create-standard` skill has one write surface, `standards/` at the working root, in the toolkit and in a target alike. That is the root the resolver reads first, so an author never picks between two spellings.
