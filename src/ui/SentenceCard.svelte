<script lang="ts">
  import { bare, tokenize } from '../core/text'
  import { app } from '../state/app.svelte'
  import type { Sentence } from '../types'
  import Button from './primitives/Button.svelte'

  let { sentence, index, onplay, onloop, ongenerate }: {
    sentence: Sentence
    index: number
    onplay: (index: number) => void
    onloop: (index: number) => void
    ongenerate: (index: number) => void
  } = $props()

  const words = $derived(tokenize(sentence.en).map(word => ({ word, note: app.drill.anchors[bare(word)] })))
  const clip = $derived(app.clips[index])
  const noteOpen = $derived(app.openNote.card === index ? words[app.openNote.word] : undefined)

  function tapWord(position: number, note: string | undefined) {
    if (!note) return
    const same = app.openNote.card === index && app.openNote.word === position
    app.openNote = same ? { card: -1, word: -1 } : { card: index, word: position }
  }
</script>

<div class="card" class:active={app.activeCard === index} id="c{index}">
  <div class="num">{index + 1}</div>

  <div class="en" id="en{index}">
    {#each words as { word, note }, position (position)}
      {#if note}<span
        class="w anchor"
        class:sel={app.openNote.card === index && app.openNote.word === position}
        class:lit={app.activeCard === index && app.litWord === position}
        style:border-bottom={app.toggles.anchor ? '2px solid var(--blue)' : 'none'}
        title={note}
        role="button"
        tabindex="0"
        onclick={() => tapWord(position, note)}
        onkeydown={event => event.key === 'Enter' && tapWord(position, note)}
      >{word}</span>{:else}<span
        class="w"
        class:lit={app.activeCard === index && app.litWord === position}
      >{word}</span>{/if}{' '}
    {/each}
  </div>

  {#if noteOpen?.note}
    <div class="anchor-note">{noteOpen.word.replace(/[^\w']/g, '')} — {noteOpen.note}</div>
  {/if}

  {#if app.toggles.ipa}<div class="ipa">{sentence.ipa}</div>{/if}
  {#if app.toggles.vi}<div class="vi">{sentence.vi}</div>{/if}
  {#if app.toggles.anchor}
    <div class="tips">
      {#each sentence.tips as tip (tip)}<span class="tip">{tip}</span>{/each}
    </div>
  {/if}

  <div class="acts">
    <Button size="mini" onclick={() => onplay(index)}>▶ Play</Button>
    <Button size="mini" onclick={() => onloop(index)}>↻ Loop 3×</Button>
    <Button size="mini" onclick={() => ongenerate(index)}>⚡</Button>
    {#if clip}
      <a href={clip.downloadUrl} download="drill-{index + 1}.wav">
        <Button size="mini">↓ WAV</Button>
      </a>
      <span class="duration">{clip.durationSeconds ? `${clip.durationSeconds.toFixed(1)}s` : ''}</span>
    {/if}
  </div>
</div>

<style>
  .card {
    border: 2px solid #000;
    background: #fff;
    padding: 14px;
    margin-bottom: 12px;
    position: relative;
  }

  .active { box-shadow: var(--shadow); background: #fffdf3 }

  .num {
    position: absolute;
    top: -2px;
    right: -2px;
    background: #000;
    color: #fff;
    font-size: .6rem;
    padding: 2px 7px;
    font-weight: 600;
  }

  .en {
    font-family: 'IBM Plex Serif', Georgia, 'Times New Roman', serif;
    font-size: clamp(1.05rem, 4.4vw, 1.15rem);
    line-height: 1.7;
    padding-right: 22px;
  }

  .w { padding: 1px 0; border-radius: 2px }
  .anchor { cursor: pointer; -webkit-tap-highlight-color: transparent }
  .sel { background: #fff; box-shadow: 0 0 0 2px #000 }
  .lit { background: var(--acc); box-shadow: 0 0 0 2px var(--acc) }

  .anchor-note {
    margin-top: 9px;
    font-size: .72rem;
    line-height: 1.5;
    background: var(--acc);
    border: 2px solid #000;
    padding: 7px 9px;
    word-break: break-word;
  }

  .ipa {
    font-size: .76rem;
    color: var(--blue);
    margin-top: 9px;
    word-break: break-word;
    overflow-wrap: anywhere;
    line-height: 1.7;
  }

  .vi {
    font-family: 'IBM Plex Serif', Georgia, 'Times New Roman', serif;
    font-style: italic;
    font-size: .9rem;
    color: #333;
    margin-top: 9px;
    border-left: 3px solid var(--acc);
    padding-left: 9px;
    line-height: 1.6;
  }

  .tips { margin-top: 10px; display: flex; gap: 5px; flex-wrap: wrap }

  .tip {
    font-size: .64rem;
    line-height: 1.45;
    border: 1px solid #000;
    padding: 3px 6px;
    background: #f5f5f5;
  }

  .acts { display: flex; gap: 6px; margin-top: 12px; flex-wrap: wrap; align-items: center }

  .duration { font-size: .62rem; color: var(--muted); margin-left: auto }
</style>
