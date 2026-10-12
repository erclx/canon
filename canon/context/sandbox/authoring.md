---
title: Authoring
description: Scenario file shape, the provisioning order, and the disposable GitHub remote
---

# Authoring

A scenario is a `.ts` file whose default export declares its config, its anchor flag, and its arms. `src/sandbox/provision.ts` handles provisioning, asset injection, skill injection, git setup, and baseline tagging, and the declaration configures that pipeline before it runs. `canon/context/sandbox/fixtures.md` covers the file content a scenario stages.

## Decisions

### Where the scenario context lives

Keeping the context in a `sandbox/lib/` beside the scenarios was the rejected alternative. Five `src/` readers load a scenario, and `src/` importing from a folder the package does not ship breaks the installed CLI.

### Which commit `SANDBOX_SKIP_AUTO_COMMIT` gates

Two steps in `src/sandbox/provision.ts` commit, and the flag reaches only the second. Provisioning injects seeds and rules and closes on the environment commit. Only afterwards does the stage run the arm, then `injectChangedSkills`, then `commitScenarioChanges`, which is the commit the flag guards.

That order lets an arm stage a deliberately dirty tree. Work an arm leaves staged, unstaged, or untracked survives provisioning under the flag, because the unconditional commit already ran.

### Injecting changed skills

After the arm, `injectChangedSkills` unions the `claude/skills/**/SKILL.md` diff with any untracked new skill folders and copies each into `<sandbox>/.claude/skills/<name>/SKILL.md`. Project-scoped skills take priority over the installed plugin, so invoking `/<skill-name>` in the sandbox session exercises the branch's version, committed or not, without `--plugin-dir` or `--bare`.

Injection serves an interactive sandbox, where a person typing a bare `/<skill-name>` has no `--plugin-dir` to reach the branch's body. `canon sandbox run` opts out by setting `SANDBOX_SKIP_SKILL_INJECT=1` on its provisioning child, and `injectChangedSkills` then copies nothing and logs the skip. Its session already loads the branch's skills whole through `--plugin-dir`, and a lone copied `SKILL.md` would shadow that folder and strand its references. Set the flag from the headless runner only, never from a scenario's `config`, or an interactive provision of that scenario stops injecting too.

- The diff lists a skill the branch deleted beside one it changed, so the loop skips a path no longer in the tree and a branch retiring a skill provisions without a failed copy.
- The changed set diffs against `git merge-base HEAD origin/main`, falling back to `merge-base HEAD main` and then to bare `main`. A checkout whose local `main` trails the remote still diffs against what merged, rather than injecting bodies from commits the branch never touched.
- Under `SANDBOX_SKIP_AUTO_COMMIT` the copies would stay untracked and reach an arm whose skill reads untracked files, so each is appended to `$SANDBOX/.git/info/exclude` right after the copy. That keeps it off `git ls-files --others --exclude-standard` while `.claude/skills/` still loads it.

### Gov injection

`SANDBOX_INJECT_GOV` runs `canon gov install` against the sandbox rather than copying a source tree, so the sandbox cannot drift from what a target receives and provisioning exercises the installer as a side effect. `SANDBOX_GOV_STACK` picks the stack and defaults to `base`. A stack install narrows what arrives to that stack's subset of `governance/rules`, which is what a real target holds, so a scenario needing a framework's rules sets the stack rather than assuming every rule is present.

A failed install aborts provisioning with the installer's own stderr, since a sandbox missing the rules a scenario depends on would otherwise fail later somewhere unrelated.

### The anchor remote

`SANDBOX_ANCHOR_REPO` in `src/sandbox/scenario.ts` holds the repository name, `canon-sandbox`, in one place, and every scenario declaring `anchor: true` pushes to it.

- The anchor URL is built once and reaches GitHub over HTTPS rather than SSH, since an agent cannot answer a passphrase prompt and a machine carrying only `gh` credentials has none to offer SSH.
- The harness sets `credential.helper` to `!gh auth git-credential` on the sandbox repo rather than expecting the operator to run `gh auth setup-git`. `gh auth login` leaves git without a credential, and scoping the helper to the throwaway repo keeps the operator's global config unwritten while covering the pushes the agent makes from inside the sandbox.
- Setting the helper resets the list first with an empty value. `credential.helper` is multi-valued across system, global, and local config, so a plain set leaves an operator's own `store` entry or stale token answering first, and the push fails with a 403 on exactly the machines this setup serves.

#### Prompts and identity

- `GIT_TERMINAL_PROMPT=0` is set by the provisioning harness for every child it spawns and again by `canon sandbox run`. Git otherwise falls back to a terminal prompt when no helper supplies a credential, which would block on `/dev/tty` rather than fail. The runner needs its own setting because the agent pushes from a session that does not inherit the provisioning environment.
- The harness refuses an empty `GITHUB_ORG` before staging an anchor tree. Without it an empty `GITHUB_ORG` produces `git remote add origin ""`, which succeeds and leaves the run failing later somewhere unrelated.
- `ctx.anchorRemote()` sets identity and the remote in one call. `ctx.identity()` stays callable alone, since a scenario that never reaches a remote must not acquire one. The baseline push stays with each scenario, because several push after staging their own fixture, and publishing the anchor content early would change what lands on `origin/main`.

### Probing the anchor

`ctx.anchorRemote()` probes for the repository before adding the remote, so an absent one is named before the scenario stages its tree rather than surfacing as a push failure. The probe refuses on a missing anchor and names both repairs, since an absent one is nearly always a wrong `GITHUB_ORG` or a rename nobody performed.

Refusing is the default because every anchor scenario force-pushes to `main`, so a repository created on the spot carries all of them to a pass against something that is not the anchor. `SANDBOX_ANCHOR_CREATE=true` opts into creating it as private, and the probe says when it did. That flag takes `true` or `1` and refuses every other value, including `false`, where the `config` flags are presence tests, since a presence test here would have `false` provisioning a repository. `canon tooling sync --write` takes the same shape, and `canon records push` refuses outright for the reason `canon/context/development/records.md` records.

`gh` reports an absent repository and an unreachable host with the same exit status, so the probe separates them on the 404 alone and treats anything else as a network or credential fault.

### Writing a TypeScript scenario

`sandbox/<category>/<command>.ts` default-exports `scenario()` from `src/sandbox/scenario.ts`, and `sandbox/git/pr.ts` shows the shape. `config` holds the presence flags that steer provisioning, such as `SANDBOX_SKIP_AUTO_COMMIT`, `SANDBOX_INJECT_SEEDS`, and `SANDBOX_INJECT_GOV`. `anchor: true` stages the tree from the anchor fixture and names the repository the scenario pushes to. `arms` maps each arm name to a function staging the tree through its context.

Arm order is routing order, so a headless caller naming none gets the first. A lone arm named `default` routes nothing.

The arms run in the harness process, so the context is the only way into the tree. Every command it runs takes `ctx.dir` as its `cwd`, and a scenario never calls `process.chdir` or spawns a child itself. A failing command stops the arm with its status as `set -e` did, `allowFailure` is the `|| true`, `ctx.exec` hands the run to a verb, `ctx.capture` holds a command's status and streams, `prepare` runs ahead of routing, and `prompt` names the picker. Narration stays as `ctx.log` calls, so `canon sandbox equivalence` compares a log byte for byte.

An arm ends its narration with a ready line and an `Action:` line spelling the full command a caller should type, arguments included, since `canon/context/sandbox/headless.md` explains why a bare invocation fails on a skill that guards on its argument. A scenario with several arms narrates its options ahead of routing through `prepare`, with `: ` between an option name and its description and the names padded so the separators align. Commit messages an arm writes follow `claude/skills/git-commit/references/commit.md`.

`SANDBOX_INJECT_SEEDS` runs `canon claude init` into the sandbox, so the arm holds `CLAUDE.md` and each seed at the root the installer places it under before it runs. The install merges `.canon/` into the sandbox `.gitignore`, so a record staged there stays untracked and a `git add .` over it commits nothing. There is no standards injection.

### The disposable remote

The repository at `${GITHUB_ORG}/canon-sandbox` exists for `gh`-dependent skills (open PRs, push branches, merge, edit PR bodies) and is fully disposable. Each scenario owns its own reset:

1. Close any open PRs it will recreate (`gh pr close <branch> 2>/dev/null || true`)
2. Delete any remote branches it will recreate (`git push origin --delete <branch> -q 2>/dev/null || true`)
3. Force-push a fresh main (`git push --force origin HEAD:main`)
4. Recreate branches and open PRs

Let each cleanup call fail quietly so a missing branch or PR from the prior run does not abort the scenario.

## Gotchas

- The empty tree `src/sandbox/provision.ts` starts from carries a `.gitignore` holding `.canon/tmp/` and `node_modules` before the arm runs, so a scenario modelling ignore-entry drift rewrites a file it did not create. Truncating it drops both entries, and a session that installs anything then has `node_modules` tracked. Copy the file before the write and restore the copy afterwards, which removes exactly what the write added. The same shape covers any file the harness seeds and a scenario modifies.
- A refusal arm that stages nothing still owes its commit call a check. The arm runs after the seed-injection commit, so an arm changing nothing on disk hits an empty diff, which exits 1 and fails the arm before its narration prints. Skip the commit call on an arm whose fixture is the absence of a file.
- A failure arm naming its expected cause still fires for causes nobody anticipated. A `gh` call carrying an unsupported flag fails straight into a fallback log line with no pull request created, while the scenario reports ready. Give a fallback a message naming the failure rather than a guess at its cause, and follow any precondition step with a read proving the artifact exists.
- An anchor arm that declares `anchor: true` and never calls `ctx.anchorRemote()` runs the full anchor provisioning path with no network call and no force-push to the shared remote. Provisioning dispatches on `anchor` alone, so a throwaway scenario declaring it with a no-op arm checks provisioning, and a pushing arm is worth spending only on the run that has to prove the remote path. The second way to run an anchor arm without a force-push is `canon sandbox equivalence <category> --stub-remote`, which points the arm at a local bare repository and a stub `gh`. `canon/context/sandbox/fixtures.md` covers what it compares.
- A scenario that wipes the tree or skips `SANDBOX_INJECT_SEEDS` owns creating every parent folder it writes into. The seed install is the only thing that puts `canon/` on disk, so a write into `canon/REQUIREMENTS.md` stops the arm before it reaches its skill. A surface move rechecks the `mkdir` above each rewritten redirect, since seeded scenarios hide the break.
