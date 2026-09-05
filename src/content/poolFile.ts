import type { Drill } from '../types'
import type { Pool } from './pool'

export const POOL_SCHEMA = 1
export const POOL_EXTENSION = '.sietch.json'

export interface PackEntry extends Drill {
  id: string
}

export interface PoolFile {
  schema: typeof POOL_SCHEMA
  id: string
  title: string
  version: number
  cadence: Pool['cadence']
  updatedAt: string
  packs: PackEntry[]
  author?: string
  license?: string
  checksum: string
}

export type UnsignedPoolFile = Omit<PoolFile, 'checksum'>

// keys sorted by code point and no whitespace, so the same content always hashes the same
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(',')}}`
}

export async function computeChecksum(file: UnsignedPoolFile): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJson(file)))
  return `sha256:${[...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')}`
}

export async function signPool(file: UnsignedPoolFile): Promise<PoolFile> {
  return { ...file, checksum: await computeChecksum(file) }
}

export function toPool(file: PoolFile): Pool {
  return {
    id: file.id,
    title: file.title,
    cadence: file.cadence,
    items: file.packs.map(pack => ({ kind: 'passage', packId: pack.id })),
  }
}
