# Canon

A CLI and Claude Code plugin. What it is for, its goals, and its constraints are in `canon/REQUIREMENTS.md`, imported below.

## Behavior

- When reading toolkit state, prefer a CLI verb over inspecting the files yourself, since the verb is the surface under test.
- When directing the user to a skill, give the exact command with its arguments, or say it runs bare.
- Default to `bunx -y <pkg>` for one-shot package execution. Mention `npx` only as a fallback.
- Each rule or fact lives in one surface, and others point at it. Read `canon/context/context-model.md` before placing a new one.
- For a Claude Code or external-tool question, start at `wiki/index.md` and answer from the page's live `Source:` link. Workflow, shell, and target-project questions start at `docs/index.md`.

## Domains

Load the skill before editing anything in its domain.

| Paths                                    | What it holds                                                 | Load                  |
| ---------------------------------------- | ------------------------------------------------------------- | --------------------- |
| `src/`, `scripts/`, `sandbox/`           | The CLI, the bash and maintenance scripts, the test scenarios | `internal-scripts`    |
| `tooling/`                               | Golden configs, seeds, references, and manifests per stack    | `internal-tooling`    |
| `governance/`                            | Rules and stacks that ship to targets                         | `internal-governance` |
| `claude/`, `.claude/skills/`, `plugins/` | Plugin skills, internal skills, opt-in bundles                | `internal-claude`     |
| `docs/`, `canon/context/`                | Consumer guides and context entries                           | `internal-docs`       |
| `web/`, `assets/`                        | The landing page and its images                               | `internal-web`        |

`internal/` holds toolkit-only rules, and `examples/` and `wiki/` are for reading. None of the three has a skill.

@canon/REQUIREMENTS.md
@canon/context/index.md

## Commands

- Run `bun run check` to verify and `bun run format` to fix before committing. The pre-push hook runs `check`, which fails on formatting drift and writes nothing for it. Full reference in `canon/context/development/local-loop.md`.
