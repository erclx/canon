/**
 * The values every page's head reads, kept in one place so the title, the
 * site name a link preview shows, and the card agree across pages.
 *
 * The deployed address is deliberately absent. Each framework already holds it
 * in its own site setting, `ASTRO_SITE` under Astro, and a second copy here
 * would drift from the one the build resolves URLs against.
 */
export const site = {
  /** Follows a page's own title, and stands alone where a page passes none. */
  name: 'Site name',
  /** The default description, for a page that passes none of its own. */
  description: 'One sentence saying what this site is for.',
  /** A path under `public/`, resolved against the site address. */
  card: '/og-image.png',
}
