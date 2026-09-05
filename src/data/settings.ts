import { DEFAULT_SETTINGS, type Settings } from '../core/settings'
import { now, openDb, toPlain } from './db'

const SETTINGS_ID = 'settings'

export async function loadSettings(): Promise<Settings> {
  const record = await (await openDb()).get('settings', SETTINGS_ID)
  return { ...DEFAULT_SETTINGS, ...record?.value }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await (await openDb()).put('settings', { id: SETTINGS_ID, value: toPlain(settings), updatedAt: now() })
}
