import type { Pool } from '../content/pool'
import { decodeAudio, encodeAudio, POOL_SCHEMA, signPool, type PoolAudio, type PoolFile } from '../content/poolFile'
import type { AccentCode, Drill } from '../types'
import { cachedKeys, clipsForText, putClip } from './audioClips'
import { now, openDb, toPlain, type PoolRecord } from './db'

export type InstallDecision = 'replace' | 'keepBoth'

// the recipient's own voice decides the key, so shared audio plays without re-paying for it
export type ClipKeyFor = (text: string, accent: AccentCode) => string | null

export interface PoolConflict {
  installed: PoolRecord
  incoming: { id: string; title: string; version: number; packs: number; updatedAt: string }
}

// packs are keyed by pool so two pools can ship a pack with the same id
const packKey = (poolId: string, packId: string) => `${poolId}/${packId}`

export async function listPools(): Promise<PoolRecord[]> {
  return (await openDb()).getAll('pools')
}

export async function findConflict(file: PoolFile): Promise<PoolConflict | null> {
  const installed = await (await openDb()).get('pools', file.id)
  if (!installed) return null
  return {
    installed,
    incoming: { id: file.id, title: file.title, version: file.version, packs: file.packs.length, updatedAt: file.updatedAt },
  }
}

async function removePacksOf(poolId: string): Promise<void> {
  const db = await openDb()
  const keys = await db.getAllKeysFromIndex('packs', 'byPool', poolId)
  await Promise.all(keys.map(key => db.delete('packs', key)))
}

export async function installPool(file: PoolFile, decision: InstallDecision = 'replace'): Promise<string> {
  const db = await openDb()
  const conflict = await db.get('pools', file.id)
  const poolId = conflict && decision === 'keepBoth' ? `${file.id}-${crypto.randomUUID().slice(0, 8)}` : file.id
  const title = poolId === file.id ? file.title : `${file.title} (copy)`

  // replacing leaves progress alone: completions are keyed by item, not by pool version
  if (poolId === file.id) await removePacksOf(poolId)

  const stamp = now()
  await db.put('pools', {
    id: poolId,
    title,
    cadence: file.cadence,
    version: file.version,
    packIds: file.packs.map(pack => pack.id),
    ...(file.author === undefined ? {} : { author: file.author }),
    ...(file.license === undefined ? {} : { license: file.license }),
    updatedAt: stamp,
  })

  await Promise.all(file.packs.map(({ id, ...drill }) =>
    db.put('packs', { id: packKey(poolId, id), poolId, drill: toPlain(drill) as Drill, updatedAt: stamp })))

  return poolId
}

export async function importPoolAudio(file: PoolFile, clipKeyFor: ClipKeyFor): Promise<number> {
  const accentOf = new Map<string, AccentCode>()
  for (const pack of file.packs) {
    for (const sentence of pack.sentences) accentOf.set(sentence.en, pack.accent)
  }

  let imported = 0
  for (const [text, audio] of Object.entries(file.audio ?? {})) {
    const accent = accentOf.get(text)
    const key = accent && clipKeyFor(text, accent)
    if (!key) continue

    // a clip already recorded here was made with this voice; the incoming one only guesses at it
    if ((await cachedKeys([key])).has(key)) continue

    await putClip({ key, text, blob: decodeAudio(audio), durationSeconds: audio.durationSeconds })
    imported++
  }
  return imported
}

export async function removePool(poolId: string): Promise<void> {
  await removePacksOf(poolId)
  await (await openDb()).delete('pools', poolId)
}

export async function loadDrill(poolId: string, packId: string): Promise<Drill> {
  const record = await (await openDb()).get('packs', packKey(poolId, packId))
  if (!record) throw new Error(`No pack ${packId} in pool ${poolId}`)
  return structuredClone(record.drill)
}

export async function toRotationPool(poolId: string): Promise<Pool | null> {
  const record = await (await openDb()).get('pools', poolId)
  if (!record) return null
  return {
    id: record.id,
    title: record.title,
    cadence: record.cadence,
    items: record.packIds.map(packId => ({ kind: 'passage', packId })),
  }
}

async function collectAudio(packs: { sentences: { en: string }[] }[]): Promise<Record<string, PoolAudio>> {
  const audio: Record<string, PoolAudio> = {}
  for (const pack of packs) {
    for (const { en } of pack.sentences) {
      if (audio[en]) continue
      const [clip] = await clipsForText(en)
      if (!clip) continue
      audio[en] = { mime: clip.blob.type, durationSeconds: clip.durationSeconds, data: await encodeAudio(clip.blob) }
    }
  }
  return audio
}

export async function exportPool(poolId: string, withAudio = false): Promise<PoolFile> {
  const db = await openDb()
  const record = await db.get('pools', poolId)
  if (!record) throw new Error(`No pool ${poolId}`)

  const packs = await Promise.all(record.packIds.map(async packId => {
    const pack = await db.get('packs', packKey(poolId, packId))
    if (!pack) throw new Error(`No pack ${packId} in pool ${poolId}`)
    return { id: packId, ...pack.drill }
  }))

  const audio = withAudio ? await collectAudio(packs) : {}

  return signPool({
    schema: POOL_SCHEMA,
    id: record.id,
    title: record.title,
    version: record.version,
    cadence: record.cadence,
    updatedAt: new Date(record.updatedAt).toISOString(),
    packs,
    ...(Object.keys(audio).length ? { audio } : {}),
    ...(record.author === undefined ? {} : { author: record.author }),
    ...(record.license === undefined ? {} : { license: record.license }),
  })
}

export async function poolAudioSize(poolId: string): Promise<number> {
  const db = await openDb()
  const record = await db.get('pools', poolId)
  if (!record) return 0

  let bytes = 0
  const counted = new Set<string>()
  for (const packId of record.packIds) {
    const pack = await db.get('packs', packKey(poolId, packId))
    for (const { en } of pack?.drill.sentences ?? []) {
      if (counted.has(en)) continue
      counted.add(en)
      const [clip] = await clipsForText(en)
      bytes += clip?.blob.size ?? 0
    }
  }
  return bytes
}
