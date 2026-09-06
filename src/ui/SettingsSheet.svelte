<script lang="ts">
  import type { Providers } from '../providers'
  import type { Describable, SettingField } from '../providers/types'
  import { clipCacheSize } from '../data/audioClips'
  import { clearAudio, forgetLoadedAudio, updateSettings } from '../state/actions'
  import { app, setStatus } from '../state/app.svelte'
  import Button from './primitives/Button.svelte'
  import Note from './primitives/Note.svelte'
  import Row from './primitives/Row.svelte'
  import Sheet from './Sheet.svelte'
  import { STRINGS } from './strings'

  let { open = $bindable(), providers }: { open: boolean; providers: Providers } = $props()

  let cacheSize = $state({ count: 0, bytes: 0 })

  $effect(() => {
    if (open) void clipCacheSize().then(size => (cacheSize = size))
  })

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
    if (field.invalidatesAudio) void forgetLoadedAudio()
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
  <Row>
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
  </Row>

  {#each sections as section (section.id)}
    <div class="section">
      {#each section.fields as field (field.key)}
        {@const value = providerConfig(section.id)[field.key] ?? ''}
        <div class="field">
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

  <Note>Stored on your machine. Without a key the built-in passages still play through the browser voice.</Note>

  <Note style="margin-top:16px">{STRINGS.audioCacheSize(cacheSize.count, cacheSize.bytes)}</Note>
  <Row style="margin-top:8px">
    <Button onclick={async () => {
      await clearAudio()
      cacheSize = { count: 0, bytes: 0 }
      setStatus(STRINGS.audioCleared)
    }}>✕ Clear saved audio</Button>
  </Row>

  <Note style="margin-top:20px">Build {__BUILD_HASH__} · {__BUILD_TIME__}</Note>
</Sheet>

<style>
  .section { margin-top: 16px }
  .field { margin-top: 10px }
</style>
