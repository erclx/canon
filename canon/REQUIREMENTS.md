# Requirements

Describe what the toolkit does and why, rather than how it works. Domain architecture lives in `canon/context/<domain>.md` and behavioral rules live in `CLAUDE.md`.

Update this doc when scope changes, goals shift, or a non-goal is promoted to a feature.

What belongs:

- The problem being solved and for whom
- Worldview: the beliefs about AI tooling that shape every decision in this repo
- User-facing goals stated as outcomes, not implementation
- Explicit non-goals: scope boundaries that prevent feature creep. Mark deferred items "(deferred)" to signal they are not permanently excluded.
- MVP features as a numbered list: feature name and one-line description. No implementation detail.
- Distribution outcomes, stated as what a user outside this repository can do. The MVP list stays as written once shipped, so later scope lands in its own section.
- Tech stack as a plain list of tools. Rationale lives in the relevant `canon/context/<domain>.md`.
- Hard constraints that shape all decisions

What does not belong:

- Implementation details, API names, or internal component references
- Rationale for tech choices. That lives in the relevant `canon/context/<domain>.md`.
- Anything that describes how a feature is built rather than what it does

## Worldview

- Code is free. Context and human attention are scarce.
- Claude Code is the platform. Tools live inside it or attach to it through skills, hooks, and the plugin system.
- Humans stay in the loop only where judgment is non-obvious. Process and planning are where the return is largest.
- The toolkit is agent-first throughout. Human-friendly UX layers on top where needed.
- Consistency is a prompt. Same patterns across domains reduce context load and make refactors cheap.
- A rule a model can ignore needs a check that fails. Prose sets the intent and a hook, a stage, or a gate is what makes it hold.
- A custom mechanism is preferred over a platform-native one only until the platform ships an equivalent. From there, migrating onto it is the default, and staying custom takes a reason the platform does not cover.
- A bottleneck is a defect to remove, not a constant to design around.

## Problem

Every repository accumulates the same boilerplate: governance rules, prose standards, Claude Code skills, snippet libraries, seed docs, sync scripts. Re-authoring these per project wastes time and drifts over time. Without a central source, rules diverge and agents cannot rely on consistent signals across projects.

## Goals

- Agent-first CLI surface with non-interactive paths, JSON catalogs, and composable flags on every command.
- One authoritative source for governance rules, prose standards, Claude seeds, and workflow skills.
- Installable Claude Code plugin that brings a curated skill set to any project scaffolded through `canon`.
- Behavior and conventions captured as text that both humans and agents can read and enforce.
- Low-friction install and sync so target projects pull updates without hand-patching.

## Non-goals

- Replace human code review on risky changes. Agents augment the review loop. Humans still own the final call.
- Ship runtime dependencies or application code to target projects. The toolkit ships configs, seeds, snippets, and rules, plus code proven to leave the production build: either stripped by a build-time flag such as `import.meta.env.DEV` and confirmed absent from the built output, or never reached from any production entry point, which is what already carries the toolkit's test infrastructure (an e2e spec, a Playwright and a Vitest setup file, and a Python test seed). This carve-out does not cover code that runs in the shipped application under any condition, does not exempt a component merely because its intent is developer-facing, and does not waive verifying the exclusion for each instance that claims it. Native `canon` commands may shell out to user-installed external binaries, which is distinct from installing code into a target project.
- Ship first-class support for every AI coding tool. Claude Code is the platform the toolkit targets. Extending to another tool stays open (deferred), but no parallel surface is maintained without a concrete use case driving it. A comparably-shaped project making the opposite call pays it directly: two skill trees, 29 identical files, 3,905 lines kept aligned by discipline alone.
- Wrap framework scaffolding. Users run `bun init`, `npm create vite`, and similar themselves. The toolkit layers on top.
- Provide a hosted service. Everything runs locally against local CLIs. Publishing an artifact to a registry someone else hosts stays in scope, since the boundary is where execution happens rather than where a download comes from.

## MVP features

1. `canon init`: one-shot bootstrap that layers base tooling, Claude seeds, governance, and snippets into a project, and scaffolds an empty `.claude/wiki/` for the project's own authoring.
2. Per-domain `list`, `install`, and `sync` subcommands so skills can read catalogs and apply updates.
3. Governance stacks and rules installed as path-scoped files in `.claude/rules/`.
4. Claude Code plugin with skills covering planning, review, architecture diagrams, UI tests, docs sync, memory review, and the git ship chain.
5. Sandbox scenarios that provision representative project states for verifying each domain flow.
6. Prose, commit, branch, PR, and skill authoring standards synced into every project.
7. Snippets for recurring chat workflows.
8. `canon transcripts`: fetch a YouTube transcript with metadata frontmatter into the current repo.

## Distribution

The scope that followed the MVP. What the toolkit has to achieve for a user who is not the maintainer and not on this machine.

- Install without cloning: a user can get the toolkit onto a machine and use it without copying this repository by hand.
- Know and change version: a user can tell which version they are running and move to a different one without rebuilding their setup.
- Contribute unaided: a user can find what the project expects of a change and open one that fits, without a maintainer explaining the conventions.

## Tech stack

- Bun for CLI runtime, scripts, and the test runner
- TypeScript with Commander for the CLI entry point, every domain command surface, and the sync engine
- Bash 4+ for sandbox provisioning, repo maintenance under `scripts/core/`, shared lib functions, hooks, and three toolkit-internal authoring helpers (`tooling verify`, `tooling create`, `snippets create`) plus three list verbs that read frontmatter per file. Each remaining area carries a written verdict in `canon/context/scripts/overview.md`
- Markdown for all authored content
- Git and GitHub CLI for ship workflows

## Constraints

- Every command must have a non-interactive path via args or `CANON_NON_INTERACTIVE=1`. Never require a TTY.
- JSON output on `list` commands must pipe clean through any wrapper. UI and logs go to stderr.
- Human-readable output carries color only where a destination renders one. `NO_COLOR` and a destination that is not a terminal each turn it off, asked per stream rather than once for the process, and the frame survives either way.
- The toolkit is the authoritative source. Target projects consume via install and sync, never author in place.
- Skills detect and call the CLI. They do not reimplement CLI logic.
- Authored content follows `standards/markdown.md` and the `write-human` skill. No em dashes, no semicolons, no marketing buzzwords.
