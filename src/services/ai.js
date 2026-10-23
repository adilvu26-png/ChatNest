// AI helper. Default provider: Google Gemini (free tier, needs a free API key).
// Uses the OpenAI-compatible endpoint, so any compatible provider works by changing .env:
//   VITE_AI_KEY    (required)  your API key
//   VITE_AI_URL    (optional)  default: Gemini OpenAI-compatible base URL
//   VITE_AI_MODEL  (optional)  default: gemini-flash-latest

export const AI_NAME = 'ChatNest AI'

const BASE = (import.meta.env.VITE_AI_URL || 'https://generativelanguage.googleapis.com/v1beta/openai').replace(/\/+$/, '')
const MODEL = import.meta.env.VITE_AI_MODEL || 'gemini-flash-latest'
const KEY = import.meta.env.VITE_AI_KEY || ''

const SYSTEM =
  `You are ${AI_NAME}, a friendly assistant inside a WhatsApp-style chat app. ` +
  'Reply in the same language the user writes in. Keep answers short and easy to read on a phone. ' +
  'Use plain text, no markdown headings.'

// history = [{ role: 'user' | 'assistant', content }]
export async function askAI(history) {
  if (!KEY) throw new Error('AI is not set up yet. Add VITE_AI_KEY to your .env file and restart the dev server.')

  const messages = [
    { role: 'system', content: SYSTEM },
    ...history.slice(-20).map(m => ({ role: m.role, content: m.content })),
  ]

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 45000)

  try {
    const res = await fetch(BASE + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ model: MODEL, messages }),
      signal: ctrl.signal,
    })
    if (res.status === 401 || res.status === 403) throw new Error('The AI key was rejected. Check VITE_AI_KEY in your .env file.')
    if (res.status === 404) throw new Error('AI model not found. Check VITE_AI_MODEL in your .env file.')
    if (res.status === 429) throw new Error('The AI is busy or the free limit was reached. Wait a minute and try again.')
    if (!res.ok) throw new Error('The AI service returned an error (' + res.status + '). Please try again.')
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content?.trim()
    if (!text) throw new Error('The AI sent an empty answer. Please try again.')
    return text
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('The AI took too long to answer. Please try again.')
    if (e instanceof TypeError) throw new Error('No connection to the AI service. Check your internet and try again.')
    throw e
  } finally {
    clearTimeout(timer)
  }
}
