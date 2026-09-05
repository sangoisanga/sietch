import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Drill } from '../types'

const drill: Drill = {
  theme: 'The Beatles',
  accent: 'RP',
  sentences: [{ en: 'Sing now.', ipa: '/ˈsɪŋ ˈnaʊ/', vi: 'Hát đi.', tips: [] }],
  anchors: {},
}

function respondWith(body: unknown, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response)
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(async () => {
  vi.resetModules()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => vi.unstubAllGlobals())

const importPacks = () => import('./packs')

describe('loadPack', () => {
  it('fetches once and serves later calls from cache', async () => {
    fetchMock.mockImplementation(() => respondWith(drill))
    const { loadPack } = await importPacks()

    await loadPack('beatles')
    await loadPack('beatles')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('packs/beatles.json')
  })

  it('hands out a copy, so editing the open drill cannot corrupt the cache', async () => {
    fetchMock.mockImplementation(() => respondWith(drill))
    const { loadPack } = await importPacks()

    const first = await loadPack('beatles')
    first.sentences.length = 0

    expect((await loadPack('beatles')).sentences).toHaveLength(1)
  })

  it('names the file when the host answers a missing pack with html', async () => {
    fetchMock.mockImplementation(() => Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError('Unexpected token <')),
    } as unknown as Response))
    const { loadPack } = await importPacks()

    await expect(loadPack('nope')).rejects.toThrow(/nope\.json \(not JSON\)/)
  })

  it('names the missing file when the fetch fails', async () => {
    fetchMock.mockImplementation(() => respondWith(null, false, 404))
    const { loadPack } = await importPacks()

    await expect(loadPack('nope')).rejects.toThrow(/nope\.json \(404\)/)
  })
})

describe('loadManifest', () => {
  it('fetches once and shares the request', async () => {
    fetchMock.mockImplementation(() => respondWith({ packs: [], pools: [] }))
    const { loadManifest } = await importPacks()

    await Promise.all([loadManifest(), loadManifest()])

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not cache a failure, so a later call can still succeed', async () => {
    fetchMock.mockImplementationOnce(() => respondWith(null, false, 500))
    const { loadManifest } = await importPacks()

    await expect(loadManifest()).rejects.toThrow(/manifest\.json \(500\)/)

    fetchMock.mockImplementation(() => respondWith({ packs: [], pools: [] }))
    await expect(loadManifest()).resolves.toEqual({ packs: [], pools: [] })
  })
})
