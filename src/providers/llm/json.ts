export function parseLooseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T
  } catch {
    const embedded = text.match(/\{[\s\S]*\}/)
    if (!embedded) throw new Error('The model did not return JSON.')
    return JSON.parse(embedded[0]) as T
  }
}
