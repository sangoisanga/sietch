export function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id)
  if (!node) throw new Error(`missing element #${id}`)
  return node as T
}

const HTML_ESCAPES: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }

export function escapeHtml(value: string): string {
  return String(value).replace(/[<>&"]/g, c => HTML_ESCAPES[c]!)
}

export function fillSelect(select: HTMLSelectElement, options: { value: string; label: string }[]): void {
  select.replaceChildren(
    ...options.map(({ value, label }) => new Option(label, value)),
  )
}
