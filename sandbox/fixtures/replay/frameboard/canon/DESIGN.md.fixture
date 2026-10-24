# Design

Values live in `src/client/styles.css`, light on `:root` and dark on `.dark`. This record holds the intent behind the board chrome, not frames, which take their own project's tokens. Accepted designs live in `canon/design/`.

## Overview

The chrome is a quiet grey workbench that steps back so the frames carry the color. Panels sit one step off a deeper canvas, so their edge holds on a dim screen. Each hue means one thing and appears only for it. An operator should feel the board is a tool they work in, never a page they read.

## Colors

- `--primary` is the blue and `--accent` is the hover grey. shadcn's naming invites the reverse, so never reach for `--accent` as a brand color.
- Give every hue one meaning. A second use, such as a blue guide or a red badge, blurs what the operator reads at a glance.
- Set dark with the `.dark` class on the chrome root. Frames switch on their own `data-theme`, and one toggle sets both.

| Role       | Property             | Intent                                                |
| ---------- | -------------------- | ----------------------------------------------------- |
| canvas     | `--background`       | the ground behind frames and the home view            |
| text       | `--foreground`       | primary text                                          |
| panel      | `--sidebar`          | both side panels                                      |
| floating   | `--card`             | toolbar pill, home cards, menus, the palette          |
| field      | `--input`            | number fields and color rows, which carry no outline  |
| hover      | `--accent`           | hover fill on buttons, menu items, and rows           |
| line       | `--border`           | dividers, panel edges, pill and popover outlines      |
| quiet text | `--muted-foreground` | section labels, frame labels, field keys              |
| faint      | `--faint`            | hidden layers, tree chevrons, field key letters       |
| selected   | `--primary`          | selection outline and handles, the active tool, focus |
| agent      | `--claim`            | an agent's dashed outline and session tag             |
| note       | `--note`             | note pins and anything flagged for a look             |
| guide      | `--guide`            | snapping guides and gap tags while a frame drags      |
| delete     | `--destructive`      | Delete, and error findings                            |
| done       | `--success`          | a finished action's toast                             |

## Typography

- Set the chrome in Geist, the face already bundled for frames, and no second family.
- Use the four role steps, `--text-title`, `--text-panel`, `--text-body`, and `--text-label`, each carrying its own weight. Vendored components keep Tailwind's steps.
- Build hierarchy from weight and the quiet text color before reaching for a larger step.

## Spacing

- Use Tailwind's default spacing scale with no custom steps.

## Layout

- Below 1024px wide the board opens with Hide UI on, so the canvas keeps the screen and still pans and zooms.
- The width is read once at load, so resizing across 1024px later leaves Hide UI where the developer set it.

## Shapes

- Pin the field and pill radii rather than deriving them, so every component added later inherits the same three corners.

| Role    | Property      | When used                           |
| ------- | ------------- | ----------------------------------- |
| field   | `--radius-md` | fields and small controls           |
| default | `--radius-lg` | buttons, menus, cards               |
| pill    | `--radius-xl` | the floating toolbar and its pieces |

## Motion

- The claim pulse is the one looped motion, an agent's outline and tag fading and returning slowly while it holds a frame.
- Under reduced motion the pulse stops and holds the outline and tag at full opacity.
- No marching ants, no animated guides, and no entrance motion on panels.

## Iconography

- Outline icons from lucide at one stroke weight, with no custom icons beside the mark.

## Mark

- Mark 5c: a large rounded board in the selection blue, with a small ink frame overlapping its top-right corner, cut out by a canvas-colored stroke.
- `src/client/public/icon.svg` is the source and swaps fills on the system theme. `favicon.ico`, `apple-touch-icon.png`, and `.github/social-card.png` are rendered from it.
- Judge the mark at tab size first. A change that loses the frame there fails, whatever it looks like large.
