---
name: design-extract
description: Why a design system is drafted from what the tree already holds, and how a proposed value is kept distinguishable from a sourced one
---

# Design extract requirement

## Gap

Without this skill, a session asked for a design system either invents token values with nothing behind them or refuses because the project ships no stylesheet. It writes over a `canon/DESIGN.md` someone already filled. It fills every cell so the file looks complete, which leaves a reader unable to tell a hex sampled from the CLI apart from one the session made up, and a proposal nobody flagged gets built on. A trailing tag column added to mark that uncertainty breaks the render parser instead.

The greenfield case is the one that fails quietly. A project with no UI code still has a personality paragraph and a stated platform, so values can be proposed against a signal rather than pulled from a default palette. A session that does not know this reports there is nothing to extract.

## Must

- Pick the source or greenfield path from what the project tree holds, never from a flag or an argument
- Announce which path ran, since the two produce different-looking output from one skill
- Fetch the seed template and keep every heading and table header intact, because the render parser reads them
- Mark any cell not traced to a source value inline inside the cell value, and take the uncertainty into the sentence when the section is prose
- Anchor every greenfield proposal to a personality or requirements signal rather than to a default
- Render the preview and report its path, so the proposals get looked at before they are committed

## Must not

- Overwrite a `canon/DESIGN.md` that already carries content beyond the seed
- Guess a value on the source path when no signal exists. Leave the cell blank instead.
- Invent a non-goal. A proposed motion line is correct when nothing rules motion out.
- Put the verify tag in a trailing column, which breaks the row
- Rewrite the transcribed personality paragraph, which is the one section that is not a proposal

## Guards

- `canon/DESIGN.md` already populated: stop rather than mutating it
- `canon` not on PATH: stop, since the seed template and the render both need it
- Greenfield path with no `canon/REQUIREMENTS.md` or no `## Personality` section: stop, because there is nothing to propose against. Evaluate this only after Step 1 picks the path.

## Out of scope

- Mutating an existing design system, which is a direct edit of the file rather than a skill
- Producing the HTML and CSS preview, which `canon design render` owns
- Auditing the implemented UI against the tokens, which `ux-audit` owns
- Architecture and flow diagrams, which `draft-diagram` owns
