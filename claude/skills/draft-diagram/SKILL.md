---
name: draft-diagram
description: Writes per-kind Mermaid diagram entries into `.canon/diagrams/`, covering system context, components, request flow, data pipeline, and deployment. Reads `canon/ARCHITECTURE.md` and `REQUIREMENTS.md` when present, falls back to a code-structure scan. Use when asked to "draw the architecture", "diagram the system", "show the components", "give me a flow chart", "refresh the deploy diagram", or "visualize the project". Do NOT use for design tokens (use `design-extract`) or UI audits (use `ux-audit`).
---

# Draft diagram

Write one entry per diagram kind. Never rewrite the folder wholesale. A pass that refreshes the deploy view leaves the other four files byte-identical, which is the whole reason the surface is a folder.

## Guards

- If no `canon/ARCHITECTURE.md`, no `canon/REQUIREMENTS.md`, and no top-level folder structure to scan, stop: `❌ No source signal. Add canon/ARCHITECTURE.md or run inside a project folder.`

## Step 1: read sources and locate the surface

Read these from the project root in parallel, skipping any that do not exist:

- `.canon/diagrams/index.md` and every `.canon/diagrams/*.md`: which entries exist and what they already say
- `canon/REQUIREMENTS.md`: users, external dependencies, tech stack, MVP feature list
- `canon/ARCHITECTURE.md`: layered components, key technical decisions
- `CLAUDE.md`: project type, conventions
- `package.json`, `pyproject.toml`, `Cargo.toml`: language and framework markers
- Top-level folder layout and root config files via `ls`: deploy targets, infrastructure config, component boundaries

Do not recurse speculatively.

Follow `${CLAUDE_SKILL_DIR}/../../standards/diagrams.md` for frontmatter, entry kinds, and explanation rules. Follow `${CLAUDE_SKILL_DIR}/../../standards/mermaid.md` for what goes inside the fence: layout, budgets, accessibility, labels, and verification.

### Migrating a pre-split flat file

When `.canon/diagrams/` holds no entry and `.claude/DIAGRAMS.md` exists, this pass converts it. An entry is any `*.md` in the folder other than `index.md`. The seed ships `index.md` alone, so a folder holding only the catalog is an empty set and still converts.

Split each H2 section into the entry whose kind it matches, carry its mermaid body and explanation prose across unchanged, and add the frontmatter the standard requires. Leave `.claude/DIAGRAMS.md` on disk so the split can be compared against its source, and say in Step 7 that deleting it is the user's call.

Convert only. Do not redraw a diagram during a migration pass, since a rewrite and a move landing together leaves no way to tell which one broke a diagram.

## Step 2: pick which entries this pass writes

Write an entry only when its source signal exists, and only when this pass has a reason to touch it. Skip the rest and leave their files alone.

Count entries the way Step 1 does, excluding `index.md`. Counting the catalog as an entry sends a first pass down the compare branch with nothing to compare, and it writes nothing.

- The user named a kind: write that one.
- The user asked broadly and the folder holds no entry: write every kind whose signal exists.
- The user asked broadly and at least one entry exists: compare each entry against its source signal and write only the ones whose signal moved. Report the untouched ones as current.

The standard fixes one filename and one `category` value per kind. Use them verbatim rather than inventing a name, since a refresh finds its target by filename and a new name writes a duplicate entry beside the old one. Emit `system-context.md` whenever `canon/REQUIREMENTS.md` exists, since it is the entry a reader outside the team opens first and the set is incomplete without it.

Stay inside `flowchart` and `sequenceDiagram`. C4, state, ER, and class diagrams render inconsistently across viewers.

## Step 3: write the entries

One file per kind at `.canon/diagrams/<kind>.md`. Write only the files Step 2 selected.

````markdown
---
title: <what the entry answers, sentence case>
description: <the question it settles and the signal that drives it>
category: <the kind, matching the standard>
verified: 'TODO: never verified'
---

# <Same as title>

<one-line statement of what the diagram shows>

```mermaid
<diagram type>
  accTitle: <what the diagram answers>
  accDescr: <the structure in one sentence>
  <body>
```

<one to three explanation paragraphs>
````

Write `verified` as the literal `TODO: never verified` here, quoted so the colon parses. Step 6 replaces it once a render has been read back, so a SHA written beside the diagram would assert a check that has not run yet. The placeholder is what keeps a render-less project conforming, since Step 5 sends a failed render past Step 6 and nothing stamps the entry. Carry an existing entry's current value across untouched when this pass is rewriting one, and let Step 6 replace that instead.

When sources came from a code scan rather than planning prose, lead the explanation with `Source: code.` and add `Fidelity is lower than prose-driven diagrams. Verify against the project's intent.`

A reader deciding whether the entry still holds starts from the code paths the explanation cites, so cite paths that exist and spell them exactly.

Quote node labels containing spaces or special characters with double quotes (`A["Web shell"]`). Avoid parentheses inside labels, they break some renderers. Use `<br/>` for line breaks inside labels.

Run the scan in `${CLAUDE_SKILL_DIR}/../../standards/publish.md` against the whole file, including inside mermaid `subgraph` labels and node text. The file lands in the repository rather than on a remote, so the scan's destination scoping leaves the character checks and not the phase-label one, and the `pull_request` check the git-pr surface carries reads only a pull request's own title and body, never a file the diff carries. A colon also works as a replacement inside a label. The pedagogical voice the diagram standard asks for is a yield on voice alone and buys no exemption from these bans.

Nothing enforces the ban inside the diagram. The standards-audit hook toggles on a fence and skips every line within it, so a label carrying an em dash passes silently while the same character in the explanation paragraph below is caught. Check the labels by reading them. This is the one place in the file where the author is the only gate.

## Step 4: regenerate the catalog

```bash
canon indexes regen
```

Run it after the last entry is written. It rebuilds `.canon/diagrams/index.md` from sibling frontmatter and groups entries under their `category`. Never hand-edit that file.

When `canon` is not on PATH, say so in Step 7 and name `.canon/diagrams/index.md` as stale rather than writing it by hand.

Scaffold `.canon/diagrams/index.md` with `title` and `subtitle` frontmatter before the first regen when the folder is new and the seed did not provide one. The subtitle routes a first-time reader to the system context entry, since the catalog sorts categories alphabetically rather than in narrative order.

## Step 5: render what this pass changed

A source that satisfies every rule in the standard can still render as a picture that asserts something false about the system. Verification runs on the image.

Render each entry this pass wrote. Skip every entry Step 2 left alone, since an untouched diagram cannot develop a new render defect.

Before the first render in a project, say what is about to block:

```plaintext
Rendering to verify layout. The first run downloads the Mermaid CLI and takes about 15 seconds.
```

Write each diagram's mermaid body to its own scratch file, then render it:

```bash
mkdir -p .canon/tmp/diagrams && bunx -y @mermaid-js/mermaid-cli -i .canon/tmp/diagrams/<kind>.mmd -o .canon/tmp/diagrams/<kind>.png
```

Render to PNG. An SVG export reads back as markup with no recoverable spatial meaning, so it cannot be verified. Use `bunx` when bun is available. Fall back to `npx -y @mermaid-js/mermaid-cli ...` otherwise.

Renders are verification artifacts, not deliverables. They stay in `.canon/tmp/diagrams/` and are never committed.

When the render fails for any reason (no browser engine, no network, no package manager), continue to Step 7 and name the skipped check in the chat output. A missing renderer degrades the loop, it does not fail it.

## Step 6: read the renders back

Read each PNG and judge the picture against what the entry means to say. Apply the verification properties in `${CLAUDE_SKILL_DIR}/../../standards/mermaid.md`.

Fix the source and re-render. Stop after two correction passes on an entry.

When a defect survives, keep the entry and name the defect in the chat output. A diagram whose author states the flaw is recoverable. A wrong diagram reported as verified is not.

### Stamp the marker

Stamp every entry that passed. Set `verified` to the short SHA of `HEAD` and today's ISO date, and delete any `stale` key the entry carries:

```bash
git rev-parse --short HEAD
```

The result is one line, `<sha> <date>`, as in `73e9a3f8 2026-08-02`. <!-- canon-allow-reference: illustrates the verified field's two-token format, which a qualified sha would misstate -->

Stamp nothing else. An entry Step 2 left alone was never re-checked, an entry whose defect survived is known wrong, and an entry whose render was skipped was never seen. All three keep the marker they already carry, and Step 7 names the last two. The field means a render was read back and judged correct, so stamping any of these spends the only signal a reader has on a diagram nobody confirmed.

A migration pass stamps on the same rule. Conversion writes entries, Step 5 renders them, and this step reads them back, so the marker records the commit the split was checked against rather than the commit the flat file was written at.

## Step 7: chat output

```plaintext
📝 Wrote N entries to .canon/diagrams/
   .canon/diagrams/<kind>.md
   <one line per entry written>

Left untouched: <kind, kind> <omitted when the folder was empty>

Verified N renders. <defect or skipped check, one line each, omitted when clean>

Open in any viewer with native Mermaid support (VS Code with `bierner.markdown-mermaid`, GitHub, Cursor) to render. Ask to export if you want SVG or PNG files.
```

Emit the full path for every file written. Do not echo the diagram bodies in chat. Never report a clean verification when a render was skipped or a defect survived. Never report an entry as written when this pass left it alone.

After a migration pass, add: `Converted .claude/DIAGRAMS.md into N entries. The original is untouched, delete it once you have compared the split against it.`

## Step 8: export on request

If the user asks to export the diagrams (`export to svg`, `give me images`, `render to png`), run:

```bash
mkdir -p .canon/tmp/render/diagrams && bunx -y @mermaid-js/mermaid-cli -i .canon/diagrams/<kind>.md -o .canon/tmp/render/diagrams/<kind>.png
```

Export PNG by default. Swap the extension for `.svg` only when the user asks for vector, and never for the Step 5 verification path. The CLI writes one file per `mermaid` block, suffixing when an entry holds more than one. Export every entry when the user names no kind. Output line:

```plaintext
📝 Wrote N files to .canon/tmp/render/diagrams/
```
