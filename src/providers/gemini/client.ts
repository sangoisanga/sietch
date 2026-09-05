export class GeminiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
    this.name = 'GeminiError'
  }
}

export const MISSING_KEY = 'NOKEY'

export interface GeminiPart {
  text?: string
  inlineData?: { mimeType?: string; data: string }
}

export interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] } }[]
}

export async function generateContent(model: string, apiKey: string, body: unknown): Promise<GeminiResponse> {
  if (!apiKey) throw new GeminiError(MISSING_KEY)

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new GeminiError(`${response.status} — ${detail.slice(0, 180)}`, response.status)
  }
  return response.json() as Promise<GeminiResponse>
}

export function partsOf(response: GeminiResponse): GeminiPart[] {
  return response.candidates?.[0]?.content?.parts ?? []
}
