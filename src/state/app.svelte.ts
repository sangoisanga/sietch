import { DEFAULT_ACCENT, resolveAccent } from '../core/accents'
import { auditIPA } from '../core/audit'
import { DEFAULT_SETTINGS, type Settings } from '../core/settings'
import { DEFAULT_SHADOW_PACE } from '../core/shadow'
import { countWords } from '../core/text'
import type { PoolRecord } from '../data/db'
import type { Drill, Profile } from '../types'

export type StatusKind = '' | 'err' | 'shadow'

export interface PackChoice {
  poolId: string
  packId: string
  title: string
}

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
  openPackId = $state('')
  library = $state<(Drill & { entryId: string })[]>([])
  shadowPace = $state(DEFAULT_SHADOW_PACE)

  toggles = $state({ ipa: true, vi: true, anchor: true, shadow: false })
  playing = $state(false)
  stopRequested = false

  status = $state({ message: 'Ready.', kind: '' as StatusKind })
  progress = $state(0)
  activeCard = $state(-1)
  litWord = $state(-1)
  openNote = $state({ card: -1, word: -1 })
  clips = $state<Record<number, Clip>>({})
  task = $state<TaskState | null>(null)

  audit = $derived(auditIPA(
    this.drill.sentences.map(sentence => sentence.ipa ?? '').join(' '),
    resolveAccent(this.drill.accent),
  ))

  words = $derived(countWords(this.drill.sentences))
  canMarkDone = $derived(this.scheduled !== null && !this.completedToday)
}

export const app = new AppState()

export function setStatus(message: string, kind: StatusKind = ''): void {
  app.status = { message, kind }
}
