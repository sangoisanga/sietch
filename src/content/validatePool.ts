import { ACCENTS } from '../core/accents'
import { auditIPA } from '../core/audit'
import { countWords } from '../core/text'
import type { AccentCode } from '../types'
import { computeChecksum, POOL_SCHEMA, type PoolFile } from './poolFile'

export interface PackCoverage {
  packId: string
  accent: AccentCode
  pct: number
  missing: string[]
}

export interface PoolReport {
  ok: boolean
  errors: string[]
  warnings: string[]
  checksumValid: boolean
  title: string
  packs: number
  words: number
  coverage: PackCoverage[]
}

const failed = (errors: string[]): PoolReport => ({
  ok: false, errors, warnings: [], checksumValid: false, title: '', packs: 0, words: 0, coverage: [],
})

export async function validatePool(raw: unknown): Promise<PoolReport> {
  if (!raw || typeof raw !== 'object') return failed(['That file is not a pool.'])

  const file = raw as Partial<PoolFile>
  // reported before any shape check, so an old app tells the user the version rather than a field name
  if (file.schema !== POOL_SCHEMA) {
    return failed([`Unsupported pool schema: ${String(file.schema)} (this app reads ${POOL_SCHEMA})`])
  }

  const errors: string[] = []
  const warnings: string[] = []

  if (typeof file.id !== 'string' || !file.id) errors.push('Pool is missing an id.')
  if (typeof file.title !== 'string' || !file.title) errors.push('Pool is missing a title.')
  if (file.cadence !== 'daily' && file.cadence !== 'weekly') errors.push(`Unknown cadence: ${String(file.cadence)}`)
  if (typeof file.version !== 'number') errors.push('Pool is missing a version number.')
  if (!Array.isArray(file.packs) || !file.packs.length) errors.push('Pool contains no packs.')

  if (errors.length) return failed(errors)

  const packs = file.packs!
  const coverage: PackCoverage[] = []
  const seenIds = new Set<string>()

  for (const [index, pack] of packs.entries()) {
    const label = pack?.id ?? `pack ${index + 1}`
    if (!pack?.id) { errors.push(`${label}: missing id`); continue }
    if (seenIds.has(pack.id)) warnings.push(`${label}: duplicate pack id inside this pool`)
    seenIds.add(pack.id)

    if (!(pack.accent in ACCENTS)) { errors.push(`${label}: unknown accent ${String(pack.accent)}`); continue }
    if (!Array.isArray(pack.sentences) || !pack.sentences.length) { errors.push(`${label}: no sentences`); continue }

    for (const [position, sentence] of pack.sentences.entries()) {
      const where = `${label} sentence ${position + 1}`
      if (!sentence?.en?.trim()) errors.push(`${where}: empty en`)
      if (!sentence?.ipa?.trim()) errors.push(`${where}: empty ipa`)
      if (!sentence?.vi?.trim()) errors.push(`${where}: empty vi`)
    }

    const audit = auditIPA(pack.sentences.map(sentence => sentence.ipa ?? '').join(' '), ACCENTS[pack.accent])
    coverage.push({ packId: pack.id, accent: pack.accent, pct: audit.pct, missing: audit.missing })
    if (audit.missing.length) warnings.push(`${label}: covers ${audit.pct}%, missing ${audit.missing.join(' ')}`)
  }

  if (!file.author) warnings.push('Pool has no author.')
  if (!file.license) warnings.push('Pool has no license.')

  const checksumValid = typeof file.checksum === 'string'
    && file.checksum === await computeChecksum({ ...file, checksum: undefined } as never)
  if (!checksumValid) errors.push('Checksum does not match — the file has been altered or was built wrong.')

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    checksumValid,
    title: file.title!,
    packs: packs.length,
    words: packs.reduce((total, pack) => total + countWords(pack?.sentences ?? []), 0),
    coverage,
  }
}
