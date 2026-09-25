---
title: Records push
description: Backing the record folders to a private remote and restoring them, which folders the payload carries, the one-time setup, the refusal reasons, and the hook that runs the push
---

# Records push

`canon records push` commits the backed record folders to a private remote and pushes them. `canon records pull` fetches the other direction and writes them back. Both take `--json` and `--root` the way `validate` does, and both exit `0` on agreement and `1` on a refusal.

```bash
canon records push
canon records push --json
canon records pull
```

At the `.canon` root, the backed folders are every top-level directory less three: `tmp`, which is deletable without loss, `ordinal-locks`, whose entries are transient per claim and would race the claim they guard, and `.records.git`, which is the history the rest are pushed into. Nothing bounds the set from outside, since the claude manifest ships one `.canon/` root entry and names no folder, so a record folder added later enters the payload on its own rather than waiting on a name written here. A push names each folder in scope that the records index has never tracked before, so a folder that picked up a name by mistake, such as a misrouted scratch write, is visible in the report rather than entering the payload silently. The report also lists every file new to the history under `added`, since a stray file inside a folder already tracked is visible only by name.

The three excluded names bound the records index as well as the disk. A name an older binary committed, such as `tmp`, is removed from the history once and reported under `dropped`, and no later push stages it again. That removes it from the tip going forward and purges nothing from earlier commits the remote already holds. A project's own drafts folder needs no config to be backed: moved to `.canon/<name>/`, it is a top-level directory like any other and enters the payload on the next push. The legacy `.claude` root keeps a fixed allowlist instead, since that root also holds tracked `skills/`, `rules/`, and `hooks/` a push must never carry, and an exclusion set there would stage all three. Each name is a top-level record folder and every archive sits inside the one it archives, so the set stays at one entry per surface however many archives appear, and it deliberately does not match the six record kinds `validate` hardcodes.

Records are gitignored by design, so the history lives in a second git directory at `.records.git` inside the record root, with that root as its work tree. Both resolve off the root together rather than folder by folder, since a history opened at one root beside a work tree at the other would stage the deletion of every folder a move relocated. Every path stays where it is, which is what a separate checkout could not do. The verbs stage the backed folders by explicit pathspec with `--force`, so nothing outside them can enter the index however the ignore rules read, and the project working tree and its index are never touched. Each pathspec is a bare folder name and git reads it against the current directory rather than against the work tree the same call names, so the invocation carries `-C` at the work tree beside the other two flags. That is what lets either verb run from a linked worktree under `.claude/worktrees/`, which sits inside the records work tree and would otherwise prefix every name with its own path.

## Setup

A person creates the records repository once per machine, and the verbs refuse with the commands when it is absent:

```bash
git --git-dir=.canon/.records.git init
git --git-dir=.canon/.records.git remote add origin <private-repo-url>
printf '.canon/\n' >> .gitignore
```

The ignore line is repeated here rather than left to the install, because the person running these commands is the one who creates the directory and the rule is worth reading beside the command that needs it. The claude manifest ships `.canon/` too, so a project that ran `canon tooling sync` already carries it and this line is a no-op there. One root entry covers the history and every record beside it, which is what makes the rule worth stating once rather than per folder.

Point it at a private repository, and at one that is not a remote of the project. Records carry the memory pen, the review reports, and the groundwork trails, so a public project publishes all of it to anyone who fetches all refs. `push` compares the configured origin against every remote of the project and refuses on a match. A read of that list which fails refuses as well, since an empty list clears the comparison for every origin and a gate that passes on its own failure is no gate.

## Refusals

| Reason              | What fired                                                                             |
| ------------------- | -------------------------------------------------------------------------------------- |
| `split-roots`       | Record folders sit under both roots, so the resolved work tree is not the whole set    |
| `no-repository`     | No `.canon/.records.git`, answered with the two setup commands                         |
| `no-remote`         | The records history has no `origin`                                                    |
| `remote-unreadable` | The project's own remotes could not be read, so the shared-origin gate could not run   |
| `remote-shared`     | The records origin is also a remote of the project                                     |
| `no-remote-records` | `pull` found no branch on the records origin                                           |
| `local-changes`     | `pull` found records on disk that the history does not carry                           |
| `local-ahead`       | `pull` found local commits that never reached the origin                               |
| `unsafe-payload`    | `push` found a pending file over 25 MB or carrying a credential, named under `blocked` |
| `git-failed`        | A git call failed, with its stderr in the message                                      |

`split-roots` runs ahead of every gate below it and fires on a half-migrated tree, which is what a `canon migrate records` run that failed partway leaves. `recordRoot` answers for the whole tree on the first root that exists, so a folder left at the old root is absent from the work tree while the records index still names it, and an unguarded `add -A` would stage its deletion and drop it from the remote on the next push. Finish the move, or put the stranded folders back beside the others.

`unsafe-payload` runs before anything is staged, so a refusal leaves the index, the log, and the object store as it found them. It reads every new or changed file the push would stage and blocks one over 25 MB, which is read off the file's size without opening it, or one carrying a value `canon secrets scan` would report, through the same patterns and the same `canon-allow-secret` marker. It refuses the whole push rather than skipping the file, and `--json` lists each path with its cause and a detail that names the credential's kind and line, never its value. Move the file out of the record folders, such as into `.canon/tmp/`, or remove the credential, then push again. The guard reads only what this push would add, so a credential committed before it existed stays in the history unreported.

A push the remote rejects undoes the commit that run made and leaves the records on disk, so the next run does not send a payload the remote already refused. A history an older binary committed and left unpushed is outside that undo, and the guard never reads it either, so every push sends the same blob again. Reset it by hand from the project root to the last commit the origin holds, `git --git-dir=.canon/.records.git --work-tree=.canon reset <commit>`, and push again. The `--work-tree` is required, since the setup `init` marks the history bare and git refuses that reset on a bare repository.

The two `pull` refusals exist because the directions are not symmetric. A push only adds, while a pull onto a machine holding work that never left it would discard that work. Resolve either by running `push` first, or by moving the local folders aside. A machine holding no backed folders has nothing to lose, so a restore onto a fresh checkout runs straight through.

## When it runs

`.husky/post-merge` runs `push` after the task archiving loop, on every merge rather than only on one that archived a task. A review report and a memory entry both land on runs that close nothing. The call sits inside an `if` and last in the file, so an unreachable remote neither aborts the hook nor delays the archiving above it, and a checkout that never ran the setup reports nothing. Anything the hook misses is covered by running the verb by hand.
