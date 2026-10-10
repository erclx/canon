---
title: Workflow arms
description: What the orchestrator, groundwork, standards read, worktree, review, and test craft arms prove, and what each leaves unmeasured
---

# Workflow arms

The arms below follow the shared decisions and gotchas in `canon/context/sandbox/coverage/arms.md`.

## Orchestrator

`claude/role-orchestrator.sh` drives a skill that reads a board and reports state, so it is proposal-only. Three `reply` pins carry the verdict and two `absent` entries carry the tree. Nothing asserts that the staged board is still staged, since a pin over provisioning counts the same as a real one.

- `.canon/plans/feature-log-entry.md` proves the run opened the plans folder rather than reporting the board alone.
- `auto-ship` is the route a task with a plan earns, spelled without a leading slash because a session invoking through the plugin writes `/canon:auto-ship`. The planned task carries a staged plan file, so the route reads back off provisioning.
- `Next:` asserts the output contract's last slot and neither its singleness nor the route it names.
- The fixture carries a second task row with no plan, so the needs-a-plan branch is reachable. Its `plan-feature` route sits in `manual` under `Judgment:`, since the token is one the run chooses.

The skill names its route again on the `Next:` line, so the `auto-ship` pin reads the token anywhere in the reply rather than on the row it is written about. A rewrite of that row's route passes the pin. Anchoring is not available, since `reply` matches plain substrings, so the declaration names the row in `manual`. The arm scores that the run produced a board report naming the right plan and the right route somewhere in it.

## Groundwork

`sandbox/fixtures/claude/plan-groundwork/` does not exist, so every `claude:plan-groundwork` arm returns `unchecked` with nothing asserted, and a verdict confirms only that the session completed.

The `open`, `resume`, and `decline` arms cover creating, continuing, and refusing a track. None runs a spike or produces an artifact, so the write-scope rule sending evidence to `evidence/` inside a track has no arm exercising it. The skill's first guard refuses a missing topic without creating a folder, so each arm names its intended prompt on its own `Action:` line and has to be driven with that topic.

## Standards read

`infra:standards read` covers a resolve order rather than a skill. `src/standards/read.ts` searches two roots, and the second is the package corpus, which is the only one a target has. `src/standards/read.test.ts` passes its own roots in, so the arm is what runs the command from a working directory outside the toolkit checkout, where `PROJECT_ROOT` comes off the module's location rather than off `pwd`.

- The arm runs `canon standards skill` from `install/`, a clean target, and captures the frame to `install/read-frame.log` and the document to `install/read-body.md`, since `canon sandbox check` reads the tree alone and splitting the streams lets the resolve be asserted apart from the read. Running from `install/` rather than the sandbox root keeps `authored/standards/` out of the picture.
- `<canon>` is what the arm scores, since `standardRoots` spells the other root as `standards` and the prefix is the one label no project path produces. The two `absent` entries carry the other half, because a resolve answered from a project copy returns the same document. `.claude/standards` stays in that list.
- The arm carries no `max_turns`, since it runs the CLI with no agent and no envelope.

It does not reach the published layout. The arm runs `bun "$PROJECT_ROOT/src/cli.ts"`, so the package root is this checkout's `standards/` rather than an installed package directory, and whether `package.json` ships the corpus is measured nowhere. It does not reach the catalog either: no shipped skill body invokes this verb, and plugin bodies read standards off the `claude/standards` symlink, a route that never reaches `src/standards/read.ts`.

## Session worktree

### Port offset

`claude:session-worktree/port-offset` stages the web layer's port helper into the target and pins the reply to `Port offset 27`, the cksum of the worktree folder name modulo the band of 50, plus one. Pinning the number rather than its shape separates a session that read the helper from one that printed a plausible integer, and the folder name is derived from the plan the branch matches rather than chosen by the run. The dependency line lands on the last of Step 6's bullets, since the arm seeds no manifest inside the worktree.

The arm cannot reach the refusal branch for a leftover folder, since Step 4 registers whatever it creates. The scenario seeds one as a sibling for a hand drive and says so in `manual`, and `src/tooling/worktree-port.test.ts` covers the branch directly.

### Submodule

The runner takes the prompt as a free argument, and a session's `Bash` working directory persists across calls, so a prompt opening with `cd vendor` puts every git read the skill makes inside the submodule. `submodule` runs from inside the submodule and asserts the guard, and `submodule-root` runs from the superproject root over the same staged tree and asserts the guard stays silent.

A scenario staging a subdirectory read inside its own script is the other mechanism, as `infra:standards read` does. The prompt route reaches the skill session's own directory, which no scenario body can set.

## Review close-out

`claude/review-pr.sh`'s `repeat-close-out` arm seeds a `## Review`, then a `## Review closed`, then one commit that raises nothing, which is the state a pass has to meet without posting a second close-out. The local file proves a body was written under `## Review closed` naming what the pass covered. Whether a second close-out was posted beside the standing one is the shape of a remote thread, which no assertion kind reads, so four entries sit in `manual` and are confirmed through the pull request's review API.

A `PUT` rewrite moves a review's body and leaves its `commit_id` pinned, so the field `review-pr` Step 2 and `poll.ts` derive a prior commit from goes stale when the guard fires. `canon/context/claude-plugin/skill-review/two-pass.md` holds why that cost stands.

## Test craft

`claude/test-craft.sh` carries `layers` and `pull`, both asserting where a written test lands rather than whether it passes, since nothing installs.

- A baseline session already places each of `layers`' three behaviors at its right layer, so a with-and-without comparison over it cannot move.
- `pull` stages a page with an existing end to end spec and asks for a loading state, the prompt meant to pull a session toward extending the spec. A baseline session also places it in a component test, so the arm does not discriminate either. Its `expect.toml` asserts the with arm: a component test carrying the loading state, and `Loading` absent from every `e2e/*.spec.ts`.
- The without arm cannot run through `run.sh`, which hardcodes `--plugin-dir claude`. It is a hand run of `claude -p` against the provisioned tree with a scratch copy of `claude/` lacking `skills/test-craft`, scored by reading the files it wrote.

## Code craft

`claude/code-craft.sh`'s `pricing` arm seeds one member discount written in both `src/cart.ts` and `src/invoice.ts` and asks for a staff discount in both, without saying the rule is duplicated. Its `expect.toml` asserts the invoice carries no discount arithmetic of its own, so the rule ended in one place, and that no strategy, factory, or registry file landed for the variant. Where the merged rule lives is free, so `manual` carries the check that the cart holds at most one copy.
