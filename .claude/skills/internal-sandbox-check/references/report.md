---
title: Sandbox check report
description: The report block internal-sandbox-check Step 4 prints to chat and the rules each of its sections follows
---

# Print the report

Step 4 of `internal-sandbox-check`. The session reads this file on reaching that step, after resolving the provisioning scenario, its arm, and its gate.

Print one block to chat:

```plaintext
Sandbox check

Provisioning:
  CANON_NON_INTERACTIVE=1 ./scripts/manage-sandbox.sh <category>:<scenario>

Queued (run manually after testing the current scenario):
  CANON_NON_INTERACTIVE=1 ./scripts/manage-sandbox.sh <category>:<scenario>
  CANON_NON_INTERACTIVE=1 ./scripts/manage-sandbox.sh <category>:<scenario>

Headless verification (this session runs it):
  scripts/sandbox/run.sh <category>:<rest> "/canon:<skill-name>" <arm>

Interactive re-test (copied to clipboard):
cd <current-root>/.sandbox && claude --plugin-dir <current-root>/claude --model sonnet

Findings:
  <status>  <item-path>  →  <scenario-path or "none">     # <invocation-hint>

Scenarios changed but not paired:
  <path>                                                 # unchanged items in the same scenario may still apply
```

Rules for the block:

- List every changed item on its own line under `Findings:`. Sort `stale` and `unmapped` first, then `aligned`, then the census verdicts, then `none`.
- Use these status labels exactly: `STALE`, `ALIGNED`, `NONE`, `UNMAPPED`, `EXEMPT`, `SHOULD-BE-ASSERTED`, `OUTSIDE-CENSUS`.
- An `EXEMPT` row prints its census `reason` as the hint, which is the whole value of reading the file. Print the reason verbatim rather than summarizing it, since a reader overturns an exemption by disagreeing with its stated grounds.
- A row carrying a census verdict or `OUTSIDE-CENSUS` shows `none` in the scenario column. Five statuses now resolve to no scenario, so the label is what distinguishes them and the column no longer does.
- For plugin skills, use `<skill-name>` as the item path and append `# /<skill-name>` as the invocation hint. For scripts under `scripts/`, use the path relative to the repo root (`scripts/core/regen-hero.sh`) and omit the hint. For `src/**` items, append `# Closest e2e: bun run check:install` as the hint.
- `Provisioning:` shows exactly one scenario, the next to provision. Always invoke the local script, never `canon sandbox`. `canon` is globally installed and resolves to the main repo's scripts, so from a worktree it would run stale scenarios and provision the sandbox outside the worktree.
- `.sandbox/` is a single directory per repo root. Provisioning a second scenario overwrites the first, so the skill provisions one at a time and queues the rest.
- `Queued:` lists every remaining distinct scenario as a full `manage-sandbox.sh` command, one per line, so the user can copy directly. Omit the section when there is only one scenario.
- Omit `Provisioning:` and `Queued:` when no pairing carries a scenario, since there is nothing to provision.
- `Headless verification:` shows the Step 6 command for the `Provisioning:` scenario alone, carrying the arm when the scenario is multi-arm. Replace the command with `gate: <label>` when a Step 6 skip condition holds, so the report says why before the run is missing rather than after.
- Print the interactive re-test command flush-left as a single chained line (`cd … && claude --plugin-dir … --model sonnet`) so the user can paste it into any terminal
  - The `--plugin-dir` points at `<current-root>/claude` so unchanged sub-skills (those not dev-injected) stay available to chained skills like `auto-ship`. Dev-injected skills under the sandbox's `.claude/skills/` still take priority.
- Pipe the same chained command to the clipboard using the first available tool: `wl-copy`, `xclip -selection clipboard`, `pbcopy`, then `clip.exe`. If none are present, drop the `(copied to clipboard)` suffix from the heading and continue silently.
- After the `Interactive re-test:` block, print one line: `Note: in the interactive session, invoke skills as /<skill-name>, not /canon:<skill-name>. The project-scoped copy takes priority.` The headless prompt in Step 6 uses the qualified form for the opposite reason, so keep the two lines distinct.
- `Scenarios changed but not paired:` lists any scenario in the changed-scenarios list that no Step 2 mapping pointed to. Omit the section when empty.

If every pairing is `ALIGNED` or carries no scenario, prefix the block with `✅ All changed items have paired scenario edits.`. Still print the full block so the re-test command is available.
