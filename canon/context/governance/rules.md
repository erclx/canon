---
title: Rules
description: Rule names and the folders that carry their domain, the three sources and where each installs, the frontmatter contract, how Claude Code loads a rule, adding one, and rules a target authors itself
---

# Rules

A rule is a `.md` file carrying the Claude shape directly, so install is a passthrough copy. Every rule is written by hand, and nothing generates one. Rules sit in subdirectories by domain and install preserves that layout, so the folder is the one grouping signal a rule carries.

What earns a rule in the first place, and which standard each one routes to, is `canon/context/governance/routing.md`.

## Decisions

### A rule is named by its folder and its slug

A rule lives at `<folder>/<slug>.md` with no number in front. The folder states the domain, and the slug states the topic.

A three-digit prefix from a number range per folder, `000` for `code/` through `800` for `writing/`, is not used. The leading digit restated the folder, and nothing precedence-orders rules at load, so what the number supplied was read order in a folder listing.

Keeping the prefix for that read order was the rejected alternative. It cost a range table, a range from `900` reserved for target-authored rules, and a division of each range between shipped and internal rules, and none of the three was checked. A `governance/renames.toml` entry per shipped rule carries a target across through `canon gov sync`.

Every basename stays distinct and off every folder name, which `expandStackEntry` in `src/gov/stacks.ts` leans on, since a stack entry naming a folder expands to the whole folder. `src/gov/rule-layout.test.ts` asserts both across `governance/rules/` and `internal/rules/`. Four names collided and took a different slug, three of them because the Folder-echoed filenames stage of `bun run check` refuses a filename equal to its folder or opening on the folder's name:

- `602-tasks` became `canon/task-scope.md`, since the path-scoped `canon/tasks.md` already held `tasks`. Folding the two would move an always-loaded rule behind a `paths:` glob.
- `400-ui` became `ui/copy.md`, read off its H1, since `ui` names the folder and a detect proposal for it would install all ten `ui` rules.
- `000-code` became `code/routing.md`, read off its description, since `code` names the folder the four language stacks take whole.
- `596-claude-md` became `claude/seed-mirror.md`, read off its H1, since `claude-md` opens on its folder's name.

### Three sources install into three folders

- `governance/rules/` ships to targets and installs under `.claude/rules/canon/`.
- `internal/rules/` governs this repository alone and installs under `.claude/rules/internal/`. Its `core/` folder holds rules the shipped tree carries no folder for.
- A target's own rules sit under `.claude/rules/project/`, written there by `create-rule`.

The folder is what stops a shipped rule and a target's rule of the same slug from overwriting one file with the other, so a target's slug needs to be free only inside its own subdir. `internal/` exists only in this repository, and its basenames share one namespace with the shipped set, since both resolve through the same stack and rename lookups.

### Rules group by the audience they serve

A rule's folder names who the rule serves: `code/` for a project writing code, `claude/` for session conduct and `.claude/` authoring, `canon/` for the toolkit workflow and its record folders, where the record rules `canon/context.md`, `canon/tasks.md`, and `canon/plan.md` sit, `tooling/` for dev setup, and `writing/` for prose and document shape. `base` names ten rules from `canon/`, `claude/`, and `writing/` one by one, and the language stacks add `code` whole, so a docs or writing project loads no rule it can never apply.

Grouping along the repository's three roots, `tooling/`, `claude/`, and `canon/`, was the alternative, and it left two groups with no honest home: the generic code rules are not tooling, and the prose rules are not about Claude.

An always-loaded rule still reaches a target through `canon gov sync` rather than through a seeded root file nothing refreshes, once `base` names it or `canon gov detect` proposes it. A `CLAUDE.md` bullet carries the same session-start priority, so the group is the only thing a move from a seed changes. `code/routing.md` and `code/testing.md` keep only the pointers to the skills that carry the depth, so the floors load on demand rather than every session.

### Pointer rules are authored by hand

A generator writing a pointer rule under `governance/rules/standards/` for each standard carrying `paths:` has nothing to write, since no standard carries the field. Keeping one would leave a gate stage watching an empty path and a folder any restored `paths:` field would regrow. The rules for the shape of a reference live in `create-skill`'s `skill-reference.md`.

A rule pointing at a skill rather than a standard stays authored, as do the `writing/markdown` rule, `design-taste`, and `internal/rules/claude/tooling-reference.md`, whose standard never ships.

### Frontmatter contract

Path-scoped rules emit a `paths:` list, one entry per glob:

```yaml
---
description: Enforce strict Python type hints, casing, and import patterns
paths:
  - '**/*.py'
---
```

Always-on rules emit no `paths:` key. The Cursor schema of `globs`, `alwaysApply`, and `priority` is not consumed and must not appear in source.

Claude Code discovers `.claude/rules/*.md` recursively at session start. A rule without `paths:` always applies, with the same priority as `CLAUDE.md`, and a rule with `paths:` applies when Claude reads or writes a matching file, in a linked worktree as in the main one, and a session creating the first matching file gets it only after that write lands. The create-rule reference carries the conclusion and the recipe to re-measure it. The source page linked from `wiki/claude/memory.md` carries the loading-time details. Recursive discovery is also why a target still holding the flat `.claude/rules/<subdir>/` layout loads two copies of a rule, which `canon/context/governance/install.md` covers.

### Adding a rule

Create `<folder>/<slug>.md` under `governance/rules/`, with a slug no other rule takes and no folder carries. Discovery is automatic and the rest of the branch is not.

- Commit the regenerated `.claude/rules/` copy, which the Consumed copies stage asserts against git.
- Run `canon gov counts` and fix every figure it names, per the gotcha above.
- A rename adds an entry to `governance/renames.toml` in the same change, mapping the old basename to the new one, so `canon gov sync` moves a target across rather than only deleting the old file. A fold of several rules into one takes no entry, since the ledger declares one-to-one identity only.
- The branch owes no hero render. The Hero stage runs `regen-hero.ts --check`, which discards what it fills, and `refresh-capture-frames.yml` lists `governance/rules/**` in its path filter, so the frames refresh in their own pull request after the merge.

A rule added to `code/` reaches every `node`, `python`, `go`, and `php` consumer with no stack edit, since each takes that folder whole. A rule in any other folder reaches nobody until its name lands in `governance/stacks/base.toml` or a language stack, or it gets an entry in `governance/detect.toml`. `base` names its ten rules one by one, so a new rule under `canon/` or `claude/` is opt-in by default.

Glob the rule against every ecosystem it governs rather than only the one its stack serves, since `--add` layers a rule onto a stack that never names it. `security-server` and `database` sit on no stack and glob `**/*.go` and `**/*.php` beside `**/*.py`, `**/*.ts`, and `**/*.js`, so any backend that takes either through a detect proposal or `--add` already matches. A glob narrowed to the naming stack's language installs a rule that matches nothing there.

### Project-local rules

The `create-rule` plugin skill scaffolds a target's own rule into `.claude/rules/project/<subdir>/<slug>.md`, taking a slug free in that subdir. That folder sits beside `.claude/rules/canon/` rather than inside it.

`canon gov sync` walks only `.claude/rules/canon/`, since `createGovAdapter` narrows its `installedRoot` to the toolkit-owned folder. A project rule sits outside the walk, so it is never read, matched, or classified, and it cannot collide with a later toolkit rule taking the same name inside `canon/`.

A file under `.claude/rules/canon/` that no toolkit source names is classified `orphaned`, and the report offers no destination for it, since that folder is toolkit-owned and replaced wholesale on sync. The toolkit cannot tell a stale toolkit file at a flat path from a project rule of the same name, so neither gets a suggested move.

The stamp does not separate a renamed toolkit rule from a project-authored one either. `recordStamp` skips a file whose source is gone and `writeStamp` replaces the domain's whole `files` map, so a renamed rule's entry survives one sync past the rename, and a target installed before stamping carries no entry at all. The notice for such a file therefore stays conditional rather than assertive.

## Gotchas

- A widened source rule fails `bun run check` until its consumed copy is committed. The Consumed copies stage regenerates `.claude/rules/` and turns the resulting diff into a failure. A glob matching nothing still does not error, so the gate catches a stale copy rather than a dead glob.
- Moving the files a rule governs breaks the rule twice. The `paths:` glob stops matching, so the rule stops loading for its surface, and the body still describes the old layout, so a session that does load it is instructed against the change. No stage reports either half, so grep `governance/rules/` and `internal/rules/` whenever a branch moves a governed path.
- A rule in a folder no stack names installs for nobody. `canon/context/governance/stacks.md` covers why `code` is the one folder a stack takes whole and the stage that reports the gap.
- Sync never retracts a rule a target's stack stopped naming, since `locateSource` matches a held basename in any folder. A `base` target installed before the audience regroup keeps `testing` under `core/` and `ci-workflow` under `ci/`, updated in place beside the new folders, so moving a rule between stacks reaches new installs only. Loading is recursive, so the stray folders cost orientation and nothing at load.
- Adding a rule stales every hardcoded rule count in the context entries and `docs/`. Run `canon gov counts` after the rule lands, fix each figure it names, and re-run it until clean. Three figures move independently: the authored total under `governance/rules/`, the consumed total under `.claude/rules/`, and what `base` resolves to, which `canon gov list --json` reports.

### Shipped rules reaching beyond governance

- A rule that names a plugin skill, such as the markdown rule, `worktrees`, or `git`, points at something a project installing governance alone does not have. Each such rule tells the session to report the missing skill, which surfaces the gap without closing it.
- A rule that names a `canon` verb, such as `canon gov test-order`, sits on the slow side of the two-speed gap `canon/context/claude-plugin/distribution.md` records. The rule reaches a target when an install copies it, while the verb reaches that target only once a release publishes, so a rule citing a verb owes the same release wait a skill body does. Nothing detects the skew.
- A rule publishing a heading some command parses is program input. `src/comments/vocabulary.ts` reads its terms from whichever rule publishes `## Degradation vocabulary`, so adding that heading elsewhere changes what `canon comments scan` sweeps for. Grep for a reader of the heading or filename before writing the rule.
  - The program-input check in `internal-rule-audit` runs the same grep per rule, and attaches the reader to any retire or merge verdict.
- A `description` holding a bare word, a colon, and a space breaks `Bun.YAML.parse`, which reads the shape as a nested key. `parseFrontmatter` treats the unparsable block as absent, so `canon gov list` and the citation check list the rule as unscoped rather than naming the colon. Rephrase the description rather than quoting it, since every other frontmatter example here is unquoted.
- A glob can reach well past one named folder. `canon/indexes.md` globs `**/index.md` and reaches every folder in the tree.
