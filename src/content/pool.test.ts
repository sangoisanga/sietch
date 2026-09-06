import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearClips, getClip, putClip } from '../data/audioClips'
import { closeDb, DB_NAME, openDb } from '../data/db'
import { exportPool, findConflict, importPoolAudio, installPool, listPools, loadDrill, toRotationPool } from '../data/pools'
import { markCompleted, loadProgress } from '../data/progress'
import { computeChecksum, signPool, toPool, type PoolFile, type UnsignedPoolFile } from './poolFile'
import { validatePool } from './validatePool'

const starter = JSON.parse(
  readFileSync(join(process.cwd(), 'public', 'pools', 'starter.sietch.json'), 'utf8'),
) as PoolFile

const clone = (): PoolFile => structuredClone(starter)

const minimal = async (overrides: Partial<UnsignedPoolFile> = {}): Promise<PoolFile> => signPool({
  schema: 1,
  id: 'tiny',
  title: 'Tiny pool',
  version: 1,
  cadence: 'daily',
  updatedAt: '2026-09-05T00:00:00.000Z',
  author: 'Test',
  license: 'CC0',
  packs: [{ id: 'one', theme: 'One', accent: 'GA', sentences: [{ en: 'Sing now.', ipa: '/ˈsɪŋ ˈnaʊ/', vi: 'Hát đi.', tips: [] }], anchors: {} }],
  ...overrides,
})

beforeEach(async () => {
  await closeDb()
  await new Promise<void>(resolve => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = request.onerror = request.onblocked = () => resolve()
  })
})

describe('the shipped starter pool', () => {
  it('validates with no errors and no warnings', async () => {
    const report = await validatePool(starter)
    expect(report.errors).toEqual([])
    expect(report.warnings).toEqual([])
    expect(report.ok).toBe(true)
  })

  it('covers every phoneme in all 12 packs', async () => {
    const report = await validatePool(starter)
    expect(report.packs).toBe(12)
    for (const pack of report.coverage) {
      expect(pack.missing, `missing from ${pack.packId}`).toEqual([])
      expect(pack.pct).toBe(100)
    }
  })

  it('carries a checksum that matches its contents', async () => {
    expect((await validatePool(starter)).checksumValid).toBe(true)
  })
})

describe('validatePool rejections', () => {
  const cases = [
    { name: 'a future schema, naming the version', mutate: (p: PoolFile) => ({ ...p, schema: 3 }), match: /Unsupported pool schema: 3/ },
    { name: 'a missing schema', mutate: (p: PoolFile) => { const { schema, ...rest } = p; return rest }, match: /Unsupported pool schema/ },
    { name: 'no packs', mutate: (p: PoolFile) => ({ ...p, packs: [] }), match: /no packs/ },
    { name: 'an unknown cadence', mutate: (p: PoolFile) => ({ ...p, cadence: 'hourly' }), match: /Unknown cadence/ },
    { name: 'a missing title', mutate: (p: PoolFile) => ({ ...p, title: '' }), match: /missing a title/ },
    { name: 'a tampered pack body', mutate: (p: PoolFile) => { p.packs[0]!.sentences[0]!.ipa = '/hacked/'; return p }, match: /Checksum does not match/ },
    { name: 'an unknown accent', mutate: (p: PoolFile) => { p.packs[0]!.accent = 'Klingon' as never; return p }, match: /unknown accent/ },
    { name: 'an empty vi field', mutate: (p: PoolFile) => { p.packs[0]!.sentences[0]!.vi = ''; return p }, match: /empty vi/ },
  ]

  for (const { name, mutate, match } of cases) {
    it(`rejects ${name}`, async () => {
      const report = await validatePool(mutate(clone()) as PoolFile)
      expect(report.ok).toBe(false)
      expect(report.errors.join(' | ')).toMatch(match)
    })
  }

  it('rejects something that is not a pool at all', async () => {
    expect((await validatePool('nope')).ok).toBe(false)
  })
})

describe('validatePool warnings', () => {
  it('warns without rejecting when coverage is short', async () => {
    const thin = await minimal({ packs: [{ id: 'thin', theme: 'Thin', accent: 'GA', sentences: [{ en: 'Hi.', ipa: '/haɪ/', vi: 'Chào.', tips: [] }], anchors: {} }] })
    const report = await validatePool(thin)
    expect(report.ok).toBe(true)
    expect(report.warnings.join(' ')).toMatch(/covers \d+%, missing/)
  })

  it('warns on a missing author and license', async () => {
    const { checksum, author, license, ...unattributed } = await minimal()
    const report = await validatePool(await signPool(unattributed))
    expect(report.ok).toBe(true)
    expect(report.warnings).toContain('Pool has no author.')
    expect(report.warnings).toContain('Pool has no license.')
  })
})

describe('installing', () => {
  it('installs the starter pool and serves its drills', async () => {
    await installPool(starter)
    expect((await listPools()).map(pool => pool.id)).toEqual(['sietch-starter'])
    expect((await loadDrill('sietch-starter', 'rumi')).theme).toBe('Rumi')
    expect((await toRotationPool('sietch-starter'))!.items).toHaveLength(12)
  })

  it('hands out a copy, so editing a drill cannot corrupt the store', async () => {
    await installPool(starter)
    const drill = await loadDrill('sietch-starter', 'rumi')
    drill.sentences.length = 0
    expect((await loadDrill('sietch-starter', 'rumi')).sentences.length).toBeGreaterThan(0)
  })

  it('reports a conflict when the id is already installed', async () => {
    await installPool(starter)
    const conflict = await findConflict(starter)
    expect(conflict?.installed.version).toBe(1)
    expect(conflict?.incoming.packs).toBe(12)
  })

  it('replace keeps progress, because completions are keyed by item', async () => {
    await installPool(starter)
    await markCompleted('p1', 'passage:rumi', '2026-09-05')

    const updated: PoolFile = await signPool({ ...clone(), version: 2, checksum: undefined } as never)
    await installPool(updated, 'replace')

    expect((await loadProgress('p1')).completed).toEqual({ 'passage:rumi': '2026-09-05' })
    expect((await listPools())[0]!.version).toBe(2)
  })

  it('keepBoth installs under a new id and leaves the original alone', async () => {
    await installPool(starter)
    const secondId = await installPool(starter, 'keepBoth')

    expect(secondId).not.toBe(starter.id)
    expect(await listPools()).toHaveLength(2)
    expect((await toRotationPool(secondId))!.title).toMatch(/\(copy\)/)
    expect((await loadDrill(secondId, 'rumi')).theme).toBe('Rumi')
  })

  it('replacing does not leave packs from the older version behind', async () => {
    await installPool(starter)
    const trimmed: PoolFile = await signPool({ ...clone(), packs: clone().packs.slice(0, 3), checksum: undefined } as never)
    await installPool(trimmed, 'replace')

    expect(await (await openDb()).getAllKeysFromIndex('packs', 'byPool', starter.id)).toHaveLength(3)
  })
})

describe('exporting', () => {
  it('round-trips through export and re-validates', async () => {
    await installPool(starter)
    const exported = await exportPool(starter.id)
    const report = await validatePool(exported)

    expect(report.ok).toBe(true)
    expect(report.packs).toBe(12)
  })

  it('still reads a schema 1 pool, which is what every shipped file is', async () => {
    expect((await validatePool(starter)).ok).toBe(true)
    expect(starter.schema).toBe(1)
  })
})

describe('sharing audio inside the pool', () => {
  const firstSentence = () => starter.packs[0]!.sentences[0]!.en
  const keyFor = (text: string) => `test|${text}`

  it('carries a clip out and back in, byte for byte', async () => {
    await installPool(starter)
    await putClip({ key: keyFor(firstSentence()), text: firstSentence(), blob: new Blob(['abc'], { type: 'audio/mpeg' }), durationSeconds: 2 })

    const exported = await exportPool(starter.id, true)
    expect(Object.keys(exported.audio ?? {})).toEqual([firstSentence()])
    expect((await validatePool(exported)).clips).toBe(1)

    await clearClips()
    expect(await importPoolAudio(exported, keyFor)).toBe(1)

    const restored = await getClip(keyFor(firstSentence()))
    expect(await restored!.blob.text()).toBe('abc')
    expect(restored!.blob.type).toBe('audio/mpeg')
    expect(restored!.durationSeconds).toBe(2)
  })

  it('leaves a clip already recorded here alone', async () => {
    await installPool(starter)
    await putClip({ key: keyFor(firstSentence()), text: firstSentence(), blob: new Blob(['theirs']), durationSeconds: 2 })
    const exported = await exportPool(starter.id, true)

    await putClip({ key: keyFor(firstSentence()), text: firstSentence(), blob: new Blob(['mine']), durationSeconds: 9 })
    expect(await importPoolAudio(exported, keyFor)).toBe(0)
    expect(await (await getClip(keyFor(firstSentence())))!.blob.text()).toBe('mine')
  })

  it('imports nothing when the active voice cannot be keyed', async () => {
    await installPool(starter)
    await putClip({ key: keyFor(firstSentence()), text: firstSentence(), blob: new Blob(['abc']), durationSeconds: 2 })
    const exported = await exportPool(starter.id, true)

    await clearClips()
    expect(await importPoolAudio(exported, () => null)).toBe(0)
  })

  it('rejects audio for a sentence the pool does not contain', async () => {
    const tampered = { ...starter, audio: { 'Not in this pool.': { mime: 'audio/mpeg', durationSeconds: 1, data: 'YWJj' } } }
    const report = await validatePool(tampered)

    expect(report.ok).toBe(false)
    expect(report.errors.join(' | ')).toMatch(/does not contain/)
  })

  it('omits the audio field entirely when nothing is cached', async () => {
    await installPool(starter)
    expect(await exportPool(starter.id, true)).not.toHaveProperty('audio')
  })
})

describe('toPool', () => {
  it('turns a pool file into the rotation shape', () => {
    expect(toPool(starter).items).toHaveLength(12)
    expect(toPool(starter).items[0]).toEqual({ kind: 'passage', packId: 'beatles' })
  })
})

describe('computeChecksum', () => {
  it('ignores key order', async () => {
    const file = await minimal()
    const shuffled = Object.fromEntries(Object.entries(file).reverse()) as unknown as PoolFile
    expect(await computeChecksum({ ...shuffled, checksum: undefined } as never))
      .toBe(await computeChecksum({ ...file, checksum: undefined } as never))
  })

  it('changes when any content changes', async () => {
    const file = await minimal()
    const edited = structuredClone(file)
    edited.packs[0]!.sentences[0]!.en = 'Sing later.'
    expect(await computeChecksum({ ...edited, checksum: undefined } as never))
      .not.toBe(await computeChecksum({ ...file, checksum: undefined } as never))
  })
})
