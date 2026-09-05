<script lang="ts">
  import { deleteFromLibrary, openFromLibrary, saveOpenDrill } from '../state/actions'
  import { app } from '../state/app.svelte'
  import Sheet from './Sheet.svelte'

  let { open = $bindable() }: { open: boolean } = $props()
</script>

<Sheet bind:open title="Library">
  <button class="pri" style="width:100%" onclick={saveOpenDrill}>💾 Save the open passage</button>

  <div style="margin-top:16px">
    {#if app.library.length}
      {#each app.library as entry (entry.entryId)}
        <div class="lib">
          <b>{entry.theme} · {entry.accent}</b>
          <button class="mini" onclick={async () => { await openFromLibrary(entry.entryId); open = false }}>Open</button>
          <button class="mini" onclick={() => deleteFromLibrary(entry.entryId)}>✕</button>
        </div>
      {/each}
    {:else}
      <p class="sub">Empty.</p>
    {/if}
  </div>
</Sheet>
