# Design

## Colors

| Role    | Intent      | Value     |
| ------- | ----------- | --------- |
| canvas  | page ground | #FFF      |
| text    | body copy   | #121212   |
| overlay | scrim       | #00000080 |
| warning | terminal    | ANSI 33   |

## Typography

| Role  | Size     | Tablet | Phone     |
| ----- | -------- | ------ | --------- |
| hero  | 5.625rem | 4rem   | 2.5rem    |
| body  | 1rem     | 1rem   | 0.9375rem |
| small | 13px     | 13px   | 13px      |

## Shapes

| Role  | Radius | Width |
| ----- | ------ | ----- |
| frame | 12px   | none  |
| panel | 12px   | 1px   |
| rule  | none   | 1px   |

| Token           | Value                                                    |
| --------------- | -------------------------------------------------------- |
| `--shadow-ring` | 0 0 0 1px rgba(0,0,0,.07)                                |
| `--shadow-lift` | 0 0 0 1px rgba(0, 0, 0, 0.07), 0 24px 60px -28px #000000 |

## Motion

| Token             | Value                          |
| ----------------- | ------------------------------ |
| `--duration-fast` | 120ms                          |
| `--duration-draw` | 1s                             |
| `--ease`          | cubic-bezier(0.3, 0.7, 0.3, 1) |
