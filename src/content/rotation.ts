import { isDue, type ReviewState } from '../core/srs'
import type { Progress } from '../types'
import { itemKey, type Pool, type PoolItem } from './pool'

function hash(seed: string): number {
  let value = 2166136261
  for (let i = 0; i < seed.length; i++) {
    value ^= seed.charCodeAt(i)
    value = Math.imul(value, 16777619)
  }
  return value >>> 0
}

// a weekly pool's period is an ISO week, which cannot be compared to a due date, so today comes separately
export function drawForPeriod(
  pool: Pool,
  progress: Progress,
  period: string,
  profileId: string,
  reviews: Record<string, ReviewState> = {},
  today = period,
): PoolItem | null {
  if (!pool.items.length) return null

  const assigned = progress.assignments[period]
  const standing = pool.items.find(item => itemKey(item) === assigned)
  if (standing) return standing

  const overdue = pool.items
    .filter(item => reviews[itemKey(item)] && isDue(reviews[itemKey(item)], today))
    .sort((a, b) => reviews[itemKey(a)]!.due.localeCompare(reviews[itemKey(b)]!.due))
  if (overdue[0]) return overdue[0]

  const unseen = pool.items.filter(item => !progress.completed[itemKey(item)])
  if (unseen.length) return unseen[hash(profileId + period) % unseen.length]!

  // the pool is exhausted, so it cycles: whatever was finished longest ago comes back first
  return [...pool.items].sort((a, b) =>
    (progress.completed[itemKey(a)] ?? '').localeCompare(progress.completed[itemKey(b)] ?? ''))[0]!
}

export function withAssignment(progress: Progress, period: string, item: PoolItem): Progress {
  return { ...progress, assignments: { ...progress.assignments, [period]: itemKey(item) } }
}

export function withCompletion(progress: Progress, item: PoolItem, isoDate: string): Progress {
  return { ...progress, completed: { ...progress.completed, [itemKey(item)]: isoDate } }
}
