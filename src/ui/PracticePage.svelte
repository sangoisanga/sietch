<script lang="ts">
  import { RATINGS } from '../core/srs'
  import { openPack, openScheduled, providers, rateOpenDrill, reportError } from '../state/actions'
  import { app } from '../state/app.svelte'
  import type { Player } from '../state/player'
  import { go } from '../state/route.svelte'
  import Box from './primitives/Box.svelte'
  import Button from './primitives/Button.svelte'
  import Note from './primitives/Note.svelte'
  import Row from './primitives/Row.svelte'
  import SentenceCard from './SentenceCard.svelte'
  import { STRINGS } from './strings'

  let { player, runSteppedTask }: {
    player: Player
    runSteppedTask: (label: string, total: number, work: (step: (done: number, detail: string) => void) => Promise<number>) => Promise<void>
  } = $props()

  const TODAY = '__today__'

  const canPrefetch = $derived(Boolean(providers.activeTts().prefetch))
  const selected = $derived(app.scheduled && app.openPackId === `${app.scheduled.poolId}/${app.scheduled.packId}` ? TODAY : app.openPackId)

  const toggles = [
    { key: 'ipa', label: 'IPA' },
    { key: 'vi', label: 'Vietnamese' },
    { key: 'anchor', label: 'Anchors' },
    { key: 'shadow', label: 'Shadow mode' },
  ] as const

  async function choosePack(value: string) {
    if (value === TODAY) return openScheduled()
    const [poolId, packId] = value.split('/')
    if (poolId && packId) await openPack(poolId, packId)
  }

  $effect(() => {
    if (app.activeCard < 0) return
    document.getElementById(`c${app.activeCard}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
</script>

<Row style="margin-top:20px">
  <select value={selected} onchange={event => choosePack((event.currentTarget as HTMLSelectElement).value)} aria-label="Drill pack">
    <option value={TODAY} disabled={!app.scheduled}>
      {app.scheduled ? STRINGS.todayOption(app.scheduled.title) : STRINGS.nothingScheduled}
    </option>
    {#each app.packChoices as choice (choice.poolId + choice.packId)}
      <option value="{choice.poolId}/{choice.packId}">{choice.title}</option>
    {/each}
  </select>
  {#if canPrefetch && app.drill.sentences.length}
    <Button
      variant="accent"
      size="mini"
      disabled={!app.missingAudio}
      onclick={() => runSteppedTask(STRINGS.audioTask, app.drill.sentences.length, step => player.prefetchAll(step))}
    >
      {app.missingAudio ? STRINGS.loadAudio(app.missingAudio) : STRINGS.audioReady}
    </Button>
  {/if}
</Row>

<div class="toggles">
  {#each toggles as toggle (toggle.key)}
    <Button size="mini" active={app.toggles[toggle.key]} onclick={() => (app.toggles[toggle.key] = !app.toggles[toggle.key])}>
      {toggle.label}
    </Button>
  {/each}
</div>

<h2>{app.drill.theme} · {app.drill.accent}</h2>

{#each app.drill.sentences as sentence, index (index)}
  <SentenceCard
    {sentence}
    {index}
    onplay={i => player.sayOne(i)}
    onloop={i => player.loopThree(i)}
    ongenerate={i => player.regenerate(i).catch(reportError)}
  />
{:else}
  <Note>Nothing open. Forge a passage or pick one from the library.</Note>
  <Row style="margin-top:10px">
    <Button variant="accent" onclick={() => go('library')}>☰ Open the library</Button>
  </Row>
{/each}

{#if app.openPackId}
  <Box style="margin-top:16px">
    <h2>How did that go?</h2>
    <Row>
      {#each RATINGS as rating (rating.value)}
        <Button size="mini" onclick={() => rateOpenDrill(rating.value)}>{rating.label}</Button>
      {/each}
    </Row>
    <Note>Rating it sets when it comes back.</Note>
  </Box>
{/if}

<Box style="margin-top:16px">
  <h2>The 90-second routine</h2>
  <Note tone="ink">
    <b>20s</b> — listen sentence by sentence at 0.6×, watching only the anchors.<br>
    <b>40s</b> — turn on Shadow mode, read over the top of it, record yourself on your phone.<br>
    <b>30s</b> — play it back and pick <b>one</b> mistake. Fix that one tomorrow.
  </Note>
</Box>

<p class="foot">
  P(fluent) = P(every sound) × P(linking right) × P(repeating for 60 days).<br>
  The audit covers the first factor. Shadow mode covers the second. The third is yours.
</p>

<style>
  .toggles { display: flex; gap: 6px; flex-wrap: wrap; margin: 14px 0 18px }

  /* the toggles are components, so they carry no scoping class of ours */
  .toggles > :global(button) { flex: 1 1 auto }

  .foot {
    font-size: .7rem;
    color: var(--muted);
    margin-top: 26px;
    line-height: 1.7;
  }

  @media (min-width: 600px) {
    .toggles > :global(button) { flex: 0 0 auto }
  }
</style>
