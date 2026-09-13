---
name: internal-ask
description: Scope boundary for answering a question about this repository from its own prose, and the tier each answer is sourced from
---

# Internal ask requirement

## Gap

Without this skill, a session answering a question about this toolkit greps the repository and reconstructs the answer from source, lands on a file that mentions the term rather than the one that owns the subject, sources a target-facing answer from internal narrative written for a different reader, spends a repository-wide sweep on an answer worth four lines, and returns it with no path a reader can check.

Reconstruction from source is the failure that reads best and is worth least. It reports what the code currently does, which is not what the repository documents, and it arrives with no owner, so a reader who acts on it has no file to correct when it turns out to be wrong.

## Must

- Read the four indexes together and route on their one-line summaries before opening any file, since the index states which file owns a subject and a grep only states which files mention it
- Follow a wiki match into the role catalog holding its page summaries, since `wiki/index.md` routes to a catalog rather than to a page
- Route by reader, keeping `docs/` for consumer-facing reference, `canon/context/` for how a domain is built here, `standards/` for the shape an authored artifact must take, and `wiki/` for a subject owned outside this repository
- Cite the file paths the answer came from, so the reader can check it and correct it at its source
- Bound the read. One file, two when the indexes tie, and one hop per escalation level. An index read spent reaching a page is routing rather than a hop.
- Report that nothing covers the question rather than assembling an answer from what is nearby

## Must not

- Open `src/`, `scripts/`, or any source file. The question is what the repository documents, and code answers a different question with no citation behind it.
- Modify a file, or run a command the answer describes. This skill is read-only and the reader decides what to act on.
- Paraphrase a long section in place of citing it, which substitutes a lossy copy for the file that owns the subject

## Guards

- No question provided, stop rather than guessing the topic from session context

## Out of scope

- Editing whatever the answer names, which routes to the `internal-*` skill owning that domain
- Reference on an externally owned tool past what `wiki/` records, which belongs to that tool's own documentation
- Deciding when to fire. The skill is user-invoked through `disable-model-invocation`, so routing a question to it is the operator's call rather than a description match.
