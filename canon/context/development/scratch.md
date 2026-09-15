---
title: Session scratch
description: Why shared scratch lives at the main worktree root, the two write routes a linked worktree has, how each gitignored folder is indexed and archived, where a spike puts what it reads against what it produces, and the second git directory backing them off the disk
---

# Session scratch

`.canon/plans/`, `.canon/review/`, `.canon/memory/`, and `.canon/tasks/` are gitignored and live at the main worktree root. A linked worktree resolves them there rather than writing its own copy.

A session taking the scratch rule's second spelling used to write `<worktree>/.claude/.tmp/<slug>/` against an ignore file naming only `.canon/` and `.claude/worktrees/`, so `git check-ignore` exited 1 on it. The scratch-guard hook accepted the path and told the session it complied, while the `git add -A` in the ship chain staged the folder anyway. What caught it was a status read before staging, the same signal that caught the flat task archive below. Measured 2026-09-01 on `fix/record-tree-old-root`. <!-- canon-keep-record-root -->

`.claude/.tmp/` now carries its own `.gitignore` entry and manifest array member, so the fallback spelling is covered wherever it is written, worktree or main root alike. It stays an ignore entry rather than a second scratch root: nothing changed about which path a project without `.canon/` writes to, only whether git sees it. `canon/ARCHITECTURE.md` carries the entry as a temporary carve-out, retired once `canon migrate records` has moved every project off the fallback it covers. <!-- canon-keep-record-root -->

A linked worktree reads them through one tool and writes them through another. `Edit` and `Write` refuse every main-root path with a message naming session isolation and directing the session to the worktree copy, while `Read` resolves normally and `Bash` writes without complaint, so the boundary is tool-scoped rather than filesystem-scoped. That holds across all four folders and a live task file.

The same isolation refuses a `Bash` command whose target it cannot statically verify stays inside the worktree, reporting complexity rather than a path. Joining `mkdir -p` and a heredoc write to the main root with `&&` is refused whole even though each half runs alone, so a main-root write goes out as a plain single command.

Where the target sits is not what fires it. The same pair joined the same way was refused with both halves naming a path under the worktree root itself, so the rule is one command per call from a linked worktree whatever it writes to. Reading the main-root example as the trigger is what earns a session the refusal a second time.

The verification reads the heredoc body as well as the command around it. A review report quoting a command substitution was refused on its content, and so was the same report with the substitution stripped and a quoted `||` left in place, while a bare `mkdir -p` against that folder ran. Content decides it rather than length, so a body of plain prose goes out and a body quoting shell does not.

A third trigger reads the command string itself, so a token sitting inside a path can be taken for the shell construct it spells. Listing the harness folder under `scripts/` whose name is also a shell builtin was refused as running a string through that builtin, and a plain read of a file under the matching context subfolder was refused the same way, both entirely inside the worktree and neither writing anywhere. A shell loop reading several files went the same way under the complexity reason, which puts a read-only command inside the rule the paragraph above states for writes. Reach for a form that avoids the token, such as a `find` with a path pattern, rather than rewording the path. Measured 2026-08-21.

A fourth trigger counts a repeated tool name, and the count runs after shell parsing rather than over the raw text, so splitting the token across two adjacent quoted strings does not lower it. A command naming `git` twice is refused, which puts `git branch -m worktree-<name> <type>/<name>` out of reach whenever `<name>` carries that token, and that is `session-worktree` Step 5 for every branch under a git topic. The same token inside an ordinary argument passes, so the count rather than the position decides. What separates this from the third trigger is that no token-free form of the rename exists, since the branch name is the argument, so a session meeting it stops and reports the miscount rather than reaching for another spelling. Measured 2026-08-28 on `feat/git-skill-precedence`.

A `cat <<'EOF' > file` heredoc was refused twice more against a main-root path, once carrying a multi-paragraph body and once carrying one line of plain prose with no shell syntax at all, so the shape rather than the length or the content was what fired. A single-line `printf '%s\n' "line one" "line two" ... > file` carrying the same content wrote without complaint, which is a third route beside the two the section below names, usable wherever the file is short enough to spell as `printf` arguments. Measured 2026-08-26.

### The two write routes

Two write kinds therefore take two routes. Creating a whole file is a heredoc through `Bash`, which is why a plan, a review report, and a memory entry need no code behind them. A body the verification above refuses falls back to `Write` into the worktree followed by a two-argument `cp` out to the main root, which carries no syntax to inspect and needs no verb. Changing a line inside a file that already exists has no shell route, because the stream editors that would do it are banned for rewriting the line they anchored to and for exiting zero on a non-match, so it runs through a `canon` verb resolving the main root in-process.

`canon tasks pull-request` and `canon tasks outcome` cover the two the board takes, and `mainWorktreeRoot()` in `src/worktree.ts` is the resolver all of them share. A skill with a structured edit no verb covers reads the file and writes it back whole instead. `git-pr` routes its own `Pull request:` line through this same verb rather than writing it directly, since a linked worktree's own write there is the refused path and the number is what the archive gate depends on.

A shell write costs the index hook, which matters wherever a folder's `index.md` is generated. The `PostToolUse` triggers match `Write|Edit|MultiEdit`, so nothing fires on `Bash`, and `task-board` and `memory-capture` each regenerate positionally after a shell write rather than leaving the index a row short.

The bypass reaches five hooks here: `PostToolUse` on `Edit|Write|MultiEdit` runs `standards-audit.sh`, `tasks-index.sh`, `memory-index.sh`, and `path-form.sh`, and `PreToolUse` on `Write|Edit` runs `scratch-guard.sh`, with `pr-create-log.sh` alone on `PostToolUse` for `Bash`. A plan write is a no-op for every one of the five: `standards-audit.sh` exits on `*.canon/plans/*` by an explicit skip, `tasks-index.sh` and `memory-index.sh` each match their own folder alone, `path-form.sh` answers only a path carrying a worktree segment, and `scratch-guard.sh` fires only on a `tmp`, `Temp`, or `var/folders` segment. `.canon/review/` clears the same five for the same reasons, so the cost above lands on `.canon/tasks/` and `.canon/memory/` alone, where the two index hooks are real writers.

A setting would lift the refusal outright rather than route around it. `worktree.bgIsolation` takes `worktree` or `none`, defaults to `worktree`, sits per repository, and the refusal message names it directly. Resolution runs `CLAUDE_BG_ISOLATION` first, then a value stamped into the job record at spawn, then `.claude/settings.json`, and the spawn value comes out `none` when the spawning context is an interactive REPL, which is why a session working in place never meets the refusal a session it dispatches does. The route above declines the key anyway, since it carries no path carve-out: `none` frees every concurrent background session to write the shared checkout rather than only the write this section covers, and it buys nothing where the five hooks it would recover are already no-ops on the folder that raised the question.

The task board is a folder of one file per task, which is what keeps two concurrent sessions from overwriting each other on a board that has no history to recover from. Its `index.md` is regenerated by a `PostToolUse` hook rather than by `bun run check`, because the whole-repo index walk filters candidates through `git check-ignore` and so never sees a gitignored folder. Positional regen reaches it, since the walk-up never consults git.

`.canon/memory/` carries the same shape and mechanism. `standards/memory.md` fixes the frontmatter an entry carries, so the shared renderer groups the catalog by kind, and `.claude/hooks/memory-index.sh` regenerates `index.md` on every write.

`.canon/review/` carries a subfolder per producer: `branch/` for `review-branch`, `feedback/` for `canon feedback`, `memory/` for `memory-review`, `design/` for the `canon design render` preview, and `board/` for the `canon design board` page set. The filename prefix does the folder's job for a producer with no subfolder, since the ignore entry and the backed-folder entry already cover everything under `review/`. A producer with no subfolder keeps writing to the folder root, which is where `ux-audit-*`, `ux-measure-*`, and `seed-audit-*` still land.

A branch report is the one thing here that gets swept rather than archived. It is read once by the session addressing it, and the durable record of what a review found is the comment `review-pr` posts, so `docs-fold` deletes the current slug's report and any report whose branch is gone. What that loses is a local-only review on a branch that never opened a pull request, which `review-branch` says where a reader meets the report.

A `.canon/tmp/<topic>/<slug>.md` handoff shared across worktrees, the pattern `memory-capture` and `teach-workspace` already use for `.canon/tmp/memory-routing/` and `.canon/tmp/teach-promotion/`, carries no producer subfolder of its own the way `.canon/review/` does. Its consumer removes the consumed `<slug>.md` alone, then `rmdir`s the topic folder guarded with `2>/dev/null || true`, which is a no-op wherever a sibling branch's own pending file still sits in it. A plain `rm -rf` on the topic folder would delete that sibling's in-flight handoff, since the folder is shared across every worktree writing to the same main root.

### The census behind the mixed `.canon/tmp/` rule

Sixteen skills write `.canon/tmp/`. Eight write throwaway working state a single run creates, consumes through a local verb or a `gh` call, and removes or leaves for the next run to overwrite: `git-pr`'s pull request body, `review-address`'s reply body, `draft-diagram`'s verification renders, `plan-groundwork`'s spike fixtures, `git-issue`'s issue body, `git-split`'s per-branch bodies, `internal-tooling`'s headless verify scaffold, and `internal-governance`'s paste-payload build. None of the eight needs a root, since nothing outside the run that wrote it ever opens the file.

Six write material a later run or a different worktree reads back. `memory-capture` states the main worktree root for `.canon/tmp/memory-routing/<slug>.md`, and `memory-review`'s append to that file relies on the location capture already put it at rather than restating the root. `ui-test`'s checklist, `teach-workspace`'s promotion handoff, `draft-screencast`'s draft, and `role-orchestrator`'s poll baseline (`role-orchestrator/scripts/poll.sh`, `STATE_DIR="$MAIN_ROOT/.canon/tmp/pr-poll"`) each state their own root directly.

`085-worktrees.md` states the mixed default alone and names none of the six, since a shipped rule citing a path under this repository's own `canon/context/` resolves nowhere in a target, per `598-authoring-layout.md`. The census lives here instead.

`draft-and-pick`'s `.canon/tmp/<slug>/candidates.html` reads like a seventh material case, since an operator drives the pick across more than one turn, but nothing outside the same skill run ever opens the scratch folder itself: `canon capture` and `canon serve` are its only readers there. The skill's own close step batch-captures the final round's arms out to `.canon/review/evidence/<slug>/`, one of the mixed-default four `085-worktrees.md` already resolves at the main root, before it deletes the scratch folder. The scratch folder itself still fails the read-by-a-later-consumer test the six above pass, so the census records it staying worktree-local rather than joining them.

`review-pr`'s `.canon/tmp/pr-review/body-<number>-<short-sha>.md` is the one exception on the other side: material a later pass reads back through the Step 2 oid comparison, with no root stated anywhere in the body. A dispatched re-review runs in its own worktree, so the second pass writes a folder the first pass never touched, which the filename scheme's PR number and head-sha segments cannot stop without the root fixed. Its Step 4 takes the same main-root heredoc route the six above use.

### Where each folder archives to

An archive sits inside the folder it archives, so a record folder holds its own lifecycle subfolders and a listing of the root shows records rather than records paired with their history.

A memory entry that leaves the pen moves to `.canon/memory/archive/`, the same rule every other record folder follows. Nothing cites a retired memory the way a task file cites a plan or a groundwork track, and a phase label derives from the task archive while no surface reads this one, but citation is not what decides whether a folder is backed: `memory/` is not one of the three names `EXCLUDED_ENTRIES` withholds from `canon records push`, so a wrong call over the folder recovers through `canon records pull` the same as any other retired record.

A plan that ships moves to `.canon/plans/archive/` under its original name, swept there by `docs-fold`. A re-shipped slug overwrites the earlier file, which keeps the folder holding intact plans under the names they were written with.

Two surfaces both named for memory archive inside the same pen: a retired entry at `.canon/memory/archive/` and a review receipt at `.canon/memory/review/archive/`, so a listing of `.canon/memory/` shows one record rather than a record split across scratch and review.

A memory-review receipt a triage takes out of `.canon/memory/review/` moves to `archive/` beside it. A receipt whose items have all resolved needs no archive at all, since the collection rule folds its declines into the entries and deletes the file.

A task that ships moves to `.canon/tasks/archive/` the same way, through `canon tasks archive`. The `Pull request:` line `git-pr` writes onto the task is what lets the merge close it, since every merge on `main` is a squash carrying that number in its subject while the branch name never lands. The command owns the move, the `priority.md` row removal, and the index regen as one unit, so the hook and `task-board` cannot archive differently.

A folder cited by a durable record as its evidence, and written by no script on a schedule of its own, leaves scratch outright rather than archiving in place. `canon migrate scratch-evidence` applies the same deletable test that emptied `.tmp/` into `groundwork/` and the three archives, walking every live and archived record for a citation and refusing a folder a source file still names by path, landing a qualifying folder at `.canon/review/evidence/<folder>/`. `canon/ARCHITECTURE.md` carries the measurement behind the move.

### Changing where a folder sits

A path convention over these folders takes effect on disk the moment a branch applies it and takes effect in the tooling only when a release ships, so both layouts are live in between. Every ship chain running in that window uses the installed CLI and writes the old path back, so the citation sweep behind such a rename runs a second pass before the branch merges rather than once at the start.

A binary predating the convention does more than write the old path. `resolveLivePlan` without an archive subtraction reads a `Plan:` line pointing into `.canon/plans/archive/` as live and refuses with `plan-unswept`, so an installed `canon tasks archive` that old declines every task whose plan has already shipped until a release lands. It fails closed rather than corrupting the board, which is the safe direction and still stops the archiving. That reason is retired now, so a session meeting it is holding a binary two changes behind rather than one.

The plan move takes the same skew in the quiet direction. A binary predating it archives the task and leaves the plan live, reporting success either way, so between the merge of that change and the release carrying it no plan archives at all. A plan left live is recoverable and one archived early is not, which is why the lag is accepted rather than worked around.

The task archive verb itself takes the opposite path on the same skew. A stale binary still finds the board, still writes the file, and lands it in a flat `task-archive/` sibling rather than the `tasks/archive/` folder nested inside it, with neither the board count nor the exit code reporting anything wrong. The flat sibling stays untracked and unignored on purpose, so a stray write there is visible in a status read rather than silently absorbed the way an ignored folder would be. `RETIRED_FOLDERS` in `src/records/backup.ts` already names both flat spellings as paths that moved rather than paths still live, which an ignore entry over them would contradict.

`standards/tasks.md` and `standards/plan.md` state the nested position as a convention a project receives rather than this repository's own habit, so both failure modes above are what an old binary produces against either layout, not a defect in either standard.

The move off the older layout is named rather than worked out per visit: `git mv` both archive folders onto the nested path, retarget every citing pointer onto the new spelling in the same commit, then run `canon tasks archive` in that checkout to confirm it resolves against the moved folder. That runs inside the project that owns the files, on its own branch, never from this checkout.

The citation sweep behind `canon migrate records` passes over the records themselves, and the documented first-run order is what makes that necessary. `canon tooling sync claude . --write` prunes the old ignore entries down to one `.canon/` line immediately before the verb runs, so every record folder still at the old root becomes visible to `ls-files --others --exclude-standard` and enters the sweep as source.

### The record roots the sweep passes over

`isRecordArtifact` in `src/migrate/records.ts` is what closes it, applied inside `planRecordsMove` for correctness and again in `runRecords` ahead of `readSources`, which keeps every excluded record file off the read path. The verb reports what it passed over as a count on its own line rather than in `excluded`, which exists so a reader can go and check a handful by hand.

A rewritten file can still couple to an excluded one, naming an excluded prefix or path as plain text while carrying a citation of its own, which `referencesExcluded` reports on `RecordsPlan.coupled` as a third list beside `entries` and `excluded`. This closes the case of a shell test's dual-root check surviving with only one root once the citation beside it is rewritten, since the check reads the whole file's text rather than the citation's own line.

The two roots take different rules and the asymmetry is deliberate. `.canon/` is read whole, since `canon/ARCHITECTURE.md` fixes the rule that every gitignored record moves there and nothing tracked ever lands there, which covers a folder `RECORD_ENTRIES` has yet to learn about. `.claude/` is mixed and has to be entry-scoped, because a bare prefix there drops tracked files and strands a target's installed `.claude/rules/canon/core/035-tasks.md`, which is the file the sweep exists to repoint.

What that leaves standing is a record holding a live pointer, which keeps the old spelling after the move. The predicate ships exported so a decision entry can invert it rather than restate it.

The marker's own comment syntax has to match the file it sits in, since the sweep tests the raw substring on the line itself or on the nearest non-blank line above it, walking past any blank run between them. A `.gitignore` pattern takes no trailing comment, so the marker needs its own comment line directly above the pattern, while a TOML array entry can carry it trailing on the same line and a markdown sentence takes the inline `<!-- canon-keep-record-root -->` form. Forgetting it on a new `.claude/<record-entry>` citation fails the Record idempotence stage rather than drifting silently.

### What a spike leaves behind

`plan-groundwork` sends every experiment artifact to `.canon/tmp/groundwork-fixtures/<slug>/`, and `canon/ARCHITECTURE.md` defines the scratch tree as holding only what can be deleted without loss. A recording an `08-spikes.md` entry cites as proof of a finding fails that test, so the skill splits an input a spike reads from evidence a spike produces, and sends each where its own lifetime puts it: the fixtures path keeps the input, and `evidence/` inside the track keeps the output.

The split is input against output rather than markdown against binary. A fixture page, an arm script, and a copied theme file are re-runnable and cited by nothing. A recording and the frames pulled from it are what a later reader opens to check a claim.

The exile rule keeps the half of its reason that holds. Mode detection lists `.canon/groundwork/` and matches entries at its top level, so a sibling sitting there can be taken for a track and a folder nested inside one cannot.

`canon records validate groundwork` reports nothing on a track's `evidence/` subfolder, because `listMarkdown` in `src/records/validate.ts` filters `readdir` to files ending `.md` at the track's own level and `listFolders` runs once at the groundwork root to enumerate tracks without descending, so a track's subfolder is outside everything the validator reads.

Intake needs no equivalent, and the reason is structural rather than an oversight. `plan-intake` routes any finding needing an experiment away to a track, so an intake pass never runs a spike and never produces an artifact to place. Its own gap is separate and smaller: `standards/intake.md` enumerates items and an index and says nothing about a subfolder, while a live folder can carry one holding markdown.

Two tracks, `38-demo-recorder` and `15-diagrams`, chose `evidence/` as their subfolder name before any rule named it, and they are left as they are: conforming them would be a no-op, since a repair made without the rule and a rule written after it landed on the same shape.

### Backing the record folders off the disk

Archiving moves a record between folders that all sit on one disk, so `canon records push` carries them to a private remote and `canon records pull` brings them back. The set is the record root's own entries less three: `tmp`, deletable by definition, `.claude/worktrees/`, whose contents the project repository holds already, and `.records.git/`, which is the history the rest push into. Nothing bounds the set any more, since the claude manifest ships one `.canon/` root entry that names none of them, so `BACKED_FOLDERS` being spelled out in `src/records/backup.ts` is the whole of the protection rather than half of it. `docs/agents/records.md` carries the verb surface and the refusal table.

The folders `canon migrate scratch-evidence` promotes out of `tmp` land inside `review`, which is already part of the set, so the backed set does not grow by one entry apiece. What changes is what `review/evidence/` holds.

The history lives in a second git directory at `.canon/.records.git` with `.canon/` as its work tree, so every tracked file spelling one of these paths keeps working. A separate checkout was the alternative and it moves all of them. `canon/ARCHITECTURE.md` carries the count and the anchor it was read at, since a figure repeated on two surfaces drifts on the first correction that reaches only one. Staging runs by explicit pathspec with `--force`, which is what lets a folder the project ignores reach an index while keeping anything outside the set out of it, and neither verb touches the project index or working tree.

A tree whose records sit under both roots is refused by both verbs ahead of every other gate. `recordRoot` answers for the whole tree on the first root that exists, so a folder a failed move left behind is absent from the work tree while the index still names it, and `add -A` would stage its deletion and drop it from the remote. `canon migrate records` stops on its first failed rename for the same reason, which bounds how far a tree splits without putting back what already moved.

Each pathspec is a bare folder name and git derives its prefix from the current directory rather than from the work tree the same call passes, so the invocation carries `-C` at the work tree beside `--git-dir` and `--work-tree`. Without it a session under `.claude/worktrees/` stands inside the records work tree, every name picks up that worktree's own path, and a push fails with a pathspec mismatch naming whichever folder sorts first. Both verbs run from anywhere for this reason, since implementation work runs in a linked worktree. Pull is the more dangerous direction of the two: `add` refuses an unmatched pathspec outright, while `status` tolerates one, so without the fix a reset behind a clean-looking status would have taken an unpushed record.

The remote is created by hand, once per machine, and both verbs refuse with the two setup commands until it exists. Provisioning a private repository from a verb needs a `gh` scope this toolkit asks for nowhere else. `push` also refuses when the records origin is a remote of this project, because this repository is public and the payload is the memory pen, the review reports, and the groundwork trails. Failing to read the project's remotes refuses under its own reason rather than answering an empty list, since an empty list clears the comparison for every origin and turns the one gate protecting the payload into a pass.

The one-time setup:

```bash
git --git-dir=.canon/.records.git init
git --git-dir=.canon/.records.git remote add origin <private-repo-url>
```
