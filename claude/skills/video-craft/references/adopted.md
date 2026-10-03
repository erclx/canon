---
title: Adopted and declined
description: The source behind every number in the video-craft body, by field, which conflicts between sources were picked and why, and what was declined
---

# Adopted and declined

Each number in the body traces to a source here, read through the `search-craft` method: the field named first, its authorities derived from the kind of body it trusts, and each question searched scoped to those authorities and open beside it. A later session extending the skill adds to this file rather than re-arguing an item settled here.

## Captions

Field: subtitling and captioning. Authorities: broadcasters' and streamers' published subtitle guidelines, and the captioning program that sets educational practice.

**On screen for 5/6 of a second to 7 seconds, two lines, 42 characters a line.** Netflix's [Timed Text Style Guide: General Requirements](https://partnerhelp.netflixstudios.com/hc/en-us/articles/215758617-Timed-Text-Style-Guide-General-Requirements) states a minimum of 5/6 of a second (20 frames at 24 fps) and a maximum of 7 seconds per event, and its [English (USA) guide](https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-USA-Timed-Text-Style-Guide) states 42 characters a line and two lines at most.

**20 characters per second, 17 for children.** The same English (USA) guide, adult and children's programs respectively.

**Start on the first frame of the action.** Netflix's [Subtitle Timing Guidelines](https://partnerhelp.netflixstudios.com/hc/en-us/articles/360051554394-Timed-Text-Style-Guide-Subtitle-Timing-Guidelines) put a subtitle's in-time on the first frame of its audio. A software video's caption names an action rather than a line of speech, so the body keys the in-time on the action's first frame.

**Never over what the frame is about.** The DCMP [Captioning Tip Sheet](https://dcmp.org/learn/225-captioning-tip-sheet): "Placement must not interfere with existing visuals/graphics."

**Captions name what the frame shows.** No source states this for a software video. It is the operator's read of an unguided render whose caption narrated the whole flow, kept because the timing rules above already assume a caption tied to one moment.

## Zoom

Fields: interface motion design, and screen recording practice. Authorities: design systems that publish motion specs, and the reference documentation of a screen recording tool.

**A push onto an action no faster than HyperFrames' floor, never past 1 second.** HyperFrames' `viewport-change` rule states a zoom of 1.0 to 2.0 seconds and gives its reason beside the value: "under 0.8s teleports, over 2.5s drags". The body keeps that floor by pointing at the rule rather than restating it. The 1 second ceiling has two grounds. Measured: an unguided render pushed in over 2.2 seconds and a second over 1.4 seconds, and the operator judged both slow, so the range's lower half already reads slow on a push onto a click. Published: Material Design 3's [easing and duration tokens](https://m3.material.io/styles/motion/easing-and-duration/tokens-specs) end their scale at 1000 ms, the top of the extra-long band they reserve for ambient transitions, so no input-driven transition in that system runs longer.

**Zoom on a click.** Screen Studio's [auto zoom guide](https://screen.studio/guide/auto-zoom) keys its zoom on click positions and zooms nowhere a click did not occur.

**Conflict, and the pick.** HyperFrames' range and the measured renders disagree on the push onto an action, and the body takes the overlap: HyperFrames' teleport floor below, and 1 second above, which sits inside HyperFrames' range at its fast end. HyperFrames' full range stays with an ambient reveal, which matches Material's own split between input-driven and ambient motion. A tighter band was considered and declined. Material puts large expressive transitions at 450 to 600 ms, and Nielsen Norman Group's [animation duration article](https://www.nngroup.com/articles/animation-duration/) calls 400 ms "very slow", but both write for an interface a user waits on, which a video viewer is not, and that band sits below HyperFrames' stated teleport floor with nothing measured to show it reads right. Narrow the band once a composed demo is compared against the unguided renders.

## Pointer

The two pointer rules in the body carry no number. One pointer on a frame and a click landing inside its recorded box both follow from the take recording the real pointer and the timeline recording each target's box.

## Audio

Fields: web accessibility, and audio post-production. Authorities: the W3C's accessibility guidelines, and the audio engineering society's streaming recommendation.

**Music at least 20 dB under the voice.** WCAG 2.1 [Success Criterion 1.4.7](https://www.w3.org/WAI/WCAG21/Understanding/low-or-no-background-audio.html): "The background sounds are at least 20 decibels lower than the foreground speech content, with the exception of occasional sounds that last for only one or two seconds."

**Conflict, and the pick.** HyperFrames' `media-use` sets its narrated bed at a volume of 0.12, about 18 dB under a voice at full scale. The body takes WCAG's 20 dB, since it is the published floor and the bed default sits 2 dB short of it.

**Overall loudness is delegated.** The AES [TD1008](https://aes.org/wp-content/uploads/2024/01/20210924_TD1008_v3.13.pdf) streaming recommendation normalizes speech to -18 LUFS with a true peak no higher than -1 dBTP, while `media-use` ships -14 and -16 LUFS targets for social and podcast delivery. The body states no overall target, since the right one depends on where the video is published and `media-use` owns that operation.

## Voiceover

Field: captioning, for the reading ceiling a voiceover's captions inherit. Authority: the captioning program's presentation rate guidance.

**At or under 160 words a minute when captioned.** The DCMP [Captioning Key: Presentation Rate](https://dcmp.org/learn/601-captioning-key---presentation-rate) caps upper-level captions at 160 words a minute. `hyperframes-creative`'s narration reference states 2.5 words a second, 150 a minute, which sits under the ceiling, so the two do not conflict. An open search of voiceover practitioners put explainers at 140 to 160 words a minute, which agrees.

Narration has no standards body for pace, and the scoped search found none, so the body sets only the ceiling captions impose and points at HyperFrames for the pace itself.

## Declined

**Restating HyperFrames' motion rules.** Ease variety, anchoring, click timing, the scale and dwell of a zoom, and title-safe margins are stated in HyperFrames' own skills, which update on their own cadence. A copy here goes stale on theirs.

**A loudness target in the body.** See Audio above.

**Pointer smoothing and hiding at rest.** Screen Studio's [cursor guide](https://screen.studio/guide/cursor) smooths the pointer and hides it when idle, and its [guide to disabling smooth movement](https://screen.studio/guide/disable-smooth-mouse-movement) turns smoothing off for a dropdown menu. Declined because both are recorder settings. A take is composed with its pointer already baked into the frames, so a session composing from it cannot change either. They belong to whatever records the take.

**Zoom out before a cut, and a sound effect only on a click that changes something.** Neither has a source, and no operator read stands behind either, so both stay out until one does.

**Vertical 9:16 framing.** Every video measured when this skill was written was landscape. Add it when a project asks for vertical video, with its safe areas sourced from the platform's own creator documentation.
