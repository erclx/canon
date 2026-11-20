---
title: Captions
description: The caption rules a session composing ui-film takes follows over app footage, being the spot each beat's caption takes, the scorer that picks it, the scrim, caption text, and the approval every on-screen line gets before the first cut
---

# Captions

Read at Step 5 of `ui-film` beside `compose-craft.md`, by the session that composes the takes. HyperFrames owns captioning, so this file carries only what app footage changes about its advice and the approval the words take, and restates none of the rest.

## Placing a caption

HyperFrames' caption guide places a landscape caption 80 to 120 px from the bottom and keeps it off a speaker's face. App footage has no speaker. Each beat acts in its own region instead, a toolbar along the bottom edge on one beat and a header on the next, so any one spot held for the whole film covers some beat's action.

- Center every caption, at top center or bottom center alone, since a caption pushed toward a side reads as misplaced
- Pick the spot per beat, and keep every line of one beat in that spot, so the viewer looks for a caption again only at a beat change
- Back a caption over bright UI with the scrim HyperFrames' caption guide sizes to the text

### Scoring the two spots

The pick is measured rather than judged. Write the scorer as a script in the composition project, since the method is a few ffmpeg filters that a verb would only wrap.

1. List the screen regions where the app raises toasts, banners, or popovers, and count each as busy whatever a sampled frame shows, since a toast can rise between two samples.
2. Build the cut with captions off.
3. Take six frames spread across each caption's window, the count that caught a caption over UI changing under it.
4. Size each spot's box from the caption's text, and score it as the mean luma of ffmpeg `edgedetect` output inside the box, taking its busiest frame.
5. Take the lower-scoring spot for each beat, letting top center win a near tie, and write the spots to a file the build reads.
6. Rebuild with captions on, and snapshot each caption mid-window to look at it before the cut goes out.

## Caption text

Write caption text by the interface copy rules in `ui-craft`'s `copy.md`, so a caption ends with no period.

## Approving the on-screen copy

Step 2 approves what each beat shows, and filming starts before anyone knows the words. A viewer reads the words first, so they take their own approval, as the beats do.

- Draft every caption, hook title, and other on-screen line in one list, beat by beat, and show it to the operator in plain words before the first cut
- Build no cut until the operator approves the list, and read silence as no approval
- Send a changed line back to the operator before the next cut, whoever proposed the change, never into the build alone

## Sources

| Rule                          | Source                                                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Caption placement and scrim   | HyperFrames' `captions.md`, adjusted for footage with chrome along its bottom edge                          |
| Centered spots, picked a beat | A launch film whose one spot covered some beats' action, and whose side spots read as misplaced on its cuts |
| Six frames and busy toasts    | The same film's third cut, where a caption sat over the app's own toast until toast regions counted busy    |
| Approving the copy            | A launch film whose composing session rewrote the hook's captions unapproved, which the operator rejected   |
