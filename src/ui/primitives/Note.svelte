<script lang="ts">
  import type { Snippet } from 'svelte'

  let { tone = 'muted', style = '', children }: { tone?: 'muted' | 'ink'; style?: string; children: Snippet } = $props()
</script>

<p class="note" class:ink={tone === 'ink'} {style}>
  {@render children()}
</p>

<style>
  .note {
    font-size: .76rem;
    color: var(--muted);
    margin-top: 8px;
    line-height: 1.55;
  }

  .ink { color: #000 }
</style>
