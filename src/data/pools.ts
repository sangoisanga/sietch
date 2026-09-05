import type { Pool } from '../content/pool'
import { signPool, type PoolFile } from '../content/poolFile'
import type { Drill } from '../types'
import { now, openDb, toPlain, type PoolRecord } from './db'

export type InstallDecision = 'replace' | 'keepBoth'

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

export async function exportPool(poolId: string): Promise<PoolFile> {
  const db = await openDb()
  const record = await db.get('pools', poolId)
  if (!record) throw new Error(`No pool ${poolId}`)

  const packs = await Promise.all(record.packIds.map(async packId => {
    const pack = await db.get('packs', packKey(poolId, packId))
    if (!pack) throw new Error(`No pack ${packId} in pool ${poolId}`)
    return { id: packId, ...pack.drill }
  }))

  return signPool({
    schema: 1,
    id: record.id,
    title: record.title,
    version: record.version,
    cadence: record.cadence,
    updatedAt: new Date(record.updatedAt).toISOString(),
    packs,
    ...(record.author === undefined ? {} : { author: record.author }),
    ...(record.license === undefined ? {} : { license: record.license }),
  })
}
