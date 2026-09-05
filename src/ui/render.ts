import { bare, countWords, tokenize } from '../core/text'
import { state } from '../state'
import { el, escapeHtml } from './dom'
import { STRINGS } from './strings'

export function setStatus(message: string, kind?: 'err' | 'shadow'): void {
  const status = el('status')
  status.textContent = message
  status.className = kind ? `status ${kind}` : 'status'
}

export function setProgress(fraction: number): void {
  el('progbar').style.width = `${Math.max(0, Math.min(1, fraction)) * 100}%`
}

function cardMarkup(index: number, sentence: { en: string; ipa: string; vi: string; tips: string[] }): string {
  const words = tokenize(sentence.en).map((word, position) => {
    const note = state.drill.anchors[bare(word)]
    const noteAttrs = note ? ` data-note="${escapeHtml(note)}" title="${escapeHtml(note)}"` : ''
    return `<span class="w${note ? ' anchor' : ''}" data-w="${position}"${noteAttrs}>${escapeHtml(word)}</span>`
  }).join(' ')

  return `<div class="num">${index + 1}</div>
    <div class="en" id="en${index}">${words}</div>
    <div class="anote" id="an${index}"></div>
    <div class="ipa" id="ipa${index}">${escapeHtml(sentence.ipa)}</div>
    <div class="vi" id="vi${index}">${escapeHtml(sentence.vi)}</div>
    <div class="tips" id="tips${index}">${sentence.tips.map(tip => `<span class="tip">${escapeHtml(tip)}</span>`).join('')}</div>
    <div class="acts">
      <button class="mini" data-play="${index}">▶ Play</button>
      <button class="mini" data-loop="${index}">↻ Loop 3×</button>
      <button class="mini" data-gen="${index}">⚡</button>
      <a id="dl${index}" class="hide" download="drill-${index + 1}.wav"><button class="mini">↓ WAV</button></a>
      <span class="dur" id="d${index}"></span>
    </div>`
}

export function renderDrill(): void {
  el('title').textContent = `${state.drill.theme} · ${state.drill.accent}`

  const list = el('list')
  list.replaceChildren(...state.drill.sentences.map((sentence, index) => {
    const card = document.createElement('div')
    card.className = 'card'
    card.id = `c${index}`
    card.innerHTML = cardMarkup(index, sentence)
    return card
  }))

  applyToggles()
  renderAudit()
}

export function applyToggles(): void {
  state.drill.sentences.forEach((_, index) => {
    el(`ipa${index}`).classList.toggle('hide', !state.toggles.ipa)
    el(`vi${index}`).classList.toggle('hide', !state.toggles.vi)
    el(`tips${index}`).classList.toggle('hide', !state.toggles.anchor)
  })
  document.querySelectorAll<HTMLElement>('.en .w.anchor').forEach(word => {
    word.style.borderBottom = state.toggles.anchor ? '2px solid var(--blue)' : 'none'
  })
}

export function renderAudit(): void {
  const { audit, drill } = state
  const score = el('score')
  score.textContent = `${audit.pct}%`
  score.style.color = audit.pct >= 95 ? 'var(--green)' : audit.pct >= 85 ? '#000' : 'var(--red)'

  const summary = STRINGS.auditSummary(countWords(drill.sentences), drill.sentences.length, audit.missing.length, audit.inventory.length)
  const verdict = audit.missing.length
    ? `<b>${escapeHtml(STRINGS.coverageGaps(audit.missing))}</b>`
    : `<b style="color:var(--green)">${STRINGS.coverageComplete}</b>`
  el('auditNote').innerHTML = `${summary} ${verdict}`

  el('soundCount').textContent = String(audit.inventory.length)
  el('grid').innerHTML = audit.inventory
    .map(phoneme => `<span class="ph ${audit.found[phoneme] ? 'ok' : 'no'}">${escapeHtml(phoneme)}</span>`)
    .join('')
}

export function setActiveCard(index: number): void {
  document.querySelectorAll('.card').forEach(card => card.classList.remove('active'))
  if (index < 0) return
  const card = el(`c${index}`)
  card.classList.add('active')
  card.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

export function clearHighlight(): void {
  document.querySelectorAll('.w.lit').forEach(word => word.classList.remove('lit'))
}

export function highlightWord(cardIndex: number, wordIndex: number | null): void {
  clearHighlight()
  if (wordIndex === null) return
  el(`en${cardIndex}`).querySelectorAll('.w')[wordIndex]?.classList.add('lit')
}

export function showClip(index: number, clip: { downloadUrl: string; durationSeconds: number }): void {
  el(`d${index}`).textContent = clip.durationSeconds ? `${clip.durationSeconds.toFixed(1)}s` : ''
  const link = el<HTMLAnchorElement>(`dl${index}`)
  link.href = clip.downloadUrl
  link.classList.remove('hide')
}

export function clearClips(): void {
  document.querySelectorAll('.dur').forEach(node => { node.textContent = '' })
  document.querySelectorAll('[id^=dl]').forEach(node => node.classList.add('hide'))
}

export function installAnchorTaps(): void {
  document.addEventListener('click', event => {
    const word = (event.target as HTMLElement).closest<HTMLElement>('.en .w.anchor')
    const wasSelected = word?.classList.contains('sel') ?? false

    document.querySelectorAll('.anote.show').forEach(note => note.classList.remove('show'))
    document.querySelectorAll('.w.sel').forEach(node => node.classList.remove('sel'))
    if (!word || wasSelected) return

    word.classList.add('sel')
    const note = word.closest('.card')?.querySelector('.anote')
    if (!note) return
    note.textContent = `${word.textContent?.replace(/[^\w']/g, '')} — ${word.dataset.note}`
    note.classList.add('show')
  })
}
