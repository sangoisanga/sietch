<script lang="ts">
  import { useRegisterSW } from 'virtual:pwa-register/svelte'

  const { needRefresh, updateServiceWorker } = useRegisterSW()
</script>

{#if $needRefresh}
  <div class="update-bar">
    <span>New version ready</span>
    <button class="mini pri" onclick={() => updateServiceWorker(true)}>Reload</button>
    <button class="mini" onclick={() => ($needRefresh = false)}>Later</button>
  </div>
{/if}

<style>
  .update-bar {
    position: fixed;
    left: 0;
    right: 0;
    top: 0;
    z-index: 100;
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: center;
    padding: 8px 12px;
    background: var(--acc);
    border-bottom: 2px solid #000;
    font-size: 0.74rem;
    font-weight: 600;
  }
</style>
