import { state } from '../state'
import { el } from './dom'
import { setProgress, setStatus } from './render'
import { STRINGS } from './strings'

const SAND_TRAVEL = 37

let ticker = 0
let startedAt = 0
let done = 0
let total = 0

function drawSand(fraction: number): void {
  const progress = Math.max(0, Math.min(1, fraction))
  const topY = 8 + progress * SAND_TRAVEL
  el('sandTop').setAttribute('y', String(topY))
  el('sandTop').setAttribute('height', String(Math.max(0, 45 - topY)))
  el('sandBot').setAttribute('y', String(82 - progress * SAND_TRAVEL))
  el('sandBot').setAttribute('height', String(progress * SAND_TRAVEL))
}

export function startTask(label: string, steps: number, detail = ''): void {
  done = 0
  total = steps
  startedAt = Date.now()
  el('taskLabel').textContent = label
  el('taskDetail').textContent = detail
  el('taskCount').textContent = `0 / ${steps}`
  drawSand(0)
  el('task').classList.add('on')
  document.body.style.overflow = 'hidden'

  clearInterval(ticker)
  ticker = window.setInterval(() => {
    const elapsed = Math.round((Date.now() - startedAt) / 1000)
    const remaining = done ? Math.round(elapsed / done * (total - done)) : 0
    el('taskLabel').textContent = `${label} · ${elapsed}s${remaining ? ` · ~${remaining}s left` : ''}`
  }, 500)
}

export function advanceTask(completed: number, detail?: string): void {
  done = completed
  el('taskCount').textContent = `${completed} / ${total}`
  if (detail !== undefined) el('taskDetail').textContent = detail
  const fraction = total ? completed / total : 0
  drawSand(fraction)
  setProgress(fraction)
}

// a single-step task has no milestones to report, so the glass creeps on elapsed time
export function creepUntilDone(expectedSeconds: number): () => void {
  const creep = window.setInterval(() => drawSand(Math.min(0.9, (Date.now() - startedAt) / (expectedSeconds * 1000))), 200)
  return () => clearInterval(creep)
}

export function endTask(): void {
  clearInterval(ticker)
  el('task').classList.remove('on')
  document.body.style.overflow = ''
  setProgress(0)
}

export function installTaskCancel(): void {
  el('taskCancel').onclick = () => {
    state.stopRequested = true
    endTask()
    setStatus(STRINGS.cancelled)
  }
}
