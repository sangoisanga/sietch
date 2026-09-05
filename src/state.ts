import { loadPack } from './content'
import { resolveAccent } from './core/accents'
import { auditIPA, type AuditResult } from './core/audit'
import { loadSettings, saveSettings, type Settings } from './core/settings'
import type { Drill } from './types'

export interface Toggles {
  ipa: boolean
  vi: boolean
  anchor: boolean
  shadow: boolean
}

function auditOf(drill: Drill): AuditResult {
  return auditIPA(drill.sentences.map(sentence => sentence.ipa ?? '').join(' '), resolveAccent(drill.accent))
}

const openingDrill = loadPack()

export const state = {
  drill: openingDrill,
  audit: auditOf(openingDrill),
  settings: loadSettings(),
  toggles: { ipa: true, vi: true, anchor: true, shadow: false } as Toggles,
  playing: false,
  stopRequested: false,
}

export function setDrill(drill: Drill): void {
  state.drill = drill
  state.audit = auditOf(drill)
}

export function updateSettings(patch: Partial<Settings>): void {
  state.settings = { ...state.settings, ...patch }
  saveSettings(state.settings)
}
