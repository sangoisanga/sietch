export type AccentCode = 'RP' | 'GA' | 'Liverpool' | 'Scottish' | 'Australian'

export interface Sentence {
  en: string
  ipa: string
  vi: string
  tips: string[]
}

export interface Drill {
  theme: string
  accent: AccentCode
  sentences: Sentence[]
  anchors: Record<string, string>
}
