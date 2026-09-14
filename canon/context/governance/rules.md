---
title: Rules
description: The numbering bands and their two sources, the frontmatter contract, how Claude Code loads a rule, adding one, and rules a target authors itself
---

# Rules

A rule is a `.md` file carrying the Claude shape directly, so nothing generates it and install is a passthrough copy. Rules sit in subdirectories by domain and install preserves that layout, since a flat folder would leave the numbering bands as the only grouping signal.

What earns a rule in the first place, and which standard each one routes to, is `canon/context/governance/routing.md`.

## Numbering bands

Rules follow a numbering scheme by band, so a new rule's number states its domain without opening it.

| Range     | Domain                                                                                                                                                                            |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `000–099` | core (constitution, testing, error handling, planning, etc.)                                                                                                                      |
| `100–199` | lang (TypeScript, Python, etc.)                                                                                                                                                   |
| `200–299` | framework (React, Tailwind, FastAPI, etc.)                                                                                                                                        |
| `300–399` | lib (testing libs, Zod, Pydantic, security, etc.)                                                                                                                                 |
| `400–499` | ui (UI copy, accessibility, forms, UX completeness, surface capture, link behavior)                                                                                               |
| `500–599` | claude (markdown prose, markdown mechanics, .claude/ context, wireframe, canonical-doc, task-board, learning workspace, session map, skill, readme, rule, and standard authoring) |
| `700–799` | ci (GitHub Actions workflow files)                                                                                                                                                |

`snippets/` is the one folder drawing a single number from the headroom rather than holding a band of its own. Its one rule, the `@`-reference convention, numbers at 600 rather than claiming a hundred for one file. Every other folder maps a whole band to its domain, which is why a number states its domain everywhere else.

An eighth range sits outside the table. `900-999` is reserved for a rule a target authored itself, and no shipped rule takes a number in it. The rest of `600-699`, plus `800-899`, is what remains of the headroom between the two, held for a category the toolkit has not added a full band for. `ci` is the first category drawn from that headroom, opening `700` at a band boundary rather than crowding a range the six original folders already divide.

### Two sources numbering into one folder

`internal/rules/` takes the top of a band and `governance/rules/` takes the gaps between the tens, a division stated in `standards/rule.md`. The core band is already full at every ten, which is what forced the split rather than leaving it to convention.

`core/087-git.md` is the first shipped rule in this band to claim a gap. The `claude` and `lib` bands already hold several, so a reader taking core's unbroken run of tens as the pattern would have read the convention backwards.

The two sources install into separate folders, `.claude/rules/canon/` and `.claude/rules/internal/`, a location-based split sitting alongside the numeric one. Without it, a colliding `<n>-<slug>` between the two sources would leave one file overwriting the other with nothing reporting which lost.

The folder is what a reader who has only opened the tree sees, and the number is what a reader who has only a citation in hand, such as one written before this repository carried the split, still resolves correctly against either corpus. `internal/` exists only in this repository, and no target's `.claude/rules/` ever holds it, since a target has no rule source of its own that ships nowhere.

A target's own rules are the third source and they are divided by reservation rather than by either of the above. Neither of the two bands the toolkit crowds most has room left for a top-of-band claim: `core/` runs to 090 with internal at 095 through 097, and `claude/` runs to 592 with internal at 595 through 598, leaving three free numbers in the band where a collision would first show. `standards/rule.md` states `900-999` instead, which no release can reach, and `.claude/rules/project/` sits as a third sibling folder beside `canon/` and `internal/`.

Nothing checks any of the three divisions.

### What the number supplies

The leading digit restates the folder in every rule, so what the number uniquely supplies is read order rather than routing. Nothing precedence-orders rules at load, which is why the band-to-folder mapping was left alone when folder entries landed. Renumbering would reach every installed target and buy nothing.

## Frontmatter contract

Path-scoped rules emit a `paths:` list, one entry per glob:

```yaml
---
description: Enforce strict Python type hints, casing, and import patterns
paths:
  - '**/*.py'
---
```

Always-on rules such as the core persona, testing, and error handling emit with no `paths:` key. The legacy Cursor schema of `globs`, `alwaysApply`, and `priority` is not consumed and must not appear in source.

## How Claude Code loads rules

`.claude/rules/*.md` discovers recursively at session start. Rules without a `paths:` field always apply, with the same priority as `CLAUDE.md`. Rules with `paths:` apply when Claude reads files matching the glob. See `wiki/claude/claude-memory.md` for the loading-time details.

Recursive discovery is what makes a target still on the flat `.claude/rules/<subdir>/` layout dangerous rather than merely stale. Neither bootstrap verb detects or clears the flat tree, so a target that runs `canon gov install` on the current `canon/`-wrapped layout ends up with both the flat copy and the new `canon/` copy on disk, and Claude Code loads both, one of them frozen at whatever content the flat copy carried. `canon migrate rule-layout` is the mover, covered in `canon/context/governance/install.md`.

An always-loaded rule sitting in `core/` reads as an odd fit next to the folder's path-scoped members, since nothing about `paths:` requires the band. The reason is whether a target can update it rather than glob scope: `governance/stacks/base.toml` takes `core` whole, so a bullet moved there from the seeded root file reaches a target through `canon gov sync` instead of through a one-time copy nothing ever refreshes. A `CLAUDE.md` bullet carries the same session-start priority either way, so the band is the only thing the move changes.

## Gotchas

- A widened source rule fails `bun run check` until the copy is committed. The regen propagates the change and the drift assertion turns the resulting diff into a failure. A rule matching nothing still does not error, so the gate catches the stale copy rather than the dead glob.
- Relocating the files a rule governs is how a live glob goes dead, which is the trigger the row above names the symptom of. A move breaks the rule twice over: the `paths:` glob stops matching, so the rule quietly stops loading for the surface it was written for, and the body goes on describing the layout the branch replaced, so any session that does still load it is instructed against the change. `599-showcase-assets.md` took both when the capture sources moved to `assets/captures/`, and no stage on that branch reported either half. `CLAUDE.md` already asks for a grep of the install and list scripts before a restructure, and the rules tree is the surface that instruction does not name, so grep it too whenever a branch moves a governed path.
- A rule authored under `governance/rules/` in a folder no stack names installs for nobody through `canon gov install`. `canon/context/governance/stacks.md` covers which folders close that and which do not. `base` carries `snippets` as a folder-whole entry, the same way it already does `core` and `claude`, so the folder reaches every base consumer through governance rather than through the retired `canon snippets install` channel. See `canon/context/snippets.md`.
- Adding a rule stales a hardcoded count in five entries nothing gates at edit time. `canon/context/development/regeneration.md` states how many rules the toolkit authors and consumes, `canon/context/sandbox/authoring.md` states the authored total beside what `base` resolves to, and `canon/context/cli/audits.md` with `docs/agents/counts.md` quote both sentences as specimens of the trigger grammar, so a figure moving in either source moves three more in each quoting file. The Hero stage in `src/gate/stages.ts` gates the count on the README frame and reaches none of them. Measured 2026-08-13 at 48 authored, 30 consumed, and 28 resolved by `base`. Three numbers move together and each has its own reader: the authored total from `governance/rules/`, the consumed total from `.claude/rules/`, and what `base` resolves to, which `canon gov list --json` reports rather than any count of the source folder.
- `canon gov counts` closes the row above. Its trigger set reaches the `all <n> rules` and `authors <n> rules` shapes as well as a plain count, so it reads past both rule figures rather than only one. Run it after a rule lands, fix every figure it names, and re-run it to confirm clean. The manual re-measure is the fallback rather than the instrument.
- A landing rule also drifts the hero frame, which the row above names as reaching neither entry without saying the branch owes the render. `bun run check` fails its Hero stage until `bun src/cli.ts capture assets/captures/hero.html --selector .window --out assets` rewrites the image, and that stage and the Consumed copies stage both assert against git rather than the working tree, so the regenerated rule copy and the three hero files have to be staged before either passes.

- `core/070-planning.md` is the only rule naming a `canon` verb, which puts it on the wrong side of the two-speed gap `canon/ARCHITECTURE.md` records. A rule reaches a target the moment an install copies it, while the verb it names reaches that target only once a release publishes, so a project on an older CLI reads an instruction its binary refuses. A rule citing a verb therefore owes the same release wait a skill body does, and nothing detects the skew.

A rule that publishes a heading some command parses is program input, so adding one is a code change and the reading command runs against the tree before the commit. `src/comments/vocabulary.ts` reads its terms out of whichever rule publishes `## Degradation vocabulary`, so a rule adding that heading can turn a sweep that previously reported nothing into one returning several hits, including a hit against the matcher's own doc comment naming the terms it matches. Grep for a reader of the heading or filename before writing the rule, and read every hit before treating any as a defect.

A `description` carrying a bare word, a colon, and a space breaks `Bun.YAML.parse` in `parseFrontmatter`, since YAML reads that shape as a nested mapping key rather than plain scalar text. The failure surfaces far from the cause: `canon gov list --json` throws a stack trace pointing at `src/indexes/frontmatter.ts` rather than naming the rule file, and the Hero stage that depends on that catalog fails in turn with no mention of a colon. Rephrase the description to avoid the pattern rather than quoting it, since the frontmatter examples elsewhere in this repository are unquoted.

`claude/511-indexes.md` globs `**/index.md`, the first rule reaching every folder in the tree rather than one named folder's contents. `core/065-spelling.md` globs `.cspell/**`, the first rule reaching a folder outside `.claude/` or a project's own source, since the dictionaries four stacks seed there had been governed by prose in the always-loaded file rather than by any rule.

## Adding a rule

Create a `.md` file anywhere under `governance/rules/` using the numbering convention above. Discovery is automatic and the rest of the branch is not.

`bun run check` has three things to say about the new file. The Consumed copies stage regenerates `.claude/rules/` and asserts no drift against the index, so the copy has to be staged before the stage clears. Governance rules are one of the five catalogs `scripts/core/regen-hero.sh` counts, so the rule moves both the count and the sampled entry list on `assets/captures/hero.html`, and the Hero stage fails until `canon capture assets/captures/hero.html --selector .window --out assets` re-renders the image and the stamp beside it. The stacks entry states that for a new stack file and it holds the same way for a rule. Then the two hardcoded counts the Gotchas below name need re-measuring in the same branch, since nothing gates either.

Whether it reaches anyone depends on the stack roster rather than on the file. A rule added to `core/`, `claude/`, `snippets/`, or `ci/` reaches every `base` consumer with no stack edit, since `base` names each of those folders whole, and a rule in any other folder needs its name in the relevant `governance/stacks/*.toml`. See `canon/context/governance/stacks.md` for both cases and for the stage that reports the gap.

Glob the rule against every ecosystem it governs rather than only the one its stack serves, since `--add` layers a rule onto a stack that never names it. `360-security-server` and `370-database` sit on `python` alone and glob `**/*.py` beside `**/*.ts` and `**/*.js`, so a Node API project pulls either one in and the globs already match. A glob narrowed to the naming stack's language installs a rule that matches nothing in that case.

## Project-local rules

Target projects author their own rules that the toolkit does not ship. The `create-rule` plugin skill scaffolds one into `.claude/rules/project/<subdir>/<n>-<slug>.md` with the Claude frontmatter shape, taking the lowest free number at or above 900. That folder sits beside `.claude/rules/canon/` rather than inside it.

These rules live only in the target. `canon gov sync` walks only `.claude/rules/canon/`, since `createGovAdapter`'s `installedRoot` narrowed to that folder to carry the toolkit-owned wrapper. `.claude/rules/project/` sits outside the walk by location, so it is never read, matched against a source, or classified at all, which is a stronger guarantee than the `orphaned`-by-location state `planSync` in `src/sync/engine.ts` used to assign it: a file the walk never reaches cannot collide with a later toolkit rule taking the same name inside `canon/` either.

A file under `.claude/rules/canon/` itself that no toolkit source names is classified `orphaned` by the name lookup, and the report offers no destination for it, since a destination nested inside `canon/` would be wrong regardless: that folder is toolkit-owned and replaced wholesale on sync.

Two measured targets, `career` and `erclx.dev`, together carry seven files still sitting at flat toolkit paths from before this repository's own layout changed, two of them at 561 and 562, shipped now as `561-teach` and `562-session`. The toolkit cannot tell those from a project-authored rule at the same numbers, so neither gets a suggested move, only the generic orphaned report.

The stamp does not separate a renamed toolkit rule from a project-authored one either: `recordStamp` skips a file whose source is gone and `writeStamp` replaces the domain's whole `files` map, so a renamed rule's entry survives exactly one sync past the rename, and a target installed before stamping shipped carries no entry at all. That ambiguity is why the notice for such a file stays conditional rather than assertive, and why no replacement notice is worth building: the ambiguity is unresolved either way.

The band is what keeps a number from reading as a coincidence, and location is what keeps a file from being overwritten. Neither is checked at write time, and nothing reads a number back against the reserved range.
