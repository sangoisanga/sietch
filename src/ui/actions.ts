import { DEFAULT_PACK, DEFAULT_PACK_TITLE, loadManifest, loadPack } from '../content/packs'
import { itemKey, type PoolItem } from '../content/pool'
import { drawForPeriod, withAssignment, withCompletion } from '../content/rotation'
import { activeProfile, loadProgress, saveProgress } from '../core/profiles'
import { dayKey, periodKey } from '../core/period'
import { resolveAccent } from '../core/accents'
import { buildAnnotatePrompt, buildForgePrompt } from '../core/prompts'
import { loadLibrary, removeFromLibrary, saveToLibrary } from '../core/store'
import { countWords, splitSentences } from '../core/text'
import { GeminiError, MISSING_KEY } from '../providers/gemini/client'
import type { Providers } from '../providers'
import { setDrill, state } from '../state'
import type { AccentCode, Drill, Sentence } from '../types'
import { el, escapeHtml, fillSelect } from './dom'
import type { Player } from './player'
import { clearClips, renderDrill, setStatus } from './render'
import { closeSheets } from './sheets'
import { STRINGS } from './strings'
import { advanceTask, creepUntilDone, endTask, startTask } from './task'

const FORGE_SECONDS = 22
const TODAY_OPTION = '__today__'

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

export function createActions(providers: Providers, player: Player) {
  let scheduled: { item: PoolItem; period: string; title: string } | null = null

  async function resolveScheduled(): Promise<void> {
    scheduled = null
    const daily = (await loadManifest()).pools.find(pool => pool.cadence === 'daily')
    if (!daily) return

    const profile = activeProfile()
    const period = periodKey(daily.cadence, new Date())
    const progress = loadProgress(profile.id)
    const item = drawForPeriod(daily, progress, period, profile.id)
    if (!item) return

    saveProgress(profile.id, withAssignment(progress, period, item))
    const title = (await loadManifest()).packs.find(pack => pack.id === item.packId)?.title ?? item.packId
    scheduled = { item, period, title }
  }

  function isScheduledDone(): boolean {
    if (!scheduled) return false
    return loadProgress(activeProfile().id).completed[itemKey(scheduled.item)] !== undefined
  }

  function refreshMarkDone(): void {
    const button = el<HTMLButtonElement>('markDone')
    button.disabled = !scheduled || isScheduledDone()
  }
  const themeInput = () => el<HTMLInputElement>('theme').value.trim() || state.drill.theme || DEFAULT_PACK_TITLE
  const chosenAccent = () => el<HTMLSelectElement>('accent').value as AccentCode

  function present(drill: Drill): void {
    player.releaseAudio()
    setDrill(drill)
    clearClips()
    renderDrill()
  }

  function reportError(error: unknown): void {
    if (error instanceof GeminiError && error.message === MISSING_KEY) {
      setStatus(STRINGS.missingKey, 'err')
      return
    }
    setStatus(STRINGS.failed(error instanceof Error ? error.message : String(error)), 'err')
  }

  async function runSingleStepTask(label: string, detail: string, work: () => Promise<void>): Promise<void> {
    state.stopRequested = false
    startTask(label, 1, detail)
    const stopCreep = creepUntilDone(FORGE_SECONDS)
    try {
      await work()
    } catch (error) {
      reportError(error)
    } finally {
      stopCreep()
      advanceTask(1)
      endTask()
    }
  }

  async function forge(missing: string[]): Promise<void> {
    const accent = chosenAccent()
    const theme = themeInput()
    setStatus(STRINGS.forging)
    const prompt = buildForgePrompt(theme, resolveAccent(accent), el<HTMLSelectElement>('wc').value, missing)
    const raw = await providers.activeLlm().generateJson<unknown>(prompt, missing.length ? 0.6 : 0.9)
    present(toDrill(raw, theme, accent))
    setStatus(STRINGS.forged(state.drill.theme, countWords(state.drill.sentences)))
  }

  async function annotate(passage: string): Promise<void> {
    const accent = chosenAccent()
    setStatus(STRINGS.annotating)
    const raw = await providers.activeLlm().generateJson<unknown>(buildAnnotatePrompt(passage, resolveAccent(accent)), 0.3)
    present(toDrill(raw, STRINGS.myText, accent))
    setStatus(STRINGS.annotated(countWords(state.drill.sentences)))
  }

  function renderLibrary(): void {
    const entries = loadLibrary()
    el('libList').innerHTML = entries.length
      ? entries.map((entry, index) => `<div class="lib"><b>${escapeHtml(entry.theme)} · ${escapeHtml(entry.accent)}</b>
          <button class="mini" data-lib="${index}">Open</button><button class="mini" data-del="${index}">✕</button></div>`).join('')
      : '<p class="sub">Empty.</p>'
  }

  function saveCurrent(): void {
    const saved = saveToLibrary(state.drill)
    if (saved) setStatus(STRINGS.savedTo(state.drill.theme))
    else setStatus(STRINGS.storageBlocked, 'err')
    renderLibrary()
  }

  return {
    renderLibrary,

    forge: () => runSingleStepTask(STRINGS.forgeTask, `${themeInput()} · ${chosenAccent()}`, () => forge([])),

    patchGaps: async () => {
      if (!state.audit.missing.length) {
        setStatus(STRINGS.nothingToPatch)
        return
      }
      await runSingleStepTask(STRINGS.forgeTask, STRINGS.coverageGaps(state.audit.missing), () => forge(state.audit.missing))
    },

    useOwnText: async () => {
      const passage = el<HTMLTextAreaElement>('ownText').value.trim()
      if (!passage) {
        setStatus(STRINGS.pasteFirst, 'err')
        return
      }

      if (!providers.activeLlm().isConfigured()) {
        const sentences = splitSentences(passage).map(en => ({ en, ipa: '', vi: '', tips: [] }))
        if (!sentences.length) {
          setStatus(STRINGS.noSentencesFound, 'err')
          return
        }
        present({ theme: STRINGS.myText, accent: chosenAccent(), sentences, anchors: {} })
        setStatus(STRINGS.loadedWithoutIpa)
        return
      }

      await runSingleStepTask(STRINGS.annotateTask, passage.slice(0, 60), () => annotate(passage))
    },

    copyPrompt: async () => {
      const own = el<HTMLTextAreaElement>('ownText').value.trim()
      const accent = resolveAccent(chosenAccent())
      const prompt = own
        ? buildAnnotatePrompt(own, accent)
        : buildForgePrompt(themeInput(), accent, el<HTMLSelectElement>('wc').value, state.audit.missing)

      try {
        await navigator.clipboard.writeText(prompt)
        setStatus(STRINGS.promptCopied)
      } catch {
        const box = el<HTMLTextAreaElement>('pasteJson')
        box.value = prompt
        box.select()
        setStatus(STRINGS.clipboardBlocked, 'err')
      }
    },

    loadPastedJson: () => {
      const raw = el<HTMLTextAreaElement>('pasteJson').value.trim()
      if (!raw) {
        setStatus(STRINGS.emptyBox, 'err')
        return
      }
      try {
        const embedded = raw.match(/\{[\s\S]*\}/)
        const parsed: unknown = JSON.parse(embedded ? embedded[0] : raw)
        const accent = (parsed as { accent?: AccentCode }).accent ?? chosenAccent()
        present(toDrill(parsed, themeInput(), accent))
        el<HTMLTextAreaElement>('pasteJson').value = ''
        setStatus(STRINGS.loaded(state.drill.theme, countWords(state.drill.sentences)))
      } catch (error) {
        setStatus(error instanceof SyntaxError ? STRINGS.notJson : STRINGS.failed((error as Error).message), 'err')
      }
    },

    populatePackPicker: async () => {
      const { packs } = await loadManifest()
      await resolveScheduled()

      const todayOption = scheduled
        ? { value: TODAY_OPTION, label: STRINGS.todayOption(scheduled.title) }
        : { value: TODAY_OPTION, label: STRINGS.nothingScheduled }
      fillSelect(el('pack'), [todayOption, ...packs.map(({ id, title }) => ({ value: id, label: title }))])
      el<HTMLSelectElement>('pack').options[0]!.disabled = !scheduled
      refreshMarkDone()
    },

    scheduledPackId: () => scheduled?.item.packId ?? null,

    markScheduledDone: () => {
      if (!scheduled) {
        setStatus(STRINGS.noScheduledItem, 'err')
        return
      }
      if (isScheduledDone()) {
        setStatus(STRINGS.alreadyDone)
        return
      }
      const profile = activeProfile()
      saveProgress(profile.id, withCompletion(loadProgress(profile.id), scheduled.item, dayKey(new Date())))
      refreshMarkDone()
      setStatus(STRINGS.markedDone(scheduled.title))
    },

    openPack: async (id: string) => {
      const packId = id === TODAY_OPTION ? scheduled?.item.packId ?? DEFAULT_PACK : id
      present(await loadPack(packId))
      el<HTMLSelectElement>('pack').value = id === TODAY_OPTION && scheduled ? TODAY_OPTION : packId
      refreshMarkDone()
      setStatus(STRINGS.opened(state.drill.theme))
    },

    saveCurrent,

    openFromLibrary: (index: number) => {
      const entry = loadLibrary()[index]
      if (!entry) return
      present(entry)
      closeSheets()
      setStatus(STRINGS.opened(entry.theme))
    },

    deleteFromLibrary: (index: number) => {
      removeFromLibrary(index)
      renderLibrary()
    },

    generateAllAudio: async () => {
      closeSheets()
      const total = state.drill.sentences.length
      startTask(STRINGS.audioTask, total)
      try {
        const done = await player.prefetchAll((step, sentence) => advanceTask(step, sentence))
        if (!state.stopRequested) setStatus(STRINGS.audioDone(done, total))
      } catch (error) {
        reportError(error)
      } finally {
        endTask()
      }
    },

    clearAudio: () => {
      player.releaseAudio()
      clearClips()
      setStatus(STRINGS.audioCleared)
    },
  }
}

export type Actions = ReturnType<typeof createActions>
