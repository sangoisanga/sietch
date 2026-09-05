export type PoolItem =
  | { kind: 'passage'; packId: string }

export interface Pool {
  id: string
  title: string
  cadence: 'daily' | 'weekly'
  items: PoolItem[]
}

export function itemKey(item: PoolItem): string {
  return `${item.kind}:${item.packId}`
}
