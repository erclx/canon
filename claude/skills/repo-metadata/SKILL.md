---
name: repo-metadata
description: Proposes a GitHub About description, homepage, and topic set computed from the README's opening line and package.json, reports the difference against what the repository's remote already carries, and stops without writing. A later invocation, carrying the operator's answered fields, writes the change through gh repo edit. Use when asked to "propose repo metadata", "check the github description", "does our github about text match the readme", "sync github topics", "update the repo homepage", or "apply the repo metadata answers". Do NOT use to edit README.md itself, or to change a repository setting other than description, homepage, or topics.
metadata:
  family: setup
---

# Repo metadata

Reads what `canon repo metadata propose` computes locally and reports it against the remote. Writing is a separate step: `canon repo metadata apply` never runs in the same invocation that ran propose, whatever the operator answers in the same breath. The gate is the two invocations, not a prompt inside one.

## Guards

- Report it rather than proceeding silently when `canon repo metadata propose` or `canon repo metadata apply` does not resolve. Both ship with the CLI, so a project on an older install meets a missing subcommand rather than a refusal.
- The propose read refuses when the repository has no remote `gh` can read. Report that refusal verbatim and stop. A proposal with nothing to compare against is a suggestion nobody asked for.
- Never call apply in the same turn that ran propose, even when the operator's request already names the fields to write. Surface the proposal, get the answer, then run apply as its own step.
- Never write a field the operator did not confirm in this conversation. A field the proposal computed and the operator has not answered stays unwritten, whatever the CLI's own suggestion for it was.
- A field absent from the proposal has no local source and is never a suggestion to clear what the remote already carries. Report it as unchanged, not as a removal.

## Propose

1. Run `canon repo metadata propose --json`.
2. Read `diff` and `repo` from the record. `repo` is the `--repo` value the later apply step must carry. An empty `diff` means the remote already matches what this run computed: report that and stop, since there is nothing to answer.
3. When `diff` carries a `description` field, compress its proposed value, the raw opening line `canon repo metadata propose` computed, into a single short phrase. Leave the shape and length of the phrase to judgment on each run. No numeric target applies. Keep the raw proposed value beside the compressed phrase in what gets reported, so the operator can check the phrase against the README line it came from.
4. For each field `diff` carries, put the change to the operator through the structured question surface: which of the differing fields to write. For `description`, the value offered to accept is the compressed phrase from step 3, not the raw line beside it. Rank accepting the proposed value first for a field whose current value is stale or wrong, and give the reject option the cost of leaving the remote as it stands. Never pre-select an answer for the operator.
5. Report the fields the proposal left absent as unchanged, naming that neither the README nor `package.json` carried a source for them.
6. Stop. Do not run apply here even when the operator answers immediately, since answering is not yet an apply invocation.

## Apply

1. Confirm every field about to be written was answered by the operator in this conversation. Carry no field forward unanswered. For `description`, the answered value is the compressed phrase Propose offered, never the raw README line reported beside it.
2. Run `canon repo metadata apply`, always passing `--repo <owner/name>` from the propose record's `repo` field, plus the flags for the answered fields: `--description <text>`, `--homepage <url>`, `--topics <comma-separated list>`. `--topics` is the full desired set, and the command reads the current set itself to compute what to add and remove. The command refuses rather than writing when `--repo` does not match what `--root` resolves to, so never omit it and never guess it from anything but the propose record's `repo` field.
3. Report the written state from the JSON record.

## Output

Propose:

```plaintext
📋 Repo metadata proposal
description: "<current>" → "<compressed>" (derived from the README's opening line: "<raw>")
homepage: unchanged, no local source
topics: +<added>, -<removed>

Answer which fields to write, then ask again to apply.
```

Apply:

```plaintext
✅ Applied: <fields written>
```

Omit a line from the proposal block for a field `diff` did not carry.
