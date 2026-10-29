---
name: create-rule
description: Scaffolds a project-specific governance rule into `.claude/rules/project/<subdir>/<slug>.md` with correct frontmatter and a slug no other rule in that subdir takes. Use when asked to "add a rule", "create a governance rule", "write a project rule", or when a project needs a coding rule the toolkit does not ship. Do NOT use to edit toolkit source rules under `governance/rules/`.
metadata:
  family: generate
---

# Create rule

Author a project-local governance rule. The rule lives in the target project, not the toolkit, so `canon gov sync` never overwrites it.

The sync engine orphans anything under `.claude/rules/project/` by location, before checking its name against the toolkit catalog. A rule elsewhere under `.claude/rules/` survives too, and the report offers it the path under the project subfolder.

## Guards

- If no `.claude/` directory exists, stop: `❌ No .claude/ directory found. Run canon init first.`
- If the request names no behavior to enforce, stop: `❌ Describe what the rule should enforce and which files it applies to.`

## Step 1: gather intent

Resolve both from the request, and ask only for what is missing. Attach a proposed default derived from the request.

- What the rule enforces: one topic, phrased as a standard (`<topic> conventions`).
- Scope: a path glob relative to the project root (`<dir>/**/*.<ext>`) for a path-scoped rule, or always-on when the rule states a global principle with no file scope.
- Whether canon already ships a rule for the topic, read from `canon gov list --rules --json`. When one does, point the user at it and at `canon gov install --add` rather than authoring a copy.
- An installed skill already covering the topic, found per `### Checking the installed skills` in `${CLAUDE_SKILL_DIR}/references/rule.md`. Point the rule at it rather than restating it.

## Step 2: resolve the subdir

Pick the subdir from the topic. It sits under `.claude/rules/project/` and names the rule's domain:

| Subdir        | Holds                                                      |
| ------------- | ---------------------------------------------------------- |
| `code/`:      | code placement, errors, naming, testing.                   |
| `lang/`:      | one programming language.                                  |
| `framework/`: | one framework.                                             |
| `lib/`:       | one library or tool.                                       |
| `ui/`:        | UI copy, accessibility, forms.                             |
| `claude/`:    | session conduct and `.claude/` authoring surfaces.         |
| `canon/`:     | the toolkit workflow and its record folders.               |
| `tooling/`:   | dev setup, such as CI workflows, dependencies, and config. |
| `writing/`:   | prose and document shape.                                  |

## Step 3: pick a free slug

A rule's filename is its slug alone, a one-to-three-word kebab topic with no number in front. A slug the toolkit ships is no collision, since `canon/` and `project/` install side by side and a sync never reads the second.

- Take a slug no file in the chosen `.claude/rules/project/<subdir>/` already uses.
- Never take a slug equal to a subdir name from Step 2, since a stack entry naming that word reads it as the folder.
- Stop and say so when the topic's natural slug is taken, and propose a narrower one rather than overwriting the file.

## Step 4: write the rule

Read `${CLAUDE_SKILL_DIR}/references/rule.md` for frontmatter, body shape, and voice before writing the body. Do not work the shape from memory.

Write `.claude/rules/project/<subdir>/<slug>.md`. Preview the resolved path, subdir, slug, and frontmatter, then write immediately, since the tool permission dialog is the confirmation gate.

- Frontmatter carries the Claude shape
- Path-scoped rules emit one `paths:` entry per glob
- Always-on rules omit `paths:` entirely

```markdown
---
description: <one line, what the rule enforces and where>
paths:
  - '<glob>'
---

# <Topic> standards

## <Group>

- <imperative rule>
- <imperative rule>
```

Title casing is sentence case, with proper nouns keeping their own casing (`# TypeScript standards`). `${CLAUDE_SKILL_DIR}/references/rule.md` owns the rest of the body shape.

## Step 5: check each bullet

Read `${CLAUDE_SKILL_DIR}/references/checklist.md` and run every bullet of the written rule through it, along with the shape limits and the content test in `rule.md`.

- Rewrite a bullet marked revise and cut one marked drop, then run the checklist again over what changed
- Run `canon gov audit .claude/rules/project/<subdir>/<slug>.md` and fix every finding it reports, since the shape limits are counts the verb takes rather than a judgment
- Report the verdict counts with the path, and name any bullet kept against a criterion with the reason

## After writing

Emit the full path on its own line: `.claude/rules/project/<subdir>/<slug>.md`. Remind the user that Claude Code loads path-scoped rules when it reads or writes a matching file, and always-on rules every session. When a bullet claims outside practice, tell them to cite its source, in a ledger or in the commit that adds the rule.

Show the new rule as a diff in chat and commit nothing until the operator says OK.

### When a bullet cites outside practice

Offer to record each source in a ledger at `canon/ledger/rules/<subdir>/<slug>.md`, which `canon gov audit` checks row for bullet. Read `${CLAUDE_SKILL_DIR}/references/ledger.md` for the layout and the row shape before writing one.
