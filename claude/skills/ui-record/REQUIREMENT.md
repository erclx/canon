---
name: ui-record
description: Why recording a web app runs from beats the operator approved, one take per action, and stops at the clip a HyperFrames composition reads
---

# UI record requirement

## Gap

Without this skill, a session asked for footage of the app has no way to get it. HyperFrames records nothing and asks the person for a screen recording, so the session either stops or films the screen by hand in real time, which goes soft under a zoom and logs no clicks for the edit to aim at.

A session that does reach `canon take` writes the plan from its own reading of the ask. The operator first sees the footage after the minutes it took to film, a selector guessed from memory misses, and a cursor drawn into the page grows with every zoom.

## Must

- The operator approves the beats in plain words before anything is filmed
- Each beat films one action from a fresh start state, with a hold before and after it
- Every take carries its clip, its click log, and its camera track, and no clip carries a drawn cursor
- The session looks at a still of each take before handing it off, and names a beat that fell back to the real-time route
- HyperFrames receives the takes with what it needs to apply the camera and draw the cursor

## Must not

- Film before the operator approves, or with nobody there to approve
- Write a tracked file, the config included
- Compose, caption, or render the video
- Trigger on anything but a request to record or film the app
- Stay when no caller besides the operator reaches it, such as a pull request clip through `pr-evidence`, which a review checks

## Out of scope

- Composing and rendering the video, which the HyperFrames skills own
- Driving a pull request's checklist, which `review-ui` owns
- Driving the app looking for defects, which `app-drive` owns
