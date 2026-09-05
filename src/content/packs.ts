import type { AccentCode, Drill } from '../types'
import type { Pool } from './pool'

export interface PackSummary {
  id: string
  title: string
  accent: AccentCode
  tags: string[]
  words: number
  sentences: number
}

export interface Manifest {
  packs: PackSummary[]
  pools: Pool[]
}

export const DEFAULT_PACK = 'beatles'
export const DEFAULT_PACK_TITLE = 'The Beatles'

const packCache = new Map<string, Drill>()
let manifestRequest: Promise<Manifest> | null = null

function packUrl(file: string): string {
  return `${import.meta.env.BASE_URL}packs/${file}`
}

async function fetchPackFile<T>(file: string): Promise<T> {
  const response = await fetch(packUrl(file))
  if (!response.ok) throw new Error(`Could not load ${file} (${response.status})`)
  try {
    return await response.json() as T
  } catch {
    // dev servers and SPA hosts answer a missing file with index.html at status 200
    throw new Error(`Could not load ${file} (not JSON)`)
  }
}

export function loadManifest(): Promise<Manifest> {
  // a rejected promise must not be cached, or one offline moment breaks the app until reload
  manifestRequest ??= fetchPackFile<Manifest>('manifest.json').catch(error => {
    manifestRequest = null
    throw error
  })
  return manifestRequest
}

export async function loadPack(id: string): Promise<Drill> {
  const cached = packCache.get(id)
  if (cached) return structuredClone(cached)

  const drill = await fetchPackFile<Drill>(`${id}.json`)
  packCache.set(id, drill)
  return structuredClone(drill)
}
