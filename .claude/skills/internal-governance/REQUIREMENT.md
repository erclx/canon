---
name: internal-governance
description: Scope boundary for the rule catalog and its stacks, and where a rule has to be registered before it installs anywhere
---

# Internal governance requirement

## Gap

Without this skill, a session writes a rule into `.claude/rules/` where the next check deletes it, picks a slug another rule or folder holds, widens a rule without committing the regenerated copy, and lands a gov-specific sync change in the engine three other domains inherit.

An unregistered rule passes every gate. A source rule with a free slug and a correct shape looks landed, and the drift assertion agrees because the consumed copy matches the record. Nothing reports that no stack names it, so it reaches no target.

## Must

- A new rule is registered where the record resolves it, being a stack, the `add` list in `internal/governance.toml`, or `internal/rules/` for toolkit authoring alone
- A new slug is held by no other rule and no folder
- The regenerated `.claude/rules/` copy is committed with the source change
- A sync change goes to the adapter for source location and change detection, and to the shared engine for the scan, the prompt, and the apply loop

## Must not

- Hand-edit `.claude/rules/`, which the next check regenerates from the record
- Ship a rule routing to a path no target install creates, rather than authoring it under `internal/rules/`
- Duplicate `ruleSubdir` or frontmatter stripping outside their one owner

## Out of scope

- The frontmatter, headings, and bullets a rule file carries, and creating a rule inside a target, which `create-rule` owns
- The reference a rule routes to, which `internal-claude` owns
- The verdict on whether a rule earns its place, its load mode, and its reach, which `internal-rule-audit` owns
