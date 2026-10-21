---
title: Examples
subtitle: Worked sources demonstrating what a toolkit command produces
auto: false
---

# Examples

Worked sources demonstrating what a toolkit command produces.

- [`design/DESIGN.md`](design/DESIGN.md): an authored intent record for Tidewell, an invented tide-table app, so the project is not this repository's own. It carries every section the template names plus `## Layout`, with each color and shape role naming its custom property and no value, since its lead points at the invented project's `src/styles/tokens.css`. No stylesheet sits beside it, because a hand-kept copy of the values is the drift the intent shape removes. Its prose stays inside the budget `claude/skills/design-record/references/design.md` sets, one Overview paragraph and at most three one-line rules a section, and the `design` gate stage fails it past that.
- [`teach/`](teach/): a committed teach root holding three folders. `00-fixture/` is a full workspace with three lessons, a glossary, resources, a learning record and one reference page, `reference/element-table.md`, which nav renders to the `.html` beside it. `01-sparse/` is a thin one with a single lesson. `02-unopened/` carries no `MISSION.md`, which the listing draws as a disabled row. Every lesson carries the four chrome marker pairs, and the content is deliberately meaningless so the shell is what gets developed. Rewrite the root, the contents pages, the rendered reference page and each lesson's chrome with `canon teach nav --root examples/teach`. `teach/evidence/` holds captures of the root listing, a workspace index, a lesson and a reference page, each with the stamp `canon capture` wrote. Rebuild them by serving `examples/teach` over http and capturing each page with `--selector body`.
