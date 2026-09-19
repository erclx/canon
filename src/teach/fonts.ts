/**
 * The faces a teach page embeds: the design module's own `FONT_FACES` for
 * everything a lesson reads and for code, plus the hand-drawn pair teach
 * needs for its figures, both from `@/design/fonts`.
 */

import {
  FONT_FACES,
  HAND_DRAWN_FONT_FACES,
  type FontFace,
} from '@/design/fonts'

export const TEACH_FONT_FACES: readonly FontFace[] = [
  ...FONT_FACES,
  ...HAND_DRAWN_FONT_FACES,
]
