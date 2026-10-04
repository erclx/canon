/** @jsxImportSource preact */
import { effect } from '@preact/signals'
import { render } from 'preact'
import { App } from '@/canvas/client/app'
import {
  applyChange,
  type ChangeEvent,
  loadPages,
  systemTheme,
  theme,
  themeChoice,
  type Theme,
} from '@/canvas/client/state'

const THEME_KEY = 'canon-canvas-theme'

function readStoredTheme(): Theme | undefined {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    return stored === 'light' || stored === 'dark' ? stored : undefined
  } catch {
    return undefined
  }
}

function storeTheme(value: Theme | undefined): void {
  try {
    if (value === undefined) localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, value)
  } catch {
    /* A blocked store costs the remembered pick, nothing else. */
  }
}

const darkQuery = matchMedia('(prefers-color-scheme: dark)')
systemTheme.value = darkQuery.matches ? 'dark' : 'light'
darkQuery.addEventListener('change', (event) => {
  systemTheme.value = event.matches ? 'dark' : 'light'
})
themeChoice.value = readStoredTheme()

effect(() => {
  document.documentElement.dataset.theme = theme.value
  document.documentElement.style.colorScheme = theme.value
})
effect(() => storeTheme(themeChoice.value))

/* The chrome reads this toolkit's own tokens, served beside the shell. */
const chrome = document.createElement('link')
chrome.rel = 'stylesheet'
chrome.href = '/api/chrome.css'
document.head.prepend(chrome)

/*
 * The page declares an empty icon so the browser never asks for /favicon.ico,
 * since the bundler cannot resolve a route the server answers, and this points
 * it at the brand icon once the shell loads.
 */
document
  .querySelector('link[rel="icon"]')
  ?.setAttribute('href', '/api/icon.svg')

const events = new EventSource('/api/events')
events.addEventListener('message', (message) => {
  void applyChange(JSON.parse(message.data) as ChangeEvent)
})

void loadPages()

const mount = document.getElementById('app')
if (mount) render(<App />, mount)
