<script lang="ts">
  import { boot, providers, reportError } from '../state/actions'
  import { app, setStatus } from '../state/app.svelte'
  import { createPlayer } from '../state/player'
  import { go, route } from '../state/route.svelte'
  import LibraryPage from './LibraryPage.svelte'
  import PlayerBar from './PlayerBar.svelte'
  import PracticePage from './PracticePage.svelte'
  import Button from './primitives/Button.svelte'
  import ProfilesSheet from './ProfilesSheet.svelte'
  import SettingsSheet from './SettingsSheet.svelte'
  import TaskOverlay from './TaskOverlay.svelte'
  import UpdateBar from './UpdateBar.svelte'
  import { STRINGS } from './strings'

  const FORGE_SECONDS = 22

  const player = createPlayer(providers)

  let settingsOpen = $state(false)
  let profilesOpen = $state(false)
  let barHeight = $state(120)

  const onPractice = $derived(route.current === 'practice')

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

</script>

<header class="header">
  <div class="header-inner">
    <button class="brand" onclick={() => go('practice')}>Sietch</button>
    <Button size="mini" onclick={() => (profilesOpen = true)}>👤 {app.profile?.name ?? '…'}</Button>
    <Button
      size="icon"
      active={!onPractice}
      aria-label={onPractice ? 'Library' : 'Back to the drill'}
      onclick={() => go(onPractice ? 'library' : 'practice')}
    >{onPractice ? '☰' : '←'}</Button>
    <Button size="icon" aria-label="Settings" onclick={() => (settingsOpen = true)}>⚙</Button>
  </div>
</header>

<div class="wrap" style:padding-bottom="{onPractice ? barHeight + 28 : 40}px">
  {#if onPractice}
    <PracticePage {player} {runSteppedTask} />
  {:else}
    <LibraryPage {runTask} />
  {/if}
</div>

{#if onPractice}
  <PlayerBar {player} bind:height={barHeight} />
{/if}

<SettingsSheet bind:open={settingsOpen} {providers} />
<ProfilesSheet bind:open={profilesOpen} />
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
    font-family: inherit;
    font-weight: 700;
    font-size: .86rem;
    letter-spacing: .04em;
    text-transform: uppercase;
    text-align: left;
    background: none;
    border: 0;
    cursor: pointer;
  }

  .wrap { max-width: 36rem; margin: 0 auto; width: 100% }
</style>
