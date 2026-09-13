---
title: Authoring
description: The canonical template rule and where it stops, the meta-standard's placement, the lifecycle of a change, the sibling section a new rule falsifies, the parser that reads two standards as input, and how to add a standard
---

# Authoring

The meta-standard `standards/standard.md` governs itself, so it is both the rule and the worked example. What it asks of an author is a fenced template where the document type has one, a success criterion above the shape rules, and a failing artifact behind any change to either.

## The canonical template

A standard governing a document type carries one fenced template of that document, and an attribute standard carries none. The rule lives in `standards/standard.md` under `## Template`, and `standard.md` governs itself, so it carries the template it demands. A paragraph describing a shape is advisory and a fenced block is something a check can compare against.

The rule generalizes a section several standards already had rather than inventing one. `architecture.md` and `requirements.md` carried `## Template`, and `tasks.md` carried the same block inside `## File format`. Both placements stay legal, since a template beside the rules it satisfies is one read and a fixed heading would have moved the `tasks.md` block away from them. A fourth carrier under `bundled/` was retired with the surface it governed, which cost the rule a case and none of its reasoning.

The binding condition is what keeps the rule honest. `publish.md`, `slug.md`, and `versioning.md` govern a scan, a string, and a label, so a template would have had nothing to show. Each names its own exemption in the sentence declaring it an attribute standard, which is the both-sides rule applied to a claim that would otherwise be a silence.

The template outranks the prose where they disagree. An author copies the block, so a contradiction ships as the block whatever the prose says, and naming the winner makes the drift a defect a reader can see rather than one that resolves differently per session.

## Where the template rule stops

`standards/index.md` is out of scope despite reading as a standard with no template. It is the generated catalog of the folder, rewritten by `scripts/core/regen-indexes.sh`, so a template added there is deleted by the next `bun run check`. The intake counted files in the folder rather than authored standards, which is why the finding said eight and the corpus holds seven.

`design.md` is the case that paid for the rule. It said the token tables carry fixed headers the renderer reads and never said what they are, so an author had to open `src/design/parse.ts` and `src/design/render.ts` to recover them. The shape rule therefore asks any standard for the headers and labels a tool parses, verbatim, which is the general form of that failure.

A template and a seed hold different things for the same document, which is what keeps them from drifting. `standards/design.md` carries headers and placeholder rows, and `tooling/claude/seeds/canon/DESIGN.md` carries the starting roles a scaffolded project receives.

The template first copied the seed row for row, which made the role names a second source with nothing comparing them and broke the placeholder rule two files away.

Only the headers are load-bearing, since `src/design/render.ts` reads those by exact key and slugs every row name into the variable it emits.

## The meta-standard in the flat root

The meta-standard sits in the flat root. Sitting there instead of in the narrow-readership fan-out, back when that route still existed, is what leaves an author editing an existing standard something to work against and gives `591-standard-authoring` a path that resolves in the toolkit and in every target, rather than reaching only the `create-standard` skill and no installed copy for a rule to cite. The flat root installs it and indexes it too.

The rule's glob is recursive, which mattered while the six now-flat standards still sat under `standards/bundled/`: the fan-out's own consumer count decided nothing about shape governance, so those six were held to the same shape rules as every sibling despite living one level deeper. They sit at the flat root now, governed the same way and no longer needing the recursion to be reached.

## Changing a standard

`standards/standard.md` carries two rules about a standard's own lifecycle, distinct from the shape rules governing what it contains.

A standard states a success criterion, near the top and above the shape rules. Specifying structure exhaustively and success nowhere leaves nothing to argue a proposed change against, so the standard gets edited on whichever input arrived most recently.

`standards/context.md` was the first to gain one, as `## What a working entry looks like`. `standards/skill.md` gained the second under `## Requirement`, scoped to the requirement file rather than the skill, because writing eight of them is the work that exercised it.

A standard then changes on a failure rather than on a finding. A finding is that the vendor docs say X or a paper suggests Y, and it goes to the task board as a hypothesis. A failure is an artifact that satisfied every shape rule and still missed the criterion, and it edits the standard. The change cites the failing artifact.

`scripts/eval/` is how a failure gets produced on demand. It extracts a synthetic fixture outside the repo, copies the live standard in, and asks a headless session to author against it.

Running outside the repo is the load-bearing part: a fixture under the repo loads this project's `CLAUDE.md` through the ancestor chain, and the session under test arrives already knowing what the test is trying to measure. Writes under `.claude/` stay blocked even with `--permission-mode acceptEdits`, so the artifact comes back in the final message and stdout is what gets judged.

`canon standards audit` reads the corpus at `standards/` and reports every filename carrying the section against every one that does not. `--arrivals-only` narrows the exit code to a standard new on the current branch, wired into `src/gate/stages.ts` beside the skill-requirement gate whose shape it copies.

Gating the standards already short the section would fail every push until someone closed them all, which is the sweep `standards/standard.md` forbids. Only an arrival missing the section fails.

That narrowing is also what hid the gate matching a heading the corpus does not write a criterion under. `CRITERION_HEADING` in `src/standards/audit.ts` accepted `## Success criterion` alone, which `standards/standard.md` spells over its rules about criteria while templating the section itself as `## What a working <document type> looks like`, and the template wins where the two disagree because that file says so. Twelve standards write their criterion under the templated form and none writes one under the literal words, so the gate would have refused every conforming arrival. No standard had arrived since the gate shipped, so the first one to meet it was `standards/mermaid.md`, refused for following the template. The regex now accepts both headings.

What the fix did not reach at first was the wording around it. Six strings in `src/commands/standards.ts`, one in `src/gate/measures.ts`, and the `canon standards audit` row in `docs/agents/commands.md` went on describing the check as a `## Success criterion` gate, which named one accepted heading out of two. They were left alone because `src/gate/measures.ts` was contested by two other tracks at the time, and half of a string sweep is the same drift with a collision attached. `fix/criterion-heading-strings` closed that gap, dropping the literal heading everywhere in favor of the heading-free phrasing `src/gate/measures.ts:425` already used for the passing case.

## The sibling section a new rule falsifies

Adding a section to a standard can make a claim in a sibling section of that same file false. `publish.md` scoped its phase-label rule by destination and closed on the words `takes the character checks alone`, which was accurate while phase labels were the only destination-scoped rule and stopped being accurate the moment a second one landed beside it. A reader arriving at the older section first concludes the file has nothing further to say about text entering the repository, which is the reading the new section depends on being wrong.

The change checkpoint does not prompt for it. Its collision question asks which sibling standard, rule, or template the change contradicts, so a sibling section inside the file being edited falls outside what the four questions reach. Read the destination-scoped sections of that file for words such as `alone` and `only` before adding a section beside them, and rewrite the one that now claims too much rather than leaving the new section to contradict it.

The failure is invisible to every check the repository runs. Both sentences are well-formed prose citing nothing, so the drift stages, the markdown audit, and the spell check all pass over a file that now states two incompatible things.

## The parser that read a standard as input

`markdown.md` and the retired `prose.md` had a code reader behind them, which no other standard in the corpus ever did. `src/markdown/bans.ts` anchored on `## Language` and `## Punctuation`, then harvested the single lowercase backticked words and the single non-alphanumeric backticked characters out of every `- Do not use ` bullet under them, and the seeded audit hook parsed the same shape in every target. The sets now ship as data in that file and both readers call `canon markdown audit` instead, so a wording edit changes what a reader is told and nothing else. Both `## Language` and `## Punctuation` sit in `markdown.md` since the retirement, which is what put every ban a command measures under one heading pair in one file.

The constraint below is kept rather than retired, because it holds the moment anything parses a standard again and the cost of relearning it was an intake pass.

An example chosen to illustrate a pattern therefore becomes a literal ban on that example. A content ban shown with a bare noun bans the noun everywhere it appears rather than banning the pattern it stood for, and nothing reports the difference, because both outcomes are a term in a list. A pattern ban is written with a multi-word phrase, which the parser skips by design and `bans.ts` documents as the reason it skips them.

The two headings are the anchor rather than the bullet's position. Renaming one empties its set at the report's legend, where a position-based read would narrow the check and still print a count, so neither heading moves for a wording reason.

No checker ships for the content bans that landed under `## Language`, covering inflated significance, borrowed authority, vague attribution, and fabrication introduced by a rewrite. Each is a pattern rather than a closed set, which is what already leaves negative parallelism enforcing on a reader alone. A literal match over a pattern reports the compliant text and misses the violation, and `bans.test.ts` asserting the parsed sets against the shipped standards is the check that catches a wording edit widening the closed sets by accident.

The constraint is stated twice on purpose. `markdown.md` carries a one-line note under `## Language` so an author meets it while editing, and the reason sits here because it is a fact about a code reader rather than about prose. Before that it was stated only as a doc comment on `parseWordBans`, which is a file no author editing a standard opens, so the constraint held without a single author of the corpus knowing it existed until an intake pass went looking.

A second reader takes prose rather than a list, and it needs a bounded span and a loud miss. `read_applies_to` in `scripts/standards/list.sh` reads a standard's `## Scope` line, and the whole statement pulled sibling names out of its second sentence while two standards named an unanchored folder a suffix match could not tell from a same-named folder elsewhere. Bounding to the first sentence plus two new shape rules in `standards/standard.md` is what made all thirteen resolve. Ship the parser's span rule as a shape rule in the standard governing the prose, in the same change, since a silently unparsed entry is indistinguishable from a conforming one downstream.

## Authoring a new standard

Follow `standards/standard.md`. It is the meta-standard: the success criterion, the scope rules, the frontmatter contract, heading and structure conventions, imperative rule bullets, and when to include examples. It governs itself, so it is also the worked example. `591-standard-authoring` routes any edit under `standards/` to it.

Create the `.md` file in `standards/` with `title` and `description` frontmatter, then run `bun run check` to regenerate `standards/index.md` and commit both. No consumed copy follows it any more.

The `create-standard` skill has one write surface, `standards/` at the working root, in the toolkit and in a target alike. That is the root the resolver reads first, so an author never picks between two spellings.
