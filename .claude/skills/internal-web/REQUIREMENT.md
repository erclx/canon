---
name: internal-web
description: Why the outward-facing surface needs a domain skill beside the path-scoped rule that already fires on it and the context entry that already carries its narrative
---

# Internal web requirement

## Gap

Without this skill, a session editing the landing page or this repository's images:

- Drafts a page change without opening `internal/rules/claude/593-landing-page.md`, which is scoped to `web/**` and holds conventions that fail silently. A five-round drafting pass did this and reproduced three of the failures the rule names.
- Paraphrases a convention into a plan rather than citing the rule, so a worker enforces a requirement the rule does not carry. One plan restated an image convention as a rule about where an `img` tag sits, where the actual convention is about what wrote the file.
- Types a count into the page. Every count is read from the CLI at build time, and a typed one ships looking correct.
- Adds a component under `web/src/components/` and reasons about it as page-only, missing that the gallery build renders every component in that folder whether or not the page imports it.
- Hand-edits a generated frame under `assets/`, which the next regeneration overwrites and which the drift gate reports only once the digests disagree.
- Ships a page change without `bun run web:build`, which is the only typecheck `web/` gets, since the `types` stage in `src/gate/stages.ts` never matches a web-only diff.
- Writes a string into `copy.ts` with no readme anchor, or with a line number, or with a paraphrase marker over a string that also quotes.

## Must

- Point at `canon/context/web.md` and at the path-scoped rule rather than restating either, so a rule rewrite moves what a reader sees without touching this skill.
- Say to open the rule before drafting rather than after, since the failure this addresses is a draft produced without it.
- Carry the citation contract in a reference the session opens when editing `copy.ts` rather than in the body every session loads.
- Name the `web/gallery-src` separation, which no rule states and which the guard script enforces only at build time.
- Carry a sync checklist naming the build, the suite, and the gate, since `web/` is outside the automated typecheck and a session cannot infer that from the tree.

## Must not

- Restate the five conventions. `593-landing-page.md` is the single source, `v101.0` is rewriting two of them, and a copy here would be stale the day that lands.
- Restate `canon/context/web.md`'s gotchas. The ownership table in `CLAUDE.md` puts per-domain narrative in the context entry.
- Own the design tokens. `canon/context/design.md` owns them and four surfaces read them, which makes them canonical rather than per-domain.
- Absorb `examples/`. `canon/context/web.md` separates it from `assets/` on who each folder addresses, and a skill covering both would erase the line that decision draws.

## Guards

No refusal strings. This is a domain skill loaded before editing rather than a procedure with entry conditions.

## Out of scope

- `internal-teach` covers the learning surface and its fixture.
- `internal-standards` covers `docs/`, which this routes to through `canon:docs-sync` and does not edit.
- `internal-scripts` covers `src/` and the regeneration scripts. This covers the surface those scripts render.
- `draft-and-pick` decides how a surface should look. This is for editing one whose look is settled.

### The open question this cannot answer

Whether a session loads this rather than relying on the rule firing at edit time and the context entry arriving through the eagerly loaded index. Both already reach a web edit, which is the strongest argument against this skill existing, and the gap it claims is that neither carries the procedure: the rule states conventions without saying to read it first, and the entry states gotchas without a checklist. Re-read this criterion once a few sessions have edited `web/` with the skill in place. If it turns out nothing loads it, retire it and move the checklist into the context entry rather than leaving a third surface nobody opens.
