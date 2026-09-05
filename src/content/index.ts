import type { Drill } from '../types'

const modules = import.meta.glob<{ default: Drill }>('./*.json', { eager: true })

export const PACKS: Record<string, Drill> = Object.fromEntries(
  Object.entries(modules).map(([path, module]) => [path.slice(2, -5), module.default]),
)

export const DEFAULT_PACK = 'beatles'

export function loadPack(name: string = DEFAULT_PACK): Drill {
  const pack = PACKS[name] ?? PACKS[DEFAULT_PACK]
  if (!pack) throw new Error(`no content pack named ${name}`)
  return structuredClone(pack)
}
