---
title: Authoring
description: Scenario file shape, the three hooks, the provisioning order, and the disposable GitHub remote
---

# Authoring

Each scenario is a `.sh` file with two optional hook functions, `use_config` and `use_anchor`, and a required `stage_setup` function. `manage-sandbox.sh` handles provisioning, asset injection, skill injection, git setup, and baseline tagging, and the hooks configure that pipeline before it runs. `canon/context/sandbox/fixtures.md` covers the file content a scenario stages.

## Decisions

### Which commit `SANDBOX_SKIP_AUTO_COMMIT` gates

Two helpers in `scripts/manage-sandbox.sh` commit, and the flag reaches only the second. `initialize_sandbox_environment` provisions, then calls `setup_sandbox_assets`, which injects seeds and rules and closes on `commit_environment_setup`. Only afterwards does `execute_sandbox_and_commit` run `stage_setup`, then `inject_changed_skills`, then `commit_sandbox_changes`, which is the commit the flag guards.

That order lets an arm stage a deliberately dirty tree. Work `stage_setup` leaves staged, unstaged, or untracked survives provisioning under the flag, because the unconditional commit already ran. `claude:review-branch` depends on it, staging one bug in each of four halves so the selection rule has all four to read.

### Injecting changed skills

After `stage_setup`, `manage-sandbox.sh` unions the `claude/skills/**/SKILL.md` diff with any untracked new skill folders and copies each into `<sandbox>/.claude/skills/<name>/SKILL.md`. Project-scoped skills take priority over the installed plugin, so invoking `/<skill-name>` in the sandbox session exercises the branch's version, committed or not, without `--plugin-dir` or `--bare`.

- The diff lists a skill the branch deleted beside one it changed, so the loop skips a path no longer in the tree and a branch retiring a skill provisions without a failed copy.
- The changed set comes from `resolve_sandbox_skill_diff_base` in `scripts/lib/sandbox-git.sh`, using `git merge-base HEAD origin/main`, falling back to `merge-base HEAD main` and then to bare `main`. A checkout whose local `main` trails the remote still diffs against what merged, rather than injecting bodies from commits the branch never touched.
- Under `SANDBOX_SKIP_AUTO_COMMIT` the copies would stay untracked and reach an arm whose skill reads untracked files, so each is appended to `$SANDBOX/.git/info/exclude` right after the copy. That keeps it off `git ls-files --others --exclude-standard` while `.claude/skills/` still loads it.

### Gov injection

`SANDBOX_INJECT_GOV` runs `canon gov install` against the sandbox rather than copying a source tree, so the sandbox cannot drift from what a target receives and provisioning exercises the installer as a side effect. `SANDBOX_GOV_STACK` picks the stack and defaults to `base`. A stack install narrows what arrives to that stack's subset of `governance/rules`, which is what a real target holds, so a scenario needing a framework's rules sets the stack rather than assuming every rule is present.

A failed install aborts provisioning with the installer's own stderr, since a sandbox missing the rules a scenario depends on would otherwise fail later somewhere unrelated.

### The anchor remote

`use_sandbox_anchor` in `scripts/lib/sandbox-git.sh` holds the repository name, `aitk-sandbox`, in one place, and every declaring scenario delegates to it with no argument. `ANCHOR_REPO` carries no default, since a fallback would sit permanently unreached. The library exports `use_sandbox_anchor` rather than declaring `use_anchor` itself, because `manage-sandbox.sh` keys off `type -t use_anchor` to decide between staging the anchor fixture and starting empty, and a hook declared at source time would hand an anchor to every scenario sourcing the file for its identity helpers.

- The anchor URL is built once by `sandbox_anchor_url` and reaches GitHub over HTTPS rather than SSH, since an agent cannot answer a passphrase prompt and a machine carrying only `gh` credentials has none to offer SSH.
- The harness sets `credential.helper` to `!gh auth git-credential` on the sandbox repo rather than expecting the operator to run `gh auth setup-git`. `gh auth login` leaves git without a credential, and scoping the helper to the throwaway repo keeps the operator's global config unwritten while covering the pushes the agent makes from inside the sandbox.
- Setting the helper resets the list first with an empty value. `credential.helper` is multi-valued across system, global, and local config, so a plain set leaves an operator's own `store` entry or stale token answering first, and the push fails with a 403 on exactly the machines this setup serves.
- `GIT_TERMINAL_PROMPT=0` is exported by `manage-sandbox.sh` and again by `run.sh`. Git otherwise falls back to a terminal prompt when no helper supplies a credential, which would block on `/dev/tty` rather than fail. `run.sh` needs its own export because the agent pushes from a session that does not inherit the provisioning environment.
- `require_sandbox_anchor_config` runs in the main shell before provisioning, because `sandbox_anchor_url` is called inside command substitutions where `log_error` exits only the subshell. Without it an empty `GITHUB_ORG` produces `git remote add origin ""`, which succeeds and leaves the run failing later somewhere unrelated.
- `configure_sandbox_anchor_remote` sets identity and the remote in one call. `configure_sandbox_git_identity` stays callable alone, since a scenario that never reaches a remote must not acquire one. The baseline push stays with each scenario, because several push after staging their own fixture, and publishing the anchor content early would change what lands on `origin/main`.

### Probing the anchor

`configure_sandbox_anchor_remote` probes for the repository before adding the remote, so an absent one is named before the scenario stages its tree rather than surfacing as a push failure. The probe refuses on a missing anchor and names both repairs, since an absent one is nearly always a wrong `GITHUB_ORG` or a rename nobody performed.

Refusing is the default because every anchor scenario force-pushes to `main`, so a repository created on the spot carries all of them to a pass against something that is not the anchor. `SANDBOX_ANCHOR_CREATE=true` opts into creating it as private, and the probe says when it did. That flag takes `true` or `1` and refuses every other value, including `false`, where the `use_config` flags are presence tests, since a presence test here would have `false` provisioning a repository. `canon tooling sync --write` takes the same shape, and `canon records push` refuses outright for the reason `canon/context/development/records.md` records.

`gh` reports an absent repository and an unreachable host with the same exit status, so the probe separates them on the 404 alone and treats anything else as a network or credential fault.

## Gotchas

- A scenario reading git history through a pipeline ending in an early exit fails on output it read. Scenario files run under `set -o pipefail`, so a `grep -m 1` matching the first line closes the pipe while git is still writing, and the substitution returns git's SIGPIPE status. The failure is timing-dependent and passes by hand in an interactive shell. Take the listing through a process substitution with a `while read` loop and `break`, which pipefail does not observe. `infra:drift` carries both reads in that shape.
- `init_empty_sandbox` writes a `.gitignore` holding `.canon/tmp/` and `node_modules` before `stage_setup` runs, so a scenario modelling ignore-entry drift rewrites a file it did not create. Truncating it drops both entries, and a session that installs anything then has `node_modules` tracked. Copy the file before the write and restore the copy afterwards, which removes exactly what the write added. The same shape covers any file the harness seeds and a scenario modifies.
- A refusal arm that stages nothing still owes its commit call a check. `stage_setup` runs after the seed-injection commit, so an arm changing nothing on disk hits an empty diff, which exits 1 under `set -e` and aborts before the `log_step` lines print. Skip the commit call on an arm whose fixture is the absence of a file.
- A failure arm naming its expected cause still fires for causes nobody anticipated. A `gh` call carrying an unsupported flag fails straight into a fallback log line with no pull request created, while the scenario reports ready. Give a fallback a message naming the failure rather than a guess at its cause, and follow any precondition step with a read proving the artifact exists.
- An anchor arm that declares `use_anchor` and never calls `configure_sandbox_anchor_remote` runs the full anchor provisioning path with no network call and no force-push to the shared remote. `provision_sandbox` dispatches on `type -t use_anchor` alone, so a throwaway scenario declaring it with a no-op `stage_setup` checks provisioning, and a pushing arm is worth spending only on the run that has to prove the remote path.

## stage_setup

`stage_setup` sets up scenario-specific state. It runs inside the sandbox tree after provisioning and asset injection. Commit messages inside it follow `standards/commit.md`.

```bash
stage_setup() {
  # scaffold scenario state
  # end with scenario ready instructions
  log_step "Scenario ready: ..."
  log_info "Action:  what to run"
  log_info "Expect:  what should happen"
}
```

The `Action:` line spells the full command a caller should type, arguments included, since `canon/context/sandbox/headless.md` explains why a bare invocation fails on a skill that guards on its argument.

Multi-scenario files list options before calling `select_or_route_scenario`. Use `: ` as the separator between option name and description, and pad option names so the separators align.

```bash
log_info "install/ : clean target, no rules present"
log_info "sync/    : stale .claude/rules/ present"
log_info "list     : read-only catalog dump, no target needed"
```

## use_config

`use_config` runs before provisioning. Declare it to set sandbox behavior flags.

```bash
use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"  # skip auto-commit after stage_setup
  export SANDBOX_INJECT_SEEDS="true"      # inject tooling/claude/seeds/ into sandbox root
  export SANDBOX_INJECT_GOV="true"        # run canon gov install into the sandbox
}
```

`SANDBOX_INJECT_SEEDS` is a raw copy of `tooling/claude/seeds/.` into the sandbox root, not a run of `canon claude init`. It drops `CLAUDE.md` and the `.claude/` seed files before `stage_setup` runs. There is no standards injection.

## use_anchor

`use_anchor` marks a scenario that needs a real remote. Declaring it stages the sandbox from the anchor fixture instead of starting empty, and names the repository the scenario pushes to.

```bash
use_anchor() {
  use_sandbox_anchor
}
```

The repository at `${GITHUB_ORG}/aitk-sandbox` exists for `gh`-dependent skills (open PRs, push branches, merge, edit PR bodies) and is fully disposable. Each scenario owns its own reset:

1. Close any open PRs it will recreate (`gh pr close <branch> 2>/dev/null || true`)
2. Delete any remote branches it will recreate (`git push origin --delete <branch> -q 2>/dev/null || true`)
3. Force-push a fresh main (`git push --force origin HEAD:main`)
4. Recreate branches and open PRs

Wrap each cleanup call with `2>/dev/null || true` so a missing branch or PR from the prior run does not abort the scenario.
