# Canon

A CLI and Claude Code plugin. What it is for, its goals, and its constraints are in `canon/REQUIREMENTS.md`, imported below.

## Behavior

- When reading toolkit state, prefer a CLI verb over inspecting the files yourself, since the verb is the surface under test.
- When directing the user to a skill, give the exact command with its arguments, or say it runs bare.
- Default to `bunx -y <pkg>` for one-shot package execution. Mention `npx` only as a fallback.

## Content ownership

Each rule or fact lives in one surface. Others point at it. `canon/context/context-model.md` carries the test that sorts a fact between surfaces.

| Kind of content                                                                 | Owner                                                                     |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Identity, goals, non-goals, constraints                                         | `canon/REQUIREMENTS.md`                                                   |
| Behavior every session needs                                                    | `CLAUDE.md`                                                               |
| A path-scoped pointer to a skill, or a floor no skill carries                   | `governance/rules/`, or `internal/rules/` for this repository alone       |
| Practice a session applies when building or reviewing in a domain               | the owning plugin skill's `references/`                                   |
| Sources or decisions behind a toolkit rule, or sources behind a skill reference | `governance/ledger/`                                                      |
| Shape of an artifact many sessions edit                                         | the owning skill's `references/`                                          |
| What a session needs when editing domain X                                      | `.claude/skills/internal-<X>/SKILL.md`                                    |
| What a domain does, where it lives, and the traps a session would hit in it     | `canon/context/<X>/`                                                      |
| Consumer-facing guides and the reference for verbs run by hand                  | `docs/`, with a skill-only verb covered by its calling skill and `--help` |

A fact more than one domain reads is canonical. A fact one domain reads belongs to that domain, however important.

## Domains

Load the skill before editing anything in its domain.

| Task type                                               | Skill                 |
| ------------------------------------------------------- | --------------------- |
| `src/`, `scripts/`, `sandbox/`                          | `internal-scripts`    |
| `tooling/`, manifests, golden configs, seeds            | `internal-tooling`    |
| `docs/`, `canon/context/`                               | `internal-docs`       |
| `governance/rules/`, `governance/stacks/`               | `internal-governance` |
| `claude/skills/`, `claude/README.md`, `.claude/skills/` | `internal-claude`     |
| `web/`, `assets/`, the landing page                     | `internal-web`        |

@canon/REQUIREMENTS.md
@canon/context/index.md

## Key paths

### Shipped surfaces

What install and sync carry into a target, beside the rules that never leave.

- `governance/rules/`: governance rules that ship to targets
- `internal/`: toolkit-only rules, outside every installable surface
- `tooling/`: golden configs, references, and manifests per stack
- `claude/skills/`: plugin skills installable in target projects

### Code

The programs that build, test, and serve the toolkit.

- `src/`: the TypeScript CLI, including the product verbs
- `scripts/`: remaining bash and maintenance scripts
- `sandbox/`: scenarios, fixtures, and the headless runner
- `web/`: the landing page, deployed on its own

### Reference

Material a session reads for orientation rather than edits as part of a feature.

- `examples/`: worked examples of the product outputs
- `wiki/`: reference pages for Anthropic-owned subjects

## Commands

- Run `bun run check` to verify and `bun run format` to fix before committing. The pre-push hook runs `check`, which fails on formatting drift and writes nothing for it. Full reference in `canon/context/development/local-loop.md`.

## Wiki

- Before answering a how-to question about an external tool or a Claude Code concept, scan `wiki/index.md`, then the role catalog it links. Reference detail comes from the page's `Source:` link, fetched live, and the wiki answers only orientation and lessons. Workflow, shell, and target-project questions are answered from `docs/index.md`.
