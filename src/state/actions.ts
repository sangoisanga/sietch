import { itemKey } from '../content/pool'
import { POOL_EXTENSION, type PoolFile } from '../content/poolFile'
import { drawForPeriod } from '../content/rotation'
import { validatePool, type PoolReport } from '../content/validatePool'
import { resolveAccent } from '../core/accents'
import { dayKey, periodKey } from '../core/period'
import { buildAnnotatePrompt, buildForgePrompt } from '../core/prompts'
import { countWords, splitSentences } from '../core/text'
import { loadLibrary, removeFromLibrary, saveToLibrary } from '../data/library'
import { migrateFromLocalStorage } from '../data/migrate'
import { exportProfile, importProfile } from '../data/profileTransfer'
import {
  activeProfile, createProfile, deleteProfile, listProfiles, renameProfile, setActiveProfile,
} from '../data/profiles'
import { exportPool, findConflict, installPool, listPools, loadDrill, toRotationPool, type InstallDecision } from '../data/pools'
import { assignForPeriod, loadProgress, markCompleted } from '../data/progress'
import { loadSettings, saveSettings } from '../data/settings'
import { GeminiError, MISSING_KEY } from '../providers/gemini/client'
import { createProviders } from '../providers'
import type { AccentCode, Drill, Sentence } from '../types'
import { STRINGS } from '../ui/strings'
import { app, setStatus, type PackChoice } from './app.svelte'

const STARTER_POOL_URL = `${import.meta.env.BASE_URL}pools/starter${POOL_EXTENSION}`
const STARTER_POOL_ID = 'drill-forge-starter'

export const providers = createProviders({
  getSettings: () => app.settings,
  rememberTextModel: model => void updateSettings({ textModel: model }),
})

export function reportError(error: unknown): void {
  if (error instanceof GeminiError && error.message === MISSING_KEY) {
    setStatus(STRINGS.missingKey, 'err')
    return
  }
  setStatus(STRINGS.failed(error instanceof Error ? error.message : String(error)), 'err')
}

function toSentence(raw: unknown): Sentence | null {
  const source = raw as Partial<Sentence> | null
  if (!source || typeof source.en !== 'string' || !source.en.trim()) return null
  return {
    en: source.en,
    ipa: typeof source.ipa === 'string' ? source.ipa : '',
    vi: typeof source.vi === 'string' ? source.vi : '',
    tips: Array.isArray(source.tips) ? source.tips.filter(tip => typeof tip === 'string') : [],
  }
}

function toDrill(raw: unknown, fallbackTheme: string, accent: AccentCode): Drill {
  const source = raw as { theme?: unknown; anchors?: unknown; sentences?: unknown }
  const sentences = Array.isArray(source.sentences)
    ? source.sentences.map(toSentence).filter((sentence): sentence is Sentence => sentence !== null)
    : []
  if (!sentences.length) throw new Error(STRINGS.missingSentences)

  const anchors = source.anchors && typeof source.anchors === 'object' ? source.anchors as Record<string, string> : {}
  return { theme: typeof source.theme === 'string' && source.theme ? source.theme : fallbackTheme, accent, sentences, anchors }
}

export function present(drill: Drill): void {
  providers.tts.forEach(provider => provider.release?.())
  app.drill = drill
  app.clips = {}
  app.activeCard = -1
  app.litWord = -1
  app.openNote = { card: -1, word: -1 }
}

async function refreshPacks(): Promise<void> {
  const pools = await listPools()
  app.pools = pools

  const choices: PackChoice[] = []
  for (const pool of pools) {
    for (const packId of pool.packIds) {
      const drill = await loadDrill(pool.id, packId)
      choices.push({ poolId: pool.id, packId, title: drill.theme })
    }
  }
  app.packChoices = choices
}

async function refreshScheduled(): Promise<void> {
  app.scheduled = null
  app.completedToday = false

  const profile = app.profile
  const daily = app.pools.find(pool => pool.cadence === 'daily')
  if (!profile || !daily) return

  const pool = await toRotationPool(daily.id)
  if (!pool) return

  const period = periodKey(pool.cadence, new Date())
  const progress = await loadProgress(profile.id)
  const item = drawForPeriod(pool, progress, period, profile.id)
  if (!item) return

  await assignForPeriod(profile.id, period, itemKey(item))
  const title = app.packChoices.find(choice => choice.poolId === daily.id && choice.packId === item.packId)?.title ?? item.packId
  app.scheduled = { poolId: daily.id, packId: item.packId, title, period }
  app.completedToday = progress.completed[itemKey(item)] !== undefined
}

export async function openPack(poolId: string, packId: string): Promise<void> {
  present(await loadDrill(poolId, packId))
  app.openPackId = `${poolId}/${packId}`
  setStatus(STRINGS.opened(app.drill.theme))
}

export async function openScheduled(): Promise<void> {
  if (!app.scheduled) return
  await openPack(app.scheduled.poolId, app.scheduled.packId)
}

export async function markScheduledDone(): Promise<void> {
  if (!app.scheduled || !app.profile) {
    setStatus(STRINGS.noScheduledItem, 'err')
    return
  }
  if (app.completedToday) {
    setStatus(STRINGS.alreadyDone)
    return
  }
  await markCompleted(app.profile.id, `passage:${app.scheduled.packId}`, dayKey(new Date()))
  app.completedToday = true
  setStatus(STRINGS.markedDone(app.scheduled.title))
}

async function ensureStarterPool(): Promise<void> {
  if ((await listPools()).some(pool => pool.id === STARTER_POOL_ID)) return

  const response = await fetch(STARTER_POOL_URL)
  if (!response.ok) throw new Error(`${STRINGS.starterMissing} (${response.status})`)

  let raw: unknown
  try {
    raw = await response.json()
  } catch {
    throw new Error(`${STRINGS.starterMissing} (not JSON)`)
  }

  const report = await validatePool(raw)
  if (!report.ok) throw new Error(`${STRINGS.starterMissing} ${report.errors[0] ?? ''}`)
  await installPool(raw as PoolFile)
}

export async function refreshProfiles(): Promise<void> {
  app.profiles = await listProfiles()
  app.profile = await activeProfile()
}

export async function boot(): Promise<void> {
  setStatus(STRINGS.loading)
  const migration = await migrateFromLocalStorage()

  app.settings = await loadSettings()
  await refreshProfiles()
  await ensureStarterPool()
  await refreshPacks()
  await refreshScheduled()
  app.library = await loadLibrary()

  if (app.scheduled) await openScheduled()
  else if (app.packChoices[0]) await openPack(app.packChoices[0].poolId, app.packChoices[0].packId)

  if (migration.ran && migration.profiles) setStatus(STRINGS.migrated(migration.profiles))
}

export async function switchProfile(id: string): Promise<void> {
  await setActiveProfile(id)
  await refreshProfiles()
  await refreshScheduled()
  // the drill on screen belongs to whoever was drilling before, so follow the new draw
  if (app.scheduled) await openScheduled()
  setStatus(STRINGS.profileSwitched(app.profile?.name ?? ''))
}

export async function addProfile(name: string): Promise<void> {
  if (!name.trim()) {
    setStatus(STRINGS.profileNeedsName, 'err')
    return
  }
  const created = await createProfile(name)
  await switchProfile(created.id)
}

export async function renameActiveProfile(id: string, name: string): Promise<void> {
  await renameProfile(id, name)
  await refreshProfiles()
}

export async function removeProfile(id: string): Promise<void> {
  if (!await deleteProfile(id)) {
    setStatus(STRINGS.lastProfile, 'err')
    return
  }
  await refreshProfiles()
  await refreshScheduled()
  if (app.scheduled) await openScheduled()
}

function downloadJson(filename: string, payload: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  // revoking synchronously can cancel the download before the browser has read the blob
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export async function exportActiveProfile(): Promise<void> {
  if (!app.profile) return
  const payload = await exportProfile(app.profile.id)
  downloadJson(`drill-forge-${app.profile.name.toLowerCase().replace(/\s+/g, '-')}.json`, payload)
  setStatus(STRINGS.profileExported(app.profile.name))
}

export async function importProfileFile(file: File): Promise<void> {
  try {
    const imported = await importProfile(await file.text())
    await switchProfile(imported.id)
    setStatus(STRINGS.profileImported(imported.name))
  } catch (error) {
    reportError(error)
  }
}

export async function inspectPoolFile(file: File): Promise<{ report: PoolReport; raw: unknown; conflict: Awaited<ReturnType<typeof findConflict>> }> {
  let raw: unknown
  try {
    raw = JSON.parse(await file.text())
  } catch {
    return { report: await validatePool(null), raw: null, conflict: null }
  }
  const report = await validatePool(raw)
  const conflict = report.ok ? await findConflict(raw as PoolFile) : null
  return { report, raw, conflict }
}

export async function acceptPool(raw: unknown, decision: InstallDecision): Promise<void> {
  await installPool(raw as PoolFile, decision)
  await refreshPacks()
  await refreshScheduled()
  setStatus(STRINGS.poolInstalled)
}

export async function exportPoolFile(poolId: string): Promise<void> {
  const file = await exportPool(poolId)
  downloadJson(`${poolId}${POOL_EXTENSION}`, file)
  setStatus(STRINGS.profileExported(file.title))
}

export async function updateSettings(patch: Partial<typeof app.settings>): Promise<void> {
  app.settings = { ...app.settings, ...patch }
  await saveSettings(app.settings)
}

export async function saveOpenDrill(): Promise<void> {
  await saveToLibrary(app.drill)
  app.library = await loadLibrary()
  setStatus(STRINGS.savedTo(app.drill.theme))
}

export async function openFromLibrary(entryId: string): Promise<void> {
  const entry = app.library.find(candidate => candidate.entryId === entryId)
  if (!entry) return
  const { entryId: _ignored, ...drill } = entry
  present(drill)
  setStatus(STRINGS.opened(drill.theme))
}

export async function deleteFromLibrary(entryId: string): Promise<void> {
  await removeFromLibrary(entryId)
  app.library = await loadLibrary()
}

export function themeFallback(themeInput: string): string {
  return themeInput.trim() || app.drill.theme || 'The Beatles'
}

export async function forge(themeInput: string, accent: AccentCode, maxWords: string, missing: string[]): Promise<void> {
  const theme = themeFallback(themeInput)
  setStatus(STRINGS.forging)
  const prompt = buildForgePrompt(theme, resolveAccent(accent), maxWords, missing)
  const raw = await providers.activeLlm().generateJson<unknown>(prompt, missing.length ? 0.6 : 0.9)
  present(toDrill(raw, theme, accent))
  setStatus(STRINGS.forged(app.drill.theme, countWords(app.drill.sentences)))
}

export async function annotate(passage: string, accent: AccentCode): Promise<void> {
  setStatus(STRINGS.annotating)
  const raw = await providers.activeLlm().generateJson<unknown>(buildAnnotatePrompt(passage, resolveAccent(accent)), 0.3)
  present(toDrill(raw, STRINGS.myText, accent))
  setStatus(STRINGS.annotated(countWords(app.drill.sentences)))
}

export function splitOwnTextLocally(passage: string, accent: AccentCode): boolean {
  const sentences = splitSentences(passage).map(en => ({ en, ipa: '', vi: '', tips: [] }))
  if (!sentences.length) {
    setStatus(STRINGS.noSentencesFound, 'err')
    return false
  }
  present({ theme: STRINGS.myText, accent, sentences, anchors: {} })
  setStatus(STRINGS.loadedWithoutIpa)
  return true
}

export async function copyPrompt(themeInput: string, ownText: string, accent: AccentCode, maxWords: string): Promise<string | null> {
  const resolved = resolveAccent(accent)
  const prompt = ownText.trim()
    ? buildAnnotatePrompt(ownText.trim(), resolved)
    : buildForgePrompt(themeFallback(themeInput), resolved, maxWords, app.audit.missing)

  try {
    await navigator.clipboard.writeText(prompt)
    setStatus(STRINGS.promptCopied)
    return null
  } catch {
    setStatus(STRINGS.clipboardBlocked, 'err')
    return prompt
  }
}

export function loadPastedJson(raw: string, accent: AccentCode, themeInput: string): boolean {
  if (!raw.trim()) {
    setStatus(STRINGS.emptyBox, 'err')
    return false
  }
  try {
    const embedded = raw.match(/\{[\s\S]*\}/)
    const parsed: unknown = JSON.parse(embedded ? embedded[0] : raw)
    const parsedAccent = (parsed as { accent?: AccentCode }).accent ?? accent
    present(toDrill(parsed, themeFallback(themeInput), parsedAccent))
    setStatus(STRINGS.loaded(app.drill.theme, countWords(app.drill.sentences)))
    return true
  } catch (error) {
    setStatus(error instanceof SyntaxError ? STRINGS.notJson : STRINGS.failed((error as Error).message), 'err')
    return false
  }
}

export const isLlmConfigured = (): boolean => providers.activeLlm().isConfigured()
