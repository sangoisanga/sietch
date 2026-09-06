import type { LlmProvider } from './types'

export class MalformedJsonError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MalformedJsonError'
  }
}

export function parseLooseJson<T>(text: string): T {
  for (const candidate of [text, text.match(/\{[\s\S]*\}/)?.[0]]) {
    if (!candidate) continue
    try {
      return JSON.parse(candidate) as T
    } catch { /* fall through to the next candidate */ }
  }

  if (!text.includes('{')) throw new MalformedJsonError('The model did not return JSON.')
  throw new MalformedJsonError('The model returned malformed JSON. Try a stronger model.')
}

export async function generateJsonRetrying<T>(llm: LlmProvider, prompt: string, temperature: number): Promise<T> {
  try {
    return await llm.generateJson<T>(prompt, temperature)
  } catch (error) {
    if (!(error instanceof MalformedJsonError)) throw error
    return llm.generateJson<T>(prompt, temperature)
  }
}
