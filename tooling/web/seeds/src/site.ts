/**
 * The values every page's head reads, so the title, preview, and card agree.
 * The deployed address stays in the framework's own site setting, since a
 * second copy here would drift from the one the build resolves against.
 */
export const site = {
  /** Follows a page's own title, and stands alone where a page passes none. */
  name: 'Site name',
  /** The default description, for a page that passes none of its own. */
  description: 'One sentence saying what this site is for.',
  /** A path under `public/`, resolved against the site address. */
  card: '/og-image.png',
}
