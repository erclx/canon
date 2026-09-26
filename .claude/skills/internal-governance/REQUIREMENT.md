---
name: internal-governance
description: Scope boundary for the rule catalog and its stacks, and where a rule has to be registered before it installs anywhere
---

# Internal governance requirement

## Gap

Without this skill, a session writes a rule straight into `.claude/rules/` where the next check deletes it, adds a source rule no stack names so it installs into nothing, picks a number outside its band so the number stops stating the domain, widens a rule without committing the regenerated copy, and lands a gov-specific sync change in the engine three other domains inherit.

The registration failure is the one that passes every gate. A rule sitting in `governance/rules/` under a correct number and a correct shape looks landed, and the drift assertion agrees, because the consumed copy still matches what the record resolves to. Nothing reports that the record names it nowhere, so the rule reaches no target and no session ever loads it.

## Must

- Register a new rule where the record resolves it, meaning a stack in `governance/stacks/`, the `add` list in `internal/governance.toml`, or `internal/rules/` when it governs toolkit authoring alone
- Pick the number from its band, so the number states the rule's domain without the file being opened
- Commit the regenerated `.claude/rules/` copy alongside the source change, since the drift assertion turns a stale copy into a failing check
- Route a sync change by axis, sending source location and what counts as a change to the adapter, and the scan report, the prompt, and the apply loop to the engine every other domain inherits

## Must not

- Hand-edit `.claude/rules/`. It is produced output, regenerated from the record on the next check.
- Ship a rule routing to a path no target install creates. A toolkit-only route is authored under `internal/rules/`, where location keeps it out of everything the plugin carries.
- Duplicate `rule_subdir` or frontmatter stripping. Each has one owner and the callers that justify its position.

## Guards

- `install` and `sync` refuse the toolkit root, because a target's rules belong to its operator. `regen` is the verb that writes here.
- A rule whose subject is not a file has no glob to match and never fires. Reach that surface by instruction plus a check, and leave it unrouted on purpose.

## Out of scope

- The frontmatter, headings, and bullet conventions a rule file carries, which `standards/rule.md` states
- Creating a project-local rule inside a target, which the shipped `create-rule` skill does against that project's own numbering
- Authoring the standard a rule routes to, and the catalog row it owes: `internal-standards`
- The per-rule verdict on whether a rule earns its place, its load mode, and its reach: `internal-rule-audit`
