# Measuring

Read before writing a finding and before recording a pick.

## Off the page

- Measure on the built page in a real browser at the widths the finding names, in every theme the app ships, and record the viewport.
- Read computed styles rather than class lists. A class list names intent, and the computed value is what paints.
- Measure text contrast against the ground it sits on, and a mark's contrast against its own ground, as two numbers. A mark that sets a background and no text color inherits the browser default, and only the text reading catches it.
- Measure empty space by text extent, the union of each text node's client rects, rather than by leaf element boxes. A block element spans its row whatever its text covers.
- Measure a landing by the landed element's top against the bar's bottom edge and by whether the element before it is visible. A pick with a two-part condition needs both readings.
- Reproduce the shipped value inside the candidate page before trusting an arm's numbers. Arm 0 reading the same as the live page is what shows the page matches.

## Off the data

- Re-derive a figure from the data file that produced it rather than from any document quoting it. Two documents can disagree, and neither is the source.
- Count a defect across the whole corpus or tree before recording its size, and say whether it sits only at the end, only in one version, or throughout.
- Test a proposed fix without editing code where the question is its effect, by patching the function in a throwaway script and comparing before and after on counts the fix could move.

## Before quoting

- Read every figure a pick question or a record quotes back from the page or the script that computed it. Correct the record in place when the question quoted one wrong, and say so.
