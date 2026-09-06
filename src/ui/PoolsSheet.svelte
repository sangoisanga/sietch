<script lang="ts">
  import type { PoolReport } from '../content/validatePool'
  import type { PoolConflict } from '../data/pools'
  import { acceptPool, exportPoolFile, inspectPoolFile } from '../state/actions'
  import { app } from '../state/app.svelte'
  import Box from './primitives/Box.svelte'
  import Button from './primitives/Button.svelte'
  import ListItem from './primitives/ListItem.svelte'
  import Note from './primitives/Note.svelte'
  import Row from './primitives/Row.svelte'
  import Sheet from './Sheet.svelte'
  import { STRINGS } from './strings'

  let { open = $bindable() }: { open: boolean } = $props()

  let pending = $state<{ report: PoolReport; raw: unknown; conflict: PoolConflict | null } | null>(null)
  let fileInput: HTMLInputElement

  const shortCoverage = $derived(pending?.report.coverage.filter(pack => pack.pct < 100) ?? [])
</script>

<Sheet bind:open title="Pools">
  {#each app.pools as pool (pool.id)}
    <ListItem>
      <b>{pool.title} · v{pool.version} · {pool.packIds.length} packs</b>
      <Button size="mini" onclick={() => exportPoolFile(pool.id)}>↓ Export</Button>
    </ListItem>
  {/each}

  <Row style="margin-top:14px">
    <Button variant="accent" onclick={() => fileInput.click()}>↑ Import a pool</Button>
  </Row>

  {#if pending}
    <Box style="margin-top:16px">
      {#if pending.report.ok}
        <h2>Import {pending.report.title}?</h2>
        <Note tone="ink">
          {pending.report.packs} packs · {pending.report.words} words<br>
          Checksum: {pending.report.checksumValid ? 'valid ✓' : 'invalid ✗'}<br>
          Coverage: {shortCoverage.length ? `${shortCoverage.length} pack(s) below 100%` : 'all packs 100% ✓'}
        </Note>

        {#each pending.report.warnings as warning (warning)}
          <Note style="color:var(--red)">{warning}</Note>
        {/each}

        {#if pending.conflict}
          <Note tone="ink">
            <b>Already installed:</b> v{pending.conflict.installed.version} · {pending.conflict.installed.packIds.length} packs<br>
            <b>Incoming:</b> v{pending.conflict.incoming.version} · {pending.conflict.incoming.packs} packs<br>
            Your completed drills carry over either way.
          </Note>
          <Row style="margin-top:10px">
            <Button variant="accent" onclick={async () => { await acceptPool(pending!.raw, 'replace'); pending = null }}>Replace</Button>
            <Button size="mini" onclick={async () => { await acceptPool(pending!.raw, 'keepBoth'); pending = null }}>Keep both</Button>
            <Button size="mini" onclick={() => (pending = null)}>Cancel</Button>
          </Row>
        {:else}
          <Row style="margin-top:10px">
            <Button variant="accent" onclick={async () => { await acceptPool(pending!.raw, 'replace'); pending = null }}>Import</Button>
            <Button size="mini" onclick={() => (pending = null)}>Cancel</Button>
          </Row>
        {/if}
      {:else}
        <h2>{STRINGS.poolRejected}</h2>
        {#each pending.report.errors as error (error)}
          <Note style="color:var(--red)">{error}</Note>
        {/each}
        <Row style="margin-top:10px">
          <Button size="mini" onclick={() => (pending = null)}>Close</Button>
        </Row>
      {/if}
    </Box>
  {/if}

  <input
    bind:this={fileInput}
    type="file"
    accept="application/json,.sietch.json"
    style="display:none"
    onchange={async event => {
      const file = event.currentTarget.files?.[0]
      event.currentTarget.value = ''
      if (file) pending = await inspectPoolFile(file)
    }}
  >
</Sheet>
