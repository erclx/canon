const SUBJECT_STARTS_WITH_LETTER = /^[A-Za-z]/
const SUBJECT_LEADING_LETTERS = /^[A-Za-z]+/

// Checks the first word alone, unlike the built-in subject-case rule, which
// tests the whole subject and would reject a legitimate capitalized proper
// noun anywhere past the first word.
const subjectFirstWordCase = (parsed) => {
  const { subject } = parsed

  if (
    typeof subject !== 'string' ||
    !SUBJECT_STARTS_WITH_LETTER.test(subject)
  ) {
    return [true]
  }

  const leadingWord = SUBJECT_LEADING_LETTERS.exec(subject)[0]

  return [
    leadingWord === leadingWord.toLowerCase(),
    'subject must start with a lowercase word',
  ]
}

const config = {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'subject-first-word-case': subjectFirstWordCase,
      },
    },
  ],
  rules: {
    'subject-case': [0],
    'subject-first-word-case': [2, 'always'],
    'header-max-length': [2, 'always', 72],
    'scope-case': [2, 'always', 'lower-case'],
    'subject-full-stop': [2, 'never', '.'],
  },
}

export default config
