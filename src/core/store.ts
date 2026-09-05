import type { Drill } from '../types'

const LIBRARY_KEY = 'df_lib'
const LIBRARY_LIMIT = 30

function isDrill(value: unknown): value is Drill {
  const drill = value as Drill | null
  return Boolean(drill && typeof drill.theme === 'string' && Array.isArray(drill.sentences))
}

export function loadLibrary(): Drill[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(LIBRARY_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(isDrill) : []
  } catch {
    return []
  }
}

function writeLibrary(entries: Drill[]): boolean {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(entries))
    return true
  } catch {
    return false
  }
}

export function saveToLibrary(drill: Drill): boolean {
  return writeLibrary([structuredClone(drill), ...loadLibrary()].slice(0, LIBRARY_LIMIT))
}

export function removeFromLibrary(index: number): void {
  const entries = loadLibrary()
  entries.splice(index, 1)
  writeLibrary(entries)
}
