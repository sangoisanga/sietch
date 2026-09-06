<script lang="ts">
  import type { Snippet } from 'svelte'

  let { children }: { children: Snippet } = $props()
</script>

<div class="item">
  {@render children()}
</div>

<style>
  .item {
    display: flex;
    gap: 6px;
    align-items: center;
    border-bottom: 1px solid #ddd;
    padding: 8px 0;
    font-size: .74rem;
  }

  .item :global(b) {
    flex: 1;
    font-weight: 500;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .item :global(input) { flex: 1 }
</style>
