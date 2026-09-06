<script lang="ts">
  import type { Providers } from '../providers'
  import type { Describable, SettingField } from '../providers/types'
  import { updateSettings } from '../state/actions'
  import { app, setStatus } from '../state/app.svelte'
  import type { Player } from '../state/player'
  import Sheet from './Sheet.svelte'
  import { STRINGS } from './strings'

  let { open = $bindable(), providers, player, runSteppedTask }: {
    open: boolean
    providers: Providers
    player: Player
    runSteppedTask: (label: string, total: number, work: (step: (done: number, detail: string) => void) => Promise<number>) => Promise<void>
  } = $props()

  interface ConfigSection {
    id: string
    label: string
    fields: SettingField[]
  }

  function providerConfig(id: string): Record<string, string> {
    return app.settings.providers[id] ?? {}
  }

  function updateProviderField(providerId: string, field: SettingField, value: string): void {
    updateSettings({
      providers: { ...app.settings.providers, [providerId]: { ...providerConfig(providerId), [field.key]: value } },
    })
    if (field.invalidatesAudio) player.releaseAudio()
  }

  // one provider can back both engines, and both would list its API key — show each field once
  const sections = $derived.by(() => {
    const chosen = [
      providers.tts.find(provider => provider.id === app.settings.ttsProviderId),
      providers.llm.find(provider => provider.id === app.settings.llmProviderId),
    ]

    const merged: ConfigSection[] = []
    for (const provider of chosen as (Describable | undefined)[]) {
      if (!provider?.settingsFields.length) continue

      const existing = merged.find(section => section.id === provider.id)
      if (!existing) {
        merged.push({ id: provider.id, label: provider.label, fields: [...provider.settingsFields] })
        continue
      }
      for (const field of provider.settingsFields) {
        if (!existing.fields.some(known => known.key === field.key)) existing.fields.push(field)
      }
    }
    return merged
  })
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

  {#each sections as section (section.id)}
    <div style="margin-top:16px">
      {#each section.fields as field (field.key)}
        {@const value = providerConfig(section.id)[field.key] ?? ''}
        <div style="margin-top:10px">
          <label for="{section.id}-{field.key}">{field.label}</label>
          {#if field.type === 'select'}
            <select id="{section.id}-{field.key}" {value} onchange={e => updateProviderField(section.id, field, e.currentTarget.value)}>
              {#each field.options as option (option.value)}<option value={option.value}>{option.label}</option>{/each}
            </select>
          {:else}
            <input id="{section.id}-{field.key}" type={field.type} placeholder={field.placeholder} autocomplete="off" {value}
              onchange={e => updateProviderField(section.id, field, e.currentTarget.value.trim())}>
          {/if}
        </div>
      {/each}
    </div>
  {/each}

  <p class="sub" style="margin-top:6px">Stored on your machine. Without a key the built-in passages still play through the browser voice.</p>

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
