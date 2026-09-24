---
name: canon-feedback
description: Format a report about something broken, missing, or off in canon and open it as a GitHub issue on the toolkit repo via `canon feedback --github`, where the toolkit's triage reads it. Use when asked to "send this to the toolkit", "report this to canon", "file toolkit feedback", or "give the toolkit feedback about X". Do NOT use for general complaints about other tooling, IDE issues, or in-project bugs that do not implicate canon surfaces.
---

# Canon feedback

Format a `## Toolkit feedback` block from the current session, then open it as a GitHub issue on the toolkit repo, labeled `feedback` plus the domain label its surface type names. `canon-feedback-triage` reads that queue.

## Guards

- If nothing in session context points to a toolkit issue, stop: `❌ No toolkit issue in session context. Describe what broke, then re-invoke.`
- If the surface type is ambiguous (snippet vs. plugin skill vs. CLI vs. seed), ask one line before formatting.
- Do not probe the project, list files, grep, or read toolkit surfaces. Use only what the session already contains.

## Step 1: build the block

From the conversation so far, identify:

- Target project name or kind, never its full path. The path names a folder on one machine and says nothing a triage session can route on, where the project's own name does. Name a private project by its kind instead, such as `a Next.js app`, since the report leaves the machine.
- Toolkit surface and its type (plugin skill, snippet, tooling config, governance rule, seed, or CLI). The type leads the `### Surface` field, ahead of the first comma, because the CLI picks the issue's domain labels from that text alone.
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

The destination is a public GitHub issue on the toolkit repo, so the report leaves the machine. Hold it and ask when the operator has marked it sensitive, and never send it on a guess.

Before the pipe below, run the scan in `${CLAUDE_SKILL_DIR}/../../standards/publish.md` against the composed block, phase-label half included. Nothing else checks what reaches the remote, so this scan is the only gate.

```bash
cat <<'EOF' | canon feedback --github
## Toolkit feedback

...
EOF
```

The CLI opens a GitHub issue on the toolkit repo, labeled `feedback` and each domain label the surface type names, such as `skills` for a plugin skill, and prints the issue URL, which this skill reports back on its own line. It needs `gh` authenticated. `git-issue` is not the route, since it files on the current repository and this report belongs on the toolkit's.

From a toolkit checkout, a call that produces no URL falls back to `.canon/feedback/feedback-<slug>-<ts>.md` and prints the reason on stderr. Say so in the same reply, naming the file and the reason, since a silent fallback leaves the report where nothing reads it. A target project has no such folder, so a failed call there prints the block in chat.

If `canon` is not on PATH, fall back: print the block in chat and tell the user `📋 Copy the block above into a toolkit-repo session.`

## Step 3: read what the CLI said back

The command exits 1 and writes nothing on a report it refuses, so a non-zero run is a block to repair rather than a report that shipped. Two refusals reach this step:

- A named missing field. Add that heading with a real value or its stated fallback, then re-run. Do not report the defect as filed.
- `gh` absent or its call failed. The stderr names which, since installing `gh` and fixing an authenticated call are different repairs. Fall back to printing the block in chat.

A `--github` run from a toolkit checkout whose GitHub call fails warns and writes local scratch instead, which is a report filed on the other route rather than a failure.

## Notes

- `canon feedback` resolves the toolkit root from the running `canon` binary's source location. If multiple toolkit clones exist on the machine, the first `canon` on PATH wins.
- The local folder is a fallback for a failed issue call, and nothing reads it on a schedule. The issue is the durable record.
