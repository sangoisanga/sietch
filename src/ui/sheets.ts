import { el } from './dom'

export function openSheet(id: string): void {
  closeSheets()
  el(id).classList.add('on')
  el('scrim').classList.add('on')
  document.body.style.overflow = 'hidden'
}

export function closeSheets(): void {
  document.querySelectorAll('.sheet').forEach(sheet => sheet.classList.remove('on'))
  el('scrim').classList.remove('on')
  document.body.style.overflow = ''
}

export function installSheetDismissal(): void {
  el('scrim').onclick = closeSheets
  document.addEventListener('click', event => {
    if ((event.target as HTMLElement).closest('[data-close]')) closeSheets()
  })
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeSheets()
  })
}

// the sticky bar wraps to two rows on narrow screens, so the gap it needs is measured, not guessed
export function keepContentClearOfBar(): void {
  const bar = document.querySelector<HTMLElement>('.bar')
  if (!bar) return
  const fit = () => { document.body.style.paddingBottom = `${bar.offsetHeight + 28}px` }

  new ResizeObserver(fit).observe(bar)
  window.addEventListener('resize', fit)
  window.addEventListener('orientationchange', () => setTimeout(fit, 250))
  fit()
}
