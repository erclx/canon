---
title: Sessions
description: Resolving live peer sessions to the worktree and branch each holds, reading which row is the caller, the liveness confidence field, what each session surface can see, and moving a session to another machine with export and import
---

# Sessions

## List

`canon sessions list` reports every live Claude Code session on the machine with the working directory and branch it holds.

```bash
canon sessions list
canon sessions list --json
canon sessions list --branch feat/parser --json
canon sessions list --branch chore/agents --repository ../caret --json
canon sessions list --self --json
```

| Option                | Behavior                                              |
| --------------------- | ----------------------------------------------------- |
| `--json`              | Add a machine-readable record on stdout               |
| `--branch <name>`     | Report the sessions holding this branch               |
| `--repository <path>` | Answer about this project rather than the working one |
| `--self`              | Report the caller's own row                           |

It reads and never writes. The question it answers is which session to address when work has to reach the one holding a given branch, which a session listing cannot answer on its own.

Exit codes: `0` the roster was read, `1` refused. The refusal carries a `reason` of `no-registry`, `no-repository`, `no-self-identity`, or `no-self-row`.

An exit code says nothing about a call made from a session, since a shell profile may wrap the binary in a function taking its status from a later command. Read the record's `reason` rather than the exit when a skill consumes this.

## Scope and count

`--branch` scopes the match to one repository, and refuses when none resolves. A branch name identifies a branch inside a repository and nothing across a machine, so an unscoped match reaches a session working in a different project, and `main` collides on every machine running two of them.

Which repository that is defaults to the one the command runs in, and `--repository <path>` names another. Every reading moves with it, the session match and the worktree and ref reads alike, because the answer is about that project rather than about where the caller stands. The roster underneath is machine-wide already, so the flag removes a filter rather than widening a search.

That is what a dispatcher reaching outside its own project needs. Without it a check run from the toolkit against a branch held by a live session in a consuming project answered unclaimed, and two sessions were sent onto branches other sessions were holding. One refused on the worktree lock and one cut a second worktree on the same branch, which would have put two sessions pushing to one ref.

A bare run reports every repository and carries a `repository` field on each row, holding the shared git directory that a main checkout and all its linked worktrees agree on. That is what a caller filters on when it wants a scope of its own.

The match can return more than one session. Read the count rather than the first row, since nothing stops two sessions holding one branch, and a caller that treats the result as singular picks among candidates without knowing it.

Resolution reads a session's registered `cwd`, taken at whatever `locate()` finds there rather than wherever it has since worked. That registration updates whenever the harness enters a worktree: a worker dispatched onto `main` re-registers at its own branch once `auto-ship` Step 0 runs. What stays fixed is a session moved by shell command, `cd` or `git -C` against another root, with no worktree entry behind it, so it answers only for the branch its last registered `cwd` sits in.

A session whose `cwd` reflects a harness worktree entry, at launch or mid-session, resolves fully, covering every dispatched worker once Step 0 runs. A zero for a different branch it is genuinely working on is not evidence the branch is unclaimed, only that a shell-moved registration cannot see it.

## Whether a branch is already claimed

With `--branch`, the JSON record also carries `worktree` (the path of any worktree already checked out to it, or `null`), `refs` (the refs that already name the branch, the local head and the `origin` remote-tracking ref alike), and `claimed` (`true` when any of the three holds it).

Read `claimed` rather than composing the three fields by hand. A worktree can outlive the session that made it, and a session can hold a branch before any worktree exists for it. A branch sitting behind a merged pull request has neither and is taken all the same, which is the reading that was missing when a dispatcher cleared a merged branch and told a worker to build on it.

The ref read covers the local head and the remote-tracking ref, which means it sees the remote at whatever the last fetch left behind. A branch pushed from another machine since then reads absent. Closing that gap needs `git ls-remote`, and it is left open deliberately: the remote read costs 0.438s against 0.001s for the local one, on a check that runs before every dispatch.

`worktree`, `refs`, and `claimed` are `null` on a bare run with no `--branch`, since none of the three questions has a branch to answer about. A refusal (`no-registry` or `no-repository`) carries none of the keys at all, which a caller should read as unverified rather than as clear.

Two flags say which reading came up short. `sessionsReadable` is `false` when the session roster could not be read, and `refsReadable` is `false` when the ref read failed. Either one leaves `claimed` covering the readings around it alone, so a `false` there is a report that ran short of evidence rather than a report that the branch is clear. They stay separate fields because a caller told the roster failed goes and looks at the roster, and folding both into one flag would send it to the wrong place.

## Which row is the caller

`--self` narrows the report to the row belonging to the session making the call. A dispatcher reads it to learn the `sessionId` it carries into a launch, because the roster returns every field on every row and marks none of them as the caller.

Three identifier namespaces reach a session and two of them join to a row. Four variables spell them:

- `CLAUDE_CODE_SESSION_ID` holds the roster's own `sessionId`, and is read first because it survives a rename.
- `CLAUDE_PID` holds the caller's process id, which every row already carries as `pid`.
- `CLAUDE_CODE_MESSAGING_SOCKET` spells that same pid in its basename. It is read last, since the spelling is a client convention rather than a published interface and a client that moves the socket drops this rung alone.
- `CLAUDE_CODE_HOST_SESSION_ID` is never read. It carries a `local_`-prefixed value from the harness namespace that matches no row, and it is the variable a reader searching the environment for a session id finds first.

The read refuses rather than returning an empty roster, on the same ground as `no-registry`. A `no-self-identity` refusal means the environment stated none of the three, which is a client identifying its sessions some other way. A `no-self-row` refusal means it stated one and no live row carries it, which is what a session running outside a local process gets.

## What each surface can see

The roster this verb reads and the channel a session sends messages on enumerate different populations, and neither contains the other. Read at one moment, `canon sessions list` returned 6 rows against the 13 peers plus caller the agent listing reported. The roster held a background session at confirmed confidence on two reads a minute apart that the listing never carried, so a live session sat here with no way to reach it. Nine Remote Control sessions ran the other way, reachable there with no row here at all, since they leave no local process for the registry to record.

That bounds what a carried identifier buys. Resolving a `sessionId` to a name here can produce a name the send channel rejects, and `--self` answers nothing for a controller driving from Remote Control, which is the operator working from their phone rather than an edge case. A caller that cannot resolve an addressee reports the failed resolution instead of falling back to a guess.

The `name` field is what both surfaces agree on, and that agreement is what makes the resolution work. `SendMessage` takes a name and carries no identifier parameter, so the carry runs id to name to send rather than sending an id anywhere.

Agreement is not uniqueness, and the last hop is where that bites. Two live sessions can hold one name, the roster carries no field that separates them, and a send to the bare name reaches whichever the channel resolves first. The agent listing prints a ref beside each row and the roster does not, so a name resolving to more than one live row is completed from that listing rather than from anything this verb returns.

## Why the verb exists

A session listing reports a name, a kind, a status, and how long each session has been running. None of those names a branch. Resolving a branch to a session therefore meant ordering the roster by start time and matching it against the order the worktrees were created, which is an inference that fails whenever two sessions start inside the same minute.

Each session writes its own record on disk carrying its working directory beside its own name. This verb reads those records, so a name joins to a branch by an exact match on one file rather than by a guess across two orderings.

## What a row carries

Every row names the session, the process holding it, its working directory, and the branch checked out there. The status field repeats what the session listing reports, so a caller picking a target reads one output instead of two.

A field the record did not carry is reported as null rather than as a value, so an absent start time never reads as a session launched in 1970 and an absent identifier never reads as an empty one.

A row whose branch cannot be read is kept and marked rather than dropped. A caller has to be able to tell a session holding no branch from one the resolver never saw, and the second is the failure the verb replaces. The `unresolved` field carries the reason:

- `detached-head`: the session holds a worktree with no branch name
- `not-a-repository`: the session is working outside any git repository
- `git-unavailable`: git is not on the path, so nothing could be read

## The confidence field

Every report states how liveness was decided, on a pass as well as a failure.

`confirmed` means each row's process was matched against the start time its own record stamped at launch, so the process holding the pid is the session that wrote the file. A caller can address a row of that kind directly.

`unverified` means only that the pid answers a probe. That cannot separate the original session from an unrelated process that inherited its pid after the session ended, so the roster is a candidate list rather than an identity. Treat the mapping as inferred and open the message by naming the branch the reader is believed to hold, asking to be corrected.

The registry holds one record per session and is never pruned, so it accumulates thousands of entries. On the `unverified` path a stale record whose pid has been reused reads as live, which is why the field is reported rather than assumed.

## The status dwell

Every row carries `statusUpdatedAt`, the stamp a client writes beside `status` at the moment it last changed, and `statusDwellMs`, the elapsed milliseconds since that stamp. Measured over the live registry, 23 of 341 usable records carry `statusUpdatedAt`, so `null` is the ordinary answer rather than an edge case, and the absence tracks a client version rather than a record's age alone: the one record ever measured carrying `status: "waiting"` is among the 318 without it.

`statusDwellMs` falls back to the coarser `updatedAt` stamp when `statusUpdatedAt` is absent, so it is `null` only where a record carries neither. `statusUpdatedAt` itself is never backfilled from the fallback and stays `null` in that case, since it names the exact stamp rather than an estimate. A stamp ahead of the reading clock clamps the dwell to zero rather than reporting a negative one.

The dwell is what separates a status that resolves on its own from one that does not. `busy` and `idle` transition without help, so a long dwell there is ordinary. `waiting` does not: a session in that state is blocked on something outside itself, and a dwell that keeps growing past the ordinary span of a prompt is a session stalled rather than paused. `canon sessions list` renders the dwell beside the status at the coarsest unit that keeps it a whole number, and the JSON record carries both fields on every row.

## Export

`canon sessions export <id>` packs one session into a single gzip tarball so it can resume on another machine. The bundle holds the transcript, its side folder with every path kept, and a manifest.

```bash
canon sessions export <id>
canon sessions export <id> --out ~/session.tar.gz --json
```

| Option         | Behavior                                                   |
| -------------- | ---------------------------------------------------------- |
| `--out <path>` | Write the bundle here rather than under the scratch folder |
| `--json`       | Add a machine-readable record on stdout                    |

Without `--out` the bundle lands at `.canon/tmp/session-export/<id>.tar.gz` under the main worktree root, which is gitignored and reclaimed by `canon records prune-tmp`. It writes locally and never uploads. A transcript holds whatever tool output passed through the session, credentials included where one was printed, so treat the bundle as private.

Exit codes: `0` the bundle was written, `1` refused. The refusal carries a `reason` of `not-found`, where no project folder holds a transcript for the id, or `no-archive`, where the running Bun predates `Bun.Archive`.

The lookup walks every folder under the configuration directory's `projects/`, so a transcript filed under any encoding is found. The transcript is read up to its last newline and never rewritten, so a session exporting itself mid-append drops at most the half line it was writing.

Export runs no skill. Write a handoff with `canon:session-compact` and push it with `canon records push` first where one is wanted. The manifest reports whether a handoff exists and whether it reached the records history, and whatever calls the verb owns that order.

### The manifest

| Field              | Holds                                                                        |
| ------------------ | ---------------------------------------------------------------------------- |
| `format`           | The bundle format version, `1`                                               |
| `sessionId`        | The exported id                                                              |
| `title`            | The last custom title the transcript recorded, or `null`                     |
| `cwd`              | The last working directory the transcript recorded, or `null`                |
| `root`             | The main worktree root of the repository the export read                     |
| `origin`           | The `origin` remote reduced to `host/path`, or `null`                        |
| `branch`, `head`   | The branch and commit of the checkout the export ran in                      |
| `recordsHead`      | The records history `HEAD`, or `null` where no records history exists        |
| `compacted`        | Whether the transcript carries a compaction boundary                         |
| `live`             | Whether the id was live in the roster at export                              |
| `handoff`          | The newest `.canon/compact/` note written since the session began, or `null` |
| `handoffCommitted` | Whether that note is committed in the records history                        |
| `recommend`        | `handoff` where a handoff exists, `transcript` otherwise                     |

`recommend` prefers the handoff even though the transcript resumes in full. A resumed transcript carries the source machine's absolute paths into a session working somewhere else, and a handoff states the work without them.

## Import

`canon sessions import <bundle>` places an exported session under this machine's configuration directory so `claude` can resume it.

```bash
canon sessions import session.tar.gz
canon sessions import session.tar.gz --root ~/repos/canon --json
```

| Option          | Behavior                                                   |
| --------------- | ---------------------------------------------------------- |
| `--root <path>` | The repository to resume in. Defaults to the main worktree |
| `--json`        | Add a machine-readable record on stdout                    |

The transcript and side folder land under `projects/<encoding>/`, where the encoding is the root with every character outside `[A-Za-z0-9]` turned into a dash. Import writes new files only and never overwrites.

Exit codes: `0` the session was placed, `1` refused. The refusal carries one of these reasons:

- `not-a-bundle`: the file is no gzip tarball, carries no manifest at format `1`, or names a path outside its own session, such as one climbing out with `..` or an absolute one
- `other-repository`: the local `origin` differs from the one the bundle recorded
- `exists`: the target transcript or side folder is already there, or any other project folder already holds a transcript for the id, which `--resume <id>` could reach first
- `live-here`: the id is live in the local roster, so a second copy would fork it
- `no-archive`: the running Bun predates `Bun.Archive`

A placed session can still lag the source. The record's `behind` list carries `repository-behind` when this checkout lacks the exported `HEAD`, and `records-behind` when the records history lacks the exported records commit, which `canon records pull` brings. Neither refuses, since each has a remedy the reader runs before resuming.

On success the record carries two `routes`. One runs `claude --resume <id>` from the root, and the other starts `claude` there and runs `/canon:session-resume` bare against the handoff.

### What resume depends on

Measured on `claude` 2.1.281 on 2026-09-24, `--resume <id>` found a copied transcript in any folder under `projects/` and chained the next turn onto its full history, run from a repository path the transcript never recorded. `--continue` found it only under the local encoding, which is why import derives the folder rather than keeping the source machine's.

The encoding is inferred from observed folders rather than read from a published rule, and how a client shortens a path past its length limit was never observed. A client changing the rule leaves `--continue` looking elsewhere while `--resume <id>` still works. The framed report names the derived folder so a reader can compare.

The side folder did not change the conversation sent. What it carries is `tool-results/`, which a `persisted-output` pointer in the transcript names by the source machine's absolute path, and `subagents/`, which holds background agent transcripts. On a machine whose path matches, those pointers resolve. On one whose path differs, they dangle.

Resuming on the target while the source session keeps running forks the conversation, and nothing detects that across machines. The manifest's `live` field and the printed routes are the only warning.

## What the read depends on

The records live under the Claude Code configuration directory, which the verb resolves from `CLAUDE_CONFIG_DIR` and falls back to `~/.claude`. Their location, their filenames, and the fields inside them are a client implementation detail rather than a published interface, so a client change can move them. The verb reports an absent registry as a refusal rather than as a machine running no sessions, which is what surfaces the move instead of burying it in an empty roster.

The start-time comparison reads the process filesystem and exists only on some platforms. Where it does not, the verb still answers and marks the confidence, so a target without it keeps a working roster rather than losing the command.
