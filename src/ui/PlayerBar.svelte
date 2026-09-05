<script lang="ts">
  import { updateSettings } from '../state/actions'
  import { app } from '../state/app.svelte'
  import type { Player } from '../state/player'

  let { player }: { player: Player } = $props()

  const RATES = ['0.6', '0.75', '0.85', '1']
</script>

<div class="bar">
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
    <div class="status {app.status.kind}">{app.status.message}</div>
  </div>
</div>
