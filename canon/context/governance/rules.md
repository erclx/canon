---
title: Rules
description: The numbering bands and their two sources, the frontmatter contract, how Claude Code loads a rule, adding one, and rules a target authors itself
---

# Rules

A rule is a `.md` file carrying the Claude shape directly, so nothing generates it and install is a passthrough copy. Rules sit in subdirectories by domain and install preserves that layout, since a flat folder would leave the numbering bands as the only grouping signal.

What earns a rule in the first place, and which standard each one routes to, is `canon/context/governance/routing.md`.

## Decisions

### Numbering bands

A rule's number states its domain without opening it.

| Range     | Domain                                                     |
| --------- | ---------------------------------------------------------- |
| `000–099` | core (persona, testing, error handling, planning)          |
| `100–199` | lang (one rule per language)                               |
| `200–299` | framework (one rule per framework)                         |
| `300–399` | lib (testing libraries, validation, security, persistence) |
| `400–499` | ui (copy, accessibility, forms, motion, capture)           |
| `500–599` | claude (authoring rules for `.claude/` and canonical docs) |
| `700–799` | ci (GitHub Actions workflow files)                         |

The table stays a table because it grows a row per band rather than per rule, and a band opens rarely. Each row names a category rather than listing its rules, which `canon gov list` reports.

`snippets/` draws a single number from the headroom rather than holding a band, so its one rule numbers at 600 rather than claiming a hundred for one file. `ci` opens `700` at a band boundary for the same reason. The rest of `600-699` and `800-899` is headroom held for a category that has no band yet, and `900-999` is reserved for rules a target authors itself, which no shipped rule takes.

The leading digit restates the folder, so what the number uniquely supplies is read order rather than routing. Nothing precedence-orders rules at load, and renumbering would reach every installed target and buy nothing.

### Three sources numbering into one tree

- `governance/rules/` ships to targets and takes the gaps between the tens, such as `core/087-git.md` and `core/091-channel.md`.
- `internal/rules/` governs this repository alone and takes the top of a band, a division stated in `standards/rule.md`. The core band is full at every ten, which is what forces the split rather than leaving it to convention.
- A target's own rules take `900-999`, since the two bands the toolkit crowds most, `core/` and `claude/`, have almost no top-of-band room left for a target to claim.

Each source also installs into its own folder: `.claude/rules/canon/`, `.claude/rules/internal/`, and `.claude/rules/project/`. The folder stops a colliding `<n>-<slug>` between two sources from overwriting one file with the other, and the number still resolves a citation against either corpus for a reader who has only the citation in hand. `internal/` exists only in this repository. Nothing checks any of the three divisions.

### An always-loaded rule belongs in `core/`

An always-loaded rule sits in `core/` even though nothing about `paths:` requires the band. What decides it is whether a target can update the rule: `governance/stacks/base.toml` takes `core` whole, so a bullet moved there from a seeded root file reaches a target through `canon gov sync` rather than through a one-time copy nothing refreshes. A `CLAUDE.md` bullet carries the same session-start priority, so the band is the only thing the move changes.

## Gotchas

- A widened source rule fails `bun run check` until its consumed copy is committed. The Consumed copies stage regenerates `.claude/rules/` and turns the resulting diff into a failure. A glob matching nothing still does not error, so the gate catches a stale copy rather than a dead glob.
- Moving the files a rule governs breaks the rule twice. The `paths:` glob stops matching, so the rule stops loading for its surface, and the body still describes the old layout, so a session that does load it is instructed against the change. No stage reports either half, so grep `governance/rules/` and `internal/rules/` whenever a branch moves a governed path.
- A rule in a folder no stack names installs for nobody. `canon/context/governance/stacks.md` covers which folders `base` takes whole and the stage that reports the gap.
- Adding a rule stales every hardcoded rule count in the context entries and `docs/`. Run `canon gov counts` after the rule lands, fix each figure it names, and re-run it until clean. Three figures move independently: the authored total under `governance/rules/`, the consumed total under `.claude/rules/`, and what `base` resolves to, which `canon gov list --json` reports.
- `core/070-planning.md` names a `canon` verb, which puts it on the slow side of the two-speed gap `canon/ARCHITECTURE.md` records. The rule reaches a target when an install copies it, while the verb reaches that target only once a release publishes, so a rule citing a verb owes the same release wait a skill body does. Nothing detects the skew.
- A rule publishing a heading some command parses is program input. `src/comments/vocabulary.ts` reads its terms from whichever rule publishes `## Degradation vocabulary`, so adding that heading elsewhere changes what `canon comments scan` sweeps for. Grep for a reader of the heading or filename before writing the rule.
- A `description` holding a bare word, a colon, and a space breaks `Bun.YAML.parse`, which reads the shape as a nested key. `parseFrontmatter` treats the unparsable block as absent, so `canon gov list` and the citation check list the rule as unscoped rather than naming the colon. Rephrase the description rather than quoting it, since every other frontmatter example here is unquoted.
- A glob can reach well past one named folder. `claude/511-indexes.md` globs `**/index.md` and reaches every folder in the tree, and `core/065-spelling.md` globs `.cspell/**`, a folder outside `.claude/` and outside a project's own source.

## Frontmatter contract

Path-scoped rules emit a `paths:` list, one entry per glob:

```yaml
---
description: Enforce strict Python type hints, casing, and import patterns
paths:
  - '**/*.py'
---
```

Always-on rules emit no `paths:` key. The Cursor schema of `globs`, `alwaysApply`, and `priority` is not consumed and must not appear in source.

Claude Code discovers `.claude/rules/*.md` recursively at session start. A rule without `paths:` always applies, with the same priority as `CLAUDE.md`, and a rule with `paths:` applies when Claude reads a matching file. `wiki/claude/claude-memory.md` carries the loading-time details. Recursive discovery is also why a target still holding the flat `.claude/rules/<subdir>/` layout loads two copies of a rule, which `canon/context/governance/install.md` covers.

## Adding a rule

Create a `.md` file under `governance/rules/` using the numbering bands above. Discovery is automatic and the rest of the branch is not.

- Commit the regenerated `.claude/rules/` copy, which the Consumed copies stage asserts against git.
- Run `canon gov counts` and fix every figure it names, per the gotcha above.
- The branch owes no hero render. The Hero stage runs `regen-hero.sh --check`, which discards what it fills, and `refresh-capture-frames.yml` lists `governance/rules/**` in its path filter, so the frames refresh in their own pull request after the merge.

A rule added to `core/`, `claude/`, `snippets/`, or `ci/` reaches every `base` consumer with no stack edit, since `base` names each of those folders whole. A rule in any other folder needs its name in the relevant `governance/stacks/*.toml`.

Glob the rule against every ecosystem it governs rather than only the one its stack serves, since `--add` layers a rule onto a stack that never names it. `360-security-server` and `370-database` sit on `python` and `node-server` and glob `**/*.go` and `**/*.php` beside `**/*.py`, `**/*.ts`, and `**/*.js`, so a Go or PHP backend that takes either through `--add` already matches. A glob narrowed to the naming stack's language installs a rule that matches nothing there.

## Project-local rules

The `create-rule` plugin skill scaffolds a target's own rule into `.claude/rules/project/<subdir>/<n>-<slug>.md`, taking the lowest free number at or above 900. That folder sits beside `.claude/rules/canon/` rather than inside it.

`canon gov sync` walks only `.claude/rules/canon/`, since `createGovAdapter` narrows its `installedRoot` to the toolkit-owned folder. A project rule sits outside the walk, so it is never read, matched, or classified, and it cannot collide with a later toolkit rule taking the same name inside `canon/`.

A file under `.claude/rules/canon/` that no toolkit source names is classified `orphaned`, and the report offers no destination for it, since that folder is toolkit-owned and replaced wholesale on sync. The toolkit cannot tell a stale toolkit file at a flat path from a project rule at the same number, so neither gets a suggested move.

The stamp does not separate a renamed toolkit rule from a project-authored one either. `recordStamp` skips a file whose source is gone and `writeStamp` replaces the domain's whole `files` map, so a renamed rule's entry survives one sync past the rename, and a target installed before stamping carries no entry at all. The notice for such a file therefore stays conditional rather than assertive.
