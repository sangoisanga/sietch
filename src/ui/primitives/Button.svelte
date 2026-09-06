<script lang="ts">
  import type { Snippet } from 'svelte'

  let {
    variant = 'plain',
    size = 'regular',
    active = false,
    class: extra = '',
    children,
    ...rest
  }: {
    variant?: 'plain' | 'accent'
    size?: 'regular' | 'mini' | 'icon'
    active?: boolean
    class?: string
    children: Snippet
    [key: string]: unknown
  } = $props()
</script>

<button {...rest} class="btn {size} {variant} {extra}" class:active>
  {@render children()}
</button>

<style>
  .btn {
    font-family: inherit;
    font-size: .8rem;
    font-weight: 600;
    cursor: pointer;
    border: 2px solid #000;
    background: #fff;
    padding: 11px 13px;
    box-shadow: var(--shadow);
    border-radius: 0;
    -webkit-appearance: none;
    appearance: none;
    transition: transform .05s, box-shadow .05s;
    touch-action: manipulation;
  }

  .btn:active { transform: translate(3px, 3px); box-shadow: none }
  .btn:disabled { opacity: .4; cursor: not-allowed }

  .accent { background: var(--acc) }
  .active { background: #000; color: #fff }

  .mini {
    font-size: .7rem;
    padding: 8px 11px;
    box-shadow: 2px 2px 0 #000;
    min-height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  .icon {
    font-size: 1.05rem;
    line-height: 1;
    padding: 0;
    width: 40px;
    height: 40px;
    box-shadow: 2px 2px 0 #000;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 40px;
  }

  /* targets .regular, not .btn: .btn would tie with .icon on specificity and win
     on source order, flattening the icon buttons */
  @media (min-width: 600px) {
    .regular { font-size: .78rem; padding: 9px 12px }
    .mini { font-size: .68rem; padding: 6px 9px; min-height: 0 }
  }
</style>
