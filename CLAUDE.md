# Toolkit Context

CLI toolkit for managing AI workflows, developer standards, and project tooling across repositories.

## Design principles

The toolkit is agent-first. Every surface is designed so a Claude Code skill or other agent can orchestrate it as well as a human. When adding or changing a CLI command, verify each of these holds.

Worldview and goals live in `.claude/REQUIREMENTS.md`. The rules below derive from it.

- Every command has a non-interactive path via args or `CANON_NON_INTERACTIVE=1`. Never require a TTY.
- Data goes to stdout. UI and logs go to stderr. JSON output must pipe clean through any wrapper.
- Every domain has a `list` command with `--json` so skills read catalogs at runtime. Never hardcode names in skills.
- Extend existing commands with flags over creating bespoke variants. Prefer `--add` and similar composition over stack explosion.
- The toolkit is the source of truth. Authoring happens here, target projects consume via install and sync.
- Skills detect and call the CLI. They do not reimplement CLI logic. A session reading toolkit state prefers a CLI verb over its own inspection wherever one exists, since the verb is the surface under test and a hand-rolled read of the same files is not.
- This repo is behavior-heavy. Planning and review are the work here, so a higher supervision ratio than a typical app repo is expected.
- Toolkit surfaces stay general-purpose. Map to external-tool schemas in a thin sync adapter rather than adopting them as the canonical shape.

## Behavior

### Before editing

- Plan before editing: propose what files will change and why before touching anything
- Confirm with the user before making any edits
- When directing the user to invoke a skill, give the exact command with args, or state explicitly that it runs bare

### Scope discipline

- Do not add CLI flags or aliases the user did not ask for. When a fix has a natural mirror in a template or seed, flag it as a follow-up rather than silently extending the PR.
- Before restructuring installable content (`snippets/`, `claude/skills/`, `tooling/`, `governance/rules/`), grep the corresponding install and list scripts for depth constraints (`-maxdepth`, fixed globs). Bundle script updates with the restructure or pick a depth the scripts already handle.
- Before queuing or starting a new feature, confirm a concrete project or use case drives it. If precedent exists, lift patterns from that project rather than writing from scratch.

### Choices and mechanics

- Default to `bunx -y <pkg>` for one-shot package execution. Mention `npx` only as a fallback for environments without bun.
- Prefer a single-path layout over dual-mode toggles or migration shims when one path works for both greenfield and grown projects. Skill complexity from branching read paths costs more than the extra folder or index file in the simple case.
- When a fix could plausibly live in either a skill body or a seed, default to skill-local. Wait for a second concrete case before lifting the helper into shared infrastructure.
- When encoding a fix into a skill, standard, or seed, lift the principle from target-project specifics. Strip reporter-named filenames, framework names, deploy targets, and project-specific label values. Keep canonical format specs and generic illustrations that teach the structure without overfitting.
- When triaging a multi-topic request or scoping a rule, enumerate every concern or surface and account for each. Do not silently drop the non-obvious ones.
- `$CLAUDE_PLUGIN_ROOT` and `$CLAUDE_PROJECT_DIR` are empty in model Bash.

## Conventions

- Update affected consumer docs in `docs/` as part of the change, through the `canon:docs-sync` skill. No rule is scoped to that folder.

## Content ownership

Each rule or knowledge item lives in exactly one surface. Other surfaces point, never duplicate.

- Cross-domain behavior or design principle: `CLAUDE.md`
- Cross-domain decision with its rejected alternative: `.claude/ARCHITECTURE.md`
- Behavior that fires on a path being edited rather than every session: `governance/rules/`
- Behavior triggered only when editing domain X: `.claude/skills/internal-<X>/SKILL.md`
- Per-domain internal narrative about domain X (structure, decisions, gotchas): `.claude/context/<X>.md`
- Consumer-facing reference (AI workflow, target-project integration): `docs/`
- CLI command surface or invocation contract: `docs/agents/`

When adding new content, place it in the canonical owner. If another surface needs awareness, add a one-line pointer.

The test between a canonical row and the per-domain one is how many domains read the fact. More than one makes it canonical. Exactly one makes it per-domain, even when the fact is important, because importance is not reach.

## System overview

The toolkit has the following domains. Each maps to a skill. Load the skill before editing anything in that domain.

| Task type                                                                         | Skill to load         |
| --------------------------------------------------------------------------------- | --------------------- |
| Modifying `src/`, `scripts/`, sandbox scenarios, `manage-*.sh`, `lib/`, `assets/` | `internal-scripts`    |
| Modifying `tooling/`, manifests, golden configs, seeds                            | `internal-tooling`    |
| Modifying `standards/`, `docs/`, `.claude/context/`                               | `internal-standards`  |
| Modifying `governance/rules/`, `governance/stacks/`                               | `internal-governance` |
| Modifying `snippets/`                                                             | `internal-snippets`   |
| Modifying `claude/skills/`, `claude/README.md`, `.claude/skills/`                 | `internal-claude`     |

The per-domain context catalog is always loaded so the entries are discoverable without a lookup. Load each entry on demand.

@.claude/ARCHITECTURE.md
@.claude/context/index.md

## Key paths

- `governance/rules/`: governance rules
- `internal/`: toolkit-internal standards, snippets, and rules, plus the record of which governance stack this repo consumes, all outside every installable surface
- `standards/`: authoring conventions, read through `canon standards <name>` rather than installed
- `tooling/`: golden configs (base), references, and manifests per stack
- `claude/skills/`: plugin skills installable in target projects
- `.claude/skills/`: internal skills, toolkit repo only
- `.claude/context/`: per-domain internal narrative (how each domain is built, decisions, gotchas), indexed via `.claude/context/index.md`
- `snippets/`: reusable prompt snippets, invoked by `@` reference in a Claude Code session
- `src/`: TypeScript CLI entry point, commander subcommands, exec helper
- `docs/`: consumer-facing reference (CLI surface, AI workflow, target-project integration, and the workflow method this repo runs on)
- `scripts/`: bash domain scripts, core maintenance, sandbox, and prompt generation
- `wiki/`: reference pages for tools and concepts owned outside this repo, split into `claude/`, `tools/`, and `concepts/` by who owns the subject

## Commands

- Run `bun run check` to verify and `bun run format` to auto-fix before committing. The pre-push hook runs `check` and may reformat files, so after `git push` run `git status` and commit any diff as `style(<scope>):`. Full script and hook reference in `.claude/context/development/index.md`.

## Tasks

- Never hand-edit `.canon/tasks/index.md`. A hook regenerates it from sibling frontmatter.

## Parallel sessions

- Independent feature tracks can run concurrently in git worktrees. See `wiki/claude/claude-worktrees.md` for the fan-out rules and which domains are safe to parallelize vs which must serialize.

## Wiki

- Before answering a how-to question about an external tool or a Claude Code concept, scan `wiki/index.md`, then open the matching role catalog it links to reach the page titles. Workflow method, shell environment, and target-project questions are answered from `docs/index.md` instead.
