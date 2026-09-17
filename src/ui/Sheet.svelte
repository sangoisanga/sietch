<script lang="ts">
  import type { Snippet } from 'svelte'
  import Button from './primitives/Button.svelte'

  let { open = $bindable(), title, children }: { open: boolean; title: string; children: Snippet } = $props()

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') open = false
  }

  $effect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  })
</script>

<svelte:window on:keydown={onKeydown} />

{#if open}
  <div class="scrim" role="presentation" onclick={() => (open = false)}></div>
{/if}

<section class="sheet" class:open>
  <div class="head">
    <b>{title}</b>
    <Button size="icon" aria-label="Close" onclick={() => (open = false)}>✕</Button>
  </div>
  <div class="body">
    {@render children()}
  </div>
</section>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: var(--scrim);
    z-index: 70;
  }

  .sheet {
    position: fixed;
    z-index: 80;
    background: var(--paper);
    border: 2px solid var(--ink);
    display: none;
    left: 0;
    right: 0;
    bottom: 0;
    max-height: 88vh;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .open { display: block }

  .head {
    position: sticky;
    top: 0;
    background: var(--acc);
    color: var(--acc-ink);
    border-bottom: 2px solid var(--ink);
    padding: 12px 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: .8rem;
    text-transform: uppercase;
    letter-spacing: .06em;
  }

  .head b { flex: 1 }

  .body { padding: 16px 14px calc(20px + env(safe-area-inset-bottom)) }

  @media (min-width: 600px) {
    .sheet {
      left: 50%;
      right: auto;
      bottom: auto;
      top: 50%;
      transform: translate(-50%, -50%);
      width: min(34rem, 92vw);
      max-height: 86vh;
      box-shadow: 6px 6px 0 var(--ink);
    }
  }
</style>
