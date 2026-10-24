---
name: internal-sandbox-check
description: Audits the current branch for skill or script edits that lack a matching sandbox scenario update. Reports per-item pairings, drives a headless verification run against the first changed scenario, and prints the interactive re-test command for the rest. Auto-trigger at ship time after editing `claude/skills/**/SKILL.md`, `scripts/**`, or `src/**` when the user signals end-of-feature ("ready to ship", "open PR", "before push", "wrap up", "ship it"). Do NOT auto-trigger on individual file edits mid-feature or on docs-only changes.
---

# Sandbox check

Manual guard after editing a plugin skill or a domain script. Reports whether each changed item has a paired scenario edit, verifies the first changed scenario headlessly, and prints the interactive re-test command for the user to launch against the rest.

Verification runs without a human opening a session. `canon sandbox run` drives a skill through `claude -p`, provisions the scenario itself, and returns a verdict. An item that still ships unverified names which gate stopped it.

## Guards

Both guards read the branch against `main`.

- If the current branch is `main` or `master`, stop: `❌ On main. Checkout a feature branch first.`
- If the skill and script diffs Step 1 lists are both empty, stop: `✅ No skill or script changes since main.`

## Step 1: collect changed files

Run in parallel from the worktree root:

```bash
git diff "$(git merge-base main HEAD)" --name-only -- 'claude/skills/**/SKILL.md' '.claude/skills/**/SKILL.md'
```

```bash
git diff "$(git merge-base main HEAD)" --name-only -- 'scripts/**' 'src/**'
```

```bash
git diff "$(git merge-base main HEAD)" --name-only -- 'sandbox/**/*.ts'
```

```bash
pwd
```

The four lists, in order:

- The changed skills, both plugin (`claude/skills/`) and internal (`.claude/skills/`)
- The changed scripts (`scripts/`, `src/`)
- The changed sandbox scenarios
- The current root, whether that is main or a linked worktree

Provisioning reads the scenarios of whichever root ran `bun src/cli.ts sandbox`, because the CLI resolves `PROJECT_ROOT` from its own path. Drop any script path that already appears in the scenario list, since a scenario edit surfaces through the "Scenarios changed but not paired" tail.

## Step 2a: map skill changes

Read the census once before the loop, through the worktree-local CLI:

```bash
bun src/cli.ts sandbox coverage --skills --json
```

A globally installed `canon` resolves to the main checkout and would report main's skills against this branch. If the command fails, treat the census as empty, so rules 2 through 4 match nothing, internal skills still resolve at rule 5, and plugin skills reach the prompt.

For each changed `claude/skills/<skill-name>/SKILL.md` or `.claude/skills/<skill-name>/SKILL.md`, apply the first matching rule:

1. Split `<skill-name>` on the first `-` into `<category>` and `<rest>`. If `sandbox/<category>/<rest>.ts` exists in the worktree, record it.
2. If the census entry names a scenario `<category>:<command>`, record `sandbox/<category>/<command>.ts`. This reaches a spelling rule 1 cannot split, such as `claude:target-setup`.
3. If the census carries the skill with no scenario and `sandbox/infra/<rest>.ts` exists, ask `Scenario for <skill-name>? Candidate: sandbox/infra/<rest>.ts (path under sandbox/, or "none")`.
4. If the census carries the skill with no scenario and no candidate exists, record its `verdict`, with the `reason` for an exempt one. Do not ask, since a verdict is a standing ruling.
5. If the path is under `.claude/skills/`, record `outside-census`. The census counts `claude/skills/` alone, so an internal skill is absent by construction.
6. Otherwise the census has yet to see this plugin skill, so ask `Scenario for <skill-name>? (path under sandbox/, or "none" if the skill has no scenario)`.

Both prompts accept `none` as an explicit opt-out.

### Why rule 3 asks

Rule 3 offers the candidate rather than recording it, because a file at that path is evidence rather than proof. A coincidental name match reports a skill as covered by a scenario staging an unrelated tree, which is the vacuous pass the coverage entry exists to prevent.

- Do not guess past the candidate. Fuzzy matching across categories pairs wrong, such as the retired `setup-gov` to `infra/gov.ts` rather than `gov/install.ts`.
- Do not write to `sandbox/exempt.toml` from this step. An exemption is a claim about the harness rather than the branch, so entries are hand-authored.

## Step 2b: map script changes

For each changed script path, apply the first matching rule:

| Path                         | Scenario            |
| ---------------------------- | ------------------- |
| `scripts/<domain>/*.sh`      | `infra/<domain>.ts` |
| `scripts/manage-<domain>.sh` | `infra/<domain>.ts` |
| `src/**`                     | unmapped, see below |

For `src/**`, record no scenario. Mark the row `UNMAPPED` and append `Closest e2e: bun run check:install` to its hint.

If a domain produces no `infra/<domain>.ts`, do not guess. Ask `Scenario for <script-path>? (path under sandbox/, or "none" if the domain has no scenario)` and accept `none` as an opt-out. The census covers skills alone, and a second census for domains would cost more than this one prompt.

## Step 3: classify each pairing

- **aligned**: scenario path is set and appears in the changed-scenarios list.
- **stale**: scenario path is set but does not appear in the changed-scenarios list.
- **exempt**: the census returned that verdict. Carry the `reason` into the report.
- **should-be-asserted**: the census returned that verdict.
- **outside-census**: the item is a skill under `.claude/skills/`.
- **none**: the user answered `none` at a Step 2a rule 3 or rule 6 prompt, or at a Step 2b prompt.
- **unmapped**: no scenario was identified, no census verdict applies, and the user did not answer `none`, or the item is under `src/**`.

`canon/context/development/sandbox.md` owns what each verdict means. `none` covers only an answer given this run, which separates deferring verification on one branch from ruling that no arm should ever exist.

Every status but `aligned` and `stale` leaves the row with no scenario. The skip conditions below test that one property rather than restating the labels, so they cannot drift as labels are added.

## Step 4: print the report

Build the distinct scenario list from Step 2 in its original input order, so re-runs are deterministic. The first entry is the `Provisioning:` target and any remainder is the `Queued:` list.

Resolve the arm and the gate for the `Provisioning:` scenario here, per the arm rule in `.claude/skills/internal-sandbox-check/references/headless.md` and the skip conditions in Step 6. This step prints both on the `Headless verification:` line, and Step 5 skips on them.

### The report block

Read `.claude/skills/internal-sandbox-check/references/report.md` for the block to print and the rules each section follows.

- Always invoke the local `bun src/cli.ts sandbox`, never `canon sandbox`, which from a worktree runs the main repo's stale scenarios

## Step 5: execute re-provision

Right after printing the report, run only the `Provisioning:` command. Claude Code's permission dialog is the confirmation gate, and no `Queued:` scenario runs, since the user copies the next command after testing the current one.

Skip this step in either case:

- No pairing carries a scenario
- The gate from Step 4 leaves Step 6 free to run, since `canon sandbox run` provisions the same target itself. A gated Step 6 leaves this step to run for the interactive re-test.

## Step 6: run the headless verification

Verify the `Provisioning:` scenario, one arm, through `canon sandbox run`. Read `.claude/skills/internal-sandbox-check/references/headless.md` on reaching this step for the arguments, the verdict report, and the gate vocabulary. Never sweep the `Queued:` list, and do not fix a failing verdict.

Skip the run when no pairing carries a scenario. Otherwise skip it and print `Verification: skipped  <category>:<rest>  →  gate: <label>` when either gate holds:

- `no-mechanism`: the scenario came from a Step 2b script mapping, so no skill invocation exists to pass as the prompt, or the user answered `none` to the arm question
- `credentials`: the scenario declares `anchor: true` and `gh auth status` fails. Check both before running, since an anchor scenario pushes to a private remote and fails there otherwise.

## Do not

- Do not open an interactive sandbox session, since it holds a terminal a headless caller cannot release. The user launches it from the `Interactive re-test:` line.
- Do not read the line above as a ban on `canon sandbox run`. The runner returns when its session ends, and Step 6 is where this session uses it.
- Do not sweep the `Queued:` list through the runner. Verify one arm and let the user ask for the rest.
- Do not propose scenario edits or write an exemption. The skill flags the gap and reports the standing verdict, and the user decides whether to edit, rescope, or accept it.
