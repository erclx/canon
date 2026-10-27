---
name: canon-feedback
description: Format a report about something broken, missing, or off in canon and open it as a GitHub issue on the toolkit repo via `canon feedback`, where the toolkit's triage reads it. Use when asked to "send this to the toolkit", "report this to canon", "file toolkit feedback", or "give the toolkit feedback about X". Do NOT use for general complaints about other tooling, IDE issues, or in-project bugs that do not implicate canon surfaces.
metadata:
  family: upkeep
---

# Canon feedback

Format a `## Toolkit feedback` block from the current session, then open it as a GitHub issue on the toolkit repo, labeled `feedback` plus the domain label its surface type names. The toolkit's maintainers triage that queue.

## Guards

- If nothing in session context points to a toolkit issue, stop: `❌ No toolkit issue in session context. Describe what broke, then re-invoke.`
- If the surface type is ambiguous (plugin skill vs. CLI vs. seed), ask one line before formatting.
- Do not probe the project, list files, grep, or read toolkit surfaces. Use only what the session already contains.

## Step 1: build the block

### A follow-up or a new issue

Pick the form before filling any field, from what the session already holds.

- A follow-up, when the session cites an open feedback issue and the new case sits on its surface, such as a fix landing elsewhere, a second instance, or a finding that overturns the proposed fix
- A new issue, when no feedback issue is cited or the case sits on a different surface

For a follow-up, fill the `## Toolkit feedback follow-up` block in `${CLAUDE_SKILL_DIR}/references/template.md` and go to Step 2. For a new issue, build the report below.

A follow-up carries `### Observed`, `### Changes the fix`, and `### Links`, and the CLI refuses one missing any of them. `### Changes the fix` opens with yes or no, since a yes tells triage the body's fix no longer stands. `### Links` holds at least one URL or issue reference such as `frameboard#156`, never a bare name.

### The report fields

From the conversation so far, identify:

- Target project name or kind, never its path, which names one machine's folder and nothing triage routes on. Name a private project by kind, such as `a Next.js app`, since reports leave the machine.
- Toolkit surface and its type (plugin skill, tooling config, governance rule, seed, or CLI). The type leads `### Surface`, ahead of the first comma, since the CLI labels from it alone.
- Specific toolkit file or name when the session cites one

### Behavior and fix

From the same conversation, identify:

- Observed behavior
- Expected behavior, or `unclear`
- Repro details already in context (commands run, files touched), or `none`
- Proposed fix, or `open` when the session settled on no direction

**Fields the report omits when the session has none:**

- Suggested shape, when the session worked out what the change should look like, such as a template, a command's output, or a field list
- Why, when the session has reasons for the fix beyond the observed failure
- Links, when the session cites an issue, a pull request, or a document

Format as a single fenced markdown block, one `###` heading per field. Read `${CLAUDE_SKILL_DIR}/references/template.md` on reaching this point for the block and each field's fallback.

### Required and optional fields

The fields fall into three groups, and each treats a missing value differently.

| Fields                                            | When the session has nothing                                                        |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `### Surface`, `### Observed`, `### Proposed fix` | Required, and `canon feedback` refuses a report missing one, naming it              |
| `### From project`, `### Expected`, `### Repro`   | Write the template's literal fallback, so the field reads as absent, not unreported |
| `### Suggested shape`, `### Why`, `### Links`     | Omit the heading with no fallback, since a placeholder reads as nothing to say      |

Keep Observed and Expected to one or two lines each, so the report scans. Length belongs in Proposed fix, Suggested shape, and Why.

### Headings, not bold labels

A GitHub issue form renders a submitted field as `### <label>`, so one shape reaches the toolkit whichever route a report takes, and the CLI parses both with one parser. The retired `**Surface:**` form is refused, so a block carrying it has to be rewritten.

The issue body is the request. Put everything the toolkit needs to act on it there, since a comment is easy to miss and a body and a comment that differ leave triage choosing. A comment carries only what happens after filing, and goes out as a follow-up through `canon feedback --on`, never a hand-written `gh issue comment`.

## Step 2: ship to the toolkit

Detect whether `canon` is on PATH:

```bash
command -v canon >/dev/null 2>&1
```

The destination is a public GitHub issue on the toolkit repo, so the report leaves the machine. Hold it and ask when the operator has marked it sensitive, and never send it on a guess.

Before the pipe below, run the scan in `${CLAUDE_SKILL_DIR}/../git-pr/references/publish.md` against the composed block, phase-label half included. Nothing else checks what reaches the remote, so this scan is the only gate.

```bash
cat <<'EOF' | canon feedback
## Toolkit feedback

...
EOF
```

A follow-up pipes the same way with the issue number, and the CLI refuses a closed issue or one without the `feedback` label before posting anything:

```bash
cat <<'EOF' | canon feedback --on <issue>
## Toolkit feedback follow-up

...
EOF
```

The CLI opens a GitHub issue on the toolkit repo, labeled `feedback` and each domain label the surface type names, such as `skills` for a plugin skill, and prints the issue URL for this skill to report on its own line. It needs `gh` authenticated, and `git-issue` is not the route, since it files on the current repository.

### Reading the outcome

Read the outcome off stdout, never off the exit code, since a shell wrapper can flatten it. Stdout takes one of three shapes:

- A line opening with `https://` is the filed issue, or the posted comment for a follow-up. Report the URL.
- A block opening with `## Toolkit feedback` is a failed call. Show it in chat with the stderr reason and `📋 Paste this into an issue at https://github.com/erclx/canon/issues/new`.
- The same block on a follow-up is a failed comment. Show it the same way, pointing the paste line at the issue's own URL.
- Empty stdout is a refusal. Step 3 says how to repair it from stderr.

If `canon` is not on PATH, fall back: print the block in chat and tell the user `📋 Copy the block above into a toolkit-repo session.`

## Step 3: read what the CLI said back

A report that was not filed reads one of two ways on stdout, and stderr carries the reason in both:

- Empty stdout, with a named missing field on stderr. Add that heading with a real value or its stated fallback, then re-run. Do not report the defect as filed.
- Empty stdout on a follow-up naming a malformed field, a closed issue, or a missing label. Repair the field and re-run, or file a new issue when the issue is closed or not a feedback report.
- The block on stdout, with `gh` absent or its call failed on stderr, which names which, since the two repairs differ. Show the block in chat with the reason and the paste line from Step 2.
