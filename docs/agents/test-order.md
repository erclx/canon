---
title: Test order
description: Reading where an implementation reached history ahead of its test, how a pair is decided, the three verdicts, the coverage the pairing cannot reach, and why the check reports rather than gates
---

# Test order

`canon gov test-order` reports where an implementation reached a commit ahead of the test covering the same behavior. It answers the rule in `.claude/rules/canon/claude/567-planning.md` that asks for the test first, which until this verb existed was prose loaded on a glob match with nothing measuring it.

```bash
canon gov test-order
canon gov test-order --base origin/main --json
canon gov test-order --root ../my-app
```

| Option          | Behavior                                                   |
| --------------- | ---------------------------------------------------------- |
| `--base <ref>`  | Ref the range runs back to, defaulting to the trunk        |
| `--root <path>` | Repository to read, defaulting to the current directory    |
| `--json`        | Add a machine-readable record on stdout, keeping the frame |

Under `--json` the record holds stdout alone and the frame still renders on stderr, refusals included, which is the split `output-shape.md` fixes for every mode. A consumer reading stdout sees pure data, and an operator reading the terminal sees why a run refused rather than a command that appeared to do nothing.

## The range it reads

The default range is the branch against the trunk, resolved as the merge base against `origin/main` and then local `main`. A repository carrying neither falls back to the root commit, so a fresh checkout still answers rather than refusing.

Reading all history on every run measures work nobody is reviewing and buries the finding that matters under the ones already merged. `--base` widens or narrows it when a reader wants a different window.

A ref passed there is resolved the same way, through its merge base with `HEAD`, so it names the far side of the range and not the commit the range starts from. `--base origin/main` therefore reports the same window whether the trunk has moved since the branch left or not. Naming a commit the branch already carries still measures from that commit, since the merge base of `HEAD` and an ancestor is the ancestor, and a ref sharing no history with `HEAD` refuses as `bad-base`.

Only history is read. A file sitting in the working tree and in no commit is invisible here, which is the point: the verification run sees a tree at one moment, and the ordering exists nowhere but history.

## How a pair is decided

A test is paired to an implementation by the module path with the test suffix removed, so `src/parser.test.ts` covers `src/parser.ts`. Every record is keyed on the implementation path, which is what a reader goes looking for.

Pairing is the whole difficulty. A test and its implementation are related by behavior rather than by filename, so a behavior split across two modules pairs wrongly or not at all. That is what the unclassified verdict exists to catch rather than hide.

## The three verdicts

- **Satisfied.** The implementation was added in the range and its test reached history no later. A test that predates the range counts, and so does one commit carrying both sides, since the rule asks that the test not come after and a single commit is the shape a small change takes.
- **Implementation-first.** The implementation was added in the range and its test was added in a later commit of the same range. This is the only verdict that moves the exit code.
- **Unclassified.** Everything the pairing cannot read, each carrying its own reason. A module the range modified rather than added lands here, because a refactor and a new behavior cannot be told apart from history. So does an implementation no test names, and a test whose implementation the range never introduced.

## What it reads past

Only `.ts` and `.tsx` are paired, since a test sits beside its subject under one name across that corpus and a bash script has no such partner. Declaration files carry no behavior to test. Every other changed path is counted under `Read past` rather than dropped silently.

Coverage is narrower than the rule the check answers to. The rule speaks to every behavior, and the verb speaks to the behaviors it can identify, so the report states its own scope on every run rather than implying it looked at everything.

## Exit codes

Exit codes are `0` when nothing reached history ahead of its test, `1` for a refusal, and `2` for at least one implementation-first finding. Unclassified rows move no exit code.

Nothing wires this into `bun run check` or into a hook. The unclassified class is large and known, and gating a measure carrying a known false-positive class is what teaches contributors to route around the stage. `canon tasks validate` is the precedent: it exits `2` on findings and is called where the claim is made rather than on every push.

An exit code says nothing about a call made from a session, since a shell profile may wrap the binary in a function taking its status from a later command. Read the JSON record's `findings` array rather than the exit when a skill consumes this.
