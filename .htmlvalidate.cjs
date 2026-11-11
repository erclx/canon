// The base for the built landing page, web/dist/index.html. The sheets under
// web/src/content/records/ extend it from .htmlvalidate-records.cjs.
module.exports = {
  extends: ['html-validate:recommended'],
  rules: {
    // Astro writes void elements as <meta> and <link>, and the formatters leave
    // generated output alone, so neither form is ours to demand.
    'void-style': 'off',
    // The page holds styled toggles and a command listbox that stand in for a
    // checkbox and a select on purpose, as pictures of a record and a palette.
    'prefer-native-element': 'off',
    // The explorer asides carry aria-hidden, so no assistive tech reads them as
    // landmarks and a name would add nothing.
    'unique-landmark': 'off',
    // role="list" on a ul keeps list semantics where Safari drops them with
    // list-style: none, so the attribute is deliberate.
    'no-redundant-role': 'off',
    // The hero's play buttons wrap an h3. Fixing it moves section markup that
    // feature-web-styling-stack is relocating, so it waits for a follow-up.
    'element-permitted-content': 'off',
  },
}
