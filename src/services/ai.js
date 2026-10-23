export const AI_NAME = 'ChatNest AI'

const SYSTEM =
  `You are ${AI_NAME}, a friendly assistant inside a WhatsApp-style chat app. ` +
  'Reply in the same language the user writes in. Keep answers short and easy to read on a phone. ' +
  'Use plain text, no markdown headings.'

export async function askAI(history) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 45000)

  try {
    const res = await fetch('/.netlify/functions/ask-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history }),
      signal: ctrl.signal,
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      throw new Error(data.error || 'The AI service returned an error. Please try again.')
    }

    const text = data.text?.trim()
    if (!text) throw new Error('The AI sent an empty answer. Please try again.')

    return text
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error('The AI took too long to answer. Please try again.')
    }
    if (e instanceof TypeError) {
      throw new Error('Unable to connect to the AI service. Please try again.')
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}
