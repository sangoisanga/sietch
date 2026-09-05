import type { Accent } from './accents'

function inventoryOf(accent: Accent): string {
  return [...accent.vowels, ...accent.consonants].join(' ')
}

const OUTPUT_CONTRACT = `For each sentence give:
- en: the sentence
- ipa: broad {ACCENT} transcription in slashes, using ‿ to mark linking, | to mark pauses
- vi: idiomatic Vietnamese conveying the MEANING, not a literal word-by-word translation
- tips: 2–4 very short Vietnamese notes on the hardest sounds in that sentence

Also give anchors: an object mapping lowercase tricky words to a very short Vietnamese pronunciation note.

Return ONLY JSON:
{"theme":"...","accent":"{CODE}","sentences":[{"en":"","ipa":"","vi":"","tips":[""]}],"anchors":{"word":"note"}}`

function outputContract(accent: Accent): string {
  return OUTPUT_CONTRACT.replace('{ACCENT}', accent.code).replace('{CODE}', accent.code)
}

export function buildForgePrompt(theme: string, accent: Accent, maxWords: string, missing: string[]): string {
  const gapRule = missing.length
    ? `\n6. CRITICAL: the previous draft was missing these phonemes — the new version MUST contain them: ${missing.join(' ')}`
    : ''

  return `You are a phonetics coach writing a daily pronunciation drill for a Vietnamese adult learner.

TASK: Write an ORIGINAL passage under ${maxWords} words, set in the world/spirit of: ${theme}.

HARD RULES
1. ORIGINAL PROSE ONLY. Never quote lyrics, poems, or any copyrighted text verbatim. Echo the themes and characteristic vocabulary, never the lines.
2. It must be one coherent piece with real meaning — carry the philosophy of ${theme}. It should be worth memorising.
3. Accent target: ${accent.code}. Every one of these phonemes must appear at least once: ${inventoryOf(accent)}
4. Must also include, in STRESSED syllables where possible: /ʒ/, a rare diphthong, a dark L, a word-final /ŋ/, both /θ/ and /ð/, one intrusive-R linking, one linking-R, and one rise–fall contrast pair (e.g. "not X, but Y").
5. Split into 8–14 short sentences. End on a very short sentence.${gapRule}

${outputContract(accent)}`
}

export function buildAnnotatePrompt(passage: string, accent: Accent): string {
  return `You are a phonetics coach preparing a pronunciation drill for a Vietnamese adult learner.

TASK: Take the PASSAGE below EXACTLY as written. Do NOT rewrite, add, remove, translate or reorder any words — the learner's own English text must stay verbatim. Only split it into sentences and annotate.

PASSAGE:
"""
${passage}
"""

${outputContract(accent)}
Set theme to a short label for the passage (its first few words, or "My text").`
}
