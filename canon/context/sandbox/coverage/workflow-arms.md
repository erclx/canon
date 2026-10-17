---
title: Workflow arms
description: What the orchestrator, groundwork, standards read, worktree, review, and test craft arms prove, and what each leaves unmeasured
---

# Workflow arms

The arms below follow the shared decisions and gotchas in `canon/context/sandbox/coverage/arms.md`.

## Decisions

### Orchestrator

`claude/role-orchestrator.ts` drives a skill that reads a board and reports state, so it is proposal-only. Three `reply` pins carry the verdict and two `absent` entries carry the tree. Nothing asserts that the staged board is still staged, since a pin over provisioning counts the same as a real one.

- `.canon/plans/feature-log-entry.md` proves the run opened the plans folder rather than reporting the board alone
- `auto-ship` is the route a task with a plan earns, spelled without a leading slash because a plugin session writes `/canon:auto-ship`, and the staged plan file makes it read back off provisioning
- `Next:` asserts the output contract's last slot, neither its singleness nor the route it names
- A second task row with no plan makes the needs-a-plan branch reachable, and its `plan-feature` route sits in `manual` under `Judgment:`, since the run chooses the token

The skill names its route again on the `Next:` line, so the `auto-ship` pin reads the token anywhere in the reply rather than on the row it is written about. A rewrite of that row's route passes the pin. Anchoring is unavailable, since `reply` matches plain substrings, so the declaration names the row in `manual`.

### Groundwork

`sandbox/fixtures/claude/plan-groundwork/` does not exist, so every `claude:plan-groundwork` arm returns `unchecked` with nothing asserted, and a verdict confirms only that the session completed.

The `open`, `resume`, and `decline` arms cover creating, continuing, and refusing a track. None runs a spike or produces an artifact, so the write-scope rule sending evidence to `evidence/` inside a track has no arm exercising it.

- The skill's first guard refuses a missing topic without creating a folder
- Each arm names its prompt on its own `Action:` line and has to be driven with that topic

### Session worktree port offset

`claude:session-worktree/port-offset` stages the web layer's port helper into the target and pins the reply to `Port offset 27`, the cksum of the worktree folder name modulo the band of 50, plus one. Pinning the number rather than its shape separates a session that read the helper from one that printed a plausible integer.

- The folder name is derived from the plan the branch matches rather than chosen by the run
- The dependency line lands on the last of Step 6's bullets, since the arm seeds no manifest inside the worktree
- The arm cannot reach the refusal branch for a leftover folder, since Step 4 registers whatever it creates
- The scenario seeds one as a sibling for a hand drive and says so in `manual`, and `src/tooling/worktree-port.test.ts` covers the branch directly

### Session worktree submodule

The runner takes the prompt as a free argument, and a session's `Bash` working directory persists across calls, so a prompt opening with `cd vendor` puts every git read the skill makes inside the submodule.

- `submodule` runs from inside the submodule and asserts the guard
- `submodule-root` runs from the superproject root over the same staged tree and asserts the guard stays silent
- A scenario staging a subdirectory read inside its own script is the other mechanism, but the prompt route reaches the skill session's own directory, which no scenario body can set

### Review close-out

`claude/review-pr.ts`'s `repeat-close-out` arm seeds a `## Review`, then a `## Review closed`, then one commit that raises nothing, the state a pass has to meet without posting a second close-out. The local file proves a body was written under `## Review closed` naming what the pass covered.

Whether a second close-out was posted is the shape of a remote thread, which no assertion kind reads, so four entries sit in `manual`.

- A `PUT` rewrite moves a review's body and leaves its `commit_id` pinned, so the field `review-pr` and `poll.ts` read a prior commit from goes stale when the guard fires

### Test craft

`claude/test-craft.ts` carries `layers` and `pull`, both asserting where a written test lands rather than whether it passes, since nothing installs.

- A baseline session already places each of `layers`' three behaviors at its right layer, so a with-and-without comparison over it cannot move
- `pull` stages a page with an existing end to end spec and asks for a loading state, to pull a session toward extending it. A baseline session also picks a component test, so it does not discriminate.
- Its `expect.toml` asserts the with arm, being a component test carrying the loading state and `Loading` absent from every `e2e/*.spec.ts`
- The without arm cannot run through `canon sandbox run`, which hardcodes `--plugin-dir claude`, so it is a hand run of `claude -p` against a scratch copy of `claude/` lacking `skills/test-craft`

### Code craft

`claude/code-craft.ts`'s `pricing` arm seeds one member discount written in both `src/cart.ts` and `src/invoice.ts` and asks for a staff discount in both, without saying the rule is duplicated.

- Its `expect.toml` asserts the invoice carries no discount arithmetic of its own, so the rule ended in one place
- It also asserts that no strategy, factory, or registry file landed for the variant
- Where the merged rule lives is free, so `manual` carries the check that the cart holds at most one copy
