<script lang="ts">
  import { ACCENTS, ACCENT_CODES, DEFAULT_ACCENT } from '../core/accents'
  import {
    annotate, copyPrompt, forge, isLlmConfigured, loadPastedJson, markScheduledDone,
    openPack, openScheduled, saveOpenDrill, splitOwnTextLocally,
  } from '../state/actions'
  import { app, setStatus } from '../state/app.svelte'
  import type { AccentCode } from '../types'
  import { STRINGS } from './strings'

  let { runTask }: { runTask: (label: string, detail: string, work: () => Promise<void>) => Promise<void> } = $props()

  const THEME_SUGGESTIONS = [
    'The Beatles', 'Bob Dylan', 'Leonard Cohen', 'Hans Christian Andersen', 'Aesop’s Fables', 'Grimm Brothers',
    'Sherlock Holmes', 'Studio Ghibli', 'Terry Pratchett', 'Rumi', 'Jane Austen', 'Pink Floyd',
  ]
  const TODAY = '__today__'

  let theme = $state('')
  let accent = $state<AccentCode>(DEFAULT_ACCENT)
  let maxWords = $state('120')
  let ownText = $state('')
  let pasted = $state('')

  const selected = $derived(app.scheduled && app.openPackId === `${app.scheduled.poolId}/${app.scheduled.packId}` ? TODAY : app.openPackId)

  async function choosePack(value: string) {
    if (value === TODAY) return openScheduled()
    const [poolId, packId] = value.split('/')
    if (poolId && packId) await openPack(poolId, packId)
  }
</script>

<div class="box acc">
  <h2>1 · Pick a world</h2>
  <input bind:value={theme} placeholder="The Beatles / Hans Christian Andersen / Sherlock Holmes…">

  <div class="chips">
    {#each THEME_SUGGESTIONS as suggestion (suggestion)}
      <button class="chip" onclick={() => (theme = suggestion)}>{suggestion}</button>
    {/each}
  </div>

  <div class="row" style="margin-top:12px">
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
  </div>

  <div class="row" style="margin-top:12px">
    <button class="pri" onclick={() => runTask(STRINGS.forgeTask, `${theme || 'The Beatles'} · ${accent}`, () => forge(theme, accent, maxWords, []))}>
      ⚒ Forge passage
    </button>
    <select value={selected} onchange={event => choosePack((event.currentTarget as HTMLSelectElement).value)} aria-label="Drill pack">
      <option value={TODAY} disabled={!app.scheduled}>
        {app.scheduled ? STRINGS.todayOption(app.scheduled.title) : STRINGS.nothingScheduled}
      </option>
      {#each app.packChoices as choice (choice.poolId + choice.packId)}
        <option value="{choice.poolId}/{choice.packId}">{choice.title}</option>
      {/each}
    </select>
    <button class="mini" disabled={!app.canMarkDone} onclick={markScheduledDone}>✓ Mark done</button>
  </div>

  <details style="margin-top:12px;border-top:2px solid #000;padding-top:10px">
    <summary>Or: use your own text</summary>
    <p class="sub" style="color:#000;margin-top:8px">
      Paste your English passage. The forge <b>keeps your wording</b> and only adds IPA, Vietnamese meaning and pronunciation tips.
    </p>
    <textarea bind:value={ownText} rows="4" placeholder="Paste your English passage here…" style="margin-top:10px"></textarea>
    <div class="row" style="margin-top:8px">
      <button class="pri" onclick={async () => {
        const passage = ownText.trim()
        if (!passage) { setStatus(STRINGS.pasteFirst, 'err'); return }
        if (!isLlmConfigured()) { splitOwnTextLocally(passage, accent); return }
        await runTask(STRINGS.annotateTask, passage.slice(0, 60), () => annotate(passage, accent))
      }}>✍ Use my text</button>
    </div>
  </details>

  <details style="margin-top:12px;border-top:2px solid #000;padding-top:10px">
    <summary>No API key? Take the detour</summary>
    <p class="sub" style="color:#000;margin-top:8px">
      Copy the prompt → paste it into Gemini web / ChatGPT / Claude → copy the JSON back → paste below → Load.
      The phoneme audit runs on your machine, no network needed.
    </p>
    <div class="row" style="margin-top:10px">
      <button class="mini" onclick={async () => {
        const fallback = await copyPrompt(theme, ownText, accent, maxWords)
        if (fallback) pasted = fallback
      }}>📋 Copy prompt</button>
    </div>
    <textarea bind:value={pasted} rows="4" placeholder={'{"theme":"...","sentences":[...]}'} style="margin-top:10px;font-size:.7rem"></textarea>
    <div class="row" style="margin-top:8px">
      <button class="mini" onclick={() => { if (loadPastedJson(pasted, accent, theme)) pasted = '' }}>⤵ Load JSON</button>
    </div>
  </details>
</div>

<div class="box">
  <h2>2 · Phoneme audit</h2>
  <div class="row" style="align-items:baseline">
    <div class="score" style:color={app.audit.pct >= 95 ? 'var(--green)' : app.audit.pct >= 85 ? '#000' : 'var(--red)'}>
      {app.drill.sentences.length ? `${app.audit.pct}%` : '—'}
    </div>
    <div class="sub" style="margin:0;flex:2">
      {STRINGS.auditSummary(app.words, app.drill.sentences.length, app.audit.missing.length, app.audit.inventory.length)}
      {#if app.audit.missing.length}
        <b>{STRINGS.coverageGaps(app.audit.missing)}</b>
      {:else}
        <b style="color:var(--green)">{STRINGS.coverageComplete}</b>
      {/if}
    </div>
  </div>

  <div class="grid">
    {#each app.audit.inventory as phoneme (phoneme)}
      <span class="ph {app.audit.found[phoneme] ? 'ok' : 'no'}">{phoneme}</span>
    {/each}
  </div>

  <div class="row" style="margin-top:12px">
    <button class="mini" onclick={async () => {
      if (!app.audit.missing.length) { setStatus(STRINGS.nothingToPatch); return }
      await runTask(STRINGS.forgeTask, STRINGS.coverageGaps(app.audit.missing), () => forge(theme, accent, maxWords, app.audit.missing))
    }}>⚕ Patch the gaps</button>
    <button class="mini" onclick={saveOpenDrill}>💾 Save to library</button>
  </div>
</div>
