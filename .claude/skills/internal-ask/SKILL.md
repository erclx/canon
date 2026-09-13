---
name: internal-ask
description: Answers repository-knowledge questions about this toolkit by looking up `docs/index.md`, `canon/context/index.md`, `standards/index.md`, and `wiki/index.md` first, then the specific file those indexes point to. Use when asked "how do I use X", "what does Y do", "where is Z documented", or "how do I set up a target project". Do NOT use for code changes, editing, debugging, or questions about external tools not documented in this repo.
disable-model-invocation: true
---

# Internal ask

Manual Q&A surface for toolkit self-knowledge. User triggers with `/internal-ask <question>`. Output is short, cites the source file, and stops.

## Guards

- If no question is provided, stop: `❌ No question. Ask something like "how do I set up a target project".`
- Do not modify any file. This skill is read-only.
- Do not open `src/`, `scripts/`, or any source file. Prose surfaces only.

## Step 1: read the indexes in parallel

From the project root, read these together:

- `docs/index.md`: one-line summary per consumer-facing reference (CLI surface, AI workflow, target-project integration, and the workflow method docs)
- `canon/context/index.md`: one-line summary per domain's internal narrative (how a domain is built, decisions, gotchas)
- `standards/index.md`: one-line summary per authoring convention, each governing the shape of one document type or one attribute carried across every document
- `wiki/index.md`: one line per role catalog, each holding the page summaries for the subjects it owns

All four indexes are small. Parallel read avoids routing errors between consumer references, domain context, authoring conventions, and wiki prose.

## Step 2: pick one file

Match the question against the one-line summaries in all four indexes. Pick the single most relevant file.

- Prefer `docs/` for CLI surface, target-project integration, and the workflow this repo runs on (AI workflow, operating model, design tiers, shell aliases)
- Prefer `canon/context/` for how a specific domain is built (structure, decisions, gotchas)
- Prefer `standards/` for the shape an authored artifact must take, which is what a question about how to write one is asking
- Prefer `wiki/` for Claude Code concepts and reference on tools owned outside this repo

If two entries look equally relevant, read both. Do not read more than two.

A wiki match resolves one level down. Open the role catalog `wiki/index.md` names, then pick the page from its summaries. That read is part of routing rather than one of the two files.

## Step 3: answer

Read the picked file. Answer the question in four lines or fewer. End with a `Source:` line naming the file paths used.

Response format:

```plaintext
<answer, four lines or fewer>

Source: <relative/path/to/file.md>
```

When two files were read, list both on the `Source:` line separated by a comma.

## Step 4: escalation

When no index points at a relevant file, fall through in this order:

1. `CLAUDE.md` for behavior rules and conventions
2. `canon/REQUIREMENTS.md` for scope and non-goals
3. `governance/rules/` and `governance/stacks/` for rule content

Authoring conventions are absent from this list by design. `standards/index.md` routes them at Step 1, and a corpus reachable both by routing and by fallthrough is reached twice under two sets of rules.

Stop at the first file that answers the question. If none do, reply:

```plaintext
Not covered in docs or wiki. Narrow the question or point at a specific file.
```

Do not guess. Do not read source files. Do not grep the whole repo.

## Tone

- Direct. Developer-level technical knowledge assumed.
- No marketing words, no hedging clusters, no filler lead-ins
- Follow `standards/markdown.md` and the `write-human` skill for any multi-line answer
- Prose by default. Use bullets only when the answer is a discrete list already present in the source file.

## Do not

- Do not implement, edit, or run commands the answer describes
- Do not paraphrase large sections. Quote one short phrase if useful and cite the file.
- Do not chain multiple follow-up file reads past Step 2 + Step 4. One hop per escalation level. A wiki role catalog is a routing read, so it does not count against the bound.
