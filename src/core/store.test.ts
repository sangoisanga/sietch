import { beforeEach, describe, expect, it } from 'vitest'
import type { Drill } from '../types'
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from './settings'
import { loadLibrary, removeFromLibrary, saveToLibrary } from './store'

// node 25 ships a localStorage global that throws without --localstorage-file
function createMemoryStorage(): Storage {
  const entries = new Map<string, string>()
  return {
    get length() { return entries.size },
    key: index => [...entries.keys()][index] ?? null,
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => { entries.set(key, String(value)) },
    removeItem: key => { entries.delete(key) },
    clear: () => entries.clear(),
  }
}

Object.defineProperty(globalThis, 'localStorage', { value: createMemoryStorage(), configurable: true })

const drill = (theme: string): Drill => ({
  theme,
  accent: 'RP',
  sentences: [{ en: 'Sing now.', ipa: '/ˈsɪŋ ˈnaʊ/', vi: 'Hát đi.', tips: [] }],
  anchors: {},
})

beforeEach(() => localStorage.clear())

describe('settings', () => {
  it('round-trips through storage', () => {
    saveSettings({ ...DEFAULT_SETTINGS, apiKey: 'AIza-test', voice: 'Puck', rate: 0.75 })
    expect(loadSettings()).toMatchObject({ apiKey: 'AIza-test', voice: 'Puck', rate: 0.75 })
  })

  it('falls back to defaults when nothing is stored', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('backfills keys a stored older shape is missing', () => {
    localStorage.setItem('df_settings', JSON.stringify({ apiKey: 'AIza-test' }))
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, apiKey: 'AIza-test' })
  })

  it('degrades to defaults on corrupt json instead of throwing', () => {
    localStorage.setItem('df_settings', '{not json')
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })
})

describe('library', () => {
  it('stores newest first', () => {
    saveToLibrary(drill('Rumi'))
    saveToLibrary(drill('Pink Floyd'))
    expect(loadLibrary().map(entry => entry.theme)).toEqual(['Pink Floyd', 'Rumi'])
  })

  it('deep-copies so later edits do not mutate the saved entry', () => {
    const original = drill('Rumi')
    saveToLibrary(original)
    original.theme = 'edited'
    expect(loadLibrary()[0]?.theme).toBe('Rumi')
  })

  it('caps at 30 entries', () => {
    for (let i = 0; i < 35; i++) saveToLibrary(drill(`pack ${i}`))
    expect(loadLibrary()).toHaveLength(30)
  })

  it('removes by index', () => {
    saveToLibrary(drill('a'))
    saveToLibrary(drill('b'))
    removeFromLibrary(0)
    expect(loadLibrary().map(entry => entry.theme)).toEqual(['a'])
  })

  it('yields an empty list for corrupt json rather than throwing', () => {
    localStorage.setItem('df_lib', '{not json')
    expect(loadLibrary()).toEqual([])
  })

  it('drops entries that are not drills', () => {
    localStorage.setItem('df_lib', JSON.stringify([{ nope: true }, drill('Rumi')]))
    expect(loadLibrary().map(entry => entry.theme)).toEqual(['Rumi'])
  })
})
