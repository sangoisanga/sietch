import { parseLooseJson } from '../llm/json'
import type { LlmProvider } from '../llm/types'
import type { ProviderContext } from '../types'
import { callOpenRouter, OpenRouterError } from './client'

export const DEFAULT_LLM_MODEL = 'google/gemini-3.1-flash'

export function createOpenRouterLlm(context: ProviderContext): LlmProvider {
  return {
    id: 'openrouter',
    label: 'OpenRouter',
    isConfigured: () => Boolean(context.config().apiKey),
    settingsFields: [
      { key: 'apiKey', label: 'OpenRouter API key', type: 'password', placeholder: 'sk-or-v1-…' },
      { key: 'llmModel', label: 'LLM model', type: 'text', placeholder: DEFAULT_LLM_MODEL },
    ],

    async generateJson<T>(prompt: string, temperature: number): Promise<T> {
      const { apiKey, llmModel } = context.config()
      const response = await callOpenRouter('/chat/completions', apiKey ?? '', {
        model: llmModel || DEFAULT_LLM_MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature,
      })

      const data = await response.json() as { choices?: { message?: { content?: string } }[] }
      const content = data.choices?.[0]?.message?.content
      if (!content) throw new OpenRouterError('The response contained no content.')

      // models still wrap JSON in prose often enough to want the tolerant parser
      return parseLooseJson<T>(content)
    },
  }
}
