<script lang="ts">
  import {
    addProfile, exportActiveProfile, importProfileFile, removeProfile, renameActiveProfile, switchProfile,
  } from '../state/actions'
  import { app } from '../state/app.svelte'
  import Button from './primitives/Button.svelte'
  import ListItem from './primitives/ListItem.svelte'
  import Note from './primitives/Note.svelte'
  import Row from './primitives/Row.svelte'
  import Sheet from './Sheet.svelte'

  let { open = $bindable() }: { open: boolean } = $props()

  let newName = $state('')
  let fileInput: HTMLInputElement
</script>

<Sheet bind:open title="Profiles">
  {#each app.profiles as profile (profile.id)}
    <ListItem>
      <input
        value={profile.name}
        onchange={event => renameActiveProfile(profile.id, event.currentTarget.value)}
      >
      <Button size="mini" disabled={profile.id === app.profile?.id} onclick={() => switchProfile(profile.id)}>
        {profile.id === app.profile?.id ? 'Active' : 'Use'}
      </Button>
      <Button size="mini" onclick={() => removeProfile(profile.id)}>✕</Button>
    </ListItem>
  {/each}

  <Row style="margin-top:14px">
    <input bind:value={newName} placeholder="New profile name">
    <Button variant="accent" onclick={async () => { await addProfile(newName); newName = '' }}>+ Add</Button>
  </Row>

  <Note>Progress lives in this browser. Export it to carry it to another device.</Note>

  <Row style="margin-top:14px">
    <Button size="mini" onclick={exportActiveProfile}>↓ Export progress</Button>
    <Button size="mini" onclick={() => fileInput.click()}>↑ Import progress</Button>
  </Row>

  <input
    bind:this={fileInput}
    type="file"
    accept="application/json"
    style="display:none"
    onchange={async event => {
      const file = event.currentTarget.files?.[0]
      event.currentTarget.value = ''
      if (file) await importProfileFile(file)
    }}
  >
</Sheet>
