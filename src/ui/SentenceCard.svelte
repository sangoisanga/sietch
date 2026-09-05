<script lang="ts">
  import { bare, tokenize } from '../core/text'
  import { app } from '../state/app.svelte'
  import type { Sentence } from '../types'

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
    <div class="anote show">{noteOpen.word.replace(/[^\w']/g, '')} — {noteOpen.note}</div>
  {/if}

  {#if app.toggles.ipa}<div class="ipa">{sentence.ipa}</div>{/if}
  {#if app.toggles.vi}<div class="vi">{sentence.vi}</div>{/if}
  {#if app.toggles.anchor}
    <div class="tips">
      {#each sentence.tips as tip (tip)}<span class="tip">{tip}</span>{/each}
    </div>
  {/if}

  <div class="acts">
    <button class="mini" onclick={() => onplay(index)}>▶ Play</button>
    <button class="mini" onclick={() => onloop(index)}>↻ Loop 3×</button>
    <button class="mini" onclick={() => ongenerate(index)}>⚡</button>
    {#if clip}
      <a href={clip.downloadUrl} download="drill-{index + 1}.wav"><button class="mini">↓ WAV</button></a>
      <span class="dur">{clip.durationSeconds ? `${clip.durationSeconds.toFixed(1)}s` : ''}</span>
    {/if}
  </div>
</div>
