---
title: Rules
description: Rule names and folders, the three sources and where each installs, the frontmatter contract, loading, adding a rule, and project rules
---

# Rules

A rule is a `.md` file carrying the Claude shape directly, so install is a passthrough copy. Every rule is written by hand, and nothing generates one. Rules sit in subdirectories by domain and install preserves that layout, so the folder is the one grouping signal a rule carries.

What earns a rule in the first place, and which standard each one routes to, is `canon/context/governance/routing.md`.

## Decisions

### A rule is named by its folder and its slug

A rule lives at `<folder>/<slug>.md` with no number in front. The folder states the domain and the slug states the topic. A three-digit prefix from a range per folder, `000` for `code/` through `800` for `writing/`, is not used. The leading digit restated the folder and nothing orders rules at load, so the number only gave read order in a listing.

Keeping the prefix would have cost a range table, a reserved range from `900` for target-authored rules, and a shipped-against-internal division of each range, and none of the three was checked. A `governance/renames.toml` entry per shipped rule carries a target across through `canon gov sync`.

### Basenames stay distinct

Every basename stays distinct and off every folder name, which `expandStackEntry` in `src/gov/stacks.ts` leans on, since a stack entry naming a folder expands to the whole folder. `src/gov/rule-layout.test.ts` asserts both across `governance/rules/` and `internal/rules/`.

Four names collided and took a different slug, three because the Folder-echoed filenames stage refuses a filename equal to its folder or opening on the folder's name.

| Old name        | New name                | Reason                                                                                                        |
| --------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| `602-tasks`     | `canon/task-scope.md`   | path-scoped `canon/tasks.md` already held `tasks`, and folding would move an always-loaded rule behind a glob |
| `400-ui`        | `ui/copy.md`            | `ui` names the folder, and a detect proposal for it would install all ten `ui` rules                          |
| `000-code`      | `code/routing.md`       | `code` names the folder the four language stacks take whole                                                   |
| `596-claude-md` | `claude/seed-mirror.md` | `claude-md` opens on its folder's name                                                                        |

### Three sources install into three folders

Each source lands in its own folder.

| Source               | Installs under            | Holds                                                                                     |
| -------------------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| `governance/rules/`  | `.claude/rules/canon/`    | rules shipped to targets                                                                  |
| `internal/rules/`    | `.claude/rules/internal/` | rules for this repository alone, with a `core/` folder the shipped tree has no folder for |
| a target's own rules | `.claude/rules/project/`  | rules written by `create-rule`                                                            |

The folder stops a shipped rule and a target's rule of the same slug from overwriting each other, so a target's slug needs to be free only inside its own subdir. `internal/` exists only here, and its basenames share one namespace with the shipped set, since both resolve through the same stack and rename lookups.

### Rules group by the audience they serve

A rule's folder names who the rule serves.

| Folder     | Serves                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------- |
| `code/`    | a project writing code                                                                         |
| `claude/`  | session conduct and `.claude/` authoring                                                       |
| `canon/`   | the toolkit workflow and its record folders, where `context.md`, `tasks.md`, and `plan.md` sit |
| `tooling/` | dev setup                                                                                      |
| `writing/` | prose and document shape                                                                       |

`base` names ten rules from `canon/`, `claude/`, and `writing/` one by one, and the language stacks add `code` whole, so a docs or writing project loads no rule it can never apply.

Grouping along the repository's three roots, `tooling/`, `claude/`, and `canon/`, left two groups with no honest home, since the generic code rules are not tooling and the prose rules are not about Claude.

- An always-loaded rule reaches a target through `canon gov sync` rather than a seeded root file nothing refreshes
- A `CLAUDE.md` bullet has the same priority, so the group is the only thing a move from a seed changes
- `code/routing.md` and `code/testing.md` keep only pointers to the skills carrying the depth, so the floors load on demand rather than every session

### Pointer rules are authored by hand

A generator writing a pointer rule under `governance/rules/standards/` for each standard carrying `paths:` has nothing to write, since no standard carries the field. Keeping one would leave a gate stage watching an empty path. The rules for the shape of a reference live in `create-skill`'s `skill-reference.md`.

A rule pointing at a skill rather than a standard stays authored, as do the `writing/markdown` rule, `design-taste`, and `internal/rules/claude/tooling-reference.md`, whose standard never ships.

### Frontmatter contract

Path-scoped rules emit a `paths:` list, one entry per glob.

```yaml
---
description: Enforce strict Python type hints, casing, and import patterns
paths:
  - '**/*.py'
---
```

Always-on rules emit no `paths:` key. The Cursor schema of `globs`, `alwaysApply`, and `priority` is not consumed and must not appear in source.

### How Claude Code loads a rule

Claude Code discovers `.claude/rules/*.md` recursively at session start. A rule without `paths:` always applies, with the same priority as `CLAUDE.md`.

- A rule with `paths:` applies when Claude reads or writes a matching file, in a linked worktree as in the main one
- A session creating the first matching file gets the rule only after that write lands
- The create-rule reference carries the conclusion and the recipe to re-measure it, and the source page linked from `wiki/claude/memory.md` carries the loading-time details
- Recursive discovery is why a target still holding the flat `.claude/rules/<subdir>/` layout loads two copies, which `canon/context/governance/install.md` covers

### Adding a rule

Create `<folder>/<slug>.md` under `governance/rules/`, with a slug no other rule takes and no folder carries. Discovery is automatic and the rest of the branch is not.

- Commit the regenerated `.claude/rules/` copy, which the Consumed copies stage asserts against git
- Run `canon gov counts` and fix every figure it names, per the gotcha below
- A rename adds an entry to `governance/renames.toml` in the same change, so `canon gov sync` moves a target across. A fold of several rules takes no entry, since the ledger is one-to-one.
- The branch owes no hero render, since `regen-hero.ts --check` discards what it fills and `refresh-capture-frames.yml` refreshes the frames after the merge

### Who a new rule reaches

A rule added to `code/` reaches every `node`, `python`, `go`, and `php` consumer with no stack edit, since each takes that folder whole. A rule in any other folder reaches nobody until its name lands in `base.toml` or a language stack, or in `governance/detect.toml`, so a new rule under `canon/` or `claude/` is opt-in by default.

Glob the rule against every ecosystem it governs, since `--add` layers a rule onto a stack that never names it. `security-server` and `database` sit on no stack and glob Go and PHP beside Python, TypeScript, and JavaScript. A glob narrowed to one language installs a rule that matches nothing elsewhere.

### Project-local rules

The `create-rule` plugin skill scaffolds a target's own rule into `.claude/rules/project/<subdir>/<slug>.md`, taking a slug free in that subdir. That folder sits beside `.claude/rules/canon/` rather than inside it.

`canon gov sync` walks only `.claude/rules/canon/`, since `createGovAdapter` narrows its `installedRoot` to the toolkit-owned folder. A project rule is never read, matched, or classified, and cannot collide with a later toolkit rule taking the same name inside `canon/`.

- A file under `.claude/rules/canon/` that no toolkit source names is classified `orphaned`, and the report offers no destination, since that folder is replaced wholesale on sync
- The toolkit cannot tell a stale toolkit file at a flat path from a project rule of the same name, so neither gets a suggested move
- The stamp cannot separate a renamed toolkit rule from a project-authored one either, since `recordStamp` skips a file whose source is gone and `writeStamp` replaces the domain's whole `files` map
- A renamed rule's entry therefore survives one sync past the rename, and a target installed before stamping carries none, so the notice for such a file stays conditional

## Gotchas

### Stale copies and dead globs

A widened source rule fails `bun run check` until its consumed copy is committed. The Consumed copies stage regenerates `.claude/rules/` and turns the diff into a failure. A glob matching nothing does not error, so the gate catches a stale copy rather than a dead glob.

Moving the files a rule governs breaks the rule twice. The `paths:` glob stops matching, so the rule stops loading for its surface, and the body still describes the old layout. No stage reports either half, so grep `governance/rules/` and `internal/rules/` whenever a branch moves a governed path.

### Rules no stack names

A rule in a folder no stack names installs for nobody. `canon/context/governance/stacks.md` covers why `code` is the one folder a stack takes whole and the stage that reports the gap.

Sync never retracts a rule a target's stack stopped naming, since `locateSource` matches a held basename in any folder. A `base` target installed before the audience regroup keeps `testing` under `core/` and `ci-workflow` under `ci/`, so moving a rule between stacks reaches new installs only. The stray folders cost orientation, nothing at load.

### Counts

Adding a rule stales every hardcoded rule count in the context entries and `docs/`. Run `canon gov counts` after the rule lands, fix each figure it names, and re-run it until clean.

Three figures move independently: the authored total under `governance/rules/`, the consumed total under `.claude/rules/`, and what `base` resolves to, which `canon gov list --json` reports.

### Shipped rules reaching beyond governance

A shipped rule can point at something a governance-only target lacks.

A rule naming a plugin skill, such as the markdown rule, `worktrees`, or `git`, tells the session to report the missing skill, which surfaces the gap without closing it.

- A rule naming a `canon` verb, such as `canon gov test-order`, sits on the slow side of the gap in `canon/context/claude-plugin/distribution.md`, since the verb waits on a release, unseen
- A rule publishing a heading some command parses is program input, as `src/comments/vocabulary.ts` reads whichever rule publishes `## Degradation vocabulary`
- Adding that heading elsewhere changes what `canon comments scan` sweeps for, so grep for a reader before writing the rule, as `internal-rule-audit` does per rule
- A glob can reach well past one folder, as `canon/indexes.md` globs `**/index.md` and reaches every folder in the tree

### Descriptions that break YAML

A `description` holding a bare word, a colon, and a space breaks `Bun.YAML.parse`, which reads the shape as a nested key. `parseFrontmatter` treats the unparsable block as absent, so `canon gov list` and the citation check list the rule as unscoped rather than naming the colon.

Rephrase the description rather than quoting it, since every other frontmatter example here is unquoted.
