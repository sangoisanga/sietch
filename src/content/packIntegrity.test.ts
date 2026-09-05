import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ACCENTS } from '../core/accents'
import { auditIPA } from '../core/audit'
import { countWords } from '../core/text'
import type { AccentCode, Drill } from '../types'
import type { Manifest } from './packs'

const PACK_DIR = join(process.cwd(), 'public', 'packs')

const readJson = <T>(file: string): T => JSON.parse(readFileSync(join(PACK_DIR, file), 'utf8')) as T

const manifest = readJson<Manifest>('manifest.json')
const packFiles = readdirSync(PACK_DIR).filter(file => file.endsWith('.json') && file !== 'manifest.json')

describe('manifest', () => {
  it('lists a file for every entry', () => {
    expect(manifest.packs.map(pack => `${pack.id}.json`).sort()).toEqual([...packFiles].sort())
  })

  it('references only pack ids that exist', () => {
    const ids = new Set(manifest.packs.map(pack => pack.id))
    for (const pool of manifest.pools) {
      for (const item of pool.items) expect(ids, `pool ${pool.id}`).toContain(item.packId)
    }
  })
})

describe.each(manifest.packs)('pack $id', summary => {
  const drill = readJson<Drill>(`${summary.id}.json`)

  it('declares a known accent matching the manifest', () => {
    expect(Object.keys(ACCENTS)).toContain(drill.accent)
    expect(drill.accent).toBe(summary.accent)
  })

  it('has complete sentences', () => {
    expect(drill.sentences.length).toBeGreaterThan(0)
    for (const sentence of drill.sentences) {
      expect(sentence.en.trim()).not.toBe('')
      expect(sentence.ipa.trim()).not.toBe('')
      expect(sentence.vi.trim()).not.toBe('')
    }
  })

  it('matches the word and sentence counts in the manifest', () => {
    expect(countWords(drill.sentences)).toBe(summary.words)
    expect(drill.sentences.length).toBe(summary.sentences)
  })

  it('covers every phoneme its accent declares', () => {
    const audit = auditIPA(drill.sentences.map(sentence => sentence.ipa).join(' '), ACCENTS[drill.accent as AccentCode])
    expect(audit.missing, `missing from ${summary.id}`).toEqual([])
    expect(audit.pct).toBe(100)
  })
})
