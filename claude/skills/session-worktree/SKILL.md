---
name: session-worktree
description: Enters a Claude Code worktree at `.claude/worktrees/<name>/` with a name derived from the active plan or branch. Use when asked to "enter a worktree", "start a worktree", "work in a worktree", or at the plan-to-execute boundary after `/plan-feature`. Also use when an `Edit` or `Write` to a main-root file such as a plan, a task, or a memory entry was refused for session isolation. Do NOT use to list, clean up, or rotate worktrees (use `git-worktree`).
---

# Session worktree

Wrap the `EnterWorktree` entry path with name derivation so the user does not pick a name by hand.

The Guards and Steps gate entry alone. A session loading this skill for a main-root write reads `## Main-root writes`, enters nothing, and runs no guard, which is what keeps a session already inside a linked worktree off the first guard's stop.

## Guards

- If `git rev-parse --git-dir` and `git rev-parse --git-common-dir` differ, the session is already inside a linked worktree. Stop: `❌ Already in a worktree. Run ExitWorktree first.`
- If neither command resolves, the session is not in a git repo and no `WorktreeCreate` hook is configured. Stop: `❌ Not a git repository. EnterWorktree needs git or a WorktreeCreate hook.`
- If the two match and `git rev-parse --show-superproject-working-tree` prints a path, the session is inside a submodule checkout. Stop: `❌ Inside a submodule of <path>. Run this from there instead.`

The submodule guard sits on the matching branch rather than ahead of the first one, and a measurement decided that. Inside a submodule at git 2.43.0 both reads return the same absorbed path under the superproject's `.git/modules/`, so the first guard does not fire and the session proceeds. Every derivation below then reads the submodule as the project: Step 1 resolves the main root to the submodule, the plan lookup reads a `.canon/plans/` the project never wrote, and entry builds `.claude/worktrees/` inside a tree the superproject tracks as a commit. The superproject read is empty in a linked worktree of a submodule and in one of the superproject alike, which is why it separates the two states rather than qualifying the first guard.

## Step 1: resolve the main worktree root

Run in parallel:

- `git worktree list --porcelain | awk '/^worktree /{print $2; exit}' 2>/dev/null || pwd`
- `git branch --show-current 2>/dev/null || echo ""`
- `git config --get core.bare 2>/dev/null || echo false`

Plans always live at the main root, never inside a linked worktree.

`EnterWorktree` writes `core.bare = true` into the shared config, and nothing restores it, so the repository can already be broken before this session arrives. Repair it before entering when the value is `true` and `<main-root>/.git` is a directory:

```bash
git config core.bare false
```

The directory test separates the defect from a genuinely bare repository, which keeps its objects at the root and has no `.git` directory. Announce the repair in one line naming the flag. Leave the file alone when the value is already `false`.

## Step 2: derive the worktree name

Try each source in order. Stop at the first match.

0. **Caller-supplied.** The invocation carried an argument. Take it as the name and infer nothing further. Accept `<name>` or `<type>/<name>`, where a leading segment matching a type in `${CLAUDE_SKILL_DIR}/../../standards/branch.md` sets `<type>` and the rest is `<name>`. A bare `<name>` falls to the default type below.
1. **Plan matched to current branch.** Derive `<slug>` per `${CLAUDE_SKILL_DIR}/../../standards/slug.md`. An empty result falls through to the next source here rather than becoming `latest`, since the slug is one candidate among several. If `<main-root>/.canon/plans/feature-<slug>.md` exists, use `<slug>`.
2. **Single plan file.** List `<main-root>/.canon/plans/feature-*.md`. If exactly one match, derive `<slug>` from the filename.
3. **Multiple plan files, no branch match.** Ask the user which plan. Show the candidate slugs as a numbered list. Do not pick.
4. **Current branch.** When no plan exists, use the `<slug>` from step 1 if it is not `main` or `master`.
   4b. **Session context.** When on `main` or `master` with no matching plan, read the current conversation to infer a kebab slug from the topic being discussed. Propose it: `Infer: <slug>. Confirm or rename?` Do not enter the worktree until the user confirms or provides a corrected name.
5. **Ask.** None of the above applies. Ask the user for a name. Do not invent one.

Tier 0 sits ahead of the inference because every tier below it answers from state the caller cannot set, and a caller that already knows the name has no way to say so. That gap is what a dispatched worker meets. It starts on `main`, so tier 1 cannot match, and a board carrying more than one plan puts tier 2 out of reach too, which lands the run on tier 3 and its instruction to ask somebody who is not there. A prompt naming the branch does not reach any of them, since no tier reads the prompt.

Validate the result: letters, digits, dots, underscores, dashes only, max 64 chars (`/` separators are also allowed). If the derived name violates the rule, sanitize by replacing invalid chars with `-` and truncating. Show the sanitized name in the preview before invoking.

Resolve `<type>` here as well, since Step 3 previews it and Step 5 renames onto it, drawing the value from the type vocabulary in `${CLAUDE_SKILL_DIR}/../../standards/branch.md`. A type the caller spelled in tier 0 wins outright and no reading overrides it. A name that came from a plan, through tier 1 or tier 2, takes its type from `canon tasks plan-branch <plan> --json`, read off the record's `type` field. Every other case takes `feat`, which covers a name from a branch, a bare name from the user, and a plan the verb could not answer for.

The verb is the reading rather than this body, because a type read off a plan's `## Summary` and `**Files to touch:**` lines is a judgment, and it has disagreed with itself in production. One dispatch checked `fix/path-form-hook` and the worker took `feat/path-form-hook`, both sides reading the same plan and grading it differently. The verb answers `feat` for every plan, so two sides calling it cannot part.

The caller's type still wins over the verb's, because tier 0 is the one source that knows something no file states. The ordinary caller is `auto-ship` Step 0, which ran the verb itself and is handing over the answer it got, so nothing is overridden in that case either.

Branch on the record rather than on the exit code, which a shell function wrapping `canon` can flatten to zero. Take `feat` and say the verb did not answer where it refuses, where the record carries no `type` key, or where the installed binary carries no `plan-branch` subcommand.

A wrong type is cheap because the branch type is cosmetic rather than because anything corrects it. `git-stage` reads a commit's type off the staged diff and `git-pr` reads a title off the diff too, so the semantics a release reads never pass through the branch name at all. Nothing downstream is wrong when a `feat/` sits over a fix, and a person scanning a worktree listing loses a signal.

`git-branch` does not correct it, which three surfaces used to say it did. Its second guard reads `If branch name already follows conventions, stop`, and `${CLAUDE_SKILL_DIR}/../../standards/branch.md` makes the type vocabulary an axis without making the choice within that vocabulary one, so `feat/` over a fix conforms and the guard fires ahead of the Analysis line that would have re-derived the type.

Then test both names the entry is about to claim. Neither read needs a worktree, and a stop after Step 4 leaves one built with the session sitting inside it, so both belong here rather than beside the rename:

- Branch. `git for-each-ref --format='%(refname)' refs/heads/<type>/<name> refs/remotes/origin/<type>/<name>` printing any ref means the name is taken. Stop: `❌ Branch <type>/<name> already exists. Resolve manually before continuing.` A non-zero exit is a read that failed rather than a free name, so stop on that too and say the read failed.
- Directory. `<main-root>/.claude/worktrees/<name>/` existing means an earlier entry claimed the name. Stop: `❌ Worktree .claude/worktrees/<name>/ already exists. Resolve manually before continuing.`

Leave both in place. Resolving either automatically risks the wrong one.

The two tests catch different collisions. The branch test misses the one `${CLAUDE_SKILL_DIR}/../../standards/slug.md` records, where two branches differing only in type collapse onto one name: `feat/foo` and `fix/foo` are distinct refs and reach one directory. The directory test is the only read that sees it.

The branch test fires on the tier 1 and tier 4 sources whenever the branch the session started on is already conventional, since a name derived from that branch resolves back onto it. Stopping is the answer there. The concern already has a branch, git refuses a second under the same name, and the bare-name rename this replaces only carried the collision forward to the `git-branch` step. It fires on tier 0 as well, where a caller handed a name something already holds.

It reads both ref spaces rather than the local head alone, and it reads them the way `checkClaim` does, so a name this skill clears and a branch a dispatcher cleared are one answer. `git show-ref --verify` is what that replaces. It sees no remote-tracking ref, so a branch pushed from elsewhere passed the test and collided at the first push, and its exit code cannot separate an absent ref from a tree it could not read, which reports a failed read as a free name.

## Step 3: preview

Output exactly:

```plaintext
Worktree: .claude/worktrees/<name>/
Branch:   <type>/<name>
Source:   <plan|branch|user>
```

Step 2 resolved `<type>`. Show it, since it is the one part of the entry the user cannot read off the name they supplied.

## Step 4: enter

Call `EnterWorktree` with `name: "<name>"`. Claude Code's tool permission dialog is the confirmation gate. Do not pause for additional confirmation.

## Step 5: align the branch name and repair the shared config

`EnterWorktree` creates a branch named `worktree-<name>`, which diverges from `<name>` and breaks downstream slug derivation in `auto-ship` and any skill that reads `git branch --show-current`. A bare `<name>` fixes that and fails the branch-format guard in `git-pr`, which requires `<type>/<description>`. Rename to the conventional form, which satisfies both:

```bash
git branch -m worktree-<name> <type>/<name>
```

The slug transform drops a leading type segment, so `<name>` is what every downstream derivation reads back out of the typed branch. See `${CLAUDE_SKILL_DIR}/../../standards/slug.md`.

Step 2 already cleared the target name, so the rename runs unguarded here. Do not repeat the test. A ref created between the two points is a second session racing this one, which a re-read narrows rather than closes.

Skip the rename if the worktree was entered via `path` rather than `name`, since the branch already exists under its own identity.

Entry also sets `core.bare = true` in the shared config, which strands the main worktree. Every later command run there fails with `fatal: this operation must be run in a work tree` while the files sit untouched on disk. The linked worktree keeps working, so nothing surfaces until the operator returns to the main checkout. Repeat the Step 1 repair, which writes the parent's config even from inside the linked worktree:

```bash
git config core.bare false
```

The flag is not set on every entry, so read before writing and announce only when the write happened. Tracked upstream as `anthropics/claude-code#58345`, closed as not planned, so the repair stays until the tool changes.

## Step 6: report whether the tree can run

A linked worktree is a second working directory over one repository, and every ecosystem installs its dependencies into a folder git ignores. Nothing copies that folder across, so a fresh worktree arrives without it and the session learns as much from whichever command needs it first, which reports a missing module rather than an empty working directory.

Report the state on one line. Do not install. Entering a worktree to read is as common as entering one to run, and an install is slow, needs a network, and picks an ecosystem on the session's behalf.

Read the worktree root and evaluate node and python independently against a literal presence test, each emitting its own line regardless of the other's state:

- Node. `[ -f package.json ] && [ ! -d node_modules ]`: `Dependencies are not installed. Run <install> before any build, test, or server command.` `[ -f package.json ] && [ -d node_modules ]`: `Node dependencies are installed.`
- Python. `{ [ -f pyproject.toml ] || [ -f requirements.txt ]; } && [ ! -d .venv ]`: `No virtual environment. Create and populate one before running anything.` `{ [ -f pyproject.toml ] || [ -f requirements.txt ]; } && [ -d .venv ]`: `Python dependencies are installed.`

`[ -d node_modules ]` reads a symlinked `node_modules` as present, which is the correct read rather than a regression.

Name the ecosystem in both installed lines rather than leaving `Dependencies are installed.` unqualified. Both checks can fire on one project, so an unqualified line reported the same sentence twice for a dual-root project with both folders present, and a reader could not tell which half each line answered.

Take `<install>` from the lockfile beside the manifest, checked in this order, first match wins:

| Lockfile                  | Install command |
| ------------------------- | --------------- |
| `bun.lock` or `bun.lockb` | `bun install`   |
| `pnpm-lock.yaml`          | `pnpm install`  |
| `yarn.lock`               | `yarn install`  |
| `package-lock.json`       | `npm install`   |
| none of the above         | `bun install`   |

The order matters only when more than one lockfile sits beside the manifest, such as a project mid-migration between package managers. It is fixed rather than derived from anything about the project, so a reader hitting that rare case checks which manager the project actually uses rather than trusting the row the table picked first.

Emit the closing line only on its own direct test, run ahead of the two checks above rather than reached by falling through them unmatched: `[ ! -f package.json ] && [ ! -f pyproject.toml ] && [ ! -f requirements.txt ]`: `No package manifest, so there is nothing to install.` A dual-root project matches both checks above, and a fallthrough test would route it here by accident.

The closing line is what keeps the step honest on a stack this skill cannot read. Entry is not stack-aware, and silence is indistinguishable from a check that passed.

Then report the port this worktree derives, on a second line:

- `scripts/worktree-port.sh` present and exiting zero: run `bash scripts/worktree-port.sh` and emit `Port offset <n>. Every served port adds it to the stack default.`
- Present and exiting non-zero: emit `The port helper refuses this directory, so no server here has a port. <its stderr>`
- Absent: `No port derivation installed, so every served port is the stack default.`

Branch on the exit rather than on the output, since the helper prints nothing to stdout when it refuses and reading that as a number reports an offset of zero, which is the main checkout's.

The helper refuses a folder left behind after its worktree was removed, which Step 4 cannot land on, since it registers whatever it creates. The branch is here so a refusal is never read back as an offset of zero, which is the main checkout's port and the collision the helper exists to prevent.

The offset is what `role-orchestrator` sends a reader here to read rather than assign, and what an operator overrides through `WORKTREE_PORT_OFFSET` when two worktrees derive the same value. Deriving it correctly and printing it nowhere leaves both instructions naming a number no surface emits.

Do not invoke `ExitWorktree` from this skill. Exit is the user's call.

## Main-root writes

Route a main-root write by what it does to the file: a whole-file create goes out as a heredoc, a change inside an existing file goes through a `canon` verb, and a delete or a move runs as a plain `rm` or `mv`. Read `${CLAUDE_SKILL_DIR}/references/main-root-writes.md` for which tools the refusal covers, the mechanics of each route, and the index cost a shell write carries.
