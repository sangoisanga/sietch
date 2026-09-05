<script lang="ts">
  import { SHADOW_PACE_CHOICES } from '../core/shadow'
  import { setShadowPace, updateSettings } from '../state/actions'
  import { app } from '../state/app.svelte'
  import type { Player } from '../state/player'

  let { player, height = $bindable(0) }: { player: Player; height?: number } = $props()

  const RATES = ['0.6', '0.75', '0.85', '1']
</script>

<div class="bar" bind:offsetHeight={height}>
  <div class="inner">
    <div class="prog"><i style:width="{Math.max(0, Math.min(1, app.progress)) * 100}%"></i></div>
    <button class="pri" class:on={app.playing} onclick={() => player.playAll()}>▶ Play the passage</button>
    <button onclick={() => player.stop()}>■</button>
    <select
      value={String(app.settings.rate)}
      onchange={event => updateSettings({ rate: Number((event.currentTarget as HTMLSelectElement).value) })}
      aria-label="Playback rate"
      style="flex:0 0 92px;padding:7px"
    >
      {#each RATES as rate (rate)}<option value={rate}>{rate === '1' ? '1.0' : rate}×</option>{/each}
    </select>
    {#if app.toggles.shadow}
      <select
        value={String(app.shadowPace)}
        onchange={event => setShadowPace(Number((event.currentTarget as HTMLSelectElement).value))}
        aria-label="Shadow pace"
        style="flex:0 0 100px;padding:7px"
      >
        {#each SHADOW_PACE_CHOICES as pace (pace)}<option value={String(pace)}>{pace}× gap</option>{/each}
      </select>
    {/if}
    <div class="status {app.status.kind}">{app.status.message}</div>
  </div>
</div>
