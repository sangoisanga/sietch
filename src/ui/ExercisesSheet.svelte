<script lang="ts">
  import type { PoolReport } from '../content/validatePool'
  import type { PoolConflict } from '../data/pools'
  import {
    acceptPool, deleteFromLibrary, deletePool, exportPoolFile, inspectPoolFile,
    openFromLibrary, openPack, renameLibraryDrill, saveOpenDrill,
  } from '../state/actions'
  import { app } from '../state/app.svelte'
  import { listExercises, matchesSearch, type ExerciseEntry } from '../state/exercises'
  import Box from './primitives/Box.svelte'
  import Button from './primitives/Button.svelte'
  import ListItem from './primitives/ListItem.svelte'
  import Note from './primitives/Note.svelte'
  import Row from './primitives/Row.svelte'
  import Sheet from './Sheet.svelte'
  import { STRINGS } from './strings'

  let { open = $bindable() }: { open: boolean } = $props()

  let entries = $state<ExerciseEntry[]>([])
  let search = $state('')
  let renaming = $state('')
  let renameTo = $state('')
  let pending = $state<{ report: PoolReport; raw: unknown; conflict: PoolConflict | null } | null>(null)
  let fileInput: HTMLInputElement

  const shown = $derived(entries.filter(entry => matchesSearch(entry, search)))
  const shortCoverage = $derived(pending?.report.coverage.filter(pack => pack.pct < 100) ?? [])

  async function refresh(): Promise<void> {
    entries = await listExercises()
  }

  $effect(() => {
    if (open) void refresh()
  })

  async function openEntry(entry: ExerciseEntry): Promise<void> {
    if (entry.from.kind === 'pool') await openPack(entry.from.poolId, entry.from.packId)
    else await openFromLibrary(entry.from.entryId)
    open = false
  }

  async function commitRename(entryId: string): Promise<void> {
    await renameLibraryDrill(entryId, renameTo)
    renaming = ''
    await refresh()
  }
</script>

<Sheet bind:open title="Exercises">
  <Row>
    <Button variant="accent" onclick={async () => { await saveOpenDrill(); await refresh() }}>
      💾 Save the open passage
    </Button>
  </Row>

  <input class="search" bind:value={search} placeholder="Search by title or accent…" aria-label="Search exercises">

  <div class="list">
    {#each shown as entry (entry.id)}
      <ListItem>
        {#if renaming === entry.id}
          <input bind:value={renameTo} aria-label="New title">
          <Button size="mini" onclick={() => commitRename(entry.id)}>✓</Button>
          <Button size="mini" onclick={() => (renaming = '')}>✕</Button>
        {:else}
          <b>
            <span class="dot {entry.audio}" title={STRINGS.audioState(entry.audio)}></span>
            {entry.title}
          </b>
          <span class="meta" class:due={entry.dueInDays !== null && entry.dueInDays <= 0}>
            {entry.dueInDays === null ? STRINGS.newExercise : STRINGS.dueIn(entry.dueInDays)}
          </span>
          <span class="meta">{entry.accent}</span>
          <Button size="mini" onclick={() => openEntry(entry)}>Open</Button>
          {#if entry.from.kind === 'library'}
            <Button size="mini" aria-label="Rename" onclick={() => { renaming = entry.id; renameTo = entry.title }}>✎</Button>
            <Button size="mini" aria-label="Delete" onclick={async () => {
              await deleteFromLibrary((entry.from as { entryId: string }).entryId)
              await refresh()
            }}>✕</Button>
          {/if}
        {/if}
      </ListItem>
    {:else}
      <Note>{search ? STRINGS.noMatches : 'Empty.'}</Note>
    {/each}
  </div>

  <details class="pools">
    <summary>Pools</summary>

    {#each app.pools as pool (pool.id)}
      <ListItem>
        <b>{pool.title}</b>
        <span class="meta">v{pool.version} · {pool.packIds.length} packs</span>
        <Button size="mini" onclick={() => exportPoolFile(pool.id)}>↓ Export</Button>
        <Button size="mini" aria-label="Remove pool" onclick={async () => { await deletePool(pool.id); await refresh() }}>✕</Button>
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
              <Button variant="accent" onclick={async () => { await acceptPool(pending!.raw, 'replace'); pending = null; await refresh() }}>Replace</Button>
              <Button size="mini" onclick={async () => { await acceptPool(pending!.raw, 'keepBoth'); pending = null; await refresh() }}>Keep both</Button>
              <Button size="mini" onclick={() => (pending = null)}>Cancel</Button>
            </Row>
          {:else}
            <Row style="margin-top:10px">
              <Button variant="accent" onclick={async () => { await acceptPool(pending!.raw, 'replace'); pending = null; await refresh() }}>Import</Button>
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
  </details>

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

<style>
  .search { margin-top: 14px }

  .list { margin-top: 10px }

  .meta {
    flex: 0 0 auto;
    font-size: .66rem;
    color: var(--muted);
    white-space: nowrap;
  }

  .dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border: 2px solid #000;
    margin-right: 6px;
    vertical-align: middle;
  }

  .due { color: var(--red); font-weight: 700 }

  .none { background: #fff }
  .partial { background: var(--acc) }
  .ready { background: var(--green); border-color: var(--green) }

  .pools {
    margin-top: 20px;
    border-top: 2px solid #000;
    padding-top: 10px;
  }
</style>
