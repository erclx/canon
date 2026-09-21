# Lesson chrome

`canon teach nav` rewrites lessons in place, so an authored file and a generated one share a path. This is the single largest trap in the domain and it fails silently: a hand-edit to spliced chrome is overwritten by the next run with nothing reporting the loss.

## The four markers

A lesson carries four empty marker pairs and `canon teach nav` fills each from what the workspace holds:

| Marker                | Carries                                                  |
| --------------------- | -------------------------------------------------------- |
| `canon:teach:style`   | the embedded stylesheet and the panel's pre-paint script |
| `canon:teach:header`  | the course sidebar, the masthead, and the breadcrumb     |
| `canon:teach:footnav` | the previous and next lesson navigation                  |
| `canon:teach:scripts` | whatever the lesson chrome needs at the end of the body  |

`nav` refuses a lesson missing them rather than inventing a place to put the chrome.

## What is authored and what is generated

The authored heading, lede, body and quiz sit between the header and footnav markers. The splice leaves that region untouched and rewrites everything inside the four pairs.

So the boundary is positional rather than per-file. Edit between the markers freely. Never edit inside them, and never edit the root or contents pages at all, since `nav` regenerates those whole.

## What one run touches

`canon teach nav` rewrites the teach root, the contents pages, and the lesson chrome in one pass. It touches more than the lesson named, so a diff after running it covers files the change did not intend to reach and that is the verb working rather than a defect.

Read the diff anyway. A pipeline change moves every committed fixture lesson at once, which is the cheapest place to notice that the change was wrong.

## Why the splice exists rather than a template

A lesson is a standalone HTML file a learner opens directly, with no build step between the file and the browser. Chrome that a template inserted would need that build step, and chrome that an author copied would drift per lesson. The splice keeps both properties: the file stays directly openable, and the chrome stays uniform because one verb owns it.

The cost is the shared path, and the mitigation is this document rather than a mechanism. Nothing prevents a hand-edit inside a marker pair.
