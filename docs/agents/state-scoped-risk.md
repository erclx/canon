---
title: State-scoped risk
description: Reading committed state rather than an arriving change, the shipped-tree corpus the secret scan reads, what it keys on and how a deliberate value is exempted, the advisory check and its network failure mode, and why one gates while the other reports
---

# State-scoped risk

Every review surface a session can reach is scoped to a change. `review-branch` reads the branch diff, `review-pr` reads a pull request, and `code-review` takes a diff, a branch, or a path. A risk that arrived before the range under review is invisible to all three by construction, which is what these two commands answer.

| Question                                                 | Command              |
| -------------------------------------------------------- | -------------------- |
| Does a credential sit in the tree this repository ships? | `canon secrets scan` |
| Does a resolved dependency carry a published advisory?   | `canon deps audit`   |

Neither reads a range. That boundary is deliberate: change-scoped correctness review already exists, and a state-scoped bug scan would be a different product competing with it. Both register in `canon audits run`, so a reader who runs the aggregate gets them without knowing they exist.

## Secrets in the shipped tree

```bash
canon secrets scan
canon secrets scan --json
canon secrets scan ../my-app
```

The corpus is the package's own `files` field rather than a list the check keeps. That field is the single statement of which trees leave this repository, so a second list beside it would answer the same question and drift. It also carries the negations the publish already makes, which is what puts the sandbox tree, the eval tree, and every test file out of scope by the rule that keeps them out of the tarball rather than by an exclusion this check invented.

The plugin reaches a target by a different route, loading live from `claude/` rather than from a tarball. That folder is a `files` entry too, and its `standards` and `snippets` symlinks resolve into trees the field lists in their own right, so both routes land inside the same corpus.

Three root files are read whether or not the field names them, being `package.json`, the readme, and the license, since npm packs those on every publish. A negation still removes one, because a field that excludes a file outranks the default that included it.

### What the corpus leaves out

The corpus answers what the package publishes, which is narrower than what the repository holds. Measured against this repository on 2026-08-21, the scan read 544 files and left 593 of the 1139 git lists unread. Those include everything under `.claude/`, `wiki/`, and `internal/`, the workflow definitions under `.github/`, and the trees the publish negations remove, being `scripts/sandbox/`, `scripts/eval/`, and every test file. `src/capture/` was a fourth negation when that reading was taken and is not one now. The folder holds 5 tracked files, 2 of them tests the publish still excludes, so the corpus is 3 wider than the numbers above describe and the unread count is 3 smaller.

A public repository makes that gap readable by anyone, so a clean run means no credential in the published tree rather than none in the repository. The run states the number on every pass, including a clean one, so the bound travels with the verdict. Widening the corpus to every tracked file is a separate decision, since the row this implements puts the shipped tree first on the toolkit's rule that content leaving the repository gates harder than content that stays.

### What it keys on

Every pattern matches an issued value and none of them matches a word. A scan keyed on `password`, `secret`, or `token` fires on the environment reads, the workflow inputs, and the prose that name those things, and this repository ships all three. Keying on values instead is what makes the exclusion set empty: measured across the shipped tree on 2026-08-21, 544 files produced zero findings with nothing exempted.

The set covers issuer-stamped shapes, being AWS access key ids, GitHub tokens in both forms, Google API keys, Slack tokens and webhooks, Stripe live keys, Anthropic and OpenAI keys, npm tokens, and private key block headers. What it does not reach is a credential no issuer stamps recognizably, which no exclusion policy would have helped with either.

A reported value is redacted to its two ends. Those are what a reader needs to find it in the file and to tell one match from another, and the middle is the part no report should carry.

### Exempting a deliberate value

A line carrying a credential-shaped value on purpose takes an inline marker, either on the line itself or on the line directly above it:

```bash
# canon-allow-secret: documented sample from the vendor's own reference
AWS_KEY="<the sample value>"
```

Only a marker naming a reason counts. A bare token reads as a line that meant to say something and did not, which is the rule `stub: true` already applies to a seed field set to anything but `true`, and honoring it would let a typo mute a finding.

The exemption travels with the line rather than sitting in a path list away from it, so a reader meeting a muted match finds the reason on the spot. A path allow-list was weighed and declined: the noise it would target is word-keyed and spread past the fixture trees, so it would hide part of the noise and none of the risk.

### Exit codes and gating

Exit codes are `0` when the shipped tree carries no credential-shaped value, `1` for a refusal, and `2` for at least one value found.

This is the one entry in `canon audits run` that gates without a `canon gate run` stage behind it. A credential in the published tree is a fact rather than a judgment, which is the test the catalog asks any gating addition to pass, and the architecture record already ranks content leaving the repository above content that stays.

A refusal is never a clean tree. Five reasons produce one, and each exits `1`, because zero findings over zero files reads in the report exactly like zero findings over the whole shipped tree.

| Reason             | What it means                                                | In the aggregate |
| ------------------ | ------------------------------------------------------------ | ---------------- |
| `no-manifest`      | No `package.json`, so nothing is published from this tree    | absent           |
| `no-publish`       | The manifest declares `private`, so it publishes nothing     | absent           |
| `no-shipped-files` | The `files` field matched nothing git lists                  | absent           |
| `no-files-field`   | A publish would pack the whole tree, and none of it was read | unmeasured       |
| `no-git`           | git could not list the tree, so the corpus is unknown        | unmeasured       |

The split turns on whether a corpus exists. The first three mean this project publishes nothing, which is where most targets installing this CLI sit, so reporting them as unmeasured would pin the aggregate at `incomplete` there forever.

The last two mean a corpus exists and went unread, so neither is softened. `private` is what separates them, since a manifest with no `files` field publishes everything rather than nothing and the field alone cannot tell those apart. Declaring `private: true` is the way a project that never publishes says so.

## Advisories against the resolved dependencies

```bash
canon deps audit
canon deps audit --json
```

The check shells the runtime's own advisory command rather than carrying an index. A vendored advisory database is a second corpus to keep current, and what this is worth is the report rather than the data.

It refuses for three reasons, and each is an absence rather than a break: no `package.json`, no lockfile beside it, and no record back from the lookup. The lockfile is checked here rather than left to the underlying command, because a project whose dependencies were never resolved needs an install and not a retry, and one message naming the network would send half the readers at the wrong cause.

That buys the one failure mode no other audit here carries. The command reaches a network, so an unreachable index has to be told from a tree with nothing against it. The exit code cannot separate them, since the underlying command exits non-zero both on advisories found and on a lookup that failed, so the record on stdout is what decides: output that parses is a measurement, and output that does not is a refusal under `no-record`.

Exit codes are `0` when nothing is published against the resolved set, `1` for a refusal, and `2` for at least one advisory.

### Why it reports rather than gates

A published advisory is a fact about the index and a judgment about this tree, since the upgrade closing it may not exist yet. A push failing on one would teach a contributor to route around the stage while nothing about the dependency has changed, which is the split every other reporting measure here rests on.

The corpus is recorded as `upstream`, a third value beside `tracked` and `per-machine`. Its count moves when someone publishes rather than when someone edits here, so a retained baseline would report growth against a tree nobody touched, and the aggregate keeps it out of the record for the mirror image of the reason it keeps gitignored scratch out.

The same value decides what an offline run reports. An index this machine could not reach is an ordinary absence rather than a broken checkout, so it lands as `absent` and moves no verdict. Reading it as unmeasured would pin the aggregate at `incomplete` on every machine without a network, which is a signal nobody reads after the second time they see it.

## Reading either from a skill

An exit code says nothing about a call made from a session, since a shell profile may wrap the binary in a function taking its status from a later command. Read the `--json` record instead.

The secret scan publishes `findings`, `files`, `skipped`, and `listed`, where `listed` is everything git reports so a consumer can state the bound alongside the verdict. The advisory check publishes `advisories` and a `severities` object. A refusal from either publishes `reason` and `message` and no measurement keys at all, which is what separates it from a clean run.
