import { describe, expect, it } from 'vitest'
import { dayKey, isoWeekKey, periodKey } from './period'

const at = (iso: string) => new Date(`${iso}T12:00:00`)

describe('isoWeekKey', () => {
  const cases = [
    { name: 'Jan 1 on a Thursday starts week 1 of its own year', date: '2026-01-01', expected: '2026-W01' },
    { name: 'Jan 1 on a Friday belongs to the last week of the year before', date: '2027-01-01', expected: '2026-W53' },
    { name: 'Dec 30 on a Monday belongs to week 1 of the next year', date: '2024-12-30', expected: '2025-W01' },
    { name: 'Dec 31 on a Thursday stays in its own year', date: '2015-12-31', expected: '2015-W53' },
    { name: 'Sunday closes the week it started, not the one it touches', date: '2021-01-03', expected: '2020-W53' },
    { name: 'the Monday after opens week 1', date: '2021-01-04', expected: '2021-W01' },
    { name: 'a leap day resolves normally', date: '2020-02-29', expected: '2020-W09' },
  ]

  for (const { name, date, expected } of cases) {
    it(name, () => expect(isoWeekKey(at(date))).toBe(expected))
  }

  it('gives every day of one week the same key', () => {
    const keys = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13']
      .map(date => isoWeekKey(at(date)))
    expect(new Set(keys).size).toBe(1)
  })
})

describe('dayKey', () => {
  it('pads month and day', () => expect(dayKey(at('2026-01-05'))).toBe('2026-01-05'))
  it('reads the local date, not UTC', () => expect(dayKey(new Date(2026, 8, 5, 23, 30))).toBe('2026-09-05'))
})

describe('periodKey', () => {
  it('picks the cadence', () => {
    expect(periodKey('daily', at('2026-09-05'))).toBe('2026-09-05')
    expect(periodKey('weekly', at('2026-09-05'))).toBe('2026-W36')
  })
})
