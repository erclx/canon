---
name: draft-screencast
description: Drafts a screencast script with pre-seeded beats, defaults, and decisions to `demos/<slug>/beats.md`. Reads project context, asks four discovery questions with proposed defaults, then writes a shippable draft. Use when asked to "draft a screencast", "write a recording script", "plan a demo video", or "scaffold a screencast for X". Do NOT re-invoke to refine an existing draft. Re-running overwrites. Edit the draft file directly.
metadata:
  family: generate
---

# Draft screencast

## Guards

- If no topic is provided, stop: `❌ No screencast topic. Describe what you are recording.`
- Draft, then hand off. Do not edit video, generate captions, or drive the application, since a recording is `record-screencast`'s job. Name it as the next step and stop.
- Stack-agnostic in the draft. Never name a recording tool, an editing tool, a font, or a window manager.
- Keep selectors, URLs, wait conditions, and timings out of the beats, since the compiler adds those four in a plan of its own and a beat carrying them stops being readable

## Step 1: read the project context

Read these in parallel from the project root, skipping any that do not exist:

- `CLAUDE.md`: behavior rules and project pitch
- `canon/REQUIREMENTS.md`: feature scope, non-goals, audience hints
- `.canon/tasks/index.md`: current scope
- Recent commits via `git log --oneline -20 2>/dev/null || echo "FALLBACK"`: what shipped recently is usually the recording subject.

## Step 2: discovery with proposed defaults

Ask exactly four questions in chat. Each carries a proposed default derived from Step 1. The user confirms, overrides, or says "use defaults" to accept all.

```markdown
**Discovery:**

1. Audience: proposing technical peers. Override?
2. Length: proposing 75-90s. Override?
3. Hero moment: proposing <best guess from context, or "the single thing that has to land">. Override?
4. What to cut: proposing <best guess, or "anything that is not the hero moment">. Override?
```

Wait for answers before drafting. Do not infer silence as acceptance.

## Step 3: derive the slug

Build a 2-to-4-word kebab-case slug from the topic and discovery answers. Examples: `auth-flow-redesign`, `cli-onboarding`, `inline-edit-launch`.

## Step 4: write the draft

Create `demos/<slug>/beats.md` at the project root, creating the folder if it does not exist. The file is committed with the rest of the demo's sources, so a recording can be rebuilt from the folder alone.

### Fill the template

Write all nine sections from `${CLAUDE_SKILL_DIR}/references/beats-template.md`, read on reaching this step. Pre-seed every section with concrete content so the draft ships as-is, and the user edits down rather than fills blanks. A run stopped at discovery skips it.

Load `canon:video-craft` for every zoom and caption value the draft names, and report it rather than proceeding silently when it does not resolve.

## Step 5: output

Print the file path on its own line and a one-line summary. Do not paraphrase the path into prose.

```markdown
📝 Wrote demos/<slug>/beats.md

Draft has 5 beats and pre-seeded defaults. Edit the beats, the resolved decisions, and the wrap.

To record it rather than shoot it by hand:
record-screencast demos/<slug>/beats.md
```

Name the skill and stop there. Do not compile the draft, do not run it, and do not generate captions. The operator edits the beats first, and the compiler reports which selectors and URLs they still owe it.

Say so plainly if `canon demo compile` is not available, rather than driving the application some other way. The command ships with the CLI and the skills ship with the plugin, so a project carrying one and not the other is a real state.
