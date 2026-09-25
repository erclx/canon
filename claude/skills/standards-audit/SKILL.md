---
name: standards-audit
description: Audits changed markdown files against every authoring standard that declares jurisdiction over their paths and reports violations without fixing. Reads the standards catalog to map each file, greps for banned tokens, and groups findings by file. Use when asked to "audit prose", "audit standards", "check standards", "standards audit", or after editing markdown where standards compliance matters. Do NOT fix violations. Reporting only.
---

# Standards audit

## Guards

- Resolve the base ref first, per Diff baseline below, then scope the file list exactly as Step 1 does, fallback included. If no markdown files changed, stop: `✅ No markdown changes to audit.` A guard that reads bare local `main`, or that skips the unusable-baseline fallback, passes the skill clean on a branch it never read.
- If `${CLAUDE_SKILL_DIR}/../../standards/markdown.md` is not present, stop: `❌ markdown.md standard not found. Reinstall the canon plugin.` Test the file rather than the directory, since a plugin cache built before a given file existed keeps the directory without ever receiving that file.
- `markdown.md` is the one standard testable before the mapping runs, since its scope statement declares an attribute and every changed markdown file therefore maps to it. Every other standard is tested in Step 3, where the mapping has named which ones the run needs.

## Diff baseline

Resolve the base ref once and reuse it in the guard and in Step 1:

```bash
git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null
```

Prefer `origin/main` over local `main`. On `main` itself the local ref resolves to HEAD, so every committed change drops out of the set and the audit passes clean rather than admitting it cannot see the files.

The baseline is unusable in two cases:

- No merge base resolves against either ref.
- The base equals HEAD, whichever ref resolved it. Nothing is committed ahead of the base to compare against. This is the ordinary shape on `main`, and on a feature branch before its first commit.

An unusable baseline costs only the committed half. Audit `git diff HEAD --name-only` instead and lead the report with `⚠ Baseline unusable. Audited the uncommitted set only.`, so a clean result is never read as a clean branch.

## Step 1: scope the audit

Get the changed file list, substituting `git diff HEAD --name-only` when the baseline is unusable:

```bash
git diff <base> HEAD --name-only
```

Filter to markdown (`.md`), then drop what the project does not hand-author:

- `index.md`, unless its frontmatter carries `auto: false`
- Any file in a gitignored directory
- Any file sitting in a skill's bundled reference folder whose frontmatter names the consumers a generator copied it out to

The last rule keeps a fan-out from multiplying one edit into a finding per copy. The source is the file to audit and the only one an author can fix, because the next regen overwrites every copy.

It takes both halves. A generator copies frontmatter verbatim, so the field alone matches the source as well and drops the one file the rule means to keep. The location alone matches a reference the skill author wrote by hand, which carries no such field and is governed like the rest of the folder.

## Step 2: map files to standards

Read the mapping rather than holding it here. Every standard declares the paths it governs, so a standard added later joins this audit with no edit to this body:

```bash
canon standards list --json
```

Each entry carries `appliesTo`, the paths its `## Scope` statement declares. Match every changed file against every entry:

- `*` matches every changed markdown file
- An entry ending in `/` matches when the file path contains it at a path-segment boundary
- Any other entry matches when the file path ends with it at a path-segment boundary

Add any standard the catalog did not list, reading `${CLAUDE_SKILL_DIR}/../../standards/` and whatever folder the project authors its own standards in, and derive every declaration the same way when `canon` is unavailable: the backticked paths in the first sentence under `## Scope`, or `*` when that sentence says the standard governs an attribute. Skip `index.md`, which is generated from the others and declares nothing.

An entry whose `appliesTo` is empty declared nothing this can read. Report it as a finding against that standard's own file in Step 4 and audit the rest. A standard dropped in silence is the same miss this mapping exists to remove, one level up.

Every mapping names a changed markdown file, which is the only thing Step 1 produces. Text that never lands in the tree, such as a branch name or a pull request body, is checked by the skill that publishes it rather than here.

## Step 3: read standards and audit

Read each applicable standard once from `${CLAUDE_SKILL_DIR}/../../standards/<name>`, testing the file before reading it. A standard the mapping named and that path does not carry is reported as a finding against the file that mapped to it rather than skipped, since a standard read from nowhere reports every file under it clean.

For each changed file, audit against every rule:

- **Pattern rules**: grep the file for every token the standard bans. Grep is authoritative. Reading alone misses occurrences.
- **Judgment rules**: check each rule in context against the standard that states it.

Every changed markdown file gets the pattern pass, since `${CLAUDE_SKILL_DIR}/../../standards/markdown.md` applies to all of them. Take the banned tokens from that standard at read time rather than from a list held here. It carries the banned characters, so one read covers every token this pass greps for.

## Step 4: report

Group findings by file with line references, naming the standard each one comes from. One file is one fix pass, and the standard is what the reader opens to settle a finding they disagree with. Use this shape:

```markdown
path/to/file.md

- L12: `markdown.md`, em dash in prose
- L34: `markdown.md`, semicolon used to join clauses
- L51: `markdown.md`, vague qualifier `simply`
- L67: `context.md`, decision entry names no rejected alternative
```

If clean, respond with `✅ No violations.`

Reporting only. Do not rewrite any file, swap any punctuation, or propose fixes inline. Fixes are a separate user-initiated step because a lazy swap (semicolon to period, em dash to comma) leaves the sentence in the shape the ban exists to remove.

## Output

Chat output is the full report. This skill does not persist a file. The audit is a momentary check and living state is the diff itself.
