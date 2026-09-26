---
title: Docs reference
description: Reader and jurisdiction, frontmatter, page structure, what a page links out to, the diagram permission, and when a category earns a subfolder
---

# Docs reference

Applies to each authored reference page under `docs/`. Skip for `index.md` at any depth, which is generated rather than authored.

## Scope

Governs each authored reference page under `docs/`, whose reader is an operator running what the project ships rather than developing it, and an agent reading the page cold from a project that consumes it: the frontmatter a page carries, its structure, what it links out to rather than restating, whether it holds a diagram, and when a category earns a subfolder of its own.

Neither reader has the source open. That is the whole of the distinction from internal narrative, whose reader does, and from the page a project puts at its front door, whose reader has not decided to install anything yet.

Does not govern:

- The page a project puts at its front door, whose reader is deciding whether to commit at all: `readme.md`
- Per-domain internal narrative written for a reader with the source open: `context.md`
- The drawing inside a Mermaid fence: `mermaid.md`
- Voice, rhythm, and sentence construction: the `write-human` skill
- Punctuation and formatting: `markdown.md`

## What a working docs page looks like

A page works when a reader who has never opened the source answers all four from the page alone.

- What is this surface, and when would I reach for it?
- What do I run or write to use it, spelled exactly enough to copy?
- What does it refuse, and what does a refusal look like when I hit one?
- Where do I go for the adjacent surface this page stops at?

A page failing these is non-conforming even when it satisfies every shape rule below. The shape rules are the means. These four questions are the test.

## Frontmatter

- `title` (required): sentence case, naming the surface the page covers rather than the action a reader takes on it
- `description` (required): one line naming what the page covers, which is what the folder's catalog shows beside the link
- `category` (conditional): the shelf the page sits on in that catalog
- Declare `category` on every page in a folder where any page declares one. A grouped catalog writes the declared shelves and nothing else, so a page omitting the field beside a sibling that carries one is absent from the catalog with nothing reporting it.
- Omit it on every page or on none. A folder where no page declares one lists flat, which is the right shape for a folder whose pages need no shelves.
- Spell one shelf's value identically on every page sitting there. The grouping reads the literal string, so a second spelling opens a second shelf holding one page.

## Structure

- Open with an H1 matching `title`, then one or two lines saying what the surface is, before any heading
- Use `##` for major sections and `###` for subsections. Do not nest deeper.
- Use sentence case for every heading, proper nouns aside
- Lead with the invocation a reader came for. Background, rationale, and edge cases sit below it.
- Write a command, a flag, or a field as something copyable, in a code span or a fence, never paraphrased into prose

## Content

- Write for a reader with no access to the source. A sentence that resolves only by opening a file belongs in internal narrative instead.
- Name the failures a surface produces alongside the path that works. A page documenting success alone sends its reader to the source at the first refusal.
- Link to the adjacent page rather than restating it. One page owns each surface, and a second copy drifts with nothing comparing the two.
- Do not restate output a command already prints, such as a full flag table. Name the command that prints it.
- Do not carry the history of how a surface reached its shape. A page describes the surface as it stands, and the change that moved it is recorded wherever the project tracks work.
- Do not carry contributor setup or the argument for adopting the project. Both are addressed to a reader who has not installed anything yet.

## Diagrams

- Carry a diagram where the page describes a structure or a path the reader has to hold in their head at once. One per page at most, and none is a correct answer for most pages.
- Draw it as a Mermaid fence or as a committed image the page references. Neither form is preferred, and the pick belongs to whoever knows which one the page's reader reads it in.
- Follow `mermaid.md` for the drawing inside a fence. It reaches the drawing and stops at the fence markers, so everything around it stays this file's subject.
- Do not write the drawing as raw inline markup. A rendering host strips markup outside its own allowlist, so an inline drawing survives a local preview and vanishes on the surface the page is read from.
- Say beneath the diagram, in prose, what it shows. A reader who cannot see the image gets the same answer from the sentence.

## Splitting the folder

- Move a `category` into a subfolder once its pages stop reading as a list in the catalog and start reading as a section of one. The shelf is the signal, not a file count, and a count invites an argument about the count instead.
- Move every page carrying that value. A shelf split across two depths is harder to scan than either arrangement taken whole.
- Give the subfolder a catalog page of its own, so the parent lists one entry where it listed several. The parent lists a subfolder as a folder rather than as a member of the shelf it replaced, so nothing on that page restores the grouping.
- Retarget every link into a moved page in the same change. A link resolving nowhere is what the move costs, and nothing else reports it.
- Name a moved page per the `codebase-layout` skill, which drops the prefix the subfolder now states.

## Template

```markdown
---
title: <Surface>
description: <one line naming what this page covers>
category: <the shelf this page sits on, carried by every sibling or by none>
---

# <Surface>

<One or two lines on what the surface is and when a reader reaches for it.>

## <The invocation>

`<the command or field, spelled to copy>`

<What it does and what it produces.>

## <Refusals>

- `<the condition>`: <what the reader sees, and what to do about it>

## <Adjacent surface>

<Where the reader goes for the thing this page stops at.>
```
