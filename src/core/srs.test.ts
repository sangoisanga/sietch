import { describe, expect, it } from 'vitest'
import { daysUntilDue, isDue, nextReview, NEW_REVIEW, type ReviewState } from './srs'

const TODAY = '2026-09-06'

describe('nextReview', () => {
  it('walks the good ladder 1 → 6 → interval × ease', () => {
    const first = nextReview(NEW_REVIEW, 'good', TODAY)
    expect(first).toMatchObject({ interval: 1, reps: 1, due: '2026-09-07' })

    const second = nextReview(first, 'good', '2026-09-07')
    expect(second).toMatchObject({ interval: 6, reps: 2, due: '2026-09-13' })

    const third = nextReview(second, 'good', '2026-09-13')
    expect(third.interval).toBe(15)
    expect(third.due).toBe('2026-09-28')
  })

  it('sends a lapse back to today and counts it, keeping the reps already earned', () => {
    const learned = nextReview(nextReview(NEW_REVIEW, 'good', TODAY), 'good', TODAY)
    const lapsed = nextReview(learned, 'again', TODAY)

    expect(lapsed).toMatchObject({ interval: 0, due: TODAY, lapses: 1, reps: learned.reps })
    expect(lapsed.ease).toBeCloseTo(learned.ease - 0.2)
  })

  it('never lets the ease fall below the floor, however often it is failed', () => {
    let state: ReviewState = NEW_REVIEW
    for (let round = 0; round < 20; round++) state = nextReview(state, 'again', TODAY)
    expect(state.ease).toBe(1.3)
  })

  it('rewards easy with a longer step than good', () => {
    expect(nextReview(NEW_REVIEW, 'easy', TODAY).interval).toBe(4)
    expect(nextReview(NEW_REVIEW, 'hard', TODAY).interval).toBe(1)
  })

  it('crosses a month boundary without inventing a date', () => {
    const state = { ...NEW_REVIEW, interval: 6, reps: 2 }
    expect(nextReview(state, 'good', '2026-09-28').due).toBe('2026-10-13')
  })
})

describe('due dates', () => {
  it('treats an unreviewed exercise as due', () => {
    expect(isDue(undefined, TODAY)).toBe(true)
  })

  it('is due on the day itself, not the day after', () => {
    expect(isDue({ ...NEW_REVIEW, due: TODAY }, TODAY)).toBe(true)
    expect(isDue({ ...NEW_REVIEW, due: '2026-09-07' }, TODAY)).toBe(false)
  })

  it('counts the days left', () => {
    expect(daysUntilDue({ ...NEW_REVIEW, due: '2026-09-13' }, TODAY)).toBe(7)
    expect(daysUntilDue({ ...NEW_REVIEW, due: '2026-09-01' }, TODAY)).toBe(-5)
  })
})
