---
name: target-update
description: What catching a target up to the toolkit is for, the judgment it holds, and where it hands off to the check and the setup
---

# Target update requirement

## Gap

Without this skill, a session catching a target up after a release improvises the order. It runs a sync before the migrations that move its paths, writes a record-tree rewrite with no backup, and lets a sync replace a rule the project customized without saying what was lost.

The verbs report every fact, so the gap is the judgment between them. A session reads a refused migration as a step to force, picks rules and seed merges with nobody asked, and ends with no way to tell a current target from one it stopped partway through.

## Must

- Show the changelog summary, the pending migrations, and the drift before the first write to the target, and apply only on the operator's go-ahead
- Read every fact from a `canon` verb, so a later release changes what the skill reports with no edit to its body
- Stop and ask on a refused migration, a stranded file, an unattributed folder, and a rule the stack newly ships
- Keep a customized file and a drifted seed as the project wrote them, naming the toolkit change each one skipped
- End on a clean `target-check` or on named remainders, with nothing written when nothing is pending

## Must not

- Detect pending migrations or parse the changelog inside the body, since `canon migrate status` and `canon changelog` own both
- Name a toolkit version in an update commit's subject
- Run from the toolkit's own checkout, or write into a target from another repository's session
- Rely on being typed by name. It is reached through its description and `target-check`'s close, and a quarter of releases with no migration and no drift is the signal to fold it in there.

## Out of scope

- First-time scaffold, which `target-setup` owns
- Reporting drift without repairing it, which `target-check` owns
- Opening the target's pull request, which `git-ship` owns
