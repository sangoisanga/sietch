export function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean)
}

export function bare(word: string): string {
  return word.toLowerCase().replace(/[^a-z']/g, '')
}

export function countWords(sentences: { en: string }[]): number {
  return sentences.reduce((total, sentence) => total + tokenize(sentence.en).length, 0)
}

export function splitSentences(text: string): string[] {
  const clean = String(text).replace(/\s+/g, ' ').trim()
  if (!clean) return []
  return (clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [clean]).map(s => s.trim()).filter(Boolean)
}
