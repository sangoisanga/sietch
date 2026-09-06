import { describe, expect, it, vi } from 'vitest'
import { generateJsonRetrying, MalformedJsonError, parseLooseJson } from './json'
import type { LlmProvider } from './types'

describe('parseLooseJson', () => {
  const cases = [
    { name: 'bare json', text: '{"theme":"Rumi"}', expected: { theme: 'Rumi' } },
    { name: 'fenced json', text: '```json\n{"theme":"Rumi"}\n```', expected: { theme: 'Rumi' } },
    { name: 'json wrapped in prose', text: 'Sure! Here you go:\n{"theme":"Rumi"}\nHope that helps.', expected: { theme: 'Rumi' } },
    { name: 'nested braces', text: 'x {"a":{"b":[1,2]}} y', expected: { a: { b: [1, 2] } } },
  ]

  for (const { name, text, expected } of cases) {
    it(name, () => expect(parseLooseJson(text)).toEqual(expected))
  }

  it('rejects a response with no object at all', () => {
    expect(() => parseLooseJson('I cannot help with that.')).toThrow(/did not return JSON/)
  })

  it('reports an unterminated string as malformed rather than leaking the parser message', () => {
    const unterminated = '{"tips":["one","two]}'
    expect(() => parseLooseJson(unterminated)).toThrow(MalformedJsonError)
    expect(() => parseLooseJson(unterminated)).toThrow(/malformed JSON/)
  })

  it('reports a value missing its opening quote as malformed', () => {
    expect(() => parseLooseJson('{"anchors":{"field":/i/ long"}}')).toThrow(/malformed JSON/)
  })
})

describe('generateJsonRetrying', () => {
  function llmReturning(...responses: (string | object)[]): LlmProvider {
    const generateJson = vi.fn(async () => {
      const next = responses.shift()
      return typeof next === 'string' ? parseLooseJson(next) : next
    })
    return { generateJson } as unknown as LlmProvider
  }

  it('resamples once when the model returns malformed JSON', async () => {
    const llm = llmReturning('{"theme":"broken', { theme: 'Rumi' })
    await expect(generateJsonRetrying(llm, 'prompt', 0.9)).resolves.toEqual({ theme: 'Rumi' })
    expect(llm.generateJson).toHaveBeenCalledTimes(2)
  })

  it('gives up after the second malformed response', async () => {
    const llm = llmReturning('{"theme":"broken', '{"theme":"still broken')
    await expect(generateJsonRetrying(llm, 'prompt', 0.9)).rejects.toThrow(MalformedJsonError)
    expect(llm.generateJson).toHaveBeenCalledTimes(2)
  })

  it('does not resample a network or auth failure', async () => {
    const generateJson = vi.fn(async () => { throw new Error('OpenRouter request failed (401)') })
    const llm = { generateJson } as unknown as LlmProvider
    await expect(generateJsonRetrying(llm, 'prompt', 0.9)).rejects.toThrow(/401/)
    expect(generateJson).toHaveBeenCalledTimes(1)
  })
})
