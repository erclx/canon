# Canon

A CLI and Claude Code plugin. What it is for, its goals, and its constraints are in `canon/REQUIREMENTS.md`, imported below.

## Behavior

- When reading toolkit state, prefer a CLI verb over inspecting the files yourself, since the verb is the surface under test.
- When directing the user to a skill, give the exact command with its arguments, or say it runs bare.
- Default to `bunx -y <pkg>` for one-shot package execution. Mention `npx` only as a fallback.

## Content ownership

Each rule or fact lives in one surface. Others point at it. `canon/context/context-model/overview.md` carries the test that sorts a fact between surfaces.

| Kind of content                                                        | Owner                                                               |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Identity, goals, non-goals, constraints                                | `canon/REQUIREMENTS.md`                                             |
| A decision filling an architecture slot, with its rejected alternative | `canon/ARCHITECTURE.md`                                             |
| Behavior every session needs                                           | `CLAUDE.md`                                                         |
| Behavior that fires on a path being edited                             | `governance/rules/`, or `internal/rules/` for this repository alone |
| Shape of an artifact many sessions edit                                | `standards/`                                                        |
| What a session needs when editing domain X                             | `.claude/skills/internal-<X>/SKILL.md`                              |
| Narrative, decisions, and gotchas for one domain                       | `canon/context/<X>/`                                                |
| Consumer-facing reference                                              | `docs/`, with the CLI contract in `docs/agents/`                    |

A fact more than one domain reads is canonical. A fact one domain reads belongs to that domain, however important.

## Domains

Load the skill before editing anything in its domain.

| Task type                                                                    | Skill                 |
| ---------------------------------------------------------------------------- | --------------------- |
| `src/`, `scripts/`, `sandbox/`                                               | `internal-scripts`    |
| `tooling/`, manifests, golden configs, seeds                                 | `internal-tooling`    |
| `standards/`, `docs/`, `canon/context/`                                      | `internal-standards`  |
| `governance/rules/`, `governance/stacks/`                                    | `internal-governance` |
| `claude/skills/`, `claude/README.md`, `.claude/skills/`                      | `internal-claude`     |
| `web/`, `assets/`, the landing page                                          | `internal-web`        |
| `src/teach/`, `examples/teach/`, `claude/skills/teach-workspace/references/` | `internal-teach`      |
| `src/canvas/`, `src/commands/canvas.ts`                                      | `internal-canvas`     |

@canon/REQUIREMENTS.md
@canon/ARCHITECTURE.md
@canon/context/index.md

## Key paths

- `governance/rules/`: governance rules that ship to targets
- `internal/`: toolkit-only rules and standards, outside every installable surface
- `standards/`: authoring conventions, read through `canon standards <name>`
- `tooling/`: golden configs, references, and manifests per stack
- `claude/skills/`: plugin skills installable in target projects
- `src/`: the TypeScript CLI, including the product verbs
- `scripts/`: remaining bash and maintenance scripts
- `sandbox/`: scenarios, fixtures, and the headless runner
- `web/`: the landing page, deployed on its own
- `examples/`: worked examples of the product outputs
- `wiki/`: reference pages for Anthropic-owned subjects

## Commands

- Run `bun run check` to verify and `bun run format` to fix before committing. The pre-push hook runs `check` and may reformat files, so after `git push` run `git status` and commit any diff as `style(<scope>):`. Full reference in `canon/context/development/index.md`.

## Wiki

- Before answering a how-to question about an external tool or a Claude Code concept, scan `wiki/index.md`, then the role catalog it links. Reference detail comes from the page's `Source:` link, fetched live, and the wiki answers only orientation and lessons. Workflow, shell, and target-project questions are answered from `docs/index.md`.
