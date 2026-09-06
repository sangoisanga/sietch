import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ACCENTS } from '../../core/accents'
import type { ProviderContext } from '../types'
import { MISSING_KEY, OpenRouterError } from './client'
import { createOpenRouterLlm, DEFAULT_LLM_MODEL } from './llm'
import { createOpenRouterTts, DEFAULT_TTS_MODEL, DEFAULT_VOICE } from './tts'

let fetchMock: ReturnType<typeof vi.fn>

const contextFor = (config: Record<string, string>): ProviderContext => ({
  config: () => config,
  update: patch => Object.assign(config, patch),
})

const jsonResponse = (body: unknown, ok = true, status = 200) => Promise.resolve({
  ok, status, json: () => Promise.resolve(body),
} as Response)

const chatReply = (content: string) => jsonResponse({ choices: [{ message: { content } }] })

const sentBody = () => JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string)
const sentHeaders = () => (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => vi.unstubAllGlobals())

describe('OpenRouter LLM', () => {
  it('posts the prompt as one user message asking for json', async () => {
    fetchMock.mockImplementation(() => chatReply('{"theme":"Rumi"}'))
    const llm = createOpenRouterLlm(contextFor({ apiKey: 'sk-or-v1-test', llmModel: 'anthropic/claude-sonnet-5' }))

    await llm.generateJson('write a drill', 0.9)

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(sentBody()).toEqual({
      model: 'anthropic/claude-sonnet-5',
      messages: [{ role: 'user', content: 'write a drill' }],
      response_format: { type: 'json_object' },
      temperature: 0.9,
    })
    expect(sentHeaders().Authorization).toBe('Bearer sk-or-v1-test')
  })

  it('falls back to the default model when none is configured', async () => {
    fetchMock.mockImplementation(() => chatReply('{}'))
    await createOpenRouterLlm(contextFor({ apiKey: 'k' })).generateJson('p', 0.5)
    expect(sentBody().model).toBe(DEFAULT_LLM_MODEL)
  })

  it('parses json the model wrapped in prose', async () => {
    fetchMock.mockImplementation(() => chatReply('Sure!\n```json\n{"theme":"Rumi"}\n```'))
    const parsed = await createOpenRouterLlm(contextFor({ apiKey: 'k' })).generateJson('p', 0.5)
    expect(parsed).toEqual({ theme: 'Rumi' })
  })

  it('reports the missing key without reaching the network', async () => {
    const llm = createOpenRouterLlm(contextFor({}))
    await expect(llm.generateJson('p', 0.5)).rejects.toThrow(MISSING_KEY)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(llm.isConfigured()).toBe(false)
  })

  it('surfaces the error message OpenRouter returns', async () => {
    fetchMock.mockImplementation(() => jsonResponse({ error: { message: 'No endpoints found for that model.', code: 400 } }, false, 400))
    await expect(createOpenRouterLlm(contextFor({ apiKey: 'k' })).generateJson('p', 0.5))
      .rejects.toThrow('No endpoints found for that model.')
  })

  it('falls back to the status when the error body is unreadable', async () => {
    fetchMock.mockImplementation(() => Promise.resolve({ ok: false, status: 502, json: () => Promise.reject(new Error('nope')) } as unknown as Response))
    await expect(createOpenRouterLlm(contextFor({ apiKey: 'k' })).generateJson('p', 0.5)).rejects.toThrow('502')
  })

  it('rejects a reply carrying no content', async () => {
    fetchMock.mockImplementation(() => jsonResponse({ choices: [] }))
    await expect(createOpenRouterLlm(contextFor({ apiKey: 'k' })).generateJson('p', 0.5))
      .rejects.toThrow(OpenRouterError)
  })
})

describe('OpenRouter TTS', () => {
  const speakOptions = { accent: ACCENTS.GA, rate: 1 }

  const audioResponse = () => Promise.resolve({
    ok: true, status: 200, arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer),
  } as unknown as Response)

  it('asks for mp3 with the configured model and voice', async () => {
    fetchMock.mockImplementation(audioResponse)
    const tts = createOpenRouterTts(contextFor({ apiKey: 'k', ttsModel: 'mistralai/voxtral-mini-tts-2603', voice: 'nova' }))

    await tts.prefetch!('Sing now.', speakOptions)

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://openrouter.ai/api/v1/audio/speech')
    expect(sentBody()).toEqual({
      model: 'mistralai/voxtral-mini-tts-2603',
      input: 'Sing now.',
      voice: 'nova',
      response_format: 'mp3',
    })
  })

  it('falls back to the default model and voice', async () => {
    fetchMock.mockImplementation(audioResponse)
    await createOpenRouterTts(contextFor({ apiKey: 'k' })).prefetch!('Sing now.', speakOptions)
    expect(sentBody()).toMatchObject({ model: DEFAULT_TTS_MODEL, voice: DEFAULT_VOICE })
  })

  it('declares itself unconfigured without a key', () => {
    expect(createOpenRouterTts(contextFor({})).isConfigured()).toBe(false)
    expect(createOpenRouterTts(contextFor({ apiKey: 'k' })).isConfigured()).toBe(true)
  })

  it('marks the fields that invalidate cached audio', () => {
    const fields = createOpenRouterTts(contextFor({})).settingsFields
    expect(fields.filter(field => field.invalidatesAudio).map(field => field.key)).toEqual(['ttsModel', 'voice'])
  })
})
