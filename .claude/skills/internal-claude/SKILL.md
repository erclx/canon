---
name: internal-claude
description: Claude Code plugin and tooling. Use for adding or modifying plugin skills, the `CLAUDE.md` seed, `canon claude` commands, or the Claude context entries.
---

# Claude

Read `canon/context/claude-plugin/index.md` for the shipped plugin and `canon/context/claude-internal/index.md` for internal skills and plugin setup before editing. Everything about the skills themselves sits in the `skill-*` children the plugin index lists, one per sub-area.

- `canon/context/claude-plugin/distribution.md`: marketplace and release wiring
- `canon/context/claude-plugin/cli.md`: `canon claude`
- `canon/context/claude-plugin/boundaries.md`: overlap with built-in features

## Editing rules

- When updating an internal skill, write to `{base-dir}/SKILL.md`, where `{base-dir}` is the path the skill header shows at load time
- Read `canon/context/claude-plugin/skill-strategy/overview.md` before adding a plugin skill and `canon/context/claude-internal/skills.md` before adding an internal one
- Run `canon claude skills list` for the plugin roster, which no entry restates
- Follow `claude/skills/create-skill/references/skill.md` for skill structure and frontmatter

Audit a skill body against four sources, each owning one concern.

| Source                                                 | Covers                                                               |
| ------------------------------------------------------ | -------------------------------------------------------------------- |
| `claude/skills/create-skill/references/skill.md`       | Structure and frontmatter                                            |
| `claude/skills/create-skill/references/skill-paths.md` | Which root a path resolves against, citing another skill's reference |
| `claude/skills/markdown-craft/references/markdown.md`  | Word choice, punctuation, and formatting                             |
| The `write-human` skill                                | Voice and rhythm                                                     |

## Authoring conventions

Write a new skill only when it encodes workflow specific to this toolkit or a convention the author consistently applies. The test is whether the same skill would be invoked on every target project the author owns.

- Install a community skill for domain expertise the toolkit does not maintain, such as frontend design or security audits, and reference it in per-tier install recommendations rather than absorbing it
- When a fix could live in a skill body or a seed, default to the skill, and lift it into shared infrastructure on the second concrete case
- Never fork a community skill. Propose a thin wrapper composing the upstream one, and fork only when upstream diverges hard from a stated need and the maintenance cost is accepted explicitly.

`canon/context/claude-plugin/skill-strategy/overview.md` carries the reasoning, and `canon/context/claude-plugin/skill-strategy/redundancy-audit.md` the redundancy audit.

### Skill bodies and references

A task skill with a preview and execute pattern runs its commands right after the preview. Claude Code's permission dialog is the confirmation gate, so the user approves with Enter or interrupts with Escape, and the body adds no confirm step.

- When a skill persists output to `.claude/`, cite `claude/skills/git-branch/references/slug.md` and state which empty case it takes, rather than restating the derivation
- Never reference a repo-local path such as `wiki/` from `claude/skills/`, since it resolves to nothing in a target and the Skill paths stage of `bun run check` fails on it
- Reach supporting prose from a shipped skill through a `canon docs <topic>` command, a bundled reference a `consumers:` field copies in, or text inlined in the body
- Internal skills under `.claude/skills/` take the `internal-*` prefix, and `canon-*` marks a toolkit-subject plugin skill. Flag a plan naming an internal skill `canon-*` before creating the folder.

### Handoff, hooks, and defaults

A plugin skill test handed off from a linked worktree prints two lines, a `cd` to the sandbox path and then `claude --plugin-dir <worktree-root>/claude --model sonnet`. Without `--plugin-dir`, Claude loads main's stale copy.

- Propose a husky hook rather than a `CLAUDE.md` or skill bullet for unconditional pre-push or per-edit automation, since `CLAUDE.md` fires only while Claude acts and a hook fires for everyone
- A PostToolUse hook such as `standards-audit` ships punctuation bans and closed-set wordlists, read from the standard at runtime rather than copied
- Keep structural checks such as negative parallelism, hollow openers, and paragraph length out of a hook, since regex detection on those fires against legitimate prose
- Default cross-project behavior rules, such as output formatting and path printing, to the seeded `CLAUDE.md` plus the toolkit's own. Reserve `~/.claude/` for terminal capability and machine specifics.

## Plugin variables

- `$CLAUDE_PLUGIN_ROOT` and `$CLAUDE_PROJECT_DIR` are empty in model Bash. Resolve a plugin or project path another way when a skill or hook step runs through the Bash tool.

## Couplings

Before shipping a change to the seed, a plugin skill, or a `.claude/` state doc, grep for the identifier you are changing. Check plugin skills for quoted seed section headings and the Claude context entries for skill descriptions.

When editing any file under `.claude/` here, check `tooling/claude/seeds/` for a mirror path and `tooling/claude/reference.md` for a description that needs updating.

## Sync checklist

Adding a skill touches the catalog, the skill map, the family key, a scenario, a routing case, and the hero.

- Create the skill folder and `SKILL.md` in `claude/skills/`
- List an internal skill in `canon/context/claude-internal/skills.md`. A plugin skill needs no catalog edit, and takes a `skill-*` entry only for reasoning no existing child covers.
- Add a row to the skill's group in `docs/workflow/skill-map.md`, or in `skill-map-on-request.md` beside it for the artifact and question groups. Every listed name takes exactly one row across the two.
- Set `metadata.family` to the group's key from `canon claude skills list --json`. The Skill family gate stage fails a skill without one, and the web build refuses a row under another group.

### Scenario, routing, and hero

Draft a `sandbox/<category>/<skill>.ts` scenario beside `SKILL.md`, even for judgment-driven output, since the seeded input is the point. Skip it, and list no follow-up, only for a skill whose body forbids probing, listing, grepping, or reading project surfaces.

- `canon sandbox run <cat:cmd> "<prompt>"` drives the arm through `claude -p`, so the sandbox can drive Claude
- The operator authorizes the spend and the session performs it, per `canon/context/scripts/eval.md`
- `src/claude/cases/all.test.ts` fails `bun run check` until a routing case for the new skill lands in one of `src/claude/cases/*.ts`
- A changed skill count fails the Hero gate stage until `bun scripts/core/regen-hero.ts` runs and `canon capture assets/captures --selector .window --out assets/frames` re-renders the frame
- Commit the hero markup, the image, and the stamp together

`canon/context/claude-plugin/skill-procedures/overview.md` records why for the last two.

### Modifying a skill

Read the skill's sibling `REQUIREMENT.md` first when one exists. A change closing no gap it states changes the requirement first or is dropped.

- Update the matching bullet in `canon/context/claude-internal/skills.md` when an internal skill's description changes. A plugin skill's description is read from its own frontmatter.
- Update the paired scenario in `sandbox/` when the skill's behavior changed
- Run `/internal-sandbox-check` before shipping to audit which skills changed without a paired scenario edit

### Modifying either CLAUDE.md

The root file and its seed are paired by `internal/rules/claude/seed-mirror.md`, which fires on an edit to either and holds the mirroring split alone. The routing criterion is the tier test in `canon/context/context-model.md`.

The seed's "Context" section defines the three-tier context model, so keep it coherent with the same model in `canon/context/context-model.md`.

## Reference

The context entries and seeds this skill draws on, beyond the ones named above.

- `canon/context/claude-plugin/`: skill strategy, requirements, lifecycle, review paths, shared procedures, distribution, the CLI, and built-in overlap
- `canon/context/claude-internal/`: internal skills, orchestration, plugin discovery
- `canon/context/context-model.md`: three-tier context model and how entries get populated
- `canon/context/context-model.md`: index.md system rationale and contracts
- `tooling/claude/reference.md`: seed layout and design notes
