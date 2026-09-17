<script lang="ts">
  import type { Snippet } from 'svelte'

  let { accent = false, style = '', children }: { accent?: boolean; style?: string; children: Snippet } = $props()
</script>

<div class="box" class:accent {style}>
  {@render children()}
</div>

<style>
  .box {
    border: 2px solid var(--ink);
    box-shadow: var(--shadow);
    background: var(--paper);
    padding: 14px;
    margin-bottom: 16px;
  }

  .accent { background: var(--acc) }
</style>
