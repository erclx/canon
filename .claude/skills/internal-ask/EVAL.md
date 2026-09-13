# internal-ask eval

Run each prompt in a fresh session. Invoke with `/internal-ask <question>`. Judge by: right source file, answer under four lines, `Source:` line present and accurate.

## 1. docs/ hit

- **Prompt:** `/internal-ask how do I set up a target project?`
- **Expected source:** `docs/target-projects.md`
- **Shape:** short answer explaining `canon init`, cites the doc.

## 2. docs/ hit, CLI surface

- **Prompt:** `/internal-ask what CLI commands does the toolkit expose?`
- **Expected source:** `docs/agents/commands.md`
- **Shape:** names the agent surface doc, lists at most a couple examples.

## 3. wiki/ hit, Claude Code concept

- **Prompt:** `/internal-ask what are Claude Code hooks?`
- **Expected source:** `wiki/claude/claude-hooks.md`
- **Shape:** one-line concept answer, cites wiki page.

## 4. wiki/ hit, workflow

- **Prompt:** `/internal-ask how do I run parallel Claude sessions on separate branches?`
- **Expected source:** `wiki/claude/claude-worktrees.md`
- **Shape:** points at worktrees wiki page.

## 5. two-file ambiguity

- **Prompt:** `/internal-ask how do skills get installed from the toolkit into a project?`
- **Expected source:** `canon/context/claude-plugin/distribution.md` and `wiki/claude/claude-skills.md` both plausible. Either one alone is acceptable. Two-file `Source:` line is also acceptable.
- **Shape:** tests the "read at most two" rule.

## 6. escalation to CLAUDE.md / REQUIREMENTS.md

- **Prompt:** `/internal-ask what are the non-goals of this toolkit?`
- **Expected source:** `canon/REQUIREMENTS.md`
- **Shape:** neither index lists this directly. Should fall through to the requirements doc, not guess from docs/.

## 7. not covered

- **Prompt:** `/internal-ask how do I configure the Datadog integration?`
- **Expected source:** none. Reply: `Not covered in docs or wiki. Narrow the question or point at a specific file.`
- **Shape:** tests the stop-and-decline path. Must not guess or grep the repo.

## Failure modes to watch

- Reading more than two files in Step 2
- Opening `src/` or `scripts/` files. The skill is prose-only.
- Answer longer than four lines
- Missing or fabricated `Source:` path
- Marketing or filler language (`simply`, `easily`, `serves as`)
