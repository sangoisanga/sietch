<script lang="ts">
  import { app, setStatus } from '../state/app.svelte'
  import Button from './primitives/Button.svelte'
  import { STRINGS } from './strings'

  const SAND_TRAVEL = 37

  let elapsed = $state(0)

  $effect(() => {
    if (!app.task) return
    const timer = setInterval(() => { elapsed = Math.round((Date.now() - (app.task?.startedAt ?? 0)) / 1000) }, 500)
    return () => clearInterval(timer)
  })

  const remaining = $derived(app.task?.done ? Math.round(elapsed / app.task.done * (app.task.total - app.task.done)) : 0)
  const topY = $derived(8 + (app.task?.sand ?? 0) * SAND_TRAVEL)
</script>

{#if app.task}
  <div class="overlay">
    <div class="card">
      <svg viewBox="0 0 60 92" class="glass" width="86" height="130" aria-hidden="true">
        <defs>
          <clipPath id="clipTop"><rect x="6" y={topY} width="48" height={Math.max(0, 45 - topY)} /></clipPath>
          <clipPath id="clipBot"><rect x="6" y={82 - app.task.sand * SAND_TRAVEL} width="48" height={app.task.sand * SAND_TRAVEL} /></clipPath>
        </defs>
        <polygon points="10,8 50,8 30,45" fill="var(--acc)" clip-path="url(#clipTop)" />
        <polygon points="30,45 50,82 10,82" fill="var(--acc)" clip-path="url(#clipBot)" />
        <line class="stream" x1="30" y1="44" x2="30" y2="74" stroke="#000" stroke-width="2.5" stroke-dasharray="3 5" />
        <polygon points="10,8 50,8 30,45" fill="none" stroke="#000" stroke-width="3" />
        <polygon points="30,45 50,82 10,82" fill="none" stroke="#000" stroke-width="3" />
        <rect x="6" y="3" width="48" height="6" fill="#000" />
        <rect x="6" y="81" width="48" height="6" fill="#000" />
      </svg>

      <div class="count">{app.task.done} / {app.task.total}</div>
      <div class="label">
        {app.task.label} · {elapsed}s{remaining ? ` · ~${remaining}s left` : ''}
      </div>
      <div class="detail">{app.task.detail}</div>

      <Button
        style="margin-top:16px"
        onclick={() => { app.stopRequested = true; app.task = null; setStatus(STRINGS.cancelled) }}
      >■ Cancel</Button>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 90;
    background: rgba(255, 255, 255, .94);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .card {
    border: 2px solid #000;
    box-shadow: var(--shadow);
    background: #fff;
    padding: 26px 22px;
    text-align: center;
    max-width: 20rem;
    width: 100%;
  }

  .glass { display: block; margin: 0 auto 14px }

  .stream { animation: fall .9s linear infinite }

  @keyframes fall {
    from { stroke-dashoffset: 0 }
    to { stroke-dashoffset: -8 }
  }

  .count {
    font-family: 'IBM Plex Serif', Georgia, 'Times New Roman', serif;
    font-size: 2rem;
    font-weight: 600;
    line-height: 1;
  }

  .label {
    font-size: .74rem;
    margin-top: 8px;
    text-transform: uppercase;
    letter-spacing: .06em;
    font-weight: 600;
  }

  .detail {
    font-size: .72rem;
    color: var(--muted);
    margin-top: 8px;
    line-height: 1.5;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }
</style>
