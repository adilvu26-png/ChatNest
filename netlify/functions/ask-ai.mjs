export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const { history } = await req.json()

    if (!Array.isArray(history)) {
      return Response.json({ error: 'Invalid chat history.' }, { status: 400 })
    }

    const apiKey = Netlify.env.get('AI_KEY')
    if (!apiKey) {
      return Response.json({ error: 'AI service is not configured.' }, { status: 500 })
    }

    const messages = [
      {
        role: 'system',
        content: 'You are ChatNest AI, a friendly assistant inside a WhatsApp-style chat app. Reply in the same language the user writes in. Keep answers short and easy to read on a phone. Use plain text, no markdown headings.'
      },
      ...history.slice(-20)
        .filter(m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
        .map(m => ({ role: m.role, content: m.content }))
    ]

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: Netlify.env.get('AI_MODEL') || 'gemini-3.5-flash-lite',
          messages
        })
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return Response.json(
        { error: 'The AI service could not complete your request. Please try again.' },
        { status: response.status === 429 ? 429 : 502 }
      )
    }

    const answer = data.choices?.[0]?.message?.content?.trim()
    if (!answer) {
      return Response.json({ error: 'The AI returned an empty answer.' }, { status: 502 })
    }

    return Response.json({ text: answer })
  } catch {
    return Response.json({ error: 'Unable to contact the AI service.' }, { status: 500 })
  }
}
