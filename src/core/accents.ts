import type { AccentCode } from '../types'

export interface Accent {
  code: AccentCode
  label: string
  bcp47: string
  ttsDescription: string
  vowels: string[]
  consonants: string[]
}

const SHARED_CONSONANTS = ['p', 'b', 't', 'd', 'k', 'ɡ', 'tʃ', 'dʒ', 'f', 'v', 'θ', 'ð', 's', 'z', 'ʃ', 'ʒ', 'h', 'm', 'n', 'ŋ', 'l', 'r', 'w', 'j']

const RP_VOWELS = ['iː', 'ɪ', 'e', 'æ', 'ɑː', 'ɒ', 'ɔː', 'ʊ', 'uː', 'ʌ', 'ɜː', 'ə', 'eɪ', 'aɪ', 'ɔɪ', 'əʊ', 'aʊ', 'ɪə', 'eə', 'ʊə']
const GA_VOWELS = ['i', 'ɪ', 'ɛ', 'æ', 'ɑ', 'ɔ', 'ʊ', 'u', 'ʌ', 'ɝ', 'ɚ', 'ə', 'eɪ', 'aɪ', 'ɔɪ', 'oʊ', 'aʊ']

export const ACCENTS: Record<AccentCode, Accent> = {
  RP: { code: 'RP', label: 'British — RP', bcp47: 'en-GB', ttsDescription: 'British Received Pronunciation', vowels: RP_VOWELS, consonants: SHARED_CONSONANTS },
  GA: { code: 'GA', label: 'American — General', bcp47: 'en-US', ttsDescription: 'General American', vowels: GA_VOWELS, consonants: SHARED_CONSONANTS },
  Liverpool: { code: 'Liverpool', label: 'British — Liverpool', bcp47: 'en-GB', ttsDescription: 'Liverpool English', vowels: RP_VOWELS, consonants: SHARED_CONSONANTS },
  Scottish: { code: 'Scottish', label: 'British — Scottish', bcp47: 'en-GB', ttsDescription: 'Scottish English', vowels: RP_VOWELS, consonants: SHARED_CONSONANTS },
  Australian: { code: 'Australian', label: 'Australian', bcp47: 'en-AU', ttsDescription: 'Australian English', vowels: RP_VOWELS, consonants: SHARED_CONSONANTS },
}

export const ACCENT_CODES: AccentCode[] = ['GA', 'RP', 'Liverpool', 'Scottish', 'Australian']

export const DEFAULT_ACCENT: AccentCode = 'GA'

export function resolveAccent(code: string): Accent {
  return ACCENTS[code as AccentCode] ?? ACCENTS[DEFAULT_ACCENT]
}
