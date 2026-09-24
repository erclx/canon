---
title: Arms
description: What each armed scenario proves, the fixture property it rests on, and what it leaves unmeasured
---

# Arms

Each section states what an arm's declaration proves and what it leaves open, so a green verdict reads at its real width. Read the declaration itself in `scripts/sandbox/fixtures/<category>/<scenario>/`, which carries the pins, the ceilings, and the `manual` entries this entry does not restate.

## Decisions

- Read a verdict as covering the arm that ran, not the skill. A skill with one armed arm and four unarmed ones reports `asserted` while four arms score nothing.
- Read `unchecked` beside `asserted` rather than under it. Several arms carry `manual` entries covering what no substring reaches, so `asserted` is a denominator rather than the coverage.
- A claim that the harness cannot drive something owes one attempt before it is written down. The runner's defaults are not refusals, as the `session-worktree` submodule arms show.
- An escape naming a file another session edited during the run is read against what the machine was doing before it counts as a finding. Drive board-reading arms while the board is quiet.

## Gotchas

- `canon sandbox check <category>:<command>` with no arm asserts nothing on a multi-arm scenario and reports clean. Name the arm in every check call.
- The prompt a caller supplies and the arm's assertions are joined by nothing. `Expectation` in `src/sandbox/expect.ts` carries no prompt field, so crossing the prompts of two arms over one tree swaps both verdicts and reports ordinary failures. Each arm's header names the prompt it assumes, which is a convention rather than a check.

## Standards citation arms

`claude/review-branch`, `claude/ui-checklist`, and `claude/memory-review` each run against a target holding no standards folder, so the plugin root is the only route to the slug transform. Each stages a branch carrying a `/`, and the transform replacing it with `-` appears in no skill body, so the output filename is evidence the citation resolved. Each also asserts that `.claude/standards/skill.md` and `standards/skill.md` are both absent, so an arm staging a copy of its own goes red where it lands rather than quietly voiding the premise.

`claude/ui-checklist` asserts the exact checklist path, because the checklist is the skill's whole output and a run producing none has produced nothing. Its remaining entries stay `Semantic:`, since which changes land on the visual list and which layer each missing-test line names are the skill's calls, and a pattern cannot tell a correct classification from a lucky one.

## Task board

`claude/task-board.sh` carries separate `create` and `archive` arms, because the two paths have disjoint preconditions and one arm running both would assert the second against a tree the first mutated. Both stage the board rather than inheriting one, since `SANDBOX_INJECT_SEEDS` leaves `.canon/tasks/` holding only the seeded `index.md`.

- `canon tasks archive` is a typed verb whose refusals `src/tasks/archive.test.ts` covers, so the archive arm stages a board that satisfies every gate and asserts the successful move. The create path has no CLI verb, so the skill writes the file from `standards/tasks.md` and that arm covers prose with nothing underneath it.
- The create board runs three consecutive versions with no gaps, which forces the next one, and a `.canon/tasks/` reply fragment pins the proposed label.
- The archive task carries a `Pull request:` line, which satisfies the work-reached-main check without a remote, and its `Plan:` line points at a live plan no other task cites, which puts the plan move under assertion.
- `priority.md` puts the archived task's row first and a control row second. An `absent` entry cannot express a removed table row, so the arm pins the separator line and the row that follows it.
- Neither arm asserts `.canon/tasks/index.md`, which a hook regenerates. Both leave the main-worktree-root guard in `manual`, since a standalone sandbox repository has no linked worktree.

## Intake

`claude/plan-intake.sh` writes a folder that is gitignored in every target, so no check anywhere reads its shape, and a wrong numbering leaves a record cited for weeks with nothing reporting the drift.

- The `file` arm pins the slug through the invocation, since `paths` and `content` match exact paths. The numbering is still asserted, because the index links its cluster files and the pattern requires a two-digit number and a domain name in each link.
- The `route` arm asserts a refusal. Its three `absent` entries name the folders a wrong turn would create, and the reply pin catches a stop that refuses without naming where the question goes. Why the run refused stays in `manual`.

## Operator routing

`claude/canon-operator.sh` drives a skill whose subject is a decision. Each arm pins the skill or command a route names in `reply`, pairs it with a `manual` entry for the negative a substring cannot carry, and asserts over the tree in the direction a correct run leaves it alone.

- A proposal-only skill cannot be covered by tree assertions alone, since a session that did nothing passes every negative one.
- `gitignore` pins what the write produced, the managed entries back in the file and the install stamp as the inject wrote it, which separates the narrow mode from a full inject.
- `fresh` carries no tree pin, because a handoff to `target-setup` may continue into that skill and write the whole scaffold, and no path assertion separates routing from doing. It is reachable only from a real run.
- `unclaimed` pins the reverse walk's attribution rather than a route, since the walk reports a folder the toolkit stopped shipping and offers nothing. Provisioning refuses a CLI whose report attributes no unclaimed folder, which is the two-speed release risk `canon/ARCHITECTURE.md` records arriving in the harness. The refusal names both causes, since reading attribution cannot separate a binary predating the walk from a walk that reached nothing. The declaration pins the dropped folder's name so the fragility sits where a reader sees it.
- Every section of the operator report is gated on `isManagedTarget`, so the fixture stages a short `CLAUDE.md` as the one marker it needs rather than inheriting one from dev-skill injection.

### The audits arm

`audits` stages a target carrying two of the four audit surfaces. A passing run names the scaffold handoff first, offers the two staged audits, withholds the comment scan with a reason, and names `plans` as the only record kind.

`## Route` in the skill carries a measurement row for the audit offers, and the preamble above the table ranks a lifecycle row ahead of them, because a session acting on the lifecycle row never opens the section below it. The arm pins `target-setup` beside the two audit commands to score that ranking. The order between the handoff and the offers stays in `manual`, because a substring set is unordered, and the withheld offer is a negative substring any rephrasing satisfies.

The fixture stages one target shape with nothing installed, so a target shaped differently could rank the rows the other way with no assertion seeing it.

## Rollout

`claude/canon-rollout.sh` covers the only skill that enters a worktree in another project and pushes a branch there. The arm reaches a fixture rather than a real target, so it covers the decision taken before any dispatch rather than the dispatch.

- The fixture is a bare origin and two clones built after the outer commit, on the pattern `infra:gov`'s `test-order` arm runs. `kestrel-b` moves the remote forward and `kestrel-a` is left one commit behind and sorts first, so a run picking by listing order reaches the wrong answer.
- Both clones are taken before the divergence, so currency is the only thing separating them.
- Nothing fetches in `kestrel-a` after the clone, so both checkouts read level until a run goes to the remote. `FETCH_HEAD` appears in both clones only if something fetched during the run, so a `paths` entry over it proves the fetch.
- The narration fixes the two-line format the decision is written in, because both a correct and a wrong answer name both clones, and only an anchored pattern on the dispatch line reads which was chosen.
- `write_scope` admits what a fetch touches, being `FETCH_HEAD`, the remote-tracking ref and its log, and the fetched objects, and keeps out working-tree paths, `targets/origin.git/`, and `refs/heads/**`. Remote-tracking refs move on a fetch and local heads do not, which is the right place to cut.
- The population is given in the narration rather than read. `canon targets list` answers from the machine-level index, so a run enumerating for itself reaches the operator's real consuming projects, and no fixture can scope a machine-wide record.

### What its escape scope proves

The arm declares `escape_scope = []`, which `canon/context/sandbox/isolation.md` states the mechanism of. A pass says the run touched none of the eight watched destinations, which the narration asks for, now checked by the harness rather than trusted from the reply. A fail names an unbounded write the arm has no legitimate reason to make.

Neither reaches the write a real dispatch would make. A pass proves the refusal path stayed clean and says nothing about a worker's worktree entry, commit, or session record, nor about the home directory, sibling worktrees, or machine-level registries a live `claude --bg` reaches. A run invoked with the bare `/canon:canon-rollout` prompt, without the narration, can dispatch a real worker and still report `no escape during this run`, correctly, because the dispatch touches none of the watched destinations. The dispatch bound in `canon/context/sandbox/isolation.md` covers that case instead.

## Orchestrator

`claude/role-orchestrator.sh` drives a skill that reads a board and reports state, so it is proposal-only. Three `reply` pins carry the verdict and two `absent` entries carry the tree. Nothing asserts that the staged board is still staged, since a pin over provisioning counts the same as a real one.

- `.canon/plans/feature-log-entry.md` proves the run opened the plans folder rather than reporting the board alone.
- `auto-ship` is the route a task with a plan earns, spelled without a leading slash because a session invoking through the plugin writes `/canon:auto-ship`. The planned task carries a staged plan file, so the route reads back off provisioning.
- `Next:` asserts the output contract's last slot and neither its singleness nor the route it names.
- The fixture carries a second task row with no plan, so the needs-a-plan branch is reachable. Its `plan-feature` route sits in `manual` under `Judgment:`, since the token is one the run chooses.

The skill names its route again on the `Next:` line, so the `auto-ship` pin reads the token anywhere in the reply rather than on the row it is written about. A rewrite of that row's route passes the pin. Anchoring is not available, since `reply` matches plain substrings, so the declaration names the row in `manual`. The arm scores that the run produced a board report naming the right plan and the right route somewhere in it.

## Groundwork

`scripts/sandbox/fixtures/claude/plan-groundwork/` does not exist, so every `claude:plan-groundwork` arm returns `unchecked` with nothing asserted, and a verdict confirms only that the session completed.

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

The arm cannot reach the refusal branch for a leftover folder, since Step 4 registers whatever it creates. The scenario seeds one as a sibling for a hand drive and says so in `manual`, and `src/worktree-port.test.ts` covers the branch directly.

### Submodule

The runner takes the prompt as a free argument, and a session's `Bash` working directory persists across calls, so a prompt opening with `cd vendor` puts every git read the skill makes inside the submodule. `submodule` runs from inside the submodule and asserts the guard, and `submodule-root` runs from the superproject root over the same staged tree and asserts the guard stays silent.

A scenario staging a subdirectory read inside its own script is the other mechanism, as `infra:standards read` does. The prompt route reaches the skill session's own directory, which no scenario body can set.

## Review close-out

`claude/review-pr.sh`'s `repeat-close-out` arm seeds a `## Review`, then a `## Review closed`, then one commit that raises nothing, which is the state a pass has to meet without posting a second close-out. The local file proves a body was written under `## Review closed` naming what the pass covered. Whether a second close-out was posted beside the standing one is the shape of a remote thread, which no assertion kind reads, so four entries sit in `manual` and are confirmed through the pull request's review API.

A `PUT` rewrite moves a review's body and leaves its `commit_id` pinned, so the field `review-pr` Step 2 and `poll.sh` derive a prior commit from goes stale when the guard fires. `canon/context/claude-plugin/skill-review.md` holds why that cost stands.

## UX walkthrough

`claude/ux-walkthrough.sh` stages a `package.json` declaring no build, dev, or preview script, and the seeded `CLAUDE.md` names no build command, so the skill's first guard fires. The arm asserts that refusal with `absent = [".canon/walkthroughs/**"]`, `write_scope = []`, and the reply pin `"Nothing to inspect"`. Every later step needs a live operator, a browser, and a served build, so the declaration claims the refusal path alone.

## Test craft

`claude/test-craft.sh` carries `layers` and `pull`, both asserting where a written test lands rather than whether it passes, since nothing installs.

- A baseline session already places each of `layers`' three behaviors at its right layer, so a with-and-without comparison over it cannot move.
- `pull` stages a page with an existing end to end spec and asks for a loading state, the prompt meant to pull a session toward extending the spec. A baseline session also places it in a component test, so the arm does not discriminate either. Its `expect.toml` asserts the with arm: a component test carrying the loading state, and `Loading` absent from every `e2e/*.spec.ts`.
- The without arm cannot run through `run.sh`, which hardcodes `--plugin-dir claude`. It is a hand run of `claude -p` against the provisioned tree with a scratch copy of `claude/` lacking `skills/test-craft`, scored by reading the files it wrote.
