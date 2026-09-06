export type Route = 'practice' | 'library'

const HASH: Record<Route, string> = { practice: '#/', library: '#/library' }

function fromHash(): Route {
  if (typeof location === 'undefined') return 'practice'
  return location.hash === HASH.library ? 'library' : 'practice'
}

class RouteState {
  current = $state<Route>(fromHash())
}

export const route = new RouteState()

// the hash, not a variable, is the source of truth: the phone's back button has to work
export function go(next: Route): void {
  location.hash = HASH[next]
}

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    route.current = fromHash()
    window.scrollTo({ top: 0 })
  })
}
