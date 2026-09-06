<script lang="ts">
  import { ACCENTS, ACCENT_CODES, DEFAULT_ACCENT } from '../core/accents'
  import {
    annotate, copyPrompt, forge, isLlmConfigured, loadPastedJson, saveOpenDrill, splitOwnTextLocally,
  } from '../state/actions'
  import { app, setStatus } from '../state/app.svelte'
  import { go } from '../state/route.svelte'
  import type { AccentCode } from '../types'
  import Box from './primitives/Box.svelte'
  import Button from './primitives/Button.svelte'
  import Note from './primitives/Note.svelte'
  import Row from './primitives/Row.svelte'
  import { STRINGS } from './strings'

  let { runTask }: { runTask: (label: string, detail: string, work: () => Promise<void>) => Promise<void> } = $props()

  const THEME_SUGGESTIONS = [
    'The Beatles', 'Bob Dylan', 'Leonard Cohen', 'Hans Christian Andersen', 'Aesop’s Fables', 'Grimm Brothers',
    'Sherlock Holmes', 'Studio Ghibli', 'Terry Pratchett', 'Rumi', 'Jane Austen', 'Pink Floyd',
  ]

  let theme = $state('')
  let accent = $state<AccentCode>(DEFAULT_ACCENT)
  let maxWords = $state('120')
  let ownText = $state('')
  let pasted = $state('')

  // you forged it to read it, so the drill is where you land
  async function forgeAndPractise(missing: string[] = []): Promise<void> {
    const detail = missing.length ? STRINGS.coverageGaps(missing) : `${theme || 'The Beatles'} · ${accent}`
    const before = app.drill
    await runTask(STRINGS.forgeTask, detail, () => forge(theme, accent, maxWords, missing))
    if (app.drill !== before) go('practice')
  }
</script>

<Box accent>
  <h2>1 · Pick a world</h2>
  <input bind:value={theme} placeholder="The Beatles / Hans Christian Andersen / Sherlock Holmes…">

  <div class="chips">
    {#each THEME_SUGGESTIONS as suggestion (suggestion)}
      <button class="chip" onclick={() => (theme = suggestion)}>{suggestion}</button>
    {/each}
  </div>

  <Row style="margin-top:12px">
    <div>
      <label for="accent">Accent</label>
      <select id="accent" bind:value={accent}>
        {#each ACCENT_CODES as code (code)}<option value={code}>{ACCENTS[code].label}</option>{/each}
      </select>
    </div>
    <div>
      <label for="wc">Length</label>
      <select id="wc" bind:value={maxWords}>
        <option value="120">≤120 words</option>
        <option value="90">≤90 words</option>
        <option value="60">≤60 words</option>
      </select>
    </div>
  </Row>

  <Row style="margin-top:12px">
    <Button variant="accent" onclick={() => forgeAndPractise()}>⚒ Forge passage</Button>
  </Row>

  <details class="detour">
    <summary>Or: use your own text</summary>
    <Note tone="ink">
      Paste your English passage. The forge <b>keeps your wording</b> and only adds IPA, Vietnamese meaning and pronunciation tips.
    </Note>
    <textarea bind:value={ownText} rows="4" placeholder="Paste your English passage here…"></textarea>
    <Row style="margin-top:8px">
      <Button variant="accent" onclick={async () => {
        const passage = ownText.trim()
        if (!passage) { setStatus(STRINGS.pasteFirst, 'err'); return }
        if (!isLlmConfigured()) {
          if (splitOwnTextLocally(passage, accent)) go('practice')
          return
        }
        const before = app.drill
        await runTask(STRINGS.annotateTask, passage.slice(0, 60), () => annotate(passage, accent))
        if (app.drill !== before) go('practice')
      }}>✍ Use my text</Button>
    </Row>
  </details>

  <details class="detour">
    <summary>No API key? Take the detour</summary>
    <Note tone="ink">
      Copy the prompt → paste it into Gemini web / ChatGPT / Claude → copy the JSON back → paste below → Load.
      The phoneme audit runs on your machine, no network needed.
    </Note>
    <Row style="margin-top:10px">
      <Button size="mini" onclick={async () => {
        const fallback = await copyPrompt(theme, ownText, accent, maxWords)
        if (fallback) pasted = fallback
      }}>📋 Copy prompt</Button>
    </Row>
    <textarea class="json" bind:value={pasted} rows="4" placeholder={'{"theme":"...","sentences":[...]}'}></textarea>
    <Row style="margin-top:8px">
      <Button size="mini" onclick={() => {
        if (!loadPastedJson(pasted, accent, theme)) return
        pasted = ''
        go('practice')
      }}>⤵ Load JSON</Button>
    </Row>
  </details>
</Box>

<Box>
  <h2>2 · Phoneme audit</h2>

  <Row align="baseline">
    <div class="score" style:color={app.audit.pct >= 95 ? 'var(--green)' : app.audit.pct >= 85 ? '#000' : 'var(--red)'}>
      {app.drill.sentences.length ? `${app.audit.pct}%` : '—'}
    </div>
    <div class="summary">
      {STRINGS.auditSummary(app.words, app.drill.sentences.length, app.audit.missing.length, app.audit.inventory.length)}
      {#if app.audit.missing.length}
        <b>{STRINGS.coverageGaps(app.audit.missing)}</b>
      {:else}
        <b class="covered">{STRINGS.coverageComplete}</b>
      {/if}
    </div>
  </Row>

  <div class="grid">
    {#each app.audit.inventory as phoneme (phoneme)}
      <span class="phoneme" class:missing={!app.audit.found[phoneme]}>{phoneme}</span>
    {/each}
  </div>

  <Row style="margin-top:12px">
    <Button size="mini" onclick={async () => {
      if (!app.audit.missing.length) { setStatus(STRINGS.nothingToPatch); return }
      await forgeAndPractise(app.audit.missing)
    }}>⚕ Patch the gaps</Button>
    <Button size="mini" onclick={saveOpenDrill}>💾 Save to library</Button>
  </Row>
</Box>

<style>
  .chips {
    display: flex;
    gap: 6px;
    margin-top: 10px;
    overflow-x: auto;
    flex-wrap: nowrap;
    padding: 0 14px 6px;
    margin-left: -14px;
    margin-right: -14px;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .chips::-webkit-scrollbar { display: none }

  .chip {
    font-family: inherit;
    font-size: .7rem;
    font-weight: 600;
    border: 2px solid #000;
    background: #fff;
    padding: 7px 10px;
    cursor: pointer;
    box-shadow: 2px 2px 0 #000;
    white-space: nowrap;
    flex: 0 0 auto;
    border-radius: 0;
  }

  .chip:active { transform: translate(2px, 2px); box-shadow: none }

  .detour {
    margin-top: 12px;
    border-top: 2px solid #000;
    padding-top: 10px;
  }

  .detour textarea { margin-top: 10px }
  .json { font-size: .7rem }

  .score {
    font-family: 'IBM Plex Serif', Georgia, 'Times New Roman', serif;
    font-size: 1.7rem;
    font-weight: 600;
    flex: 0 0 auto;
  }

  .summary {
    font-size: .76rem;
    color: var(--muted);
    line-height: 1.55;
    flex: 2;
  }

  .covered { color: var(--green) }

  .grid { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 10px }

  .phoneme {
    font-size: .72rem;
    border: 2px solid var(--green);
    padding: 3px 7px;
    background: var(--green);
    color: #fff;
  }

  .missing { background: var(--red); border-color: var(--red) }

  @media (min-width: 600px) {
    .chips {
      flex-wrap: wrap;
      overflow: visible;
      margin-left: 0;
      margin-right: 0;
      padding-left: 0;
      padding-right: 0;
    }
  }
</style>
