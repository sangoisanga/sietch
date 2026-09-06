import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ACCENTS } from '../../core/accents'
import { createClipPlayer } from './clipPlayer'

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
