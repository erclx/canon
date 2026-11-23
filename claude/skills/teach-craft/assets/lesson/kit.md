# Lesson

A course of lessons on seamless surfaces, with a sidebar of lessons and steps, a centered reading column, and a rail of the lesson's headings from 1280 px. The rules this look applies, and why, are in `presentation.md` under the skill's `references/`.

## Write a lesson page

A lesson writes its reading column alone. `nav.js` builds the header, the sidebar, the rail, and the pager from the course map, and sets the theme before first paint.

```html
<head>
  <meta charset="utf-8" />
  <title>Lesson title</title>
  <script src="../assets/course.js"></script>
  <script src="../assets/kits/lesson/nav.js"></script>
</head>
<body>
  <main class="kit-lesson">
    <article class="kit-article">
      <p class="kit-kicker">Lesson 1</p>
      <h1>What the learner will be able to do</h1>
      <p class="kit-assumes">Assumes the learner knows X</p>
      <h2>First section</h2>
    </article>
  </main>
</body>
```

The two script paths are the same on a board and off one, since a standalone course keeps the kit at `assets/kits/lesson/` too.

- Keep every lesson page one folder deep, as `<page>/<lesson>.html` beside `assets/`, so `../` reaches the course map and the kit from each
- Load `course.js` before `nav.js`, since `nav.js` reads the map once the page is parsed
- Give the rail two or more `h2` headings, since a lesson with one gets no rail. An `h2` without an `id` gets one made from its text.
- Leave the kit's sheets out of the page. A board injects them into a frame naming the kit, and `nav.js` loads them from beside itself where nothing did.

## The course map

Each course keeps its map in its own `course.js`, outside the kit folder, so a newer kit replaces the folder and the map survives. It sets `window.course` from a script rather than a JSON file, since a lesson opened from disk cannot fetch one.

```js
window.course = {
  title: 'HTTP caching',
  due: 'Review due 21 Nov',
  contents: '../course/contents.html',
  lessons: [
    {
      title: 'Two questions a cache asks',
      steps: [
        { title: 'Lesson', href: '../caching/lesson.html' },
        { title: 'Check', href: '../caching/check.html' },
      ],
    },
    { title: 'Validators in depth' },
  ],
}
```

- `title` heads the breadcrumb, and `due` sits under the sidebar. Both are optional.
- `contents` opens the pager's order and links the breadcrumb, and is optional
- `lessons` runs in course order. A lesson with no `steps` shows as not built, with a Soon tag.
- Each `href` is relative to a lesson page, and the page whose address matches is the current step

The shape changes only by adding a field, so a map written for this version keeps working.

## Reach for

- `.kit-figure` for a figure, breaking out of the column beside the rail. Put a `.kit-wide` and a `.kit-stacked` variant inside it when the figure would shrink past reading under 640 px.
- `.kit-caption` under a figure, and `.kit-cite` on a citation mark such as `[1, §4.2]`
- `.kit-note` for the one callout holding the hard part
- `.kit-option` on a `<label>` wrapping a radio input for each quiz option, and `.kit-feedback` for the one block after the attempt
- `.kit-reveal` on a `<details>` for the teach-back's points, with the chevron from the sample in its `<summary>`
- `.kit-refs` for the reference list closing the lesson
- `.kit-button`, plus `.kit-primary` on the one filled control a page carries
- `.kit-card` for a box on the tint, `.kit-muted` for secondary text, and `.kit-line` on an SVG `path`

Tables and inline code inside `.kit-article` take their look with no class.

## Keep to

- Color through the tokens in `tokens.css` alone, so both themes follow
- `--accent-strong` for small text and filled controls in the accent, since `--accent` falls under 4.5:1 there
- One filled primary and one callout per page
- A part of its own is allowed inside the reading column, with a class that takes no `kit-` prefix and a color from the tokens, leaving the header, sidebar, rail, and pager alone
- Geist for text, which the kit leaves to the board to serve, and Noto Sans Mono for code, which `tokens.css` carries as a subset of its own
- A system font as the fallback for either, since a font neither served nor installed fails a board capture

## On the canvas

A lesson frame on a board's canvas opens every link to another page in a new tab, so the canvas keeps the frame. It shows no theme toggle there, since the board sets the frame's theme. Give each lesson frame a screen height that scrolls, so the header, the sidebar, and the rail stay in view.

## The samples

The `kit` page draws each part the way the kit means it. `lesson.html` is one lesson in the layout with FPO for content, loading a sample `course.js` beside it, and `components.html` is the sheet of every part with its dimensions. A sample loads `nav.js` from one folder up, which a lesson page copying it changes to the paths above.
