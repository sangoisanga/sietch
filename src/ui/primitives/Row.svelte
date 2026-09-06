<script lang="ts">
  import type { Snippet } from 'svelte'

  let { style = '', align = '', children }: { style?: string; align?: string; children: Snippet } = $props()
</script>

<div class="row" style="{align ? `align-items:${align};` : ''}{style}">
  {@render children()}
</div>

<style>
  .row { display: flex; gap: 8px; flex-wrap: wrap }

  /* children arrive from other components, so the scoping class is not on them */
  .row > :global(*) { flex: 1 1 140px; min-width: 0 }
</style>
