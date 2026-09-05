import { describe, expect, it } from 'vitest'
import { DEFAULT_SHADOW_PACE, estimatedShadowGapMs, shadowGapMs, SHADOW_PACE_CHOICES } from './shadow'

describe('shadowGapMs', () => {
  const cases = [
    { name: 'default pace reproduces the gap v1 gave', duration: 4, rate: 1, pace: DEFAULT_SHADOW_PACE, expected: 4600 },
    { name: 'a short clip at default pace', duration: 1.2, rate: 1, pace: DEFAULT_SHADOW_PACE, expected: 1380 },
    { name: 'doubling the pace doubles the gap', duration: 4, rate: 1, pace: 2.3, expected: 9200 },
    { name: 'a slower playback rate lengthens the gap', duration: 4, rate: 0.5, pace: DEFAULT_SHADOW_PACE, expected: 9200 },
    { name: 'the slowest choice gives a four second clip ten seconds', duration: 4, rate: 1, pace: 2.5, expected: 10000 },
  ]

  for (const { name, duration, rate, pace, expected } of cases) {
    it(name, () => expect(shadowGapMs(duration, rate, pace)).toBeCloseTo(expected, 5))
  }

  it('grows with every step up the choices', () => {
    const gaps = SHADOW_PACE_CHOICES.map(pace => shadowGapMs(4, 1, pace))
    expect(gaps).toEqual([...gaps].sort((a, b) => a - b))
    expect(new Set(gaps).size).toBe(SHADOW_PACE_CHOICES.length)
  })
})

describe('estimatedShadowGapMs', () => {
  it('keeps the 70ms per character v1 used at the default pace', () => {
    expect(estimatedShadowGapMs('x'.repeat(50), DEFAULT_SHADOW_PACE)).toBeCloseTo(3500, 5)
  })

  it('scales with pace', () => {
    const base = estimatedShadowGapMs('a longer sentence to read aloud', DEFAULT_SHADOW_PACE)
    expect(estimatedShadowGapMs('a longer sentence to read aloud', DEFAULT_SHADOW_PACE * 2)).toBeCloseTo(base * 2, 5)
  })

  it('scales with length', () => {
    expect(estimatedShadowGapMs('abcd', DEFAULT_SHADOW_PACE))
      .toBeCloseTo(estimatedShadowGapMs('ab', DEFAULT_SHADOW_PACE) * 2, 5)
  })
})

describe('the choices', () => {
  it('starts at the default so the first option changes nothing', () => {
    expect(SHADOW_PACE_CHOICES[0]).toBe(DEFAULT_SHADOW_PACE)
  })
})
