---
title: Skill renames
description: Each plugin skill name canon migrate skill-names rewrites, and the retired skills and verbs with no successor
category: Agent surface
---

# Skill renames

The table and lists behind the skill citations move in [target migrations by verb](by-verb.md), for a project citing a skill under a name it no longer ships.

Plugin skills dropped their `claude-` prefix, so `canon:claude-docs` is now `canon:context-sync`. Five drafters merged into `write-doc`, and later skills took a name for the job they do. No old name keeps a pointer, and `canon migrate skill-names --write` moves a project. <!-- canon-keep-retired -->

| Old name            | New name                                        |
| ------------------- | ----------------------------------------------- |
| `draft-doc`         | `write-doc` <!-- canon-keep-retired -->         |
| `draft-figure`      | `draw-figure` <!-- canon-keep-retired -->       |
| `draft-identity`    | `design-identity` <!-- canon-keep-retired -->   |
| `draft-slides`      | `make-deck` <!-- canon-keep-retired -->         |
| `draft-and-pick`    | `design-pick` <!-- canon-keep-retired -->       |
| `draft-ready`       | `plan-ready` <!-- canon-keep-retired -->        |
| `draft-screencast`  | `script-screencast` <!-- canon-keep-retired --> |
| `pick-by-eye`       | `design-pick` <!-- canon-keep-retired -->       |
| `ui-record`         | `ui-film` <!-- canon-keep-retired -->           |
| `ux-audit`          | `ui-audit` <!-- canon-keep-retired -->          |
| `ux-measure`        | `ui-performance` <!-- canon-keep-retired -->    |
| `create-skill`      | `write-skill` <!-- canon-keep-retired -->       |
| `create-rule`       | `write-rule` <!-- canon-keep-retired -->        |
| `plan-feature`      | `plan-change` <!-- canon-keep-retired -->       |
| `ui-measure`        | `ui-performance` <!-- canon-keep-retired -->    |
| `context-fold`      | `context-sync` <!-- canon-keep-retired -->      |
| `task-board`        | `task-create` <!-- canon-keep-retired -->       |
| `design-references` | `design-gather` <!-- canon-keep-retired -->     |

Update the plugin and run `canon migrate skill-names --write` in one step. A seeded `.claude/hooks/plan-guard.sh` matches the plan skill by name, so a plugin update without the run blocks every new plan until the hook is rewritten. <!-- canon-keep-retired -->

Replace a citation of a skill with no successor by hand, or delete the sentence.

- `canvas` is now `canvas-board`. The sweep rewrites only `canon:canvas` and `skills/canvas`, so replace a bare mention by hand. <!-- canon-keep-retired -->
- `draft-ready` is rewritten only as `canon:draft-ready` and `skills/draft-ready`, since bare it also describes a pull request, so replace a bare mention by hand. <!-- canon-keep-retired -->
- `design-extract` and `sketch-design` are replaced by `canon:canvas-board`, and `canon-feedback-triage` by `canon:issue-triage`. <!-- canon-keep-retired -->
- `review-branch`, `seed-sync`, `restate-plainly`, `bash-cli-script`, `canon-operator`, and `canon-rollout` have no successor <!-- canon-keep-retired -->
- `create-standard`, `markdown-propose`, `memory-review`, `project-commands`, `repo-metadata`, `ux-walkthrough`, and `plan-ready` have no successor <!-- canon-keep-retired -->

The `memory` record kind left `canon records`, so `canon records validate memory` refuses as an unknown kind and `canon records migrate` is gone.

- `canon repo metadata`, `canon autoship`, and the `120-bash` rule are gone, and `canon gov sync` removes the rule <!-- canon-keep-retired -->
- `memory-capture`, the `603-memory` rule, and the `memory` standard are gone, so send a lesson to the context entry that owns the fact <!-- canon-keep-retired -->
