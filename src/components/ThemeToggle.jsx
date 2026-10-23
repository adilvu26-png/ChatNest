import { useState } from 'react'
import { Sun, Moon } from './Icons'

const KEY = 'chatnest-theme'

const initial = () => {
  try {
    const s = localStorage.getItem(KEY)
    if (s === 'light' || s === 'dark') return s
  } catch { /* storage blocked */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const apply = t => { document.documentElement.dataset.theme = t }

// Runs once when this module is first imported, so every page starts themed.
apply(initial())

export default function ThemeToggle({ className = '' }) {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || initial())
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next); apply(next)
    try { localStorage.setItem(KEY, next) } catch { /* storage blocked */ }
  }
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
  return (
    <button type="button" className={'icon-btn ' + className} onClick={toggle} aria-label={label} title={label}>
      {theme === 'dark' ? <Sun /> : <Moon />}
    </button>
  )
}
