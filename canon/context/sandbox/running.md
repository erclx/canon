---
title: Running
description: Prerequisites, the command surface, and the toolkit-only refusal an installed canon returns
---

# Running

## Decisions

- Every sandbox verb is toolkit-only and refuses under an installed `canon`, reporting `sandbox is toolkit-only and is absent from an installed canon`. Run this checkout's own entry point instead, as `bun src/cli.ts sandbox <verb>`. A linked worktree meets the refusal on every sandbox read, since the `canon` on the path resolves to the published binary rather than to the branch under it.
- When a scenario argument is passed, `manage-sandbox.sh` sets `SANDBOX_SCENARIO` and `CANON_NON_INTERACTIVE=1`. Multi-scenario scripts call `select_or_route_scenario` from `lib/ui.sh`, which reads `SANDBOX_SCENARIO` and skips the picker when set.
- The `internal-sandbox-check` skill maps changed plugin skills and changed `scripts/` files on a feature branch to their matching scenarios, so an e2e gap on a script edit surfaces the way one on a skill edit does.

## Gotchas

- A session that reads the toolkit-only refusal at face value concludes the verb no longer exists rather than reaching for the local CLI. The refusal names its cause so it does not read as a broken tree.
- Org membership is a real requirement for the anchor scenarios. HTTPS fixes transport rather than authorization, so a contributor outside the org cannot run them.

## Prerequisites

The anchor scenarios push to a real GitHub remote. They need an authenticated `gh` and membership in the org that owns `aitk-sandbox`, which is private. Everything else runs offline against an empty sandbox.

```bash
gh auth login   # required for any scenario declaring use_anchor
```

Provisioning is offline, since the starting tree comes from a fixture, so the first network call is the probe `configure_sandbox_anchor_remote` runs before adding the remote. The probe turns a missing credential or an unreachable host into a named error at the top of the run, and `GIT_TERMINAL_PROMPT=0` keeps a credential failure immediate. `canon/context/sandbox/authoring.md` covers why an absent repository refuses by default.

## Commands

```bash
canon sandbox                        # interactive category + command picker
canon sandbox infra:gov install      # run a specific scenario non-interactively
canon sandbox reset                  # restore sandbox to baseline
canon sandbox clean                  # wipe sandbox entirely
canon sandbox check <cat:cmd> [arm]  # assert an arm against the provisioned tree
canon sandbox coverage               # report which scenarios declare expectations
```

`docs/agents/sandbox.md` carries the flags and JSON shapes. `canon/context/sandbox/headless.md` covers driving a skill through `scripts/sandbox/run.sh`.
