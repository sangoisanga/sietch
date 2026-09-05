import { describe, expect, it } from 'vitest'
import { base64ToBytes, pcmToWav, sampleRateFromMimeType } from './wav'

const ascii = (view: DataView, offset: number, length: number) =>
  Array.from({ length }, (_, i) => String.fromCharCode(view.getUint8(offset + i))).join('')

describe('pcmToWav', () => {
  it('writes a 44-byte canonical header for 24kHz mono 16-bit', async () => {
    const pcm = new Uint8Array(100)
    const buffer = await pcmToWav(pcm, 24000).arrayBuffer()
    const view = new DataView(buffer)

    expect(buffer.byteLength).toBe(144)
    expect(ascii(view, 0, 4)).toBe('RIFF')
    expect(view.getUint32(4, true)).toBe(136)
    expect(ascii(view, 8, 4)).toBe('WAVE')
    expect(ascii(view, 12, 4)).toBe('fmt ')
    expect(view.getUint32(16, true)).toBe(16)
    expect(view.getUint16(20, true)).toBe(1)
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(24, true)).toBe(24000)
    expect(view.getUint32(28, true)).toBe(48000)
    expect(view.getUint16(32, true)).toBe(2)
    expect(view.getUint16(34, true)).toBe(16)
    expect(ascii(view, 36, 4)).toBe('data')
    expect(view.getUint32(40, true)).toBe(100)
  })

  it('keeps the samples intact after the header', async () => {
    const pcm = new Uint8Array([1, 2, 3, 250])
    const buffer = await pcmToWav(pcm, 16000).arrayBuffer()
    expect([...new Uint8Array(buffer, 44)]).toEqual([1, 2, 3, 250])
  })
})

describe('sampleRateFromMimeType', () => {
  const cases = [
    { mimeType: 'audio/L16;codec=pcm;rate=24000', expected: 24000 },
    { mimeType: 'audio/L16;rate=16000', expected: 16000 },
    { mimeType: 'audio/L16;codec=pcm', expected: 24000 },
    { mimeType: undefined, expected: 24000 },
  ]

  for (const { mimeType, expected } of cases) {
    it(`${mimeType ?? 'missing mime type'} → ${expected}`, () => {
      expect(sampleRateFromMimeType(mimeType)).toBe(expected)
    })
  }
})

describe('base64ToBytes', () => {
  it('decodes to raw bytes', () => {
    expect([...base64ToBytes(btoa('abc'))]).toEqual([97, 98, 99])
  })
})
