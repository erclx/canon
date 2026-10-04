---
name: draft-screencast
description: Drafts a screencast script with pre-seeded beats, defaults, and decisions to `demos/<slug>/beats.md`. Reads project context, asks four discovery questions with proposed defaults, then writes a shippable draft. Use when asked to "draft a screencast", "write a recording script", "plan a demo video", or "scaffold a screencast for X". Do NOT re-invoke to refine an existing draft. Re-running overwrites. Edit the draft file directly.
metadata:
  family: generate
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

Create `demos/<slug>/beats.md` at the project root, creating the folder if it does not exist. The file is committed with the rest of the demo's sources, so a recording can be rebuilt from the folder alone.

Write all nine sections. Pre-seed every section with concrete content so the draft is shippable as-is. The user edits down rather than fills blanks.

Load `canon:video-craft` for every zoom and caption value the draft names, and report it rather than proceeding silently when it does not resolve. The template below states none, since each number there traces to a source that skill records.

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
- Emphasis: zoom onto the action, scale and speed per `canon:video-craft`
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
- Emphasis: zoom out to full frame
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
- Zoom: only on an action too small to read at full frame, scale, speed, and dwell per `canon:video-craft`, zoomed out before every cut
- Highlight overlay: ~1.5s soft glow

## 6. Captions

- Each caption names what its beat's frame shows, at most two lines of 42 characters, per `canon:video-craft`
- Hold and reading rate per `canon:video-craft`, splitting a caption across beats rather than shortening its hold
- Placed off the element the beat acts on

## 7. Distribution

Where the recording ships. Strike rows that do not apply.

- [ ] Native upload to social platform
- [ ] Canonical host (long-form video platform)
- [ ] Linked from project README or release notes

## 8. Resolved decisions

Pre-seeded with the common picks. Strike or rewrite as needed.

- Audio: silent plus captions
- Language: English
- Chip order: <leave for user, derived from beats>
- Thumbnail: hero-moment frame

## 9. Wrap

What surrounds the take in the finished video. Each row carries a proposed default. Write `none` on every row to ship the raw take.

- Intro: <proposed title card of two to three seconds naming the subject, or `none`>
- Outro: <proposed closing card naming where to go next, or `none`>
- Music: none
```

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
