import type { SpeakingStyle } from '../../types'
import { generateContent, partsOf } from '../gemini/client'
import type { ProviderContext } from '../types'
import { createClipPlayer } from './clipPlayer'
import type { TtsProvider } from './types'
import { base64ToBytes, pcmToWav, sampleRateFromMimeType } from './wav'

export const GEMINI_VOICES = ['Kore', 'Puck', 'Charon', 'Zephyr', 'Fenrir', 'Aoede', 'Leda', 'Orus', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Achird', 'Vindemiatrix', 'Sadachbia', 'Sulafat', 'Callirrhoe', 'Autonoe', 'Zubenelgenubi', 'Sadaltager', 'Pulcherrima']

const STYLE_INSTRUCTIONS: Record<SpeakingStyle, string> = {
  slow: 'Read slowly and very clearly, for a language learner to imitate, keeping natural linking and rhythm, in a {ACCENT} accent:',
  natural: 'Read at a natural relaxed pace with natural linking, weak forms and rhythm, in a {ACCENT} accent:',
  veryslow: 'Read very slowly, one word at a time, over-articulating every consonant, in a {ACCENT} accent:',
}

export function createGeminiTts(context: ProviderContext): TtsProvider {
  const clipPlayer = createClipPlayer(
    async (text, options) => {
      const { apiKey, ttsModel, voice, style } = context.config()
      const instruction = STYLE_INSTRUCTIONS[(style || 'slow') as SpeakingStyle].replace('{ACCENT}', options.accent.ttsDescription)
      const response = await generateContent(ttsModel || 'gemini-3.1-flash-tts-preview', apiKey || '', {
        contents: [{ parts: [{ text: `${instruction} ${text}` }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice || 'Kore' } } },
        },
      })

      const audioPart = partsOf(response).find(part => part.inlineData)
      if (!audioPart?.inlineData) throw new Error('The response carried no audio.')

      const wav = pcmToWav(base64ToBytes(audioPart.inlineData.data), sampleRateFromMimeType(audioPart.inlineData.mimeType))
      return wav
    },
    (text, options) => [text, context.config().style, context.config().voice, options.accent.code].join('|'),
  )

  return {
    id: 'gemini',
    label: 'Gemini voice',
    isConfigured: () => Boolean(context.config().apiKey),
    settingsFields: [
      { key: 'apiKey', label: 'Gemini API key', type: 'password', placeholder: 'AIza…' },
      { key: 'ttsModel', label: 'Voice model', type: 'text' },
      { key: 'voice', label: 'Voice', type: 'select', options: GEMINI_VOICES.map(v => ({ value: v, label: v })), invalidatesAudio: true },
      { key: 'style', label: 'Delivery', type: 'select', options: [
        { value: 'slow', label: 'Slow — for shadowing' },
        { value: 'natural', label: 'Natural' },
        { value: 'veryslow', label: 'Very slow — word by word' },
      ], invalidatesAudio: true },
    ],
    ...clipPlayer,
  }
}
