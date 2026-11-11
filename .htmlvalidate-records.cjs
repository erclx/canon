// The record sheets are fragments formatted by oxfmt, which writes <input />,
// so the form is self-closing here where the built page allows either.
module.exports = {
  root: true,
  extends: ['./.htmlvalidate.cjs'],
  rules: {
    'void-style': ['error', { style: 'selfclosing' }],
  },
}
