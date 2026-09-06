import { createClipPlayer } from '../tts/clipPlayer'
import type { TtsProvider } from '../tts/types'
import type { ProviderContext } from '../types'
import { callOpenRouter } from './client'

export const DEFAULT_TTS_MODEL = 'openai/gpt-4o-mini-tts-2025-12-15'
export const DEFAULT_VOICE = 'alloy'

export function createOpenRouterTts(context: ProviderContext): TtsProvider {
  const clipPlayer = createClipPlayer(
    async text => {
      const { apiKey, ttsModel, voice } = context.config()
      const response = await callOpenRouter('/audio/speech', apiKey || '', {
        model: ttsModel || DEFAULT_TTS_MODEL,
        input: text,
        voice: voice || DEFAULT_VOICE,
        // mp3 plays straight from a blob; pcm would mean guessing a sample rate per model
        response_format: 'mp3',
      })

      return new Blob([await response.arrayBuffer()], { type: 'audio/mpeg' })
    },
    // playback speed is applied by the audio element, so it is not part of the key
    (text, options) => [text, context.config().ttsModel, context.config().voice, options.accent.code].join('|'),
  )

  return {
    id: 'openrouter',
    label: 'OpenRouter voice',
    isConfigured: () => Boolean(context.config().apiKey),
    settingsFields: [
      { key: 'apiKey', label: 'OpenRouter API key', type: 'password', placeholder: 'sk-or-v1-…' },
      { key: 'ttsModel', label: 'Voice model', type: 'text', placeholder: DEFAULT_TTS_MODEL, invalidatesAudio: true },
      { key: 'voice', label: 'Voice', type: 'text', placeholder: DEFAULT_VOICE, invalidatesAudio: true },
    ],
    ...clipPlayer,
  }
}
