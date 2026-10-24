---
name: ux-audit
description: Audits the current UI for incomplete, inconsistent, or confusing patterns. Reads DESIGN.md for intent, scans UI files, and outputs observations grouped by surface. Use when asked "audit the UX", "audit the UI", "UX audit", or "find UI roughness". Do NOT use for new feature planning or code changes, and do NOT use to measure what a running interface costs to paint, which is `ux-measure`.
metadata:
  family: check
---

# UX audit

## Guards

- If no UI files exist in the project (no JSX, TSX, Vue, Svelte, or HTML under `src/`), stop: `❌ No UI surfaces found to audit.`
- If the request asks what the interface costs to paint, block, or shift at runtime, run nothing and name `ux-measure`, since this skill reads source and reaches no number a browser produces
- Contrast is the exception and stays here, since two color values in the stylesheet's custom properties compute it, and the design document's lead names that stylesheet

## Step 1: read context

Read these in parallel from the project root, skipping any that do not exist:

- `CLAUDE.md`: project type and conventions
- `canon/DESIGN.md`: visual intent, typography, and spacing rules, plus the stylesheet its lead names for the values
- `canon/REQUIREMENTS.md`: feature scope and non-goals
- A committed capture beside the surface's own source, when the project has one, since only a capture shows the composed result rather than the markup
- Absent one, note that this audit reads source only and keep going. A project with no capture yet still gets a source-only audit rather than a stop.

## Step 2: identify surfaces

List the UI surfaces in the project. A surface is a distinct screen, page, panel, or major component (e.g. sidepanel, popup, settings page, empty state). Group files by surface. Do not audit speculative or unfinished code flagged in `.canon/tasks/` as in-progress.

## Step 3: audit each surface

For each surface, look for:

1. **Missing feedback states**: loading, empty, error, disabled, in-progress
2. **Unhandled edge cases**: long strings, overflow, zero items, many items, slow networks
3. **Inconsistencies**: spacing, tone of voice, interaction patterns, icon use, keyboard affordances
4. **Roughness in daily use**: friction, redundant steps, unclear affordances, ambiguous labels

Use `canon/DESIGN.md` as ground truth for intent where it exists. Observations only, no implementation suggestions or fixes. Take what consistent interaction means from the `ui` rules in `.claude/rules/`, and skip that when the project installed none.

Where Step 1 found a committed capture for this surface, judge composed output (spacing, overlap, contrast, wrapping) against it rather than inferring layout from markup. Where none exists, judge from source and say so in that surface's findings, since a source read cannot see what only a render shows.

## Step 4: report and persist

### Report format

Start with a summary line. Group findings by surface. Omit surfaces with no findings.

```markdown
X observations across N surfaces.

Surface: <name>

- Missing feedback state: <observation>
- Inconsistency: <observation>

Surface: <other>

- Edge case: <observation>
```

If nothing is wrong, use: `✅ No observations.`

### Persist

Derive `<slug>` per `${CLAUDE_SKILL_DIR}/../git-branch/references/slug.md`. Fall back to `latest` on an empty result.

- Write the full report to `.canon/review/ux-audit-<slug>.md` at the main worktree root, resolved the way `session-worktree` does, creating the directory if needed and always overwriting
- The report is a main-root write, so it goes out as a heredoc, routed the way `session-worktree` states
- With no observations, write `✅ No observations.` to the file with a timestamp
- `.canon/review/` is gitignored, so do not stage or commit the file

### Chat output

Output only the summary line and the file path. Do not repeat the full report in chat.

```plaintext
X observations across N surfaces.
📝 Wrote .canon/review/ux-audit-<slug>.md
```

If no observations: `✅ No observations. Wrote .canon/review/ux-audit-<slug>.md`
