export type AccentCode = 'RP' | 'GA' | 'Liverpool' | 'Scottish' | 'Australian'

export type SpeakingStyle = 'slow' | 'natural' | 'veryslow'

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

export interface Profile {
  id: string
  name: string
}

export interface Progress {
  completed: Record<string, string>
  assignments: Record<string, string>
}
