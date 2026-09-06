import { dayKey } from './period'

export type Rating = 'again' | 'hard' | 'good' | 'easy'

export const RATINGS: { value: Rating; label: string }[] = [
  { value: 'again', label: 'Again' },
  { value: 'hard', label: 'Hard' },
  { value: 'good', label: 'Good' },
  { value: 'easy', label: 'Easy' },
]

export interface ReviewState {
  interval: number
  ease: number
  reps: number
  lapses: number
  due: string
}

export const NEW_REVIEW: ReviewState = { interval: 0, ease: 2.5, reps: 0, lapses: 0, due: '' }

const MIN_EASE = 1.3

const EASE_CHANGE: Record<Rating, number> = { again: -0.2, hard: -0.15, good: 0, easy: 0.15 }

function nextInterval(state: ReviewState, rating: Rating): number {
  if (rating === 'again') return 0
  if (rating === 'hard') return Math.max(1, Math.round(state.interval * 1.2))

  const ladder = rating === 'easy' ? [4, 8] : [1, 6]
  if (state.reps < ladder.length) return ladder[state.reps]!
  return Math.max(1, Math.round(state.interval * state.ease * (rating === 'easy' ? 1.3 : 1)))
}

function addDays(from: string, days: number): string {
  const date = new Date(`${from}T00:00:00`)
  date.setDate(date.getDate() + days)
  return dayKey(date)
}

export function nextReview(state: ReviewState, rating: Rating, today: string): ReviewState {
  const interval = nextInterval(state, rating)
  return {
    interval,
    ease: Math.max(MIN_EASE, Number((state.ease + EASE_CHANGE[rating]).toFixed(2))),
    reps: rating === 'again' ? state.reps : state.reps + 1,
    lapses: rating === 'again' ? state.lapses + 1 : state.lapses,
    due: addDays(today, interval),
  }
}

export function isDue(state: ReviewState | undefined, today: string): boolean {
  return state === undefined || state.due <= today
}

export function daysUntilDue(state: ReviewState, today: string): number {
  return Math.round((new Date(`${state.due}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000)
}
