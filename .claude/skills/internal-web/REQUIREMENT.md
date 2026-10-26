---
name: internal-web
description: Why the outward-facing surface needs a domain skill beside the path-scoped rule that already fires on it and the context entry that already carries its narrative
---

# Internal web requirement

## Gap

Without this skill, a session drafts a landing page change without opening the `web/**` rule and reproduces failures it names, or paraphrases that rule into a plan a worker then enforces wrongly. It types a count the CLI reads at build time, and hand-edits a generated frame under `assets/` that the next regeneration overwrites.

It ships a page change without `bun run web:build`, the only typecheck `web/` gets since the gate's types stage never matches a web-only diff. It writes a `copy.ts` string with no readme anchor, with a line number, or with a paraphrase marker over a string that also quotes.

## Must

- The skill points at `canon/context/development/web.md` and the path-scoped rule rather than restating either
- The rule is opened before drafting, not after
- The citation contract sits in a reference opened when editing `copy.ts`
- A sync checklist names the build, the suite, and the gate

## Must not

- Restate the landing conventions or the entry's gotchas
- Own the design tokens, which `canon/context/features/design.md` holds for four surfaces
- Absorb `examples/`, which the web entry separates from `assets/` by reader

## Out of scope

- `docs/`, which `internal-docs` owns
- `src/` and the regeneration scripts, which `internal-scripts` owns
- Deciding how a surface should look, which `design-pick` owns
