<script lang="ts">
  import type { PoolReport } from '../content/validatePool'
  import { acceptPool, exportPoolFile, inspectPoolFile } from '../state/actions'
  import { app } from '../state/app.svelte'
  import type { PoolConflict } from '../data/pools'
  import Sheet from './Sheet.svelte'
  import { STRINGS } from './strings'

  let { open = $bindable() }: { open: boolean } = $props()

  let pending = $state<{ report: PoolReport; raw: unknown; conflict: PoolConflict | null } | null>(null)
  let fileInput: HTMLInputElement

  const shortCoverage = $derived(pending?.report.coverage.filter(pack => pack.pct < 100) ?? [])
</script>

<Sheet bind:open title="Pools">
  {#each app.pools as pool (pool.id)}
    <div class="lib">
      <b>{pool.title} · v{pool.version} · {pool.packIds.length} packs</b>
      <button class="mini" onclick={() => exportPoolFile(pool.id)}>↓ Export</button>
    </div>
  {/each}

  <div class="row" style="margin-top:14px">
    <button class="pri" onclick={() => fileInput.click()}>↑ Import a pool</button>
  </div>

  {#if pending}
    <div class="box" style="margin-top:16px">
      {#if pending.report.ok}
        <h2>Import {pending.report.title}?</h2>
        <p class="sub" style="color:#000">
          {pending.report.packs} packs · {pending.report.words} words<br>
          Checksum: {pending.report.checksumValid ? 'valid ✓' : 'invalid ✗'}<br>
          Coverage: {shortCoverage.length ? `${shortCoverage.length} pack(s) below 100%` : 'all packs 100% ✓'}
        </p>
        {#each pending.report.warnings as warning (warning)}
          <p class="sub" style="color:var(--red)">{warning}</p>
        {/each}
        {#if pending.conflict}
          <p class="sub" style="color:#000">
            <b>Already installed:</b> v{pending.conflict.installed.version} · {pending.conflict.installed.packIds.length} packs<br>
            <b>Incoming:</b> v{pending.conflict.incoming.version} · {pending.conflict.incoming.packs} packs<br>
            Your completed drills carry over either way.
          </p>
          <div class="row" style="margin-top:10px">
            <button class="pri" onclick={async () => { await acceptPool(pending!.raw, 'replace'); pending = null }}>Replace</button>
            <button class="mini" onclick={async () => { await acceptPool(pending!.raw, 'keepBoth'); pending = null }}>Keep both</button>
            <button class="mini" onclick={() => (pending = null)}>Cancel</button>
          </div>
        {:else}
          <div class="row" style="margin-top:10px">
            <button class="pri" onclick={async () => { await acceptPool(pending!.raw, 'replace'); pending = null }}>Import</button>
            <button class="mini" onclick={() => (pending = null)}>Cancel</button>
          </div>
        {/if}
      {:else}
        <h2>{STRINGS.poolRejected}</h2>
        {#each pending.report.errors as error (error)}
          <p class="sub" style="color:var(--red)">{error}</p>
        {/each}
        <div class="row" style="margin-top:10px">
          <button class="mini" onclick={() => (pending = null)}>Close</button>
        </div>
      {/if}
    </div>
  {/if}

  <input
    bind:this={fileInput}
    type="file"
    accept="application/json,.sietch.json"
    class="hide"
    onchange={async event => {
      const file = event.currentTarget.files?.[0]
      event.currentTarget.value = ''
      if (file) pending = await inspectPoolFile(file)
    }}
  >
</Sheet>
