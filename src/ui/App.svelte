<script lang="ts">
  import { boot, providers, reportError } from '../state/actions'
  import { app, setStatus } from '../state/app.svelte'
  import { createPlayer } from '../state/player'
  import ForgeBox from './ForgeBox.svelte'
  import LibrarySheet from './LibrarySheet.svelte'
  import PlayerBar from './PlayerBar.svelte'
  import PoolsSheet from './PoolsSheet.svelte'
  import Box from './primitives/Box.svelte'
  import Button from './primitives/Button.svelte'
  import Note from './primitives/Note.svelte'
  import ProfilesSheet from './ProfilesSheet.svelte'
  import SentenceCard from './SentenceCard.svelte'
  import SettingsSheet from './SettingsSheet.svelte'
  import TaskOverlay from './TaskOverlay.svelte'
  import UpdateBar from './UpdateBar.svelte'
  import { STRINGS } from './strings'

  const FORGE_SECONDS = 22

  const player = createPlayer(providers)

  let settingsOpen = $state(false)
  let libraryOpen = $state(false)
  let profilesOpen = $state(false)
  let poolsOpen = $state(false)
  let barHeight = $state(120)

  boot().catch(error => setStatus(STRINGS.failed(error instanceof Error ? error.message : String(error)), 'err'))

  // a single-step task has no milestones to report, so the glass creeps on elapsed time
  async function runTask(label: string, detail: string, work: () => Promise<void>): Promise<void> {
    app.stopRequested = false
    app.task = { label, detail, done: 0, total: 1, startedAt: Date.now(), sand: 0 }
    const creep = setInterval(() => {
      if (app.task) app.task.sand = Math.min(0.9, (Date.now() - app.task.startedAt) / (FORGE_SECONDS * 1000))
    }, 200)

    try {
      await work()
    } catch (error) {
      reportError(error)
    } finally {
      clearInterval(creep)
      app.task = null
    }
  }

  async function runSteppedTask(
    label: string,
    total: number,
    work: (step: (done: number, detail: string) => void) => Promise<number>,
  ): Promise<void> {
    app.task = { label, detail: '', done: 0, total, startedAt: Date.now(), sand: 0 }
    try {
      const done = await work((step, detail) => {
        if (app.task) app.task = { ...app.task, done: step, detail, sand: total ? step / total : 0 }
        app.progress = total ? step / total : 0
      })
      if (!app.stopRequested) setStatus(STRINGS.audioDone(done, total))
    } catch (error) {
      reportError(error)
    } finally {
      app.task = null
      app.progress = 0
    }
  }

  const toggles = [
    { key: 'ipa', label: 'IPA' },
    { key: 'vi', label: 'Vietnamese' },
    { key: 'anchor', label: 'Anchors' },
    { key: 'shadow', label: 'Shadow mode' },
  ] as const

  $effect(() => {
    if (app.activeCard < 0) return
    document.getElementById(`c${app.activeCard}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
</script>

<header class="header">
  <div class="header-inner">
    <div class="brand">Sietch</div>
    <Button size="mini" onclick={() => (profilesOpen = true)}>👤 {app.profile?.name ?? '…'}</Button>
    <Button size="icon" aria-label="Pools" onclick={() => (poolsOpen = true)}>⇅</Button>
    <Button size="icon" aria-label="Library" onclick={() => (libraryOpen = true)}>☰</Button>
    <Button size="icon" aria-label="Settings" onclick={() => (settingsOpen = true)}>⚙</Button>
  </div>
</header>

<div class="wrap" style:padding-bottom="{barHeight + 28}px">
  <h1 class="lead">Every sound.<br>Every day.<br>Discipline is the water.</h1>
  <Note>
    Pick the band, the author, or the fairy tale you love. The forge writes an original passage
    containing every sound in English, then audits itself.
  </Note>

  <hr>

  <ForgeBox {runTask} />

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
  {/each}

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
</div>

<PlayerBar {player} bind:height={barHeight} />

<SettingsSheet bind:open={settingsOpen} {providers} {player} {runSteppedTask} />
<LibrarySheet bind:open={libraryOpen} />
<ProfilesSheet bind:open={profilesOpen} />
<PoolsSheet bind:open={poolsOpen} />
<TaskOverlay />
<UpdateBar />

<style>
  .header {
    position: sticky;
    top: 0;
    z-index: 60;
    background: #fff;
    border-bottom: 2px solid #000;
    padding: 0 max(var(--pad), env(safe-area-inset-right)) 0 max(var(--pad), env(safe-area-inset-left));
  }

  .header-inner {
    max-width: 36rem;
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 52px;
  }

  .brand {
    flex: 1;
    font-weight: 700;
    font-size: .86rem;
    letter-spacing: .04em;
    text-transform: uppercase;
  }

  .wrap { max-width: 36rem; margin: 0 auto; width: 100% }

  .lead { margin-top: 22px }

  .toggles { display: flex; gap: 6px; flex-wrap: wrap; margin: 18px 0 }

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
