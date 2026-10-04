---
name: video-craft
description: Carries what makes a composed video of software read as designed rather than generic, being captions that name only what the frame shows, which moment earns a zoom and how fast it lands, how a real pointer behaves on a real interface, music or silence and how far under a voice the music sits, and reading a frame before dismissing a checker finding. Every number traces to a source. Use before composing or judging any video, whether a product demo, an explainer, a pull request walkthrough, or a launch clip, when a render reads generic or slow, or when asked "make this video look designed", "is this zoom too slow", "what should this caption say", "should this have music", or "the checker flagged a frame, is it real". Do NOT use for general motion such as easing, speed variety, and click timing, which HyperFrames' `hyperframes-animation` and `hyperframes-creative` carry, to fetch or generate a media file, which is `media-use`, or to record the take, which is `record-screencast`.
metadata:
  family: build
---

# Video craft

A session composing a video with no stated direction reaches for the defaults: a push-in of over two seconds, one ease on every move, a caption centered in a pill, and an intro card holding the product name and a slogan. Each default is reasonable alone, and together they read as generic. This skill carries the judgment specific to a video of software, which HyperFrames' own skills leave out.

Load `hyperframes-creative` and `hyperframes-animation` first. They own general motion, being ease and speed variety, anchoring, and click timing, and this body names none of their rules. Read `${CLAUDE_SKILL_DIR}/references/adopted.md` for the source behind every number below, and only when extending this guidance or arguing against a rule in it.

The guidance covers landscape 16:9 video. Vertical 9:16 framing is not covered yet.

## Captions name what the frame shows

- Write each caption about the frame on screen while it shows, never about the step before or the one after. A caption narrating the whole flow describes a frame the viewer is not looking at.
- Name the visible change, such as the card landing or the field filling, rather than the feature's pitch. The pitch belongs in an intro card or the voiceover.
- Start a caption on the first frame of the action it names, and keep it on screen for at least 5/6 of a second and at most 7 seconds.
- Hold a caption to two lines of at most 42 characters, read at no more than 20 characters per second, or 17 for an audience of children. Cut words rather than shorten the hold.
- Place a caption where it covers nothing the frame is about. Move it off the element the step acts on, rather than centering it by default. HyperFrames' studio skill owns the title-safe margins.

## A zoom is earned by an action

- Zoom only on a click, fill, or hover whose result is too small to read at full frame. A navigate, a wait, or a hold has nothing to aim at.
- Aim the zoom at the action's own place and moment. `canon demo run` writes a timeline beside the take carrying each step's start, end, and target box, so read the zoom's target and its start off that file rather than adding up holds by hand.
- Run a push that lands on an action no faster than the floor HyperFrames' `viewport-change` rule states, and never past 1 second. That rule's own range suits an ambient reveal with no action to land on, and reads slow on a push onto a click.
- Leave the scale and the dwell after a zoom settles to the `viewport-change` rule, which states both.

## A real pointer on a real interface

- Keep the pointer the take recorded. Never draw a second, synthetic cursor over a real interface, since two pointers on one frame leave the viewer guessing which one acted.
- Check that each click lands inside the target box the timeline records for it. A pointer arriving beside the button it claims to press reads as a fake.

## Music, silence, and a voice

- Choose silence over a music bed that competes with a voiceover. A bed earns its place on a video with no voice, where it carries the pacing between beats.
- Sit music at least 20 dB under the voice. Check `media-use`'s narrated bed default against that floor rather than take it as given, since it has sat short of it. The mechanism, a carve rather than a flat duck, is `hyperframes-audio`'s.
- Keep a captioned voiceover at or under 160 words a minute, since captions follow the voice and a faster voice forces captions past their reading limit. `hyperframes-creative`'s narration pace sits under that ceiling.

## Read the frame before dismissing a finding

- Open the frame at the timestamp a checker names before calling its finding a false positive, whether the checker is `hyperframes check`, `canon demo frames`, or `read-frames`.
- Report what the frame shows beside the dismissal. A dismissal with no frame read is a guess about the render, and the viewer sees the render.

## Excuses and rebuttals

| Excuse                                                       | Rebuttal                                                                                                                     |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| A slow zoom feels cinematic                                  | A push onto an action is interface motion. Past 1 second the viewer waits on the camera instead of watching the action land. |
| The caption explains the whole feature, so it is more useful | A caption about anything but the frame on screen makes the viewer read one thing and watch another.                          |
| The checker flagged a frame I already know is fine           | Knowing is a memory of the composition, not of the render. Open the frame.                                                   |
| Music makes it feel finished                                 | Music under a voice that is not 20 dB down masks the words, and the words carry the explanation.                             |
| A drawn cursor looks cleaner than the recorded one           | The recorded pointer is the one that pressed the button. A drawn one is a claim about an action the take already shows.      |

## Red flags

- A push onto a click runs longer than 1 second.
- Every move in the composition shares one duration.
- A caption is centered on screen and covers the element the step acts on.
- A caption names a step the frame is not showing.
- The zoom's start time was added up by hand while a timeline file sits beside the take.
- Two pointers appear on one frame.
- A checker finding was dismissed and no frame was opened.

## Before handing over

- Every caption names what its frame shows, starts on its action's first frame, and holds within its time and length limits.
- Every zoom aims at a click, fill, or hover read from the timeline, and lands within its duration.
- One pointer is on screen, and each click lands inside its recorded box.
- Music, when present, sits at least 20 dB under any voice, and a captioned voice stays at or under 160 words a minute.
- Every checker finding was either fixed or dismissed with the frame it names read and reported.

## What this delegates

- Easing, speed variety, anchoring, click timing, and every other general motion rule: `hyperframes-animation` and `hyperframes-creative`
- Title-safe margins and timeline layout: `hyperframes-studio`
- The carve that sits music under a voice: `hyperframes-audio`
- Fetching or generating music, effects, voice, and imagery: `media-use`
- Recording the take and writing its timeline: `record-screencast` through `canon demo run`
- Reading a render frame by frame: `read-frames`
