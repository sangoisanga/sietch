import { beforeEach, describe, expect, it } from 'vitest'
import {
  activeProfile, createProfile, deleteProfile, exportProfile, importProfile,
  listProfiles, loadProgress, renameProfile, saveProgress, setActiveProfile,
} from './profiles'

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

beforeEach(() => localStorage.clear())

describe('profiles', () => {
  it('creates a first profile so the app is never profile-less', () => {
    expect(listProfiles()).toHaveLength(1)
    expect(activeProfile().name).toBe('Me')
  })

  it('creates, renames and switches', () => {
    const wife = createProfile('Wife')
    setActiveProfile(wife.id)
    expect(activeProfile().id).toBe(wife.id)

    renameProfile(wife.id, 'Linh')
    expect(activeProfile().name).toBe('Linh')
    expect(listProfiles()).toHaveLength(2)
  })

  it('ignores a rename to blank', () => {
    const original = activeProfile()
    renameProfile(original.id, '   ')
    expect(activeProfile().name).toBe(original.name)
  })

  it('refuses to delete the last profile', () => {
    expect(deleteProfile(activeProfile().id)).toBe(false)
    expect(listProfiles()).toHaveLength(1)
  })

  it('switches away when the active profile is deleted', () => {
    const first = activeProfile()
    const second = createProfile('Second')
    setActiveProfile(second.id)

    expect(deleteProfile(second.id)).toBe(true)
    expect(activeProfile().id).toBe(first.id)
  })

  it('keeps progress namespaced per profile', () => {
    const me = activeProfile()
    const other = createProfile('Other')

    saveProgress(me.id, { completed: { 'passage:rumi': '2026-09-05' }, assignments: {} })
    saveProgress(other.id, { completed: { 'passage:floyd': '2026-09-05' }, assignments: {} })

    expect(Object.keys(loadProgress(me.id).completed)).toEqual(['passage:rumi'])
    expect(Object.keys(loadProgress(other.id).completed)).toEqual(['passage:floyd'])
  })

  it('drops a deleted profile\'s progress', () => {
    const other = createProfile('Other')
    saveProgress(other.id, { completed: { 'passage:rumi': '2026-09-05' }, assignments: {} })
    deleteProfile(other.id)

    expect(loadProgress(other.id)).toEqual({ completed: {}, assignments: {} })
  })

  it('degrades to an empty progress on corrupt storage', () => {
    const me = activeProfile()
    localStorage.setItem(`df_progress_${me.id}`, '{not json')
    expect(loadProgress(me.id)).toEqual({ completed: {}, assignments: {} })
  })
})

describe('export and import', () => {
  it('round-trips progress under a fresh id', () => {
    const me = activeProfile()
    renameProfile(me.id, 'Sang')
    saveProgress(me.id, { completed: { 'passage:rumi': '2026-09-05' }, assignments: { '2026-09-05': 'passage:rumi' } })

    const imported = importProfile(JSON.stringify(exportProfile(me.id)))

    expect(imported.name).toBe('Sang')
    expect(imported.id).not.toBe(me.id)
    expect(loadProgress(imported.id).completed).toEqual({ 'passage:rumi': '2026-09-05' })
    expect(loadProgress(me.id).completed).toEqual({ 'passage:rumi': '2026-09-05' })
    expect(listProfiles()).toHaveLength(2)
  })

  const rejections = [
    { name: 'a wrong version', json: JSON.stringify({ version: 2, profile: { id: 'x', name: 'y' } }), message: /Unsupported export version: 2/ },
    { name: 'a missing version', json: JSON.stringify({ profile: { id: 'x', name: 'y' } }), message: /Unsupported export version/ },
    { name: 'a missing profile', json: JSON.stringify({ version: 1 }), message: /no profile/ },
    { name: 'malformed json', json: '{not json', message: /not valid JSON/ },
  ]

  for (const { name, json, message } of rejections) {
    it(`rejects ${name}`, () => expect(() => importProfile(json)).toThrow(message))
  }
})
