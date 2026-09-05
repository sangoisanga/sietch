import './styles.css'
import { DEFAULT_PACK } from './content/packs'

const TODAY_OPTION = '__today__'
import { THEME_SUGGESTIONS } from './content/themes'
import { ACCENTS, ACCENT_CODES } from './core/accents'
import { createProviders } from './providers'
import { GEMINI_VOICES } from './providers/tts/gemini'
import type { SpeakingStyle } from './providers/tts/types'
import { state, updateSettings } from './state'
import { createActions } from './ui/actions'
import { createProfilesUi } from './ui/profiles'
import { el, fillSelect } from './ui/dom'
import { createPlayer } from './ui/player'
import { applyToggles, installAnchorTaps, setStatus } from './ui/render'
import { installSheetDismissal, keepContentClearOfBar, openSheet } from './ui/sheets'
import { installTaskCancel } from './ui/task'
import { STRINGS } from './ui/strings'
import type { Toggles } from './state'

const providers = createProviders({
  getSettings: () => state.settings,
  rememberTextModel: model => {
    updateSettings({ textModel: model })
    el<HTMLInputElement>('txtModel').value = model
  },
})

const player = createPlayer(providers)
const actions = createActions(providers, player)
const profilesUi = createProfilesUi()

async function openPack(id: string): Promise<void> {
  try {
    await actions.openPack(id)
  } catch (error) {
    setStatus(STRINGS.packLoadFailed(error instanceof Error ? error.message : String(error)), 'err')
  }
}

async function bootstrap(): Promise<void> {
  setStatus(STRINGS.loading)
  try {
    await actions.populatePackPicker()
  } catch (error) {
    setStatus(STRINGS.packLoadFailed(error instanceof Error ? error.message : String(error)), 'err')
    return
  }
  await openPack(actions.scheduledPackId() ? TODAY_OPTION : DEFAULT_PACK)
}

function populateSelects(): void {
  fillSelect(el('accent'), ACCENT_CODES.map(code => ({ value: code, label: ACCENTS[code].label })))
  fillSelect(el('voice'), GEMINI_VOICES.map(voice => ({ value: voice, label: voice })))
  fillSelect(el('ttsProvider'), providers.tts.map(({ id, label }) => ({ value: id, label })))
  fillSelect(el('llmProvider'), providers.llm.map(({ id, label }) => ({ value: id, label })))

  el<HTMLSelectElement>('accent').value = state.drill.accent
  el<HTMLSelectElement>('voice').value = state.settings.voice
  el<HTMLSelectElement>('ttsProvider').value = state.settings.ttsProviderId
  el<HTMLSelectElement>('llmProvider').value = state.settings.llmProviderId
  el<HTMLSelectElement>('style').value = state.settings.style
  el<HTMLSelectElement>('rate').value = String(state.settings.rate)
  el<HTMLInputElement>('key').value = state.settings.apiKey
  el<HTMLInputElement>('model').value = state.settings.ttsModel
  el<HTMLInputElement>('txtModel').value = state.settings.textModel
}

function bindSettings(): void {
  el<HTMLInputElement>('key').onchange = event => updateSettings({ apiKey: (event.target as HTMLInputElement).value.trim() })
  el<HTMLInputElement>('txtModel').onchange = event => updateSettings({ textModel: (event.target as HTMLInputElement).value.trim() })
  el<HTMLInputElement>('model').onchange = event => {
    updateSettings({ ttsModel: (event.target as HTMLInputElement).value.trim() })
    actions.clearAudio()
  }
  el<HTMLSelectElement>('voice').onchange = event => {
    updateSettings({ voice: (event.target as HTMLSelectElement).value })
    actions.clearAudio()
  }
  el<HTMLSelectElement>('style').onchange = event => {
    updateSettings({ style: (event.target as HTMLSelectElement).value as SpeakingStyle })
    actions.clearAudio()
  }
  el<HTMLSelectElement>('ttsProvider').onchange = event => updateSettings({ ttsProviderId: (event.target as HTMLSelectElement).value })
  el<HTMLSelectElement>('llmProvider').onchange = event => updateSettings({ llmProviderId: (event.target as HTMLSelectElement).value })
  el<HTMLSelectElement>('rate').onchange = event => updateSettings({ rate: Number((event.target as HTMLSelectElement).value) })
}

function bindThemeChips(): void {
  el('chips').replaceChildren(...THEME_SUGGESTIONS.map(theme => {
    const chip = document.createElement('span')
    chip.className = 'chip'
    chip.textContent = theme
    chip.onclick = () => { el<HTMLInputElement>('theme').value = theme }
    return chip
  }))
}

function bindToggles(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-t]').forEach(button => {
    button.onclick = () => {
      const name = button.dataset.t as keyof Toggles
      state.toggles[name] = !state.toggles[name]
      button.classList.toggle('on', state.toggles[name])
      applyToggles()
    }
  })
}

function bindCardButtons(): void {
  document.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button')
    if (!button) return

    const { play, loop, gen, lib, del } = button.dataset
    if (play !== undefined) void player.sayOne(Number(play))
    if (loop !== undefined) void player.loopThree(Number(loop))
    if (gen !== undefined) void player.regenerate(Number(gen))
    if (lib !== undefined) actions.openFromLibrary(Number(lib))
    if (del !== undefined) actions.deleteFromLibrary(Number(del))
  })
}

function bindControls(): void {
  el('forge').onclick = () => void actions.forge()
  el('patch').onclick = () => void actions.patchGaps()
  el('useOwn').onclick = () => void actions.useOwnText()
  el('copyPrompt').onclick = () => void actions.copyPrompt()
  el('loadJson').onclick = () => actions.loadPastedJson()
  el('save').onclick = () => actions.saveCurrent()
  el('save2').onclick = () => actions.saveCurrent()
  el('genAll').onclick = () => void actions.generateAllAudio()
  el('clearAudio').onclick = () => actions.clearAudio()
  el('playAll').onclick = () => void player.playAll()
  el('stopBtn').onclick = () => player.stop()
  el('openSet').onclick = () => openSheet('sheetSet')
  el('openLib').onclick = () => { actions.renderLibrary(); openSheet('sheetLib') }
  el('openProfiles').onclick = () => { profilesUi.render(); openSheet('sheetProfiles') }
  el('markDone').onclick = () => actions.markScheduledDone()
  el<HTMLSelectElement>('pack').onchange = event => void openPack((event.target as HTMLSelectElement).value)
}

populateSelects()
bindSettings()
bindThemeChips()
bindToggles()
bindCardButtons()
bindControls()
installAnchorTaps()
installSheetDismissal()
installTaskCancel()
keepContentClearOfBar()
actions.renderLibrary()
profilesUi.render()
profilesUi.install(() => void bootstrap())
void bootstrap()

// the voice list arrives asynchronously in Chrome, and an empty list means no accent match
speechSynthesis?.getVoices()
