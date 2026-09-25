---
name: session-worktree
description: Why worktree entry is wrapped rather than called directly, covering name derivation, the conventional branch rename the ship chain depends on, and the shared-config repair
---

# Session worktree requirement

## Gap

Without this skill, the user names the worktree by hand, and a name matching no plan breaks every slug derived from it afterward. The entry tool then creates the branch as `worktree-<name>`, which diverges from the name the folder carries, so the ship chain looks for a plan file under a slug that does not exist and stops with nothing wrong except the name. Correcting that to the bare name leaves the branch carrying no type, which `git-pr` refuses on format, so the same run stops a second time with the work already done and uncommitted.

Entry also writes the bare flag into the shared config, which strands the main worktree. Every command run there fails while the files sit untouched on disk, and the linked worktree keeps working, so nothing surfaces until the operator returns to the main checkout and finds the repository broken. A rename onto a branch that already exists is the third failure, and it is the one that destroys work rather than blocking it.

The tree the entry hands over is also not one the session can run. Dependencies live in a folder git ignores and never shares between working directories, so a fresh worktree arrives with none, and nothing on the entry path says so. The session finds out from whichever command needs them first, and the message it gets names a missing module rather than an empty working directory.

A declined request also has to land somewhere. The description turns away a list, cleanup, or rotation request and names no destination, so the session that reads it picks one, while the sibling owning those requests already points back here. One half of a pair carrying the pointer reads as the boundary running one way.

A submodule checkout is the state the entry path reads wrong while reporting nothing. The two directory reads that separate a linked worktree from a plain checkout return the same path there, so the guard passes and every derivation after it takes the submodule for the project: the main root, the plan lookup, and the folder entry builds all resolve inside a tree the superproject tracks as a commit.

A stack that derives its ports from the working directory has the same shape. The number is correct and invisible, and `role-orchestrator` sends a reader here to read it rather than assign one, so the entry that knows the working directory is the surface that owes it.

A session writing to the main root meets a refusal from inside a linked worktree, and from a background session that entered none. The refusal points at a worktree copy that reports success and that no later session reads, and every skill body writing there carried its own copy of the route around it, which had begun to disagree. The skill that resolves the main root is the one surface every one of those bodies can name, so it owes the routing once.

## Must

- Derive the name from the plan matched to the current branch, falling through the ordered sources rather than picking
- Validate and sanitize the derived name against what the entry tool accepts
- Preview the resolved name and which source produced it before entering
- Rename the created branch to a conventional `<type>/<name>`, so the pull request guard accepts it and the slug transform still reads `<name>` back out
- Take the type from the plan the name came from, and default to `feat` when a branch or the user supplied it
- Test the target branch and the target directory before entering, so a stop costs no worktree
- Read the bare flag before writing it, and repair it on both sides of entry
- Announce the repair only when a write actually happened
- Report on one line whether the entered worktree carries its dependencies, naming the command that installs them when it does not
- Report the same way when the project declares no package manifest, since silence there reads as a passing check
- Report the port offset this worktree derives, and say so when the project installs no derivation
- Name `git-worktree` where the description declines a list, cleanup, or rotation request, matching the pointer that skill already carries back
- State the route each kind of main-root write takes, being a heredoc for a whole-file create, a `canon` verb for a change inside an existing file, and a plain `rm` or `mv` for a delete or a move, along with the index cost a shell write carries

## Must not

- Install dependencies on the session's behalf. Entering a worktree to read is as common as entering one to run, and an install is slow and needs a network.
- Pick between plans when more than one could match. Ask.
- Enter on a name inferred from session context without confirmation
- Delete or overwrite a branch or a worktree directory that already carries the target name
- Rename when the worktree was entered by path, since that branch already has its own identity
- Invoke the exit path, which is the user's call
- Enter a worktree or run a guard for a session that loaded the skill to route a main-root write

## Guards

- Already inside a linked worktree: stop rather than nesting
- Inside a submodule checkout: stop and name the superproject, since the two reads that catch a linked worktree return the same path here and everything derived afterward would take the submodule for the project
- Not a git repository and no creation hook configured: stop
- Target branch already exists: stop before entering and leave it alone, since resolving it automatically risks the wrong branch
- Target worktree directory already exists: stop before entering, which is the only read that sees two branches differing by type collapsing onto one name

## Out of scope

- Listing, cleaning up, or rotating worktrees, which `git-worktree` owns and the description names, since this file routes no session
- Leaving a worktree, which the user decides
- What runs inside the worktree once entered, which the caller drives, apart from the route a main-root write takes
