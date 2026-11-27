---
title: Reference file reference
description: Shape and content rules for a reference that sets the shape of one artifact
---

# Reference file reference

Applies to each file under a skill's `references/` that sets the shape of one document type, or of one attribute carried across every document. A session reads it at the point the skill body names it, and skills and developers consume it alike. This file governs itself, so every rule below applies to it.

## Contents

- [Scope](#scope)
- [What a working reference looks like](#what-a-working-reference-looks-like)
- [Scoping rules](#scoping-rules)
- [Frontmatter](#frontmatter)
- [Structure](#structure)
- [Rules](#rules)
- [Success criterion](#success-criterion)
- [Changing a reference](#changing-a-reference)
- [Examples](#examples)
- [Template](#template)

## Scope

Governs a shape reference at `skills/<name>/references/<file>.md`: its stated jurisdiction, success criterion, frontmatter, structure, and rule phrasing.

Does not govern:

- The `references/` folder's place in the skill, its line ceiling, and the body naming each file: `skill.md`
- How a body or a reference cites another skill's reference: `skill-paths.md`
- The voice, rhythm, and sentence construction a reference is written in: the `write-human` skill
- The punctuation, formatting, and word choice a reference is written in: `../markdown-craft/references/markdown.md`
- The shape of any artifact a reference governs, which is that reference's own subject

## What a working reference looks like

A shape reference answers these questions. Each can be answered wrong, which is what makes them a test rather than a preamble.

- Which single document type or attribute does this govern, and where does it apply?
- Can an author who has seen no example produce a conforming document from this file alone?
- Does every rule state a shape the document must have, rather than a fact about the repository that happens to store it?
- What does a conforming document achieve, stated so a reviewer can call one non-conforming without appealing to taste?

A reference failing these questions is non-conforming even when it satisfies every shape rule below.

## Scoping rules

### Declaring scope

A reference that specifies shape exhaustively and jurisdiction nowhere cannot refuse a rule, so the rule with no obvious owner lands in whichever reference sits nearest.

- Govern one document type per reference, or one attribute across every document. Split unrelated conventions into separate files.
- Open with a `## Scope` section stating what the reference governs and what it does not, placed above the shape rules
- Write it as one line naming the artifact or attribute and where it applies, then a `Does not govern:` list. Give each entry the excluded concern and the owner it goes to.

### The path and owners

The scope line names the governed path, and each exclusion names its owner.

- Name an owner in the same `references/` folder by bare filename, and one in another skill by its sibling path, `../<skill>/references/<name>.md`
- Name the surface instead where the owner is one, such as a coding rule, a project policy, or the code
- Put the governed path in backticks inside the first sentence of that line, anchored deep enough to resolve from a project root, since a bare folder name matches a same-named folder elsewhere
- A path held back until a later sentence sits beside every other path the statement mentions, including the ones it excludes
- Say in that same sentence when the reference governs an attribute, since an attribute has no path to name and the silence reads as an omission unless the sentence claims it

Cut an entry that names no owner at all. It is either excluding something nothing was going to claim, or it is a content exclusion, which the rule below sends to the shape rules instead.

### Boundaries

A yield, an exemption, or a handoff stated in one reference alone is never checked against the reference on the other side, which is how two files come to claim the same rule or neither does.

- Declare a boundary from both sides
- Separate a jurisdiction exclusion, naming a concern another reference owns, which belongs in `## Scope`, from a content exclusion, which stays with the shape rules
- Merging the two puts a boundary claim where no sibling will read it
- Stay silent on a section the reference holds today but should not own. Claiming it makes the scope statement false the moment it moves, and the mismatch is the evidence that moves it.

### Naming the file

Name the file for the artifact the scope statement governs, taking the word from the deepest path segment that names the artifact rather than the folder holding it. `plan.md` over `.canon/plans/feature-<slug>.md` and `session.md` over `.canon/tasks/session-<slug>.md` both follow it.

### Staying inside it

A reference reaches projects whose layout is their own, so what it names holds in any of them.

- Name no path, filename, or folder outside the document type the reference governs, since a path borrowed from the authoring repository is wrong in a target and nothing reports it
- State the rule, never the mechanism enforcing it, since hooks, scripts, checks, and skill catalogs are facts about one repository
- Name the condition the document must meet, and let the enforcer name its own case
- Invent inline examples rather than citing a real file elsewhere in the project. A cited file moves or is deleted and the reference goes stale in silence.

## Frontmatter

- Start the file with a frontmatter block carrying at least `title` and `description`. A consuming surface may require more.
- `title`: names the doc type in sentence case, suffixed `reference` (`Commit reference`, `Branch reference`)
- `description`: one line naming what the reference covers

## Structure

- Use sentence case for every heading, and stop at `###`, since `markdown.md` allows no deeper one
- Flat `##` rule groups for a single-topic reference. Group `##` headers by concern for a multi-topic one.
- When one `##` section covers more than one sub-concern, split its bullets into `###` subgroups, one per sub-concern, each opening with a lead sentence
- A flat bullet list under an `##` covers a single sub-concern, and a run past the bullet limit `markdown.md` states is the signal to split it
- Order groups from the most-used rule down to the edge case

## Rules

- Write rules as imperative bullets: one rule per bullet, one concern per group
- State the forbidden shape rather than enumerating allowed options, so a rule survives new categories
- Cut any rule that resists a crisp one-line phrasing
- Do not pad with filler prose. Every line earns its place as a usable reference entry.
- Close a ban asserting how the model or a tool behaves with one `Revisit when <finding>.` sentence, since that claim can stop holding. A style, safety, or consistency ban takes none.

## Success criterion

- State what a conforming artifact achieves, not only what shape it takes. A reference that specifies structure exhaustively and success nowhere cannot be argued against, only edited on taste.
- Write the criterion as a small set of questions the artifact must answer, or a task a reader must be able to complete from it. Keep it checkable by a person in one sitting.
- Place it near the top, above the shape rules it governs. The shape rules are the means and the criterion is the test.
- Say that an artifact failing the criterion is non-conforming even when it satisfies every shape rule. Without that line the criterion reads as advice.

## Changing a reference

### The checkpoint

Answer all four before editing, and carry the answers into wherever the change is proposed. This section governs itself, so the next edit to this file answers them too.

- What problem does this solve? Name the artifact that went wrong, rather than the improvement the change makes.
- Which surface owns the rule today? A rule already stated somewhere moves or is cited, never restated in a second place.
- What deterministic check catches a regression? Name it, or say none exists and the rule holds on reading alone.
- What does this collide with? Name the sibling reference, rule, or template it contradicts, or state that nothing does.

### What justifies a change

Change a reference on a failure, not on a finding. A finding is that the docs say X or a paper suggests Y, and a failure is a conforming artifact that satisfied every shape rule and still missed the success criterion.

- Park findings wherever the project tracks pending work, or in the reference's own backlog section when it tracks none. They are hypotheses to test, not instructions to apply.
- Cite the failing artifact in the change that fixes it, so the next reader can tell which rules were paid for by evidence.

## Examples

- Include examples only where a rule is non-obvious. A self-evident rule needs none.
- When shown, label them `### Correct` and `### Incorrect` with an inline `# reason` on each entry
- Keep to two or three entries. Show the pattern, not a catalog.
- Keep each entry a short one-liner or command. Do not write multi-line correct and incorrect function blocks.

## Template

- Carry one fenced template of the document the reference governs, so an author copies a shape instead of reconstructing it from prose.
- Bind this to a reference governing a document type. An attribute reference governs a scan, a string, or a label rather than a file, so it carries none.
- State that exemption in the sentence declaring it an attribute reference
- Place the template below the rules it satisfies, under a `## Template` heading or inside the section holding those rules.

### What the template shows

The template is a skeleton an author fills, never a document of its own.

- Show the skeleton alone: every required section, one placeholder line for what each holds. A full worked document is a second document to maintain.
- Write placeholders in angle brackets rather than copying a real document. A copied file goes stale, and its backticked filenames read as citations to anything parsing the reference.
- Switch to a bare word where the fenced language reads `<` as syntax of its own, as Mermaid and HTML do, and say in the line above the fence that the names are placeholders.

### Load-bearing text

The template is the only place an author learns which strings a consuming tool parses.

- Carry any header, key, or label a consuming tool parses verbatim. The template is the only place an author learns which strings are load-bearing.
- Treat the template as authoritative where it and the prose disagree. An author copies the block, so a contradiction ships as the block.

````markdown
---
title: <Document type> reference
description: <one line naming what this reference covers>
---

# <Document type> reference

Applies to `<path/to/document>`. <One line on what the document is for and when it changes.>

## Scope

Governs `<path/to/document>`: <the aspects this reference sets>.

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

### <Sub-concern>

<A lead sentence naming what this sub-concern decides.>

- <imperative rule, one concern per bullet>

## Template

```markdown
<the skeleton of the governed document, placeholders throughout>
```
````
