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
  bun src/cli.ts sandbox <category>:<scenario>

Queued (run manually after testing the current scenario):
  bun src/cli.ts sandbox <category>:<scenario>
  bun src/cli.ts sandbox <category>:<scenario>

Headless verification (this session runs it):
  canon sandbox run <category>:<rest> "/canon:<skill-name>" <arm>

Interactive re-test (copied to clipboard):
cd <current-root>/.sandbox && claude --plugin-dir <current-root>/claude --model sonnet

Findings:
  <status>  <item-path>  →  <scenario-path or "none">     # <invocation-hint>

Scenarios changed but not paired:
  <path>                                                 # unchanged items in the same scenario may still apply
```

If every pairing is `ALIGNED` or carries no scenario, prefix the block with `✅ All changed items have paired scenario edits.`. Still print the full block so the re-test command is available.

## Findings

List every changed item on its own line under `Findings:`, sorting `stale` and `unmapped` first, then `aligned`, then the census verdicts, then `none`. Print each label exactly as written, being `STALE`, `ALIGNED`, `NONE`, `UNMAPPED`, `EXEMPT`, `SHOULD-BE-ASSERTED`, `OUTSIDE-CENSUS`.

- An `EXEMPT` row prints its census `reason` verbatim as the hint, since a reader overturns an exemption by disagreeing with its stated grounds
- A row carrying a census verdict or `OUTSIDE-CENSUS` shows `none` in the scenario column, so the label is what separates the five statuses that resolve to no scenario

| Item                 | Item path               | Hint                                   |
| -------------------- | ----------------------- | -------------------------------------- |
| Plugin skill         | `<skill-name>`          | `# /<skill-name>`                      |
| Script in `scripts/` | path from the repo root | none                                   |
| `src/**`             | path from the repo root | `# Closest e2e: bun run check:install` |

## Paths and provisioning

`Provisioning:` shows exactly one scenario, the next to provision. `.sandbox/` is one directory per repo root, so provisioning a second scenario overwrites the first and the rest queue.

- Always invoke the local `bun src/cli.ts`, never the global `canon sandbox`, which from a worktree runs main's stale scenarios and provisions outside the worktree
- `Queued:` lists every remaining distinct scenario as a full command, one per line, so the user copies it directly. Omit it when there is only one scenario.
- Omit `Provisioning:` and `Queued:` when no pairing carries a scenario

## Verification and re-test

`Headless verification:` shows the Step 6 command for the `Provisioning:` scenario alone, with the arm for a multi-arm one. Replace the command with `gate: <label>` when a Step 6 skip condition holds, so the report says why before the run is missing.

- Print the interactive re-test flush-left as one chained line, so the user can paste it into any terminal
- Pipe the same line to the first clipboard tool present, from `wl-copy`, `xclip -selection clipboard`, `pbcopy`, then `clip.exe`. With none, drop the `(copied to clipboard)` suffix and continue.
- `Scenarios changed but not paired:` lists any changed scenario no Step 2 mapping pointed to. Omit it when empty.

### Plugin dir and skill names

The re-test's `--plugin-dir` points at `<current-root>/claude`, so unchanged sub-skills stay available to a chained skill like `auto-ship`. In the interactive sandbox, the dev-injected skills under `.claude/skills/` still take priority, while a headless `canon sandbox run` tree injects none.

After the `Interactive re-test:` block, print one line, keeping it distinct from the Step 6 prompt, which uses the qualified form for the opposite reason:

```plaintext
Note: in the interactive session, invoke skills as /<skill-name>, not /canon:<skill-name>. The project-scoped copy takes priority.
```
