const BASE_URL = 'https://openrouter.ai/api/v1'

export class OpenRouterError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
    this.name = 'OpenRouterError'
  }
}

export const MISSING_KEY = 'No OpenRouter API key set.'

export async function callOpenRouter(path: string, apiKey: string, body: unknown): Promise<Response> {
  if (!apiKey) throw new OpenRouterError(MISSING_KEY)

  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Title': 'Sietch',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    let message = `OpenRouter request failed (${response.status})`
    try {
      const error = await response.json() as { error?: { message?: string; code?: string } }
      if (error.error?.message) message = error.error.message
    } catch { /* use fallback message */ }
    throw new OpenRouterError(message, response.status)
  }

  return response
}
