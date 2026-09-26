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

const CO_AUTHOR_TRAILER = /^co-authored-by:/i
const CLAUDE_OR_ANTHROPIC = /\b(claude|anthropic)\b/i

// Reads raw rather than footer, since the parser files a lone trailer under
// body and leaves footer null.
const noClaudeCoAuthor = (parsed) => {
  const offending = (parsed.raw ?? '')
    .split('\n')
    .find(
      (line) => CO_AUTHOR_TRAILER.test(line) && CLAUDE_OR_ANTHROPIC.test(line),
    )

  return [
    offending === undefined,
    `remove the co-author trailer crediting Claude or Anthropic: ${offending}`,
  ]
}

const config = {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'subject-first-word-case': subjectFirstWordCase,
        'no-claude-co-author': noClaudeCoAuthor,
      },
    },
  ],
  rules: {
    'subject-case': [0],
    'subject-first-word-case': [2, 'always'],
    'no-claude-co-author': [2, 'always'],
    'header-max-length': [2, 'always', 72],
    'scope-case': [2, 'always', 'lower-case'],
    'subject-full-stop': [2, 'never', '.'],
  },
}

export default config
