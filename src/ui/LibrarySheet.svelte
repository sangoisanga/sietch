<script lang="ts">
  import { deleteFromLibrary, openFromLibrary, saveOpenDrill } from '../state/actions'
  import { app } from '../state/app.svelte'
  import Button from './primitives/Button.svelte'
  import ListItem from './primitives/ListItem.svelte'
  import Note from './primitives/Note.svelte'
  import Sheet from './Sheet.svelte'

  let { open = $bindable() }: { open: boolean } = $props()
</script>

<Sheet bind:open title="Library">
  <Button variant="accent" style="width:100%" onclick={saveOpenDrill}>💾 Save the open passage</Button>

  <div class="list">
    {#if app.library.length}
      {#each app.library as entry (entry.entryId)}
        <ListItem>
          <b>{entry.theme} · {entry.accent}</b>
          <Button size="mini" onclick={async () => { await openFromLibrary(entry.entryId); open = false }}>Open</Button>
          <Button size="mini" onclick={() => deleteFromLibrary(entry.entryId)}>✕</Button>
        </ListItem>
      {/each}
    {:else}
      <Note>Empty.</Note>
    {/if}
  </div>
</Sheet>

<style>
  .list { margin-top: 16px }
</style>
