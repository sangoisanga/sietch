import { describe, expect, it } from 'vitest'
import { NEW_REVIEW, type ReviewState } from '../core/srs'
import type { Progress } from '../types'
import { itemKey, type Pool } from './pool'
import { drawForPeriod, withAssignment, withCompletion } from './rotation'

const pool = (...packIds: string[]): Pool => ({
  id: 'daily-passages',
  title: 'Daily passage',
  cadence: 'daily',
  items: packIds.map(packId => ({ kind: 'passage', packId })),
})

const empty = (): Progress => ({ completed: {}, assignments: {} })

const TWELVE = pool('beatles', 'dylan', 'cohen', 'andersen', 'aesop', 'grimm', 'holmes', 'ghibli', 'pratchett', 'rumi', 'austen', 'floyd')

describe('drawForPeriod with reviews', () => {
  const review = (due: string): ReviewState => ({ ...NEW_REVIEW, due, reps: 1, interval: 1 })

  it('brings back the most overdue pack before anything new', () => {
    const reviews = { 'passage:rumi': review('2026-09-01'), 'passage:dylan': review('2026-09-04') }
    expect(drawForPeriod(TWELVE, empty(), '2026-09-05', 'sang', reviews))
      .toEqual({ kind: 'passage', packId: 'rumi' })
  })

  it('leaves a pack alone until the day it falls due', () => {
    const reviews = { 'passage:rumi': review('2026-09-09') }
    expect(drawForPeriod(TWELVE, empty(), '2026-09-05', 'sang', reviews))
      .not.toEqual({ kind: 'passage', packId: 'rumi' })

    expect(drawForPeriod(TWELVE, empty(), '2026-09-09', 'sang', reviews))
      .toEqual({ kind: 'passage', packId: 'rumi' })
  })

  it('compares due dates against today, not against a weekly period key', () => {
    const weekly: Pool = { ...TWELVE, cadence: 'weekly' }
    const reviews = { 'passage:rumi': review('2026-09-01') }
    expect(drawForPeriod(weekly, empty(), '2026-W37', 'sang', reviews, '2026-09-06'))
      .toEqual({ kind: 'passage', packId: 'rumi' })
  })

  it('keeps drawing as it always did when nothing has been rated', () => {
    expect(drawForPeriod(TWELVE, empty(), '2026-09-05', 'sang', {}))
      .toEqual(drawForPeriod(TWELVE, empty(), '2026-09-05', 'sang'))
  })
})

describe('drawForPeriod', () => {
  it('returns null for an empty pool', () => {
    expect(drawForPeriod(pool(), empty(), '2026-09-05', 'sang')).toBeNull()
  })

  it('is stable for the same profile and period', () => {
    const first = drawForPeriod(TWELVE, empty(), '2026-09-05', 'sang')
    const second = drawForPeriod(TWELVE, empty(), '2026-09-05', 'sang')
    expect(first).toEqual(second)
  })

  it('honours a standing assignment even after other items are completed', () => {
    let progress = empty()
    const drawn = drawForPeriod(TWELVE, progress, '2026-09-05', 'sang')!
    progress = withAssignment(progress, '2026-09-05', drawn)

    for (const item of TWELVE.items) {
      if (itemKey(item) !== itemKey(drawn)) progress = withCompletion(progress, item, '2026-09-04')
    }

    expect(drawForPeriod(TWELVE, progress, '2026-09-05', 'sang')).toEqual(drawn)
  })

  it('gives two profiles different work across a month', () => {
    const days = Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`)
    const forProfile = (id: string) => days.map(day => itemKey(drawForPeriod(TWELVE, empty(), day, id)!))

    const sang = forProfile('sang')
    const wife = forProfile('wife')
    const sameDayCollisions = sang.filter((item, index) => item === wife[index]).length

    expect(sameDayCollisions).toBeLessThan(days.length)
  })

  it('never repeats until the pool is exhausted', () => {
    let progress = empty()
    const seen: string[] = []

    for (let day = 1; day <= TWELVE.items.length; day++) {
      const period = `2026-09-${String(day).padStart(2, '0')}`
      const drawn = drawForPeriod(TWELVE, progress, period, 'sang')!
      seen.push(itemKey(drawn))
      progress = withCompletion(progress, drawn, period)
    }

    expect(new Set(seen).size).toBe(TWELVE.items.length)
  })

  it('brings back the oldest completion once everything is seen', () => {
    let progress = empty()
    const small = pool('rumi', 'floyd')
    progress = withCompletion(progress, small.items[0]!, '2026-01-01')
    progress = withCompletion(progress, small.items[1]!, '2026-06-01')

    expect(drawForPeriod(small, progress, '2026-09-05', 'sang')).toEqual(small.items[0])
  })

  it('ignores an assignment pointing at an item no longer in the pool', () => {
    const progress = { completed: {}, assignments: { '2026-09-05': 'passage:removed' } }
    expect(drawForPeriod(TWELVE, progress, '2026-09-05', 'sang')).not.toBeNull()
  })
})

describe('progress updates', () => {
  it('does not mutate the progress handed in', () => {
    const original = empty()
    withCompletion(original, TWELVE.items[0]!, '2026-09-05')
    withAssignment(original, '2026-09-05', TWELVE.items[0]!)
    expect(original).toEqual({ completed: {}, assignments: {} })
  })
})
