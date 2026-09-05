import type { Accent } from './accents'

export interface AuditResult {
  found: Record<string, boolean>
  inventory: string[]
  missing: string[]
  pct: number
}

export function auditIPA(ipa: string, accent: Accent): AuditResult {
  const normalised = ipa.replace(/g/g, 'ɡ').replace(/ɡ̊/g, 'ɡ')
  const inventory = [...accent.vowels, ...accent.consonants]
  const found: Record<string, boolean> = {}

  // longest first, so /e/ does not consume the /eɪ/ it lives inside
  let scratch = normalised
  for (const phoneme of [...inventory].sort((a, b) => b.length - a.length)) {
    found[phoneme] = scratch.includes(phoneme)
    if (found[phoneme]) scratch = scratch.split(phoneme).join(' ')
  }
  for (const phoneme of inventory) {
    if (!found[phoneme] && normalised.includes(phoneme)) found[phoneme] = true
  }

  const missing = inventory.filter(phoneme => !found[phoneme])
  const pct = Math.round((inventory.length - missing.length) / inventory.length * 100)
  return { found, inventory, missing, pct }
}
