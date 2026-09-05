import { expect, it } from 'vitest'
import { DEFAULT_PACK, PACKS, loadPack } from './index'

it('discovers every json in the content folder', () => {
  expect(Object.keys(PACKS)).toContain(DEFAULT_PACK)
})

it('falls back to the default pack for an unknown name', () => {
  expect(loadPack('nope').theme).toBe('The Beatles')
})

it('hands out a copy, so editing the drill cannot corrupt the pack', () => {
  loadPack().sentences.length = 0
  expect(loadPack().sentences.length).toBeGreaterThan(0)
})
