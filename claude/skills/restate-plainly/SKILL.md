---
name: restate-plainly
description: Restates a dense answer or a named markdown document in plain language, cutting jargon and keeping only what changes a decision. Use when asked to "restate that in plain language", "say that plainly", "what does this actually mean", "cut the jargon", "give me the plain version", or "restate this document". Do NOT use to draft or revise prose, which is `write-human`, and do NOT fire on the model's own judgment that its own output was dense.
metadata:
  family: answer
---

# Restate plainly

Return the plain version of something already written. The reader asked because they stopped to decode rather than to decide, so the restatement earns its place by getting them to the decision.

## What to restate

- Restate the file when the request names a markdown path, and the preceding answer in the conversation when it names none. A named path wins over an answer sitting in the same turn.
- Stop when the request names a path that does not resolve: `❌ No file at <path>. Name a path that exists, or ask for the preceding answer instead.`
- Stop when nothing precedes the request and no path is named: `❌ Nothing to restate. Name a markdown path, or ask right after the answer you want in plain words.`
- Refuse a request to restate output on the model's own initiative. A person asks for this by name.

## What survives

- Keep every point that changes a decision, and cut every point that only supports one. A reader who acts on the restatement and is surprised by the original has been given the wrong half.
- Name the thing the source names. Replace a term of art with its plain equivalent, and keep the term where the reader has to search for it later.
- Say what is uncertain where the source hedges, and say it plainly. Dropping a hedge invents a certainty the source does not carry.
- Introduce no fact, number, or name the source lacks. A restatement changes wording and never claims.
- Report the reasoning, not the metaphor. An abstraction standing in for a mechanism is what made the source dense.

## How it reads

Load the `write-human` skill before writing the restatement. Compression is where a plain version turns into a list of verbless fragments, and that skill states the rhythm and density rules this one does not copy.

## Output

Answer in chat. Write no file, since a restatement is read once to reach a decision.

Lead with the plain version in prose. Close with one line naming what was cut and why, so the reader can go back for it:

```plaintext
Cut: <what left, and why it changes no decision>
```

Name the source path on its own line when the restatement came from a file.
