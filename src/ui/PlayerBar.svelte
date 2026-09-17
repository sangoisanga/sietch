<script lang="ts">
  import { SHADOW_PACE_CHOICES } from '../core/shadow'
  import { setShadowPace, updateSettings } from '../state/actions'
  import { app } from '../state/app.svelte'
  import type { Player } from '../state/player'
  import Button from './primitives/Button.svelte'
  import { STRINGS } from './strings'

  let { player, height = $bindable(0) }: { player: Player; height?: number } = $props()

  const RATES = ['0.6', '0.75', '0.85', '1']

  const idleLabel = $derived(app.resumeAt >= 0 ? STRINGS.resume : STRINGS.playPassage)
  const playLabel = $derived(app.playing ? STRINGS.pause : idleLabel)
</script>

<div class="bar" bind:offsetHeight={height}>
  <div class="inner">
    <div class="progress"><i style:width="{Math.max(0, Math.min(1, app.progress)) * 100}%"></i></div>

    <Button
      variant="accent"
      active={app.playing}
      class="play"
      onclick={() => (app.playing ? player.pause() : player.playAll())}
    >
      {playLabel}
    </Button>

    <select
      value={String(app.settings.rate)}
      onchange={event => updateSettings({ rate: Number((event.currentTarget as HTMLSelectElement).value) })}
      aria-label="Playback rate"
      class="picker"
    >
      {#each RATES as rate (rate)}<option value={rate}>{rate === '1' ? '1.0' : rate}×</option>{/each}
    </select>

    {#if app.toggles.shadow}
      <select
        value={String(app.shadowPace)}
        onchange={event => setShadowPace(Number((event.currentTarget as HTMLSelectElement).value))}
        aria-label="Shadow pace"
        class="picker wide"
      >
        {#each SHADOW_PACE_CHOICES as pace (pace)}<option value={String(pace)}>{pace}× gap</option>{/each}
      </select>
    {/if}

    <div class="status" class:error={app.status.kind === 'err'} class:shadow={app.status.kind === 'shadow'}>
      {app.status.message}
    </div>
  </div>
</div>

<style>
  .bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--paper);
    border-top: 2px solid var(--ink);
    z-index: 50;
    padding:
      9px
      max(var(--pad), env(safe-area-inset-left))
      calc(9px + env(safe-area-inset-bottom))
      max(var(--pad), env(safe-area-inset-right));
  }

  .inner {
    max-width: 36rem;
    margin: 0 auto;
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
  }

  /* buttons come from a component, so they carry no scoping class of ours */
  .inner > :global(.play) { flex: 1 1 130px }

  .picker {
    flex: 0 0 92px;
    padding: 9px 6px;
    font-size: .8rem;
    background-position: calc(100% - 12px) 50%, calc(100% - 8px) 50%;
  }

  .wide { flex: 0 0 100px }

  .progress {
    height: 6px;
    background: var(--fill);
    border: 1px solid var(--ink);
    width: 100%;
    margin-bottom: 8px;
  }

  .progress > i {
    display: block;
    height: 100%;
    background: var(--acc);
    width: 0;
    transition: width .12s linear;
  }

  .status {
    font-size: .66rem;
    color: var(--muted);
    width: 100%;
    min-height: 1.1em;
    line-height: 1.4;
  }

  .error { color: var(--red); font-weight: 600 }
  .shadow { color: var(--acc-ink); background: var(--acc); padding: 2px 5px; font-weight: 600 }
</style>
