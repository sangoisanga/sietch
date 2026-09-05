import type { Pool } from '../content/pool'

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

const pad = (value: number) => String(value).padStart(2, '0')

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// ISO 8601: weeks run Monday–Sunday and belong to the year containing their Thursday
export function isoWeekKey(date: Date): string {
  const thursdayOfWeek = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  thursdayOfWeek.setDate(thursdayOfWeek.getDate() - ((thursdayOfWeek.getDay() + 6) % 7) + 3)

  const firstThursday = new Date(thursdayOfWeek.getFullYear(), 0, 4)
  firstThursday.setDate(firstThursday.getDate() - ((firstThursday.getDay() + 6) % 7) + 3)

  const week = 1 + Math.round((thursdayOfWeek.getTime() - firstThursday.getTime()) / MS_PER_WEEK)
  return `${thursdayOfWeek.getFullYear()}-W${pad(week)}`
}

export function periodKey(cadence: Pool['cadence'], date: Date): string {
  return cadence === 'weekly' ? isoWeekKey(date) : dayKey(date)
}
