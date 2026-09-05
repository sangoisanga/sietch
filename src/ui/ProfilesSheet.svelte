<script lang="ts">
  import {
    addProfile, exportActiveProfile, importProfileFile, removeProfile, renameActiveProfile, switchProfile,
  } from '../state/actions'
  import { app } from '../state/app.svelte'
  import Sheet from './Sheet.svelte'

  let { open = $bindable() }: { open: boolean } = $props()

  let newName = $state('')
  let fileInput: HTMLInputElement
</script>

<Sheet bind:open title="Profiles">
  {#each app.profiles as profile (profile.id)}
    <div class="lib">
      <input
        style="flex:1"
        value={profile.name}
        onchange={event => renameActiveProfile(profile.id, event.currentTarget.value)}
      >
      <button class="mini" disabled={profile.id === app.profile?.id} onclick={() => switchProfile(profile.id)}>
        {profile.id === app.profile?.id ? 'Active' : 'Use'}
      </button>
      <button class="mini" onclick={() => removeProfile(profile.id)}>✕</button>
    </div>
  {/each}

  <div class="row" style="margin-top:14px">
    <input bind:value={newName} placeholder="New profile name">
    <button class="pri" onclick={async () => { await addProfile(newName); newName = '' }}>+ Add</button>
  </div>

  <p class="sub">Progress lives in this browser. Export it to carry it to another device.</p>

  <div class="row" style="margin-top:14px">
    <button class="mini" onclick={exportActiveProfile}>↓ Export progress</button>
    <button class="mini" onclick={() => fileInput.click()}>↑ Import progress</button>
  </div>

  <input
    bind:this={fileInput}
    type="file"
    accept="application/json"
    class="hide"
    onchange={async event => {
      const file = event.currentTarget.files?.[0]
      event.currentTarget.value = ''
      if (file) await importProfileFile(file)
    }}
  >
</Sheet>
