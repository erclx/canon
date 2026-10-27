# Spec: canon launch loop

The director's brief for `BRIEF.md`, with a number wherever the brief has an adjective. Build from it, check against it, and change it when a review changes the film.

```text
GOAL:    a developer watches one change go from groundwork to merge under canon, and wants to install it
OUTPUT:  HyperFrames, 1920 x 1200 (16:10), 30 fps, one render per theme
         README: 960 x 600 at 12 fps, GIF or animated WebP. Landing page: 1280 x 800 MP4 at 30 fps,
         silent, with a poster PNG at 0.6 s
TIME:    42.9 s x 30 = 1287 frames, no music
         open 0-1.2, groundwork 1.2-7.6, plan 7.6-14.2, dispatch 14.2-21.8,
         build 21.8-29.0, review 29.0-36.0, merge 36.0-41.4, close 41.4-42.9
         each beat's build plays 1.3 times slower than its script is written, then holds
         about 2.2 s once its last line lands, so a first-time viewer can read it
LOOK:    canon's own design, being the medium of its product UI: flat panels on a flat ground,
         no texture, no grain, no vignette, no shadow
         ground  #0f0e0c dark (default) / #fbfaf8 light, flat
         panel   #151412 / #f1f1ee, 1 px line #2a2926 / #dcdad6, radius 24 px
         chrome  #1b1a18 / #e9e8e5, the panel's header strip, 84 px tall
         ink     #d9d7d4 / #2c2c29 for every word that must be read
         body    #aeada9 / #4b4947 for supporting words, muted #8c8b86 / #666561 for paths and captions
         accent  the pip, #ff6b42 / #c2380e, on the pip alone and the one result it marks per shot
         display Geist SemiBold 80 px (6.7% of 1200), tracking -2%
         body    Geist 44 px, row labels Geist SemiBold 44 px, captions Geist 40 px
         mono    Geist Mono 32 px for paths and commands, never smaller
OBJECTS: the mark: a squarish bold c (76 unit rounded square, radius 30, stroke 20, mouth cut level
         with the counter) and a 20 unit square pip just past the arm ends, per the brand sheet
         the pip: a 28 px square, radius 5, that leaves the mark and travels the whole film
         a panel: header strip with a title and a mono path, rows below it
         a tick: a 28 px square, radius 5, a 3 px muted outline that fills muted once its row is done
         the number: Geist SemiBold 220 px, counted up, never typed in whole
MOTION:  enter expo.out 0.4-0.6 s; move power3.inOut 0.3-0.5 s; exit power3.in 0.18-0.2 s
         a panel prints top to bottom, clip-path inset 100% -> 0 in 0.5 s expo.out
         a row prints left to right, clip-path inset 0 100% 0 0 -> 0 in 0.3 s power2.out
         a title arrives per word, blur 6 px -> 0 and opacity 0 -> 1 in 0.13 s, words 0.067 s apart
         a tick fills in 0.12 s as the pip leaves its row
         the pip carries with blur peaking at 6 px mid-move and lands sharp
         no springs: UI does not bounce
SHOTS:   open, frames 0-36: the mark at 480 px, centered, dead still for 12 frames.
           The pip slides out of the mouth and shrinks, then the c blur-swaps out.
           Hands off: the pip is still travelling toward the first row.
         groundwork, frames 36-228: the title lands, the panel prints, the pip visits Search,
           Measure, and Spike, and each tick fills as it leaves. The number counts up while
           Measure is lit. The pip carries to the Decision slot and the decision prints beside it.
           Reads: the three rows, the number, the decision, held 1.1 s.
           Hands off: the pip leaves the decision for the plan's suggestion.
           Exits at frame 222 with a blur swap, 0.18 s power3.in, while the pip stays sharp.
         plan, frames 228-426: the pip carries from the decision into the plan file's header,
           where it marks the file being written. The panel prints, then each heading and its
           line write in left to right, 0.25 s apart. The question card prints beside it, and
           the pip carries to its Suggested slot as the suggestion prints.
           Reads: three headings, the question, the suggestion, held 1.6 s.
           Hands off: the pip leaves the suggestion for the orchestrator.
           Exits at frame 420 with a blur swap, as groundwork does.
         dispatch, frames 426-654: the operator's message lands, the agent view prints, and the
           pip carries onto the pinned orchestrator row. The orchestrator's reply prints, then the
           four sessions it launched print one by one, 0.25 s apart, each with its status.
           Once every row is in, the list re-sorts the way the real agent view does: the first
           worker starts editing and climbs above the planner, then the second worker climbs too.
           The pip moves onto the first worker in its new row, the session that builds next.
           Reads: the message, the reply, five session rows, held 1.3 s after the last row.
           Hands off: the pip leaves the worker row for the file it edits.
         build, frames 654-870: the pip carries from the worker into the file's header, marking
           the file under edit. The editor prints, the first line writes, and a rule-loaded line
           prints above it, then the body writes and a second rule loads for the test. The gate
           panel prints beside it, its three checks tick in turn, and the pip carries onto the
           passed row as the result prints.
           Reads: two rule lines, three checks, the result, held 1.1 s.
           Hands off: the pip leaves the result for the pull request's review.
           A rule line is a bordered box with square corners at radius 12, never a pill.
         review, frames 870-1080: the pip carries from the gate's result into the review's
           header, marking the pull request under review. Two findings print with open markers,
           and the UI evidence prints beside them as a base and a head capture. The worker's
           fix prints, then each finding is struck through left to right and its marker fills.
           The pip carries down to the closed row as the review closes.
           Reads: two findings, the fix, the closed review, held 1.3 s.
           Hands off: the pip leaves the closed review for the merge command.
         merge, frames 1080-1242: the terminal prints with the merge command, and the pip
           carries up from the closed review onto the merged line as it prints. The task's
           archive line ticks. The board prints beside it, the merged row strikes through,
           and the next row lights as runnable.
           Reads: the command, the merge, the board's three rows, held 0.9 s.
           Exits at frame 1236 with a blur swap.
         close, frames 1242-1287: the c blurs back in at the center while the pip flies from the
           merged line into the mouth and grows to its mark size, then the mark holds dead still.
           The last frame matches frame 0, so the loop restarts without a seam.
BANNED:  a dark void with small things floating in its middle; glow, bloom, gradients, glass
         everything centered; everything fading in at once; fade and slide up
         text that moves while it is read; titles that drift after they land
         numbered labels such as 1 / 6; pill chips; the logo docked in a corner
         a crossfade between scenes; the pip pulsing, glowing, or bouncing
         any second accent color
QA:      0 s         the mark centered with its pip, matching the film's last frame
         2.4 s       the panel printed, the pip on Search
         3.2 s       the pip on Measure, the number counting
         5.2 s       the decision printed beside the pip, every word readable
         19.5 s      the agent view mid re-sort, the first worker above the planner
         42.89 s     byte-identical to frame 0
```

## Rendering each theme

The compositions read every color from the root's variables, so one set of files renders both themes. Dark is the default, and `themes/dark.json` and `themes/light.json` hold each set.

```bash
npx hyperframes render --variables-file themes/light.json --strict-variables
```

A `png-sequence` render is RGBA and leaves the ground transparent, so lay a frame over its ground color before judging it.

The README loop comes from each theme's MP4, since no render preset scales below the canvas. One theme's pair of commands follows.

```bash
ffmpeg -i renders/launch-dark.mp4 -vf "fps=12,scale=960:600:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle" -loop 0 renders/readme-dark.gif
ffmpeg -i renders/launch-dark.mp4 -vf "fps=12,scale=960:600:flags=lanczos" -c:v libwebp_anim -lossless 0 -quality 80 -loop 0 renders/readme-dark.webp
```

The landing page plays the same render at 1280 wide, with every audio stream dropped, and shows a poster cut at 0.6 s while the film waits. `bun run film:render` writes both beside the GIFs as `assets/loops/launch.mp4` and `launch-poster.png`, with a `-light` pair for the light theme.

```bash
ffmpeg -i renders/launch-dark.mp4 -an -vf scale=1280:-2:flags=lanczos -c:v libx264 -pix_fmt yuv420p -crf 24 -preset slow -movflags +faststart renders/web-dark.mp4
ffmpeg -ss 0.6 -i renders/launch-dark.mp4 -frames:v 1 -vf scale=1280:-2:flags=lanczos renders/poster-dark.png
```

## Positions the pip layer shares

The pip lives on its own layer above every scene, so each scene leaves a slot at these canvas positions, given as the pip's center and its scale over a 28 px square.

| Moment          | Centre       | Scale |
| --------------- | ------------ | ----- |
| In the mouth    | (1120, 600)  | 3.118 |
| Search row      | (182, 580)   | 1     |
| Measure row     | (182, 710)   | 1     |
| Spike row       | (182, 840)   | 1     |
| Decision slot   | (1274, 890)  | 1     |
| Plan header     | (166, 452)   | 1     |
| Suggested slot  | (1054, 630)  | 1     |
| Orchestrator    | (882, 556)   | 1     |
| First worker    | (882, 640)   | 1     |
| Editor header   | (166, 452)   | 1     |
| Gate passed     | (1262, 820)  | 1     |
| Review header   | (166, 452)   | 1     |
| Review closed   | (182, 820)   | 1     |
| Merged line     | (182, 640)   | 1     |
| Mouth, closing  | (1120, 600)  | 3.118 |
