---
name: create-rule
description: Scaffolds a project-specific governance rule into `.claude/rules/project/<subdir>/<n>-<slug>.md` with correct frontmatter and a non-colliding number. Use when asked to "add a rule", "create a governance rule", "write a project rule", or when a project needs a coding rule the toolkit does not ship. Do NOT use to edit toolkit source rules under `governance/rules/`.
---

# Create rule

Author a project-local governance rule. The rule lives in the target project, not the toolkit, so `canon gov sync` never overwrites it: the sync engine orphans anything under `.claude/rules/project/` by location, before it ever checks the rule's name against the toolkit catalog. A rule written anywhere else under `.claude/rules/` survives the sync too, and the report offers it the path under the project subfolder it would take.

## Guards

- If no `.claude/` directory exists, stop: `❌ No .claude/ directory found. Run canon init first.`
- If the request names no behavior to enforce, stop: `❌ Describe what the rule should enforce and which files it applies to.`

## Step 1: gather intent

Resolve both from the request, and ask only for what is missing. Attach a proposed default derived from the request.

- What the rule enforces: one topic, phrased as a standard (`<topic> conventions`).
- Scope: a path glob relative to the project root (`<dir>/**/*.<ext>`) for a path-scoped rule, or always-on when the rule states a global principle with no file scope.

## Step 2: resolve the subdir

Pick the subdir from the topic. It sits under `.claude/rules/project/` and names the rule's domain:

- `code/`: code placement, errors, naming, testing.
- `lang/`: one programming language.
- `framework/`: one framework.
- `lib/`: one library or tool.
- `ui/`: UI copy, accessibility, forms.
- `claude/`: session conduct and `.claude/` authoring surfaces.
- `canon/`: the toolkit workflow and its record folders.
- `tooling/`: dev setup, such as CI workflows, dependencies, and config.
- `writing/`: prose and document shape.

## Step 3: pick a free number

A project-authored rule numbers in `900-999`, the band reserved for one. `000-899` belongs to the toolkit, so a number free in the target today is one a later release can ship into.

- Scan every `.claude/rules/project/<subdir>/` in the target for used prefixes, not only the subdir this rule lands in. The band runs as one sequence across all of them.
- Take the lowest unused number at or above `900`.
- Stop and say so if the band is full, rather than reaching below `900`.

## Step 4: write the rule

Read `${CLAUDE_SKILL_DIR}/../../standards/rule.md` for frontmatter, body shape, and voice before writing the body. Do not work the shape from memory.

Write `.claude/rules/project/<subdir>/<n>-<slug>.md` where `<slug>` is a 1-to-3-word kebab topic. Preview the resolved path, subdir, number, and frontmatter, then write immediately. The tool permission dialog is the confirmation gate.

Frontmatter carries the Claude shape. Path-scoped rules emit one `paths:` entry per glob. Always-on rules omit `paths:` entirely.

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

Title casing is sentence case, with proper nouns keeping their own casing (`# TypeScript standards`). `${CLAUDE_SKILL_DIR}/../../standards/rule.md` owns the rest of the body shape.

## After writing

Emit the full path on its own line: `.claude/rules/project/<subdir>/<n>-<slug>.md`. Remind the user that Claude Code loads path-scoped rules when it reads a matching file, and always-on rules every session.
