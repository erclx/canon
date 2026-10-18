---
title: Beats template
description: The nine-section template script-screencast writes to demos/<slug>/beats.md, pre-seeded so the draft ships as-is
---

# Beats template

Applies to the draft `script-screencast` Step 4 writes. Fill every placeholder from the project context and the discovery answers. The template states no zoom or caption value, since each traces to a source `canon:video-craft` records.

## Template

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
