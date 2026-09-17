import { resolveAccent } from '../core/accents'
import { dayKey } from '../core/period'
import { daysUntilDue, type ReviewState } from '../core/srs'
import { countWords } from '../core/text'
import { cachedKeys } from '../data/audioClips'
import { listPools, loadDrill } from '../data/pools'
import { loadProgress } from '../data/progress'
import { loadReviews } from '../data/reviews'
import type { AccentCode, Drill, Progress } from '../types'
import { providers } from './actions'
import { app, exerciseId, exerciseItemKey, type ExerciseSource } from './app.svelte'

export type AudioState = 'none' | 'partial' | 'ready'

export interface ExerciseEntry {
  id: string
  from: ExerciseSource
  title: string
  accent: AccentCode
  sentences: number
  words: number
  audio: AudioState
  completedOn: string
  dueInDays: number | null
}

async function audioStates(drills: Drill[]): Promise<AudioState[]> {
  const { cacheKey } = providers.activeTts()
  if (!cacheKey) return drills.map(() => 'none')

  const perDrill = drills.map(drill => drill.sentences.map(sentence =>
    cacheKey(sentence.en, { accent: resolveAccent(drill.accent), rate: app.settings.rate })))
  const cached = await cachedKeys(perDrill.flat())

  return perDrill.map(keys => {
    const hits = keys.filter(key => cached.has(key)).length
    if (!hits) return 'none'
    return hits === keys.length ? 'ready' : 'partial'
  })
}

function describe(
  drill: Drill,
  from: ExerciseSource,
  progress: Progress,
  reviews: Record<string, ReviewState>,
  today: string,
): Omit<ExerciseEntry, 'audio'> {
  const key = exerciseItemKey(from)
  const review = reviews[key]
  return {
    id: exerciseId(from),
    from,
    title: drill.theme,
    accent: drill.accent,
    sentences: drill.sentences.length,
    words: countWords(drill.sentences),
    completedOn: progress.completed[key] ?? '',
    dueInDays: review ? daysUntilDue(review, today) : null,
  }
}

export async function listExercises(): Promise<ExerciseEntry[]> {
  const progress = app.profile ? await loadProgress(app.profile.id) : { completed: {}, assignments: {} }
  const reviews = app.profile ? await loadReviews(app.profile.id) : {}
  const today = dayKey(new Date())
  const found: { drill: Drill; entry: Omit<ExerciseEntry, 'audio'> }[] = []

  for (const pool of await listPools()) {
    for (const packId of pool.packIds) {
      const drill = await loadDrill(pool.id, packId)
      found.push({ drill, entry: describe(drill, { kind: 'pool', poolId: pool.id, packId }, progress, reviews, today) })
    }
  }

  for (const { entryId, ...drill } of app.library) {
    found.push({ drill, entry: describe(drill, { kind: 'library', entryId }, progress, reviews, today) })
  }

  const audio = await audioStates(found.map(item => item.drill))
  return found
    .map((item, index) => ({ ...item.entry, audio: audio[index]! }))
    .sort((a, b) => (a.dueInDays ?? Number.MAX_SAFE_INTEGER) - (b.dueInDays ?? Number.MAX_SAFE_INTEGER))
}

export function matchesSearch(entry: ExerciseEntry, search: string): boolean {
  const needle = search.trim().toLowerCase()
  if (!needle) return true
  return `${entry.title} ${entry.accent}`.toLowerCase().includes(needle)
}
