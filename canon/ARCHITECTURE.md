# Architecture

Authoring guidance: `standards/architecture.md`.

## Overview

The toolkit is a CLI plus a Claude Code plugin, built so an agent can drive every surface a human can. Content is authored once at a project-root folder, consumed here through a generated copy under `.claude/`, and reaches a target project either by a `canon` install command or by loading live from the plugin root.

Five domains carry the weight: governance rules, standards, tooling stacks, plugin skills, and the CLI that installs them. This file holds only the decisions that fill one of five slots: stack and runtime, delivery, enforced boundaries, layout, and build principles. Every other decision lives in the `canon/context/<domain>.md` entry for the domain it constrains, which is also where a reader goes for how rather than why.

This record holds at most 12 decisions, and the Architecture record stage in `bun run check` fails a push past that cap.

## Key technical decisions

### TypeScript on Bun, with a bash exec boundary

`src/` parses arguments and owns every migrated domain, and `scripts/` holds what has not moved, with domains migrating one verb at a time rather than in a single rewrite. Bash keeps only what it is good at, such as `read_frontmatter_field` called once per field inside a list loop, where routing through the CLI would cost a process per read. Coarse operations called once per invocation shell into `canon` instead.

`bin` points at `src/cli.ts` and its `#!/usr/bin/env bun` shebang runs the source directly, so the package ships TypeScript and nothing compiles. Node with a build step was the alternative, and it costs a publish pipeline plus a `dist/` that can drift from the source a contributor reads. The trade is that the CLI does not run under Node at all, since `Bun.Glob`, `Bun.TOML`, and `Bun.YAML` stand in for globbing and parser dependencies, so a target needs Bun on the machine rather than only a package manager.

### Two delivery paths rather than one

`canon` commands copy governance rules, tooling configs, and design files into a project, and the marketplace plugin loads skills live from `claude/`. A single channel was the obvious alternative, and neither channel does the other's job. Copied content is what a project edits and owns, so it lands as real files under version control, while a skill is toolkit-owned process that goes stale the moment it is copied.

What the split costs is a citation crossing it, since a skill body naming an installed path resolves only for a project that ran the matching install and an unresolved path raises nothing until a session opens it. A file only one skill reads therefore travels inside that skill, which is what moved the three orchestrator runbooks into `claude/skills/role-orchestrator/references/`. Publishing on both surfaces was the alternative, and it makes two sources for one text.

### Something other than the model resolving a file by path decides whether it installs

A domain installs as a file when something other than the model resolves it by path, and ships as a command when only a session's own judgment would open it. The harness glob-loads a governance rule, and a target's own build tooling reads a tooling config or `.claude/design/base.css` straight off its path, so none needs a command in the loop. A standard is the one domain the model opens on purpose, which is why `canon standards` carries no install and no sync. Deciding per domain case by case lost to writing the criterion down, and nothing checks that a new domain answers it the same way. `canon/context/standards/resolution.md` carries the closed install channel for standards and tooling references.

### Skills call the CLI and never reimplement it

A plugin skill reads a catalog through `canon <domain> list --json`, matches it against project context, then executes the CLI under `CANON_NON_INTERACTIVE=1`. Every domain owes a `list` verb with `--json` and no skill hardcodes a rule or stack name, which keeps one behavior in one place rather than restated in a skill body that could drift from the CLI on its own cadence.

The rule covers a catalog and stops at a document, so a skill reads a standard by path off the `claude/standards` symlink, while a rule, which a glob match loads with no skill context, names `canon standards <name>` instead.

### Location enforces the plugin boundary

Toolkit-internal content lives under `internal/`, a tree nothing inside `claude/` reaches. `scripts/core/check-plugin-boundary.sh` walks the shipped tree with symlinks followed and fails on any file resolving under `internal/`. A filter at each CLI entry point was the alternative and it failed in production, since `claude/standards` and a since-retired `claude/snippets` were symlinks an installer dereferences with nothing left in the path to filter, which let five internal files reach every plugin cache. `SyncAdapter.projectSubdir` answers the same question inside the sync engine, recorded in `canon/context/cli/sync.md`.

### Three tiers of context, bounded by slots

Context splits three ways: `CLAUDE.md` and this file load eagerly, `.claude/rules/` load on glob match, and `canon/context/<domain>.md` is read on demand. One large `CLAUDE.md` was the starting point and grows without bound. Nested `CLAUDE.md` files below the cwd were the other candidate, and they load cheaply but announce nothing, so a session never learns they exist. The `index.md` catalog is what the third tier buys, since it lists every entry up front.

The eager tier is bounded by what it may hold rather than by how many domains a fact reaches. Reach always passes, since nearly every decision touches two domains, which is how this file grew to forty entries and about 15k tokens loaded into every session. A decision lands here only when it fills a slot, and a domain context entry is its default home otherwise. A numeric ceiling on the file's length was tried first and dropped, since nothing enforced it and every merge drifted past it. The entry cap holds where that ceiling did not because the Architecture record stage fails a push on it. `canon/context/context-model/overview.md` carries the test that sorts a fact between a rule, an entry, and a skill. Measured at `6b12dfa3` on 2026-09-19.

### Whether a file is committed, and whether Claude Code reads it, decides which root it sits under

Three roots split the project on two tests applied in order. Whether a file is committed separates `.canon/`, which takes every gitignored session record, from the other two. Whether Claude Code reads it by path then separates `.claude/`, which keeps `rules`, `skills`, `hooks`, and `settings.json`, from `canon/`, which keeps what the toolkit authors and commits. Both lines are mechanical rather than conceptual, which is the whole of their value.

The committed test alone was the alternative, and it left tracked content the harness never opens sharing a root with the files it loads. Sorting by what a folder is for was an earlier alternative still, and it lost because every new record folder needed a reader to judge it and then an ignore line to be written. `canon/context/context-model/overview.md` carries what each root holds, the two carve-outs under `.claude/`, and how the move ran.

### Build principles

Four principles decide how a behavior is built, and each domain entry carries its own instances.

- A hook, a gate stage, or a verb enforces what prose only states, since a rule written in a standard fires only when a session reads it. The cost is that an enforcement point is code with its own failure modes, so each one says what it does when its inputs are missing rather than reporting a pass.
- A standard governs an artifact's shape and the skill driving it governs the procedure, since a standard covering both hides the enforceable half behind the judgment half.
- A rule the model can talk itself out of moves into a verb, since an instruction is a hope and a verb is a check. What stays open is that a body remains free to reorder what the verb reports.
- A safe behavior sits on the default path rather than behind a flag, since a flag you have to remember is one nobody passes the first time, which is when the target still holds the work.

## Risks / open questions

- Skills and the CLI ship at two speeds. A skill merged to `main` reaches a `--plugin-dir` session immediately, while the CLI reaches a user only once a release publishes it, so a skill calling an unpublished verb or flag fails in a target and nothing detects that call.
  - `canon sync --check` and `canon claude skills drift` each read the installed version against the newest published one, but neither reports which verb is missing, and a reader who never runs either is reached by no route at all.
  - A missing subcommand under a command that exists is the quieter failure: a target on an older binary archives a task and leaves its plan live, reporting success either way.
  - Two binaries disagree with the nested plan archive by behavior rather than by version. One reads a nested archived plan as live and refuses, which is the safe direction, and the other writes to a flat `.claude/task-archive/` sibling. The one known target still on the flat layout, `erclx.dev`, has no checkout reachable from this repository to run the move in.
  - `800-prose`, `661-teach`, and `605-worktrees` point at a skill carrier a project installing governance without the plugin does not have. Each rule tells a session to say so, which reports the gap without closing it.
  - An exit code says nothing about a `canon` call here, because an operator's shell profile may wrap the binary in a function whose status comes from a trailing command, which is why every task verb tells a caller to branch on the record's `reason`.
  - `git-pr` calls `canon labels audit` and keeps the stated matching rule as a fallback, and the duplication runs until a release retires it.
- `canon-operator` answers an absent key as unread rather than as empty, a pattern the remaining skills could take rather than a check the repository runs, so the skew can reach a reader as a confident wrong answer.
- A marketplace install is a cached copy, which is the same skew in the other direction, and neither direction is detected.
- The skill-body drift verb answers only when a session runs it, goes quiet on a body the running session edited and has not committed, and refuses in a project consuming the plugin from a cache.
- Verification anchors here have a writer and a sweeper, and the sweeper reaches only what a diff can point at, so an anchor on a decision no branch touches is checked only by a person re-reading it.
- A decision moved to a context entry leaves a pointer with no check behind it, since nothing compares a slot entry against the entry it defers to.
- Two classes of claim stay unflagged: one counting over a tree the branch never opened, and one citing nothing narrower than a single path segment, which is deliberate since a prefix match on `src/` fires on nearly every branch.
- A native Windows checkout without symlink support materializes `claude/standards` as a plain file holding a path, so the plugin ships no standards and no stage notices.
- The cap counts decisions by heading, so a writer at the cap can pack two decisions under one heading and pass. `standards/architecture.md` asks for a merge or a retirement instead, and nothing enforces the difference.
