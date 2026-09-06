import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, GEMINI_DEFAULTS } from '../core/settings'
import { normaliseSettings } from './settings'

describe('normaliseSettings', () => {
  it('yields the defaults for an empty or missing record', () => {
    expect(normaliseSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(normaliseSettings({})).toEqual(DEFAULT_SETTINGS)
  })

  // the first release stored one provider's credentials at the top level
  it('folds a flat record into providers.gemini', () => {
    const settings = normaliseSettings({
      apiKey: 'AIza-legacy',
      textModel: 'gemini-flash-latest',
      ttsModel: 'gemini-tts',
      voice: 'Puck',
      style: 'veryslow',
      ttsProviderId: 'gemini',
      llmProviderId: 'gemini',
      rate: 0.75,
    })

    expect(settings.providers.gemini).toEqual({
      apiKey: 'AIza-legacy',
      textModel: 'gemini-flash-latest',
      ttsModel: 'gemini-tts',
      voice: 'Puck',
      style: 'veryslow',
    })
    expect(settings.rate).toBe(0.75)
    expect(settings).not.toHaveProperty('apiKey')
  })

  // reading an old record through the new defaults can produce both shapes at once
  it('prefers the flat values over default provider values', () => {
    const settings = normaliseSettings({ ...DEFAULT_SETTINGS, apiKey: 'AIza-legacy', voice: 'Puck' })
    expect(settings.providers.gemini).toMatchObject({ apiKey: 'AIza-legacy', voice: 'Puck' })
  })

  it('round-trips a record already in the new shape', () => {
    const stored = {
      ttsProviderId: 'openrouter',
      llmProviderId: 'openrouter',
      rate: 1,
      providers: {
        gemini: { ...GEMINI_DEFAULTS },
        openrouter: { apiKey: 'sk-or-v1-abc', llmModel: 'anthropic/claude-sonnet-5' },
      },
    }
    expect(normaliseSettings(stored)).toEqual(stored)
  })

  it('keeps an unknown provider entry rather than dropping it', () => {
    const settings = normaliseSettings({ providers: { future: { apiKey: 'x' } } })
    expect(settings.providers.future).toEqual({ apiKey: 'x' })
  })

  it('discards non-string config values instead of trusting them', () => {
    const gemini = normaliseSettings({ providers: { gemini: { apiKey: 'ok', voice: 42, nested: {} } } }).providers.gemini!
    expect(gemini.apiKey).toBe('ok')
    expect(gemini.voice).toBe(GEMINI_DEFAULTS.voice)
    expect(gemini).not.toHaveProperty('nested')
  })

  it('falls back to defaults for a wrongly typed rate or provider id', () => {
    const settings = normaliseSettings({ rate: 'fast', ttsProviderId: 7 })
    expect(settings.rate).toBe(DEFAULT_SETTINGS.rate)
    expect(settings.ttsProviderId).toBe(DEFAULT_SETTINGS.ttsProviderId)
  })
})
