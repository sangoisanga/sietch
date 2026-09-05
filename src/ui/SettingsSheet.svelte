<script lang="ts">
  import { GEMINI_VOICES } from '../providers/tts/gemini'
  import type { Providers } from '../providers'
  import { updateSettings } from '../state/actions'
  import { app, setStatus } from '../state/app.svelte'
  import type { Player } from '../state/player'
  import type { SpeakingStyle } from '../types'
  import Sheet from './Sheet.svelte'
  import { STRINGS } from './strings'

  let { open = $bindable(), providers, player, runSteppedTask }: {
    open: boolean
    providers: Providers
    player: Player
    runSteppedTask: (label: string, total: number, work: (step: (done: number, detail: string) => void) => Promise<number>) => Promise<void>
  } = $props()

  const STYLES: { value: SpeakingStyle; label: string }[] = [
    { value: 'slow', label: 'Slow — for shadowing' },
    { value: 'natural', label: 'Natural' },
    { value: 'veryslow', label: 'Very slow — word by word' },
  ]
</script>

<Sheet bind:open title="Settings">
  <div class="row">
    <div>
      <label for="ttsProvider">Voice engine</label>
      <select id="ttsProvider" value={app.settings.ttsProviderId} onchange={e => updateSettings({ ttsProviderId: e.currentTarget.value })}>
        {#each providers.tts as provider (provider.id)}<option value={provider.id}>{provider.label}</option>{/each}
      </select>
    </div>
    <div>
      <label for="llmProvider">Writer engine</label>
      <select id="llmProvider" value={app.settings.llmProviderId} onchange={e => updateSettings({ llmProviderId: e.currentTarget.value })}>
        {#each providers.llm as provider (provider.id)}<option value={provider.id}>{provider.label}</option>{/each}
      </select>
    </div>
  </div>

  <div style="margin-top:14px">
    <label for="key">Gemini API key</label>
    <input id="key" type="password" placeholder="AIza..." autocomplete="off"
      value={app.settings.apiKey} onchange={e => updateSettings({ apiKey: e.currentTarget.value.trim() })}>
  </div>
  <p class="sub" style="margin-top:6px">Stored on your machine. Without a key the built-in passages still play through the browser voice.</p>

  <div class="row" style="margin-top:14px">
    <div>
      <label for="txtModel">Text model</label>
      <input id="txtModel" placeholder="auto-detect" value={app.settings.textModel} onchange={e => updateSettings({ textModel: e.currentTarget.value.trim() })}>
    </div>
    <div>
      <label for="ttsModel">Voice model</label>
      <input id="ttsModel" value={app.settings.ttsModel} onchange={e => { updateSettings({ ttsModel: e.currentTarget.value.trim() }); player.releaseAudio() }}>
    </div>
  </div>

  <div class="row" style="margin-top:12px">
    <div>
      <label for="voice">Voice</label>
      <select id="voice" value={app.settings.voice} onchange={e => { updateSettings({ voice: e.currentTarget.value }); player.releaseAudio() }}>
        {#each GEMINI_VOICES as voice (voice)}<option value={voice}>{voice}</option>{/each}
      </select>
    </div>
    <div>
      <label for="style">Delivery</label>
      <select id="style" value={app.settings.style} onchange={e => { updateSettings({ style: e.currentTarget.value as SpeakingStyle }); player.releaseAudio() }}>
        {#each STYLES as style (style.value)}<option value={style.value}>{style.label}</option>{/each}
      </select>
    </div>
  </div>

  <div class="row" style="margin-top:16px">
    <button class="pri" onclick={async () => {
      open = false
      const total = app.drill.sentences.length
      await runSteppedTask(STRINGS.audioTask, total, step => player.prefetchAll(step))
    }}>⚡ Generate all audio</button>
    <button onclick={() => { player.releaseAudio(); setStatus(STRINGS.audioCleared) }}>✕ Clear audio</button>
  </div>

  <p class="sub" style="margin-top:20px">Build {__BUILD_HASH__} · {__BUILD_TIME__}</p>
</Sheet>
