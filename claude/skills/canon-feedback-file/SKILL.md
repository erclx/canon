---
name: canon-feedback-file
description: Format a paste-back report about something broken, missing, or off in canon and write it directly to the toolkit's `.canon/feedback/` folder via `canon feedback`. Use when asked to "send this to the toolkit", "report this to canon", "file toolkit feedback", or "give the toolkit feedback about X". Do NOT use for general complaints about other tooling, IDE issues, or in-project bugs that do not implicate canon surfaces.
---

# Canon feedback file

Format a `## Toolkit feedback` block from the current session, then ship it to the toolkit repo without manual copy-paste.

## Guards

- If nothing in session context points to a toolkit issue, stop: `❌ No toolkit issue in session context. Describe what broke, then re-invoke.`
- If the surface type is ambiguous (snippet vs. plugin skill vs. CLI vs. seed), ask one line before formatting.
- Do not probe the project, list files, grep, or read toolkit surfaces. Use only what the session already contains.

## Step 1: build the block

From the conversation so far, identify:

- Target project name or kind, never its full path. The path names a folder on one machine and says nothing a triage session can route on, where the project's own name does. Name a private project by its kind instead, such as `a Next.js app`, since the report leaves the machine.
- Toolkit surface and its type (plugin skill, snippet, tooling config, governance rule, seed, or CLI)
- Specific toolkit file or name when the session cites one
- Observed behavior
- Expected behavior, or `unclear`
- Repro details already in context (commands run, files touched), or `none`
- Proposed fix, or `open` when the session settled on no direction

Format as a single fenced markdown block, one `###` heading per field:

```markdown
## Toolkit feedback

### From project

<name or kind>

### Surface

<type>, <file path or name>

### Observed

<one or two lines>

### Expected

<one or two lines, or "unclear">

### Repro

<commands or steps, or "none">

### Proposed fix

<one line, or "open">
```

`canon feedback` refuses a report missing `### Surface`, `### Observed`, or `### Proposed fix`, naming the one it did not find. The other three are optional, so write the literal fallback shown above rather than dropping the heading, which is what keeps a field the session cannot fill reading as absent instead of unreported.

Headings rather than bold labels, because a GitHub issue form renders a submitted field as `### <label>`. One shape reaches the toolkit whichever route a report takes, and the CLI parses both with one parser. The retired `**Surface:**` form is refused rather than accepted, so a block carrying it has to be rewritten.

Keep each field to one or two lines.

## Step 2: ship to the toolkit

Detect whether `canon` is on PATH:

```bash
command -v canon >/dev/null 2>&1
```

Before either pipe below, run the scan in `${CLAUDE_SKILL_DIR}/../../standards/publish.md` against the composed block. `.canon/review/` is gitignored, so no hook reaches either write, and this scan is the only gate. The banned-character half runs on both branches, including the local write. The phase-label half applies only on the `--github` branch, where the block reaches a remote.

Local scratch only writes from a toolkit checkout, since `canon feedback` resolves the destination against the toolkit's own `.claude/` folder and a target project never carries one. Pipe the block to `canon feedback --github` first.

```bash
cat <<'EOF' | canon feedback --github
## Toolkit feedback

...
EOF
```

The CLI opens a GitHub issue on the toolkit repo and prints the issue URL. It needs `gh` authenticated, and falls back to local scratch with the reason on stderr when the call produces no URL and the session holds a toolkit checkout to fall back onto.

From a toolkit checkout, plain `canon feedback` reaches the same destination without opening an issue:

```bash
cat <<'EOF' | canon feedback
## Toolkit feedback

...
EOF
```

It writes to `.canon/feedback/feedback-<slug>-<ts>.md` and prints the absolute path on stdout. Report the printed path back to the user on its own line, in the form the project's instruction file sets under `## Output`.

If `canon` is not on PATH, fall back: print the block in chat and tell the user `📋 Copy the block above into a toolkit-repo session.`

## Step 3: read what the CLI said back

The command exits 1 and writes nothing on a report it refuses, so a non-zero run is a block to repair rather than a report that shipped. Two refusals reach this step:

- A named missing field. Add that heading with a real value or its stated fallback, then re-run. Do not report the defect as filed.
- `gh` absent or its call failed. The stderr names which, since installing `gh` and fixing an authenticated call are different repairs. Fall back to printing the block in chat.

A `--github` run from a toolkit checkout whose GitHub call fails warns and writes local scratch instead, which is a report filed on the other route rather than a failure.

## Notes

- `canon feedback` resolves the toolkit root from the running `canon` binary's source location. If multiple toolkit clones exist on the machine, the first `canon` on PATH wins.
- The destination `.canon/review/` is gitignored in the toolkit repo. Feedback lives as session scratch for the next toolkit-side triage, not as a durable archive.
