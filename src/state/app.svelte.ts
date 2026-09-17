import { itemKey } from '../content/pool'
import { DEFAULT_ACCENT, resolveAccent } from '../core/accents'
import { auditIPA } from '../core/audit'
import { DEFAULT_SETTINGS, type Settings } from '../core/settings'
import { DEFAULT_SHADOW_PACE } from '../core/shadow'
import { countWords } from '../core/text'
import type { PoolRecord } from '../data/db'
import type { SpeakOptions } from '../providers/tts/types'
import type { Drill, Profile } from '../types'

export type StatusKind = '' | 'err' | 'shadow'

export interface PackChoice {
  poolId: string
  packId: string
  title: string
}

export type ExerciseSource =
  | { kind: 'pool'; poolId: string; packId: string }
  | { kind: 'library'; entryId: string }

export const exerciseId = (from: ExerciseSource): string =>
  from.kind === 'pool' ? `${from.poolId}/${from.packId}` : from.entryId

export const exerciseItemKey = (from: ExerciseSource): string =>
  itemKey({ kind: 'passage', packId: from.kind === 'pool' ? from.packId : from.entryId })

export interface ScheduledItem {
  poolId: string
  packId: string
  title: string
  period: string
}

export interface Clip {
  downloadUrl: string
  durationSeconds: number
}

export interface TaskState {
  label: string
  detail: string
  done: number
  total: number
  startedAt: number
  sand: number
}

export const emptyDrill = (): Drill => ({ theme: '', accent: DEFAULT_ACCENT, sentences: [], anchors: {} })

class AppState {
  drill = $state<Drill>(emptyDrill())
  settings = $state<Settings>({ ...DEFAULT_SETTINGS })
  profile = $state<Profile | null>(null)
  profiles = $state<Profile[]>([])
  pools = $state<PoolRecord[]>([])
  packChoices = $state<PackChoice[]>([])
  scheduled = $state<ScheduledItem | null>(null)
  completedToday = $state(false)
  open = $state<ExerciseSource | null>(null)
  library = $state<(Drill & { entryId: string })[]>([])
  shadowPace = $state(DEFAULT_SHADOW_PACE)

  toggles = $state({ ipa: true, vi: false, anchor: true, shadow: false })
  playing = $state(false)
  stopRequested = false

  status = $state({ message: 'Ready.', kind: '' as StatusKind })
  progress = $state(0)
  activeCard = $state(-1)
  resumeAt = $state(-1)
  litWord = $state(-1)
  openNote = $state({ card: -1, word: -1 })
  clips = $state<Record<number, Clip>>({})
  audioReady = $state<Set<string>>(new Set())
  task = $state<TaskState | null>(null)

  audit = $derived(auditIPA(
    this.drill.sentences.map(sentence => sentence.ipa ?? '').join(' '),
    resolveAccent(this.drill.accent),
  ))

  exerciseChoices = $derived([
    ...this.packChoices.map(choice => ({ id: `${choice.poolId}/${choice.packId}`, title: choice.title })),
    ...this.library.map(entry => ({ id: entry.entryId, title: entry.theme })),
  ])

  words = $derived(countWords(this.drill.sentences))
  missingAudio = $derived(this.drill.sentences.filter(sentence => !this.audioReady.has(sentence.en)).length)
}

export const app = new AppState()

export const speakOptions = (): SpeakOptions => ({
  accent: resolveAccent(app.drill.accent),
  rate: app.settings.rate,
})

export function setStatus(message: string, kind: StatusKind = ''): void {
  app.status = { message, kind }
}
