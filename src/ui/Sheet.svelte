<script lang="ts">
  import type { Snippet } from 'svelte'

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
  <div class="scrim on" role="presentation" onclick={() => (open = false)}></div>
{/if}

<section class="sheet" class:on={open}>
  <div class="sheet-hd">
    <b>{title}</b>
    <button class="ico" aria-label="Close" onclick={() => (open = false)}>✕</button>
  </div>
  <div class="sheet-bd">
    {@render children()}
  </div>
</section>
