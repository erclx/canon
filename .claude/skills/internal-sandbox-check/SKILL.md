---
name: internal-sandbox-check
description: Audits the current branch for skill or script edits that lack a matching sandbox scenario update. Reports per-item pairings, drives a headless verification run against the first changed scenario, and prints the interactive re-test command for the rest. Auto-trigger at ship time after editing `claude/skills/**/SKILL.md`, `scripts/**`, or `src/**` when the user signals end-of-feature ("ready to ship", "open PR", "before push", "wrap up", "ship it"). Do NOT auto-trigger on individual file edits mid-feature or on docs-only changes.
---

# Sandbox check

Manual guard after editing a plugin skill or a domain script. Reports whether each changed item has a paired scenario edit, verifies the first changed scenario headlessly, and prints the interactive re-test command for the user to launch against the rest.

Verification runs without a human opening a session. `scripts/sandbox/run.sh` drives a skill through `claude -p`, provisions the scenario itself, and returns a verdict. An item that still ships unverified names which gate stopped it.

## Guards

- If the current branch is `main` or `master`, stop: `❌ On main. Checkout a feature branch first.`
- If both `git diff "$(git merge-base main HEAD)" --name-only -- 'claude/skills/**/SKILL.md' '.claude/skills/**/SKILL.md'` and `git diff "$(git merge-base main HEAD)" --name-only -- 'scripts/**' 'src/**'` are empty, stop: `✅ No skill or script changes since main.`

## Step 1: collect changed files

Run in parallel from the worktree root:

```bash
git diff "$(git merge-base main HEAD)" --name-only -- 'claude/skills/**/SKILL.md' '.claude/skills/**/SKILL.md'
```

```bash
git diff "$(git merge-base main HEAD)" --name-only -- 'scripts/**' 'src/**'
```

```bash
git diff "$(git merge-base main HEAD)" --name-only -- 'scripts/sandbox/**/*.sh'
```

```bash
pwd
```

The four lists, in order:

- The changed skills, both plugin (`claude/skills/`) and internal (`.claude/skills/`)
- The changed scripts (`scripts/`, `src/`)
- The changed sandbox scenarios
- The current root, whether that is main or a linked worktree

`.sandbox/` lives under whichever root ran `manage-sandbox.sh`, because the script resolves `PROJECT_ROOT` from its own path.

Drop any path in the script list that already appears in the scenario list. Scenario edits surface through the "Scenarios changed but not paired" tail and do not need a mapping pass.

## Step 2a: map skill changes

Read the census once before the loop, invoking the worktree-local CLI:

```bash
bun src/cli.ts sandbox coverage --skills --json
```

Use the local entry point for the reason the `Provisioning:` line does. A globally installed `canon` resolves to the main checkout and would report main's skills against this branch. If the command fails, treat the census as holding nothing. Rules 2 through 4 then match nothing, internal skills still resolve at rule 5, and every plugin skill falls through to the prompt.

For each changed skill path under `claude/skills/<skill-name>/SKILL.md` or `.claude/skills/<skill-name>/SKILL.md`, apply the first matching rule:

1. Split `<skill-name>` on the first `-` into `<category>` and `<rest>`. If `scripts/sandbox/<category>/<rest>.sh` exists in the worktree, record that path as the scenario.
2. If the skill's census entry names a scenario `<category>:<command>`, record `scripts/sandbox/<category>/<command>.sh`. The census pairs a second spelling this step's split does not, which is what reaches `target-setup` through `claude:target-setup`, a name rule 1 cannot split at all.
3. If the census carries the skill with no scenario and `scripts/sandbox/infra/<rest>.sh` exists, a scenario file is sitting where no spelling reaches it. Ask, naming the candidate: `Scenario for <skill-name>? Candidate: scripts/sandbox/infra/<rest>.sh (path under scripts/sandbox/, or "none")`. Accept `none` as an explicit opt-out.
4. If the census carries the skill with no scenario and no candidate exists, record its `verdict`, carrying the `reason` for an exempt one. Do not ask. A verdict is a standing ruling, and re-deciding it per branch is what produces an answer that lives one session.
5. If the path is under `.claude/skills/`, record `outside-census`. The census counts `claude/skills/` alone, so an internal skill is absent by construction rather than unknown, and asking would repeat the question every branch.
6. Otherwise the skill is a plugin skill the census has yet to see, which is a genuine unknown. Ask the user: `Scenario for <skill-name>? (path under scripts/sandbox/, or "none" if the skill has no scenario)`. Record the answer. Accept `none` as an explicit opt-out.

Rule 3 offers the candidate and does not record it. Both answers are live, because a file at that path is evidence a scenario exists rather than proof it exercises this skill. A coincidental name match would report a skill as covered by a scenario that stages an unrelated tree, which is the vacuous pass the coverage entry exists to prevent, while `setup-gov` against `infra/gov.sh` was a real pairing before the setup merge retired that skill. One person settling that beats either rule deciding it.

Do not guess past the candidate. Fuzzy matching across sandbox categories produces wrong pairings, such as the retired `setup-gov` pairing to `infra/gov.sh` rather than to `gov/install.sh`, so rule 3 tests one path and offers it rather than searching for a plausible one.

Do not write to `scripts/sandbox/exempt.toml` from this step. An exemption is a claim about the harness rather than about the branch in hand, and one authored mid-ship-check is how the file's two-kinds rule erodes. Entries are hand-authored.

## Step 2b: map script changes

For each changed script path, apply the first matching rule:

| Path                         | Scenario            |
| ---------------------------- | ------------------- |
| `scripts/<domain>/*.sh`      | `infra/<domain>.sh` |
| `scripts/manage-<domain>.sh` | `infra/<domain>.sh` |
| `scripts/lib/<name>.sh`      | see lib rule below  |
| `src/**`                     | unmapped, see below |

For `scripts/lib/<name>.sh`:

1. If `scripts/sandbox/infra/<name>.sh` exists, record that path as the scenario.
2. Otherwise, grep `scripts/sandbox/**/*.sh` for `source.*<name>` and record every matched scenario.

For `src/**`, do not record a scenario. Mark the row `UNMAPPED` and append `Closest e2e: bun run check:install` to the row's hint.

If a domain produces no `infra/<domain>.sh`, do not guess. Ask the user: `Scenario for <script-path>? (path under scripts/sandbox/, or "none" if the domain has no scenario)`. Accept `none` as an explicit opt-out.

The census does not reach this step. It is a census of skills, and a script domain is not one, so the prompt Step 2a drops stays here in full. Standing up a second census for domains costs more than the one prompt it would remove.

## Step 3: classify each pairing

- **aligned**: scenario path is set and appears in the changed-scenarios list.
- **stale**: scenario path is set but does not appear in the changed-scenarios list.
- **exempt**: the census returned that verdict. Carry the `reason` into the report.
- **should-be-asserted**: the census returned that verdict.
- **outside-census**: the item is a skill under `.claude/skills/`.
- **none**: the user answered `none` at a Step 2a rule 3 or rule 6 prompt, or at a Step 2b prompt.
- **unmapped**: no scenario was identified, no census verdict applies, and the user did not answer `none`, or the item is under `src/**`.

The two verdict rows are reports rather than decisions, and `canon/context/sandbox/coverage/census.md` owns what each verdict means. Do not restate that here. `none` now covers only an answer someone gave this run, which is what separates deferring verification on one branch from ruling that no arm should ever exist.

Every status but `aligned` and `stale` leaves the row with no scenario. The four skip conditions below test that one property rather than restating the five labels, which is what keeps them from drifting apart as labels are added.

## Step 4: print the report

Build the distinct scenario list from Step 2 results. Keep their original input order so re-runs are deterministic. The first entry is the `Provisioning:` target. Any remainder is the `Queued:` list.

Resolve the arm and the gate for the `Provisioning:` scenario here, following the arm rule and the gate list in Step 6. Both outcomes are read before Step 6 runs: this step prints them on the `Headless verification:` line, and Step 5 skips on them. Collecting either one later would print a command against an unresolved arm and skip provisioning on an answer nobody has given yet.

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

## Step 5: execute re-provision

Immediately after printing the report, run only the `Provisioning:` command. Claude Code's tool permission dialog is the confirmation gate. Do not pause for additional user input.

Do not run any `Queued:` scenarios. The user copies the next command after testing the current one.

Skip this step when no pairing carries a scenario.

Also skip it when the gate resolved in Step 4 leaves Step 6 free to run. `run.sh` provisions the same target before its session, so a separate provision is duplicate work. A gated Step 6 leaves this step to run, since the user still needs the scenario provisioned for the interactive re-test.

## Step 6: run the headless verification

Verify the `Provisioning:` scenario, one arm, through `scripts/sandbox/run.sh`. Read `${CLAUDE_SKILL_DIR}/references/headless.md` on reaching this step for the arguments, the verdict report, and the gate vocabulary. Never sweep the `Queued:` list, and do not fix a failing verdict.

Skip the run and print `Verification: skipped  <category>:<rest>  →  gate: <label>` when either condition holds:

- `no-mechanism`: the `Provisioning:` scenario came from a Step 2b script mapping, so no skill invocation exists to pass as the prompt, or the user answered `none` to the arm question
- `credentials`: the scenario file declares a `use_anchor` function and `gh auth status` fails. Those scenarios push to a private remote, so the failure is the credential rather than the skill. Check both before running, since no precondition catches this and a missing credential otherwise surfaces as a push error naming the host.

Skip this step when no pairing carries a scenario, the same condition Step 5 names. There is no scenario to verify.

## Do not

- Do not open an interactive sandbox session. An interactive session holds a terminal a headless caller cannot release, so the user launches that one from the `Interactive re-test:` line.
- Do not read the line above as a ban on `scripts/sandbox/run.sh`. The runner returns when its session ends and holds nothing, and Step 6 is where this session uses it.
- Do not sweep the `Queued:` list through the runner. Verify one arm and let the user ask for the rest.
- Do not propose scenario edits, and do not write an exemption. The skill flags the gap and reports the standing verdict. The user decides whether to edit, rescope, or accept as intentional.
