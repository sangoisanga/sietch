import type { Drill } from '../types'
import type { Pool } from './pool'

export const POOL_SCHEMA = 2
export const READABLE_SCHEMAS = [1, POOL_SCHEMA] as const
export const POOL_EXTENSION = '.sietch.json'

export type PoolSchema = typeof READABLE_SCHEMAS[number]

export interface PackEntry extends Drill {
  id: string
}

export interface PoolAudio {
  mime: string
  durationSeconds: number
  data: string
}

export interface PoolFile {
  schema: PoolSchema
  id: string
  title: string
  version: number
  cadence: Pool['cadence']
  updatedAt: string
  packs: PackEntry[]
  // keyed by sentence text, so reordering or re-splitting the packs never orphans a clip
  audio?: Record<string, PoolAudio>
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

export async function encodeAudio(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function decodeAudio(audio: PoolAudio): Blob {
  const binary = atob(audio.data)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: audio.mime })
}

export function toPool(file: PoolFile): Pool {
  return {
    id: file.id,
    title: file.title,
    cadence: file.cadence,
    items: file.packs.map(pack => ({ kind: 'passage', packId: pack.id })),
  }
}
