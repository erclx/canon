---
name: draft-screencast
description: Drafts a screencast script with pre-seeded beats, defaults, and decisions to `.canon/tmp/screencast/<slug>.md`. Reads project context, asks four discovery questions with proposed defaults, then writes a shippable draft. Use when asked to "draft a screencast", "write a recording script", "plan a demo video", or "scaffold a screencast for X". Do NOT re-invoke to refine an existing draft. Re-running overwrites. Edit the draft file directly.
---

# Draft screencast

## Guards

- If no topic is provided, stop: `❌ No screencast topic. Describe what you are recording.`
- Draft, then hand off. Do not edit video or generate captions, and do not drive the application. A recording is another skill's job rather than something forbidden: write the draft, name `record-screencast` as the next step, and stop.
- Stack-agnostic in the draft. Never name a recording tool, an editing tool, a font, or a window manager. Keep selectors, URLs, wait conditions, and timings out of the beats too, since those four are exactly what the compiler adds in a plan of its own. A beat carrying them stops being a document a person can read and edit down.

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

Create `.canon/tmp/screencast/<slug>.md` at the main worktree root. Create the directory if it does not exist. The file is gitignored.

From a linked worktree the file-editing tools refuse that path, so the draft goes out through `Bash`. Send the `mkdir -p` and the heredoc as two plain commands rather than joining them with `&&`, which is refused as compound.

Write all eight sections. Pre-seed every section with concrete content so the draft is shippable as-is. The user edits down rather than fills blanks.

```markdown
# Screencast: <short title>

## 1. Header

- Audience: <from discovery>
- Length: <from discovery>
- Hero moment: <from discovery>
- Pitch: <one sentence, derived from project context>

## 2. Pre-recording checklist

- [ ] Browser at 1920x1080 with notifications silenced
- [ ] Session storage and history cleared for the recorded surfaces
- [ ] Cursor highlighter on
- [ ] Live URLs and fixtures verified healthy
- [ ] <one or two project-specific items derived from context>

## 3. Beat sheet

Five beats. Each uses five fields. Add a sixth `Transition out` only when non-default.

### Beat 1: Cold open

- On screen: <derived from hero moment>
- Action: <one verb, derived>
- Watch for:
- Emphasis: zoom 1.4x
- Caption:

### Beat 2: Setup

- On screen:
- Action:
- Watch for:
- Emphasis: none
- Caption:

### Beat 3: Hero moment

- On screen: <hero moment from discovery>
- Action:
- Watch for:
- Emphasis: highlight overlay
- Caption:

### Beat 4: Payoff

- On screen:
- Action:
- Watch for:
- Emphasis: none
- Caption:

### Beat 5: Outro

- On screen:
- Action:
- Watch for:
- Emphasis: zoom 1.2x out
- Caption:

## 4. Sequencing notes

- Hover before click. The cursor needs a beat to register.
- Do not cut mid-reset. Let state changes complete on screen.
- Cut on action, not on stillness.
- <one or two project-specific gotchas derived from context>

## 5. Production notes

- Resolution: 1920x1080
- Frame rate: 30fps
- Container: mp4 H.264
- Zoom: max 1.8x with always-zoom-out before cut
- Highlight overlay: ~1.5s soft glow

## 6. Caption typography

- White text on dark scrim at ~60% opacity
- ~200ms fade in and out
- One line max per caption, split across beats if needed

## 7. Distribution

Where the recording ships. Strike rows that do not apply.

- [ ] Native upload to social platform
- [ ] Canonical host (long-form video platform)
- [ ] Linked from project README or release notes

## 8. Resolved decisions

Pre-seeded with the common picks. Strike or rewrite as needed.

- Audio: silent plus captions
- Music: none
- Language: English
- Chip order: <leave for user, derived from beats>
- Thumbnail: hero-moment frame
```

## Step 5: output

Print the file path on its own line and a one-line summary. Do not paraphrase the path into prose.

```markdown
📝 Wrote .canon/tmp/screencast/<slug>.md

Draft has 5 beats and pre-seeded defaults. Edit the beats and the resolved decisions.

To record it rather than shoot it by hand:
record-screencast .canon/tmp/screencast/<slug>.md
```

Name the skill and stop there. Do not compile the draft, do not run it, and do not generate captions. The operator edits the beats first, and the compiler reports which selectors and URLs they still owe it.

Say so plainly if `canon demo compile` is not available, rather than driving the application some other way. The command ships with the CLI and the skills ship with the plugin, so a project carrying one and not the other is a real state.
