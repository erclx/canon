---
title: Standard reference
description: Shape and content rules for authoring a standard
paths:
  - 'standards/**/*.md'
rule:
  - 'Read it before writing or editing a standard. Do not work the shape from memory.'
---

# Standard reference

Applies to each authored standard in the folder. Skip for `index.md`, which is generated rather than authored.

## Overview

A standard is a target-facing authoring convention for one document type, or for one attribute carried across every document. Nothing installs it into a project, so a reader resolves it with `canon standards <name>` or reads it at `standards/<name>.md`, and skills and developers consume it alike. This file governs itself, so every rule below applies to it.

## Scope

Governs each authored standard under `standards/`: its stated jurisdiction, success criterion, frontmatter, structure, and rule phrasing.

Does not govern:

- The voice, rhythm, and sentence construction a standard is written in: the `write-human` skill
- The punctuation, formatting, and word choice a standard is written in: `markdown.md`
- The shape of any artifact a standard governs, which is that standard's own subject

## What a working standard looks like

A standard answers these questions. Each can be answered wrong, which is what makes them a test rather than a preamble.

- Which single document type or attribute does this govern, and where does it apply?
- Can an author who has seen no example produce a conforming document from this file alone?
- Does every rule state a shape the document must have, rather than a fact about the repository that happens to store it?
- What does a conforming document achieve, stated so a reviewer can call one non-conforming without appealing to taste?

A standard failing these questions is non-conforming even when it satisfies every shape rule below.

## Scoping rules

### Declaring scope

- Govern one document type per standard, or one attribute across every document. Split unrelated conventions into separate files.
- Open with a `## Scope` section stating what the standard governs and what it does not, placed above the shape rules. A standard that specifies shape exhaustively and jurisdiction nowhere cannot refuse a rule, so the rule with no obvious owner lands in whichever standard sits nearest.
- Write it as one line naming the artifact or attribute and where it applies, then a `Does not govern:` list. Give each entry the excluded concern and the owner it goes to. Name a sibling standard by bare filename, since the corpus is one flat folder, and name the surface instead where the owner is one, such as a coding rule, a project policy, or the code.
- Put the governed path in backticks inside the first sentence of that line, anchored deep enough to resolve from a project root. A bare folder name matches a same-named folder elsewhere in the tree, and a path held back until a later sentence sits beside every other path the statement mentions, including the ones it excludes.
- Say in that same sentence when the standard governs an attribute rather than a document type. An attribute is written across every document and has no path to name, so the silence reads as an omission unless the sentence claims it.
- Cut an entry that names no owner at all. It is either excluding something nothing was going to claim, or it is a content exclusion, which the rule below sends to the shape rules instead.
- Declare a boundary from both sides. A yield, an exemption, or a handoff stated in one standard alone is never checked against the standard on the other side of it, which is how two files come to claim the same rule or neither does.
- Separate a jurisdiction exclusion from a content exclusion. The first names a concern another standard owns and belongs in `## Scope`. The second names what does not belong inside the document and stays with the shape rules. Merging them puts a boundary claim where no sibling will read it.
- Stay silent on a section the standard holds today but should not own. Claiming it makes the scope statement false the moment it moves, and the mismatch is the evidence that moves it.

### Naming the file

- Name the file for the artifact the scope statement governs, taking the word from the deepest path segment that names the artifact rather than the folder holding it. `plan.md` over `.canon/plans/feature-<slug>.md` and `session.md` over `.canon/tasks/session-<slug>.md` both follow it.
- Take the singular or the plural of that word, whichever reads as the artifact. A standard over one document takes the singular, and one over a set may take either.
- Name an attribute standard for the attribute itself, since it governs no path to derive a word from.
- Write the derived word alone. A standard installs as a sibling and is cited by bare filename, so a qualifier makes an outlier that every later citation has to carry.
- Rename an outlier at the moment it is found, and state the reach in the change that does it. The name is installed in every target and cited in surfaces that never see the rename, so the cost only grows.

### Staying inside it

- Name no path, filename, or folder outside the document type the standard governs. A standard reaches projects whose layout is their own, so a path borrowed from the authoring repository is wrong in a target and nothing reports it.
- State the rule, never the mechanism enforcing it. Hooks, scripts, checks, and skill catalogs are facts about one repository. Name the condition the document must meet and let the enforcing surface name its own case.
- Invent inline examples rather than citing a real file elsewhere in the project. A cited file moves or is deleted and the standard goes stale in silence.

## Frontmatter

- Start the file with a frontmatter block carrying at least `title` and `description`. A consuming surface may require more.
- `title`: names the doc type in sentence case, suffixed `reference` (`Commit reference`, `Branch reference`)
- `description`: one line naming what the standard covers. It becomes the index link label on install.

## Structure

- Use sentence case for every heading
- Flat `##` rule groups for a single-topic standard. Group `##` headers by concern for a multi-topic one.
- When one `##` section covers more than one sub-concern, split its bullets into `###` subgroups, one subgroup per sub-concern. A flat bullet list under an `##` covers a single sub-concern. Roughly seven bullets is a signal to split, not a hard cap.
- Order groups from the most-used rule down to the edge case

## Rules

- Write rules as imperative bullets: one rule per bullet, one concern per group
- State the forbidden shape rather than enumerating allowed options, so a rule survives new categories
- Cut any rule that resists a crisp one-line phrasing
- Do not pad with filler prose. Every line earns its place as a usable reference entry.
- Close a ban asserting how the model or a tool behaves with one `Revisit when <finding>.` sentence, since that claim can stop holding while the ban reads the same. A style, safety, or consistency ban takes none, and filling one with a condition is padding.

## Success criterion

- State what a conforming artifact achieves, not only what shape it takes. A standard that specifies structure exhaustively and success nowhere cannot be argued against, only edited on taste.
- Write the criterion as a small set of questions the artifact must answer, or a task a reader must be able to complete from it. Keep it checkable by a person in one sitting.
- Place it near the top, above the shape rules it governs. The shape rules are the means and the criterion is the test.
- Say that an artifact failing the criterion is non-conforming even when it satisfies every shape rule. Without that line the criterion reads as advice.
- Add a criterion to an existing standard when that standard is next exercised, not in a sweep. A criterion written without a failure to point at is the taste-based edit this section exists to prevent, so a standard with no criterion yet is a known gap rather than a violation.

## Changing a standard

### The checkpoint

Answer all four before editing, and carry the answers into wherever the change is proposed. This section governs itself, so the next edit to this file answers them too.

- What problem does this solve? Name the artifact that went wrong, rather than the improvement the change makes.
- Which surface owns the rule today? A rule already stated somewhere moves or is cited, never restated in a second place.
- What deterministic check catches a regression? Name it, or say none exists and the rule holds on reading alone.
- What does this collide with? Name the sibling standard, rule, or template it contradicts, or state that nothing does.

### What justifies a change

- Change a standard on a failure, not on a finding. A finding is that the docs say X or a paper suggests Y. A failure is a conforming artifact that satisfied every shape rule and still missed the success criterion.
- Park findings wherever the project tracks pending work, or in the standard's own backlog section when it tracks none. They are hypotheses to test, not instructions to apply.
- Cite the failing artifact in the change that fixes it, so the next reader can tell which rules were paid for by evidence.

## Examples

- Include examples only where a rule is non-obvious. A self-evident rule needs none.
- When shown, label them `### Correct` and `### Incorrect` with an inline `# reason` on each entry
- Keep to two or three entries. Show the pattern, not a catalog.
- Keep each entry a short one-liner or command. Do not write multi-line correct and incorrect function blocks.

## Template

- Carry one fenced template of the document the standard governs, so an author copies a shape instead of reconstructing it from prose.
- Bind this to a standard governing a document type. An attribute standard governs a scan, a string, or a label rather than a file, so it has no document to template and carries none.
- State that exemption in the sentence declaring the standard an attribute standard. An exemption left to inference reads as an omission, and the next author writes a template that teaches nothing.
- Place the template below the rules it satisfies, under a `## Template` heading or inside the section holding those rules. A reader arrives at it having already read what each part means.
- Show the skeleton alone: every required section, one placeholder line for what each holds. A full worked document is a second document to maintain.
- Write placeholders in angle brackets rather than copying a real document. A copied file goes stale, and its backticked filenames read as citations to anything parsing the standard.
- Switch to a bare word where the fenced language reads `<` as syntax of its own, as Mermaid and HTML do, and say in the line above the fence that the names are placeholders. A template that does not parse in its own language teaches a shape the author cannot run.
- Carry any header, key, or label a consuming tool parses verbatim. The template is the only place an author learns which strings are load-bearing, since prose calling them fixed does not say what they are.
- Treat the template as authoritative where it and the prose disagree. An author copies the block, so a contradiction ships as the block, and naming the winner turns a drift into a visible defect rather than a silent one.

````markdown
---
title: <Document type> reference
description: <one line naming what this standard covers>
---

# <Document type> reference

Applies to `<path/to/document>`. <One line on what the document is for and when it changes.>

## Scope

Governs `<path/to/document>`: <the aspects this standard sets>.

Does not govern:

- <excluded concern>: `<sibling>.md`
- <excluded concern>: <the surface that owns it>

## What a working <document type> looks like

A <document type> works when <the task a reader completes from it alone>:

- <question the document must answer>
- <question the document must answer>

A <document type> failing these is non-conforming even when it satisfies every shape rule below.

## Frontmatter

- `title` (required): <casing, and what it names>
- `description` (required): <what the one line covers>

## <Shape rule group>

- <imperative rule, one concern per bullet>
- <imperative rule, one concern per bullet>

## Template

```markdown
<the skeleton of the governed document, placeholders throughout>
```
````
