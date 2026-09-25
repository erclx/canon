---
name: internal-claude
description: Claude Code plugin and tooling. Use for adding or modifying plugin skills, the `CLAUDE.md` seed, `canon claude` commands, or the Claude context entries.
---

# Claude

Read `canon/context/claude-plugin/` for the shipped plugin, starting at its `index.md`, and `canon/context/claude-internal/` for internal skills and plugin setup, also starting at its `index.md`, before editing. The plugin folder carries `canon/context/claude-plugin/distribution.md` for the marketplace and release wiring, `canon/context/claude-plugin/cli.md` for `canon claude`, and `canon/context/claude-plugin/boundaries.md` for built-in feature overlap. Everything about the skills themselves sits in the `skill-*` children that `index.md` lists, one per sub-area.

## Editing rules

- When updating an internal skill, write to `{base-dir}/SKILL.md` where `{base-dir}` is the path shown in the skill header at load time.
- Read `canon/context/claude-plugin/skill-strategy/overview.md` before adding a plugin skill and `canon/context/claude-internal/skills.md` before adding an internal one. Run `canon claude skills list` for the plugin roster, which no entry restates.
- Follow `standards/skill.md` for skill structure and frontmatter conventions.
- Audit skill bodies against `standards/skill.md`, `standards/markdown.md`, and the `write-human` skill. The first covers structure and frontmatter. The second covers the body's word choice, punctuation, and formatting. The third covers its voice and rhythm.

## Authoring conventions

- Write a new skill only when it encodes workflow specific to this toolkit or a convention the author consistently applies. The test: would this same skill be invoked on every target project the author owns?
- Install a community skill rather than writing one when the need is domain expertise the toolkit does not maintain, such as frontend design, security audits, or stack-specific patterns. Reference it in per-tier install recommendations rather than absorbing it.
- Do not fork a community skill. Propose a thin toolkit wrapper that composes the upstream one, and fork only when upstream diverges hard from a stated need and the maintenance cost is accepted explicitly. See `canon/context/claude-plugin/skill-strategy/overview.md` for the reasoning and `canon/context/claude-plugin/skill-strategy/redundancy-audit.md` for the redundancy audit.
- Task skills with preview+execute patterns must execute commands immediately after the preview. Do not add a "confirm before running" step or pause for user input. Claude Code's tool permission dialog is the confirmation gate. The user hits Enter to approve or Escape to interrupt and revise.
- When a skill persists output to `.claude/` (plans, review, audits), follow `standards/slug.md`. Cite that standard from the skill body and state which empty-case the skill takes, rather than restating the derivation.
- Never reference a repo-local path such as `wiki/` from a file under `claude/skills/`. It resolves to nothing in a target project, and the Skill paths stage of `bun run check` fails on it.
- Reach supporting prose from a shipped skill through a `canon docs <topic>` command, a bundled reference copied in by a `consumers:` frontmatter field, or text inlined in the skill body.
- Internal skills under `.claude/skills/` take the `internal-*` prefix, and `canon-*` marks the toolkit-subject family under `claude/skills/`. If a plan suggests `canon-*` for an internal skill, flag the mismatch before creating the folder.
- When handing off a plugin skill test from a linked worktree, print the two-line invocation block: `cd` to the sandbox path, then `claude --plugin-dir <worktree-root>/claude --model sonnet`. Without `--plugin-dir`, Claude loads main's stale copy. Default to `--model sonnet` for skill testing.
- For unconditional pre-push or per-edit automation (formatters, audits, scaffold checks), propose a husky hook instead of a CLAUDE.md or skill bullet. CLAUDE.md only fires when Claude is acting. A hook fires for everyone.
- When extending PostToolUse hooks (`standards-audit` and similar), ship punctuation bans and closed-set wordlists, reading the list out of the standard at runtime rather than hardcoding a second copy
  - Defer structural checks such as negative parallelism, hollow openers, and paragraph length to the end-of-cycle `standards-audit` skill, since regex detection on those fires against legitimate prose
  - State the two-layer split when proposing hook scope changes
- Default cross-project Claude behavior rules (output formatting, path-printing, etc.) to the seeded `CLAUDE.md` plus the toolkit's own `CLAUDE.md`. Reserve `~/.claude/` for environment-specific config (terminal capability, machine specifics).

## Couplings

Before shipping any change to the seed, a plugin skill, a snippet, or a `.claude/` state doc, grep for the identifier you are changing. Check plugin skills for quoted seed section headings, workflows for snippet paths, and the Claude context entries for skill descriptions.

When editing any file under `.claude/` in this repo, also check `tooling/claude/seeds/` for a mirror path and `tooling/claude/reference.md` for a description that needs updating.

## Sync checklist

When adding a new skill:

- Create the skill folder and `SKILL.md` in `claude/skills/`
- Add an internal skill to the list in `canon/context/claude-internal/skills.md`. A plugin skill needs no catalog edit, since `canon claude skills list` reads the folder and the plugin entries hold reasons rather than a roster. Add a `skill-*` entry under `canon/context/claude-plugin/` only when the new skill introduces reasoning no existing child covers.
- Add a row to the skill's group in `docs/workflow/ai-workflow.md`'s Skills table. Every name `canon claude skills list --names` reports takes exactly one row there, per that file's own coverage rule.
- Draft a `scripts/sandbox/<category>/<skill>.sh` scenario alongside `SKILL.md`, even when the skill's output is judgment-driven. The deterministic seeded input is the point. Exception: skills whose body explicitly forbids probing, listing, grepping, or reading project surfaces have nothing for a seeded sandbox to anchor against. Skip the scenario for these and do not list it as a follow-up.
- `canon sandbox <cat:cmd>` provisions fixture state, and `scripts/sandbox/run.sh <cat:cmd> "<prompt>"` provisions the same tree and drives the arm, spawning `claude -p` and scoring its assertions. Authorizing the spend is the operator's call, performing it is not, matching `canon/context/scripts/eval.md`. "Sandbox cannot drive Claude" is not a reason to skip one, because it can.
- `src/claude/cases/all.test.ts` requires a routing case for the new skill in one of `src/claude/cases/*.ts`, or `bun run check` fails naming the skill rather than this step. See `canon/context/claude-plugin/skill-procedures/overview.md` for why.
- Once the skill count changes, the Hero gate stage fails until `scripts/core/regen-hero.sh` runs and `canon capture assets/captures --selector .window --out assets/evidence` re-renders the frame. Commit the markup, the image, and the stamp together. See `canon/context/claude-plugin/skill-procedures/overview.md` for why.

When modifying a skill:

- Read the skill's sibling `REQUIREMENT.md` first when one exists. If the change closes no gap it states, change the requirement first or drop the change.
- Update the matching bullet in `canon/context/claude-internal/skills.md` if an internal skill's description changed. A plugin skill's description is read from its own frontmatter, so nothing mirrors it.
- Check if a corresponding sandbox scenario exists in `scripts/sandbox/` and update it if the skill's behavior changed
- Run `/internal-sandbox-check` before shipping to audit which skills changed without a paired scenario edit

When modifying either CLAUDE.md:

- The root file and its seed are paired by `internal/rules/claude/596-claude-md.md`, which globs both and fires on an edit to either without this skill being loaded. It holds the mirroring split alone. The edit protocol and the routing criterion sit in `governance/rules/claude/592-claude-md.md`, which globs the root file and ships to a target that installed governance.
- The seed's "Context" section defines the three-tier context model (always-loaded / path-scoped lazy / on-demand lookup at `canon/context/`). Keep the section coherent with the same model in `canon/context/context-model.md`.

## Reference

- `canon/context/claude-plugin/`: skill strategy, requirements, lifecycle, review paths and shared procedures, plus distribution and release, canon claude CLI, built-in feature overlap
- `canon/context/claude-internal/`: internal skills, orchestration, plugin discovery
- `canon/context/context-model.md`: three-tier context model and how entries get populated
- `canon/context/snippets.md`: snippets catalog and invocation
- `canon/context/indexes.md`: index.md system rationale and contracts
- `tooling/claude/reference.md`: seed layout and design notes
- `standards/skill.md`: skill structure, frontmatter, and authoring rules
