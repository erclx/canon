import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import diff from 'highlight.js/lib/languages/diff'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import go from 'highlight.js/lib/languages/go'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import python from 'highlight.js/lib/languages/python'
import shell from 'highlight.js/lib/languages/shell'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

/**
 * A fixed set rather than all of highlight.js, since each grammar costs load
 * time and a workspace rarely reaches past these. An unlisted language renders
 * plain rather than refusing, so adding one here is the whole change.
 */
const LANGUAGES = {
  bash,
  css,
  diff,
  dockerfile,
  go,
  javascript,
  json,
  markdown,
  python,
  shell,
  sql,
  typescript,
  xml,
  yaml,
}

for (const [name, grammar] of Object.entries(LANGUAGES)) {
  hljs.registerLanguage(name, grammar)
}

export interface Highlighted {
  /** Markup safe to embed inside `<code>`: every source character escaped. */
  readonly html: string
  /** The language as asked for, or `undefined` when it rendered plain. */
  readonly language: string | undefined
}

function escapeCode(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

/**
 * Highlights code at build time into `hljs-*` class spans the teach
 * stylesheet colors, so an emitted page needs no script. An absent or
 * unregistered language falls back to escaped plain text rather than
 * throwing or guessing.
 */
export function highlight(text: string, lang?: string): Highlighted {
  if (lang === undefined || hljs.getLanguage(lang) === undefined) {
    return { html: escapeCode(text), language: undefined }
  }
  return {
    html: hljs.highlight(text, { language: lang, ignoreIllegals: true }).value,
    language: lang,
  }
}
