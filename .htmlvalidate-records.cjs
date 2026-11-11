// The record sheets are fragments formatted by oxfmt, which writes <input />,
// so the form is self-closing here where the built page allows either.
module.exports = {
  root: true,
  extends: ['./.htmlvalidate.cjs'],
  rules: {
    'void-style': ['error', { style: 'selfclosing' }],
    // The sheets are plain markup with none of the page's deliberate forms, so
    // they keep the rules the base turns off for the built page. Only
    // prefer-native-element stays off, inherited, for the styled task boxes.
    'unique-landmark': 'error',
    'no-redundant-role': 'error',
    'element-permitted-content': 'error',
  },
}
