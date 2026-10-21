---
name: session-worktree
description: Enters a Claude Code worktree at `.claude/worktrees/<name>/` with a name derived from the active plan or branch. Use when asked to "enter a worktree", "start a worktree", "work in a worktree", or before building an approved plan in this session. Also use when an `Edit` or `Write` to a main-root file such as a plan, a task, or a review report was refused for session isolation. Do NOT use to list, clean up, or rotate worktrees (use `git-worktree`).
metadata:
  family: build
---

# Session worktree

Wrap the `EnterWorktree` entry path with name derivation so the user does not pick a name by hand.

The Guards and Steps gate entry alone. A session loading this skill for a main-root write reads `## Main-root writes`, enters nothing, and runs no guard, which keeps a session already inside a linked worktree off the first guard's stop.

## Guards

- If `git rev-parse --git-dir` and `git rev-parse --git-common-dir` differ, the session is already inside a linked worktree. Stop: `❌ Already in a worktree. Run ExitWorktree first.`
- If neither command resolves, the session is not in a git repo and no `WorktreeCreate` hook is configured. Stop: `❌ Not a git repository. EnterWorktree needs git or a WorktreeCreate hook.`
- If the two match and `git rev-parse --show-superproject-working-tree` prints a path, the session is inside a submodule checkout. Stop: `❌ Inside a submodule of <path>. Run this from there instead.`

### Why the submodule guard sits on the matching branch

Inside a submodule both reads return the same absorbed path under the superproject's `.git/modules/`, so the first guard does not fire. Every later step would then read the submodule as the project and build `.claude/worktrees/` inside a tree the superproject tracks as a commit.

The superproject read is empty in a linked worktree of a submodule and of the superproject alike, so it separates the two states rather than qualifying the first guard.

## Step 1: resolve the main worktree root

Run in parallel:

- `git worktree list --porcelain | awk '/^worktree /{print $2; exit}' 2>/dev/null || pwd`
- `git branch --show-current 2>/dev/null || echo ""`
- `git config --get core.bare 2>/dev/null || echo false`

Plans always live at the main root, never inside a linked worktree.

### Repair a stranded bare flag

`EnterWorktree` writes `core.bare = true` into the shared config and nothing restores it, so the repository can already be broken. Repair it before entering when the value is `true` and `<main-root>/.git` is a directory:

```bash
git config core.bare false
```

The directory test separates the defect from a genuinely bare repository, which keeps its objects at the root with no `.git` directory. Announce the repair in one line naming the flag, and leave the file alone when the value is already `false`.

## Step 2: derive the worktree name

Try each source in order. Stop at the first match.

0. **Caller-supplied.** The invocation carried an argument. Take it as the name and infer nothing further.
   - Accept `<name>` or `<type>/<name>`, where a leading segment matching a type in `${CLAUDE_SKILL_DIR}/../git-branch/references/branch.md` sets `<type>`
   - A bare `<name>` falls to the default type below
1. **Plan matched to current branch.** Derive `<slug>` per `${CLAUDE_SKILL_DIR}/../git-branch/references/slug.md`, and use it if `<main-root>/.canon/plans/feature-<slug>.md` exists.
   - An empty result falls through to the next source rather than becoming `latest`, since the slug is one candidate among several
2. **Single plan file.** List `<main-root>/.canon/plans/feature-*.md`. If exactly one match, derive `<slug>` from the filename.
3. **Multiple plan files, no branch match.** Ask the user which plan. Show the candidate slugs as a numbered list. Do not pick.
4. **Current branch.** When no plan exists, use the `<slug>` from step 1 if it is not `main` or `master`.
   - **4b. Session context.** On `main` or `master` with no matching plan, infer a kebab slug from the conversation's topic and propose it: `Infer: <slug>. Confirm or rename?`
   - At 4b, do not enter the worktree until the user confirms or provides a corrected name
5. **Ask.** None of the above applies. Ask the user for a name. Do not invent one.

Tier 0 sits ahead of the inference because every tier below answers from state the caller cannot set. A dispatched worker starts on `main` beside several plans, so without it the run lands on tier 3 and asks somebody who is not there.

Validate the result: letters, digits, dots, underscores, dashes only, max 64 chars (`/` separators are also allowed). Sanitize a violating name by replacing invalid chars with `-` and truncating, and show the sanitized name in the preview.

### Resolve the type

Resolve `<type>` here too, since Step 3 previews it and Step 5 renames onto it, drawing from the vocabulary in `${CLAUDE_SKILL_DIR}/../git-branch/references/branch.md`.

| Name came from                               | `<type>`                                                    |
| -------------------------------------------- | ----------------------------------------------------------- |
| Tier 0 with a type spelled                   | That type, which no reading overrides                       |
| A plan, through tier 1 or tier 2             | The `type` field of `canon tasks plan-branch <plan> --json` |
| A branch, a bare user name, or anything else | `feat`                                                      |

- The verb is the reading because a type read off a plan's sections is a judgment two sessions can grade differently, and the verb answers the same for both
- Branch on the record rather than on the exit code, which a shell function wrapping `canon` can flatten to zero
- Take `feat` and say the verb did not answer where it refuses, the record has no `type`, or the binary has no `plan-branch`
- A wrong type is cosmetic, since `git-stage` and `git-pr` read types off the diff. Nothing corrects it later, since `git-branch` stops on a conforming name.

### Test both names before entry

Neither read needs a worktree, and a stop after Step 4 leaves one built with the session inside it, so both run here. Leave a collision in place, since resolving either automatically risks the wrong one.

- Branch. `git for-each-ref --format='%(refname)' refs/heads/<type>/<name> refs/remotes/origin/<type>/<name>` printing any ref means the name is taken
- On a taken branch, stop: `❌ Branch <type>/<name> already exists. Resolve manually before continuing.`
- A non-zero exit from that read is a failed read rather than a free name, so stop on it too and say the read failed
- Directory. `<main-root>/.claude/worktrees/<name>/` existing means an earlier entry claimed it. Stop: `❌ Worktree .claude/worktrees/<name>/ already exists. Resolve manually before continuing.`

The tests catch different collisions. Two branches differing only in type, such as `feat/foo` and `fix/foo`, are distinct refs reaching one directory, which only the directory test sees, per `${CLAUDE_SKILL_DIR}/../git-branch/references/slug.md`.

### When the branch test fires

It fires on tiers 1 and 4 whenever the starting branch is already conventional, since the derived name resolves back onto it. Stopping is right, since the concern already has a branch and git refuses a second. It fires on tier 0 when a caller handed a name something holds.

It reads both ref spaces rather than the local head, the way `checkClaim` does, so this skill and a dispatcher clear names alike, and a branch pushed from elsewhere is caught before the first push.

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

`EnterWorktree` creates a branch named `worktree-<name>`, which breaks downstream slug derivation in `auto-ship` and any skill reading `git branch --show-current`. A bare `<name>` fails the `<type>/<description>` guard in `git-pr`, so rename to the conventional form:

```bash
git branch -m worktree-<name> <type>/<name>
```

- The slug transform drops a leading type segment, so every downstream derivation reads `<name>` back out, per `${CLAUDE_SKILL_DIR}/../git-branch/references/slug.md`
- Step 2 cleared the target, so the rename runs unguarded. A ref created between the two points is a racing session, which a re-read narrows rather than closes.
- Skip the rename if the worktree was entered via `path` rather than `name`, since the branch already exists under its own identity

### Repair the bare flag again

Entry also sets `core.bare = true` in the shared config, which strands the main worktree. Every later command there fails with `fatal: this operation must be run in a work tree`, and nothing surfaces until the operator returns to it. Repeat the Step 1 repair, which writes the parent's config from inside the linked worktree:

```bash
git config core.bare false
```

The flag is not set on every entry, so read before writing and announce only when the write happened. Tracked upstream as `anthropics/claude-code#58345`, closed as not planned, so the repair stays until the tool changes.

## Step 6: report whether the tree can run

Every ecosystem installs dependencies into a folder git ignores, and nothing copies it into a fresh worktree. The session learns that from whichever command needs it first, as a missing module rather than an empty directory.

Report the state on one line, and do not install. Entering to read is as common as entering to run, and an install is slow, needs a network, and picks an ecosystem for the session.

### Dependency lines

Run the no-manifest test first, then evaluate node and python independently, each emitting its own line regardless of the other:

- No manifest: `[ ! -f package.json ] && [ ! -f pyproject.toml ] && [ ! -f requirements.txt ]` emits `No package manifest, so there is nothing to install.`
- Node missing: `[ -f package.json ] && [ ! -d node_modules ]` emits `Dependencies are not installed. Run <install> before any build, test, or server command.`
- Node present: `[ -f package.json ] && [ -d node_modules ]` emits `Node dependencies are installed.`
- Python missing: `{ [ -f pyproject.toml ] || [ -f requirements.txt ]; } && [ ! -d .venv ]` emits `No virtual environment. Create and populate one before running anything.`
- Python present: the same manifest test with `[ -d .venv ]` emits `Python dependencies are installed.`

### Reading the lines

The checks follow a few rules that keep a dual-root project and an unread stack honest.

- Take `<install>` from the lockfile beside the manifest. Read `${CLAUDE_SKILL_DIR}/references/install-command.md` when the Node line reports dependencies not installed.
- Name the ecosystem in both installed lines, since a dual-root project fires both checks and an unqualified line reads the same twice
- The no-manifest test runs on its own, never as a fallthrough, which would route a dual-root project there by accident
- `[ -d node_modules ]` reads a symlinked `node_modules` as present, which is the correct read
- The no-manifest line keeps the step honest on a stack this skill cannot read, since silence looks like a check that passed

### Port line

Then report the port this worktree derives, on a second line. Branch on the helper's exit rather than its output, since it prints nothing when it refuses and that would read as offset zero, the main checkout's.

- Present and exiting zero: run `bash scripts/worktree-port.sh` and emit `Port offset <n>. Every served port adds it to the stack default.`
- Present and exiting non-zero: emit `The port helper refuses this directory, so no server here has a port. <its stderr>`
- Absent: `No port derivation installed, so every served port is the stack default.`

The offset is what `role-orchestrator` sends a reader here to read, and what an operator overrides through `WORKTREE_PORT_OFFSET` when two worktrees derive the same value.

Do not invoke `ExitWorktree` from this skill. Exit is the user's call.

## Main-root writes

Route a main-root write by what it does to the file. A whole-file create goes out as a heredoc, a change inside an existing file goes through a `canon` verb, and a delete or a move runs as a plain `rm` or `mv`.

Read `${CLAUDE_SKILL_DIR}/references/main-root-writes.md` for which tools the refusal covers, the mechanics of each route, and the index cost a shell write carries.
