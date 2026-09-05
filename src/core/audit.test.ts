import { describe, expect, it } from 'vitest'
import type { Accent } from './accents'
import { ACCENTS } from './accents'
import { auditIPA } from './audit'

const everyRpPhoneme = [...ACCENTS.RP.vowels, ...ACCENTS.RP.consonants].join(' ')

interface AuditCase {
  name: string
  ipa: string
  accent: Accent
  pct?: number
  missing?: string[]
  present?: string[]
  absent?: string[]
}

describe('auditIPA', () => {
  const cases: AuditCase[] = [
    {
      name: 'every phoneme present scores 100',
      ipa: everyRpPhoneme,
      accent: ACCENTS.RP,
      pct: 100,
      missing: [],
    },
    {
      name: 'empty transcription scores 0 and misses everything',
      ipa: '',
      accent: ACCENTS.RP,
      pct: 0,
      missing: [...ACCENTS.RP.vowels, ...ACCENTS.RP.consonants],
    },
    {
      name: 'affricate credits its own parts',
      ipa: '/tʃ/',
      accent: ACCENTS.RP,
      present: ['tʃ', 't', 'ʃ'],
      absent: ['dʒ', 'd'],
    },
    {
      name: 'diphthong credits its leading vowel',
      ipa: '/eɪ/',
      accent: ACCENTS.RP,
      present: ['eɪ', 'e'],
      absent: ['aɪ'],
    },
    {
      name: 'ascii g counts as the ipa velar',
      ipa: '/gəʊld/',
      accent: ACCENTS.RP,
      present: ['ɡ', 'əʊ', 'l', 'd'],
    },
    {
      name: 'general american scores its own inventory, not RP',
      ipa: '/ɝ ɚ oʊ ɛ/',
      accent: ACCENTS.GA,
      present: ['ɝ', 'ɚ', 'oʊ', 'ɛ'],
    },
  ]

  for (const testCase of cases) {
    it(testCase.name, () => {
      const result = auditIPA(testCase.ipa, testCase.accent)

      if (testCase.pct !== undefined) expect(result.pct).toBe(testCase.pct)
      if (testCase.missing !== undefined) expect(result.missing).toEqual(testCase.missing)
      for (const phoneme of testCase.present ?? []) expect(result.found[phoneme], phoneme).toBe(true)
      for (const phoneme of testCase.absent ?? []) expect(result.found[phoneme], phoneme).toBe(false)
    })
  }

  it('reports an inventory the accent actually declares', () => {
    expect(auditIPA('', ACCENTS.GA).inventory).toEqual([...ACCENTS.GA.vowels, ...ACCENTS.GA.consonants])
  })

  it('audits Liverpool against a declared inventory rather than silently skipping it', () => {
    expect(auditIPA(everyRpPhoneme, ACCENTS.Liverpool).pct).toBe(100)
  })
})
