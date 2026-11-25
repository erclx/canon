---
title: Preview address
description: The preview step of pr-evidence, covering when it runs, the Pages deploy the verb dispatches, the two cases it refuses before dispatching, and how to read its record
---

# Preview address

Read by the preview step of `evidence.md`, passing the pull request number. It runs `canon pr preview` for the pull request, re-renders the evidence body with the hosted address, and hands back the address or the reason the step skipped.

The step runs when the evidence step returned `ok`, when the fallback posted a checklist, or when `canon pr evidence <number> --check --json` lists `preview` in `owed`.

- An `ok` or a fallback checklist means the pull request changes a rendered surface, and a reviewer holding a checklist with no screenshots needs the live page most
- A `preview` in `owed` is how `git-ship` reaches this step alone when an earlier run's deploy timed out
- An evidence record carrying a `commentId` takes the `owed` case alone, owed again once the branch changes a served path past the build its `previewHead` names
- The evidence comment is already posted, so the reviewer has the screenshots while the deploy runs

```bash
canon pr preview <number> --json
```

## What the verb refuses

The verb dispatches the project's Pages deploy on the pull request's branch and waits on the run for up to 15 minutes. `canon pr preview --help` states the contract. It refuses before dispatching anything in two cases.

- The deploy command passes no `--branch`, since that deploy would publish the branch to production
- The workflow's push path filter matches no changed path, since a dispatch ignores that filter and the site would show none of the change

## Reading the preview record

Read `reason` on the record rather than the exit code.

- `ok`: re-render the evidence body with the address under `## Evidence`, then post or update it as the evidence step does, through the same tmp file and the record's `commentId`:

```bash
canon pr evidence <number> --preview <url> --json
```

The hosted address opens the address line, and a local link already on the comment follows it, carried forward with no flag.

- `no-deploy` or `unserved`: the project deploys nothing a dispatch can start, or its site builds from nothing this branch changed. Say nothing and move on.
- `unfenced`, `no-alias`, `run-failed`, `timeout`, or a mirrored `gh` refusal: report the record's `message` and move on without stopping the chain
- A missing link costs the reviewer a click, and a held ship costs the whole chain
