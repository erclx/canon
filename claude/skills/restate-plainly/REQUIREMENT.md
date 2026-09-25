---
name: restate-plainly
description: Why a plain restatement is asked for by name, and where its boundary sits against the skill that drafts and the command that measures
---

# Restate plainly requirement

## Gap

Without this skill, a reader who cannot follow a dense answer has to ask for it again in ordinary words, and the second answer is drafted by the same session that produced the first. Nothing tells that session which half of its own text carried the decision, so the rewrite shortens the passage and keeps the abstraction that made it hard to read.

The corpus around it covers the neighboring jobs and not this one. `write-human` governs a passage being drafted or revised and arrives on a markdown edit, so it never sees an answer in chat and never reaches a document nobody is editing. `canon markdown audit` reports sentence spread and repeated openings against a stated range, which measures how a passage moves and says nothing about whether a reader can act on it.

A restatement also fails in a way a rewrite does not. A run that compresses by dropping what supports a claim leaves a reader who acts on the plain version and meets a different answer in the source, and that failure is invisible in the restatement itself.

## Must

- Take a named markdown path or the preceding answer, resolving the path first, since a reader pointing at a file has already said which one they mean
- Keep every point that changes a decision and cut what only supports one, which is the split that separates a restatement from a summary
- Preserve a hedge the source carries, since dropping it manufactures a certainty
- Cite the carrier of the rhythm and density rules rather than restating them, because a second copy drifts with nothing comparing the two
- Fire on an explicit request and refuse the model's own judgment about its own output

## Must not

- Write a file. A restatement is read once to reach a decision, and a file makes a record nobody opens twice.
- Add a fact, number, or name the source does not carry
- Restate the voice, rhythm, or density rules, which live in the skill this body cites
- Claim the restatement is verified. Nothing checks whether a plain version kept the deciding half, so the sandbox arm asserts what the run did rather than that the output is good.

## Guards

- A named path that does not resolve stops the run rather than falling back to the preceding answer, since the two inputs are different requests
- A request with no path and nothing preceding it stops rather than restating the request itself

## Out of scope

- Drafting or revising a passage, which is `write-human` on a markdown edit
- Measuring cadence in finished output, which `canon markdown audit` reports from package data
- Rewriting a document into a file, which is a proposal against the source rather than a restatement of it
- The banned characters, which `markdown.md` states and the audit gates
