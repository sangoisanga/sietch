import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ACCENTS } from '../../core/accents'
import { createClipPlayer } from './clipPlayer'
import type { StoredClip } from './types'

const options = { accent: ACCENTS.GA, rate: 1 }
const rpOptions = { accent: ACCENTS.RP, rate: 1 }

let revoked: string[]

beforeEach(() => {
  revoked = []
  vi.stubGlobal('URL', {
    createObjectURL: () => `blob:${Math.random()}`,
    revokeObjectURL: (url: string) => revoked.push(url),
  })
})

afterEach(() => vi.unstubAllGlobals())

describe('createClipPlayer', () => {
  it('synthesises once per cache key', async () => {
    const synthesize = vi.fn(async () => new Blob(['audio']))
    const player = createClipPlayer(synthesize, (text, opts) => `${text}|${opts.accent.code}`)

    await player.prefetch!('Sing now.', options)
    await player.prefetch!('Sing now.', options)

    expect(synthesize).toHaveBeenCalledTimes(1)
  })

  it('treats a different cache key as a different clip', async () => {
    const synthesize = vi.fn(async () => new Blob(['audio']))
    const player = createClipPlayer(synthesize, (text, opts) => `${text}|${opts.accent.code}`)

    await player.prefetch!('Sing now.', options)
    await player.prefetch!('Sing now.', rpOptions)

    expect(synthesize).toHaveBeenCalledTimes(2)
  })

  it('revokes every object url on release and re-synthesises afterwards', async () => {
    const synthesize = vi.fn(async () => new Blob(['audio']))
    const player = createClipPlayer(synthesize, text => text)

    await player.prefetch!('one', options)
    await player.prefetch!('two', options)
    player.release!()

    expect(revoked).toHaveLength(2)

    await player.prefetch!('one', options)
    expect(synthesize).toHaveBeenCalledTimes(3)
  })

  it('hands back a url and a duration', async () => {
    const player = createClipPlayer(async () => new Blob(['audio']), text => text)
    const clip = await player.prefetch!('Sing now.', options)

    expect(clip.downloadUrl).toMatch(/^blob:/)
    expect(typeof clip.durationSeconds).toBe('number')
  })

  it('lets a synthesis failure through rather than caching it', async () => {
    const synthesize = vi.fn()
      .mockRejectedValueOnce(new Error('upstream down'))
      .mockResolvedValueOnce(new Blob(['audio']))
    const player = createClipPlayer(synthesize, text => text)

    await expect(player.prefetch!('one', options)).rejects.toThrow('upstream down')
    await expect(player.prefetch!('one', options)).resolves.toBeDefined()
  })
})

describe('createClipPlayer with a store', () => {
  function memoryStore() {
    const saved = new Map<string, StoredClip>()
    return {
      saved,
      get: async (key: string) => saved.get(key),
      put: async (clip: StoredClip) => void saved.set(clip.key, clip),
    }
  }

  it('saves what it synthesises', async () => {
    const store = memoryStore()
    const player = createClipPlayer(async () => new Blob(['audio']), text => text, store)

    await player.prefetch!('Sing now.', options)

    expect([...store.saved.keys()]).toEqual(['Sing now.'])
    expect(store.saved.get('Sing now.')?.text).toBe('Sing now.')
  })

  it('plays a stored clip without paying for it again', async () => {
    const store = memoryStore()
    const synthesize = vi.fn(async () => new Blob(['audio']))
    const first = createClipPlayer(synthesize, text => text, store)
    await first.prefetch!('Sing now.', options)

    const afterReload = createClipPlayer(synthesize, text => text, store)
    const clip = await afterReload.prefetch!('Sing now.', options)

    expect(synthesize).toHaveBeenCalledTimes(1)
    expect(clip.downloadUrl).toMatch(/^blob:/)
  })

  it('exposes its cache key so callers can ask the store what is missing', async () => {
    const player = createClipPlayer(async () => new Blob(['audio']), (text, opts) => `${text}|${opts.accent.code}`)
    expect(player.cacheKey!('Sing now.', options)).toBe('Sing now.|GA')
  })
})
