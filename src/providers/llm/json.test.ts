import { describe, expect, it } from 'vitest'
import { parseLooseJson } from './json'

describe('parseLooseJson', () => {
  const cases = [
    { name: 'bare json', text: '{"theme":"Rumi"}', expected: { theme: 'Rumi' } },
    { name: 'fenced json', text: '```json\n{"theme":"Rumi"}\n```', expected: { theme: 'Rumi' } },
    { name: 'json wrapped in prose', text: 'Sure! Here you go:\n{"theme":"Rumi"}\nHope that helps.', expected: { theme: 'Rumi' } },
    { name: 'nested braces', text: 'x {"a":{"b":[1,2]}} y', expected: { a: { b: [1, 2] } } },
  ]

  for (const { name, text, expected } of cases) {
    it(name, () => expect(parseLooseJson(text)).toEqual(expected))
  }

  it('rejects a response with no object at all', () => {
    expect(() => parseLooseJson('I cannot help with that.')).toThrow(/did not return JSON/)
  })
})
