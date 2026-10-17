---
title: Running
description: Prerequisites, the command surface, and the toolkit-only refusal an installed canon returns
---

# Running

## Layout

### Prerequisites

The anchor scenarios push to a real GitHub remote. They need an authenticated `gh` and membership in the org owning the private `canon-sandbox`. Everything else runs offline.

```bash
gh auth login   # required for any scenario declaring `anchor: true`
```

Provisioning is offline, since the starting tree comes from a fixture. The first network call is the probe `configure_sandbox_anchor_remote` runs before adding the remote, which turns a missing credential or unreachable host into a named error. `canon/context/sandbox/authoring.md` covers why an absent repository refuses.

A scenario that reads git history also needs a checkout `canon` first on `PATH`, since the published install carries no history and provisioning stops naming it. A shim that execs `bun <checkout>/src/cli.ts` serves. The headless run calls the same `canon`, so a shim satisfying only the provisioning guard would fail the run.

### Commands

Seven verbs cover the run surface.

```bash
canon sandbox                        # interactive category + command picker
canon sandbox infra:gov install      # run a specific scenario non-interactively
canon sandbox reset                  # restore sandbox to baseline
canon sandbox clean                  # wipe sandbox entirely
canon sandbox check <cat:cmd> [arm]  # assert an arm against the provisioned tree
canon sandbox coverage               # report which scenarios declare expectations
canon sandbox equivalence [target]   # diff every arm's provisioned tree against a base ref
```

`docs/agents/sandbox.md` carries the flags and JSON shapes. `canon/context/sandbox/headless.md` covers driving a skill through `canon sandbox run`.

## Decisions

### Every sandbox verb is toolkit-only

Every verb refuses under an installed `canon`, reporting `sandbox is toolkit-only and is absent from an installed canon`. Run this checkout's own entry point instead, as `bun src/cli.ts sandbox <verb>`. A linked worktree meets it on every read, since the `canon` on the path is the published binary.

### Passing a scenario skips the picker

A scenario argument makes `canon sandbox` set `SANDBOX_SCENARIO` and `CANON_NON_INTERACTIVE=1`, which routes a multi-arm scenario to the named arm. The `internal-sandbox-check` skill maps changed plugin skills and `scripts/` files on a branch to their scenarios, so an e2e gap on a script edit surfaces like one on a skill edit.

## Gotchas

### Reading the refusal

A session that reads the toolkit-only refusal at face value concludes the verb no longer exists rather than reaching for the local CLI. The refusal names its cause so it does not read as a broken tree.

### Org membership

Org membership is a real requirement for the anchor scenarios. HTTPS fixes transport rather than authorization, so a contributor outside the org cannot run them.
