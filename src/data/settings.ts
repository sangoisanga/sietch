import { DEFAULT_SETTINGS, GEMINI_DEFAULTS, type ProviderConfig, type Settings } from '../core/settings'
import { now, openDb, toPlain } from './db'

const SETTINGS_ID = 'settings'

// the first release kept one provider's credentials at the top level
const LEGACY_GEMINI_KEYS = ['apiKey', 'textModel', 'ttsModel', 'voice', 'style']

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function asConfig(value: unknown): ProviderConfig {
  return Object.fromEntries(
    Object.entries(asRecord(value)).filter(([, entry]) => typeof entry === 'string'),
  ) as ProviderConfig
}

export function normaliseSettings(stored: unknown): Settings {
  const source = asRecord(stored)

  const providers: Record<string, ProviderConfig> = {}
  for (const [id, config] of Object.entries(asRecord(source.providers))) providers[id] = asConfig(config)

  const legacy = asConfig(Object.fromEntries(LEGACY_GEMINI_KEYS.map(key => [key, source[key]])))
  // legacy flat keys take priority over stored providers.gemini (which may come from DEFAULT_SETTINGS spread)
  providers.gemini = { ...GEMINI_DEFAULTS, ...providers.gemini, ...legacy }

  return {
    ttsProviderId: typeof source.ttsProviderId === 'string' ? source.ttsProviderId : DEFAULT_SETTINGS.ttsProviderId,
    llmProviderId: typeof source.llmProviderId === 'string' ? source.llmProviderId : DEFAULT_SETTINGS.llmProviderId,
    rate: typeof source.rate === 'number' ? source.rate : DEFAULT_SETTINGS.rate,
    providers,
  }
}

export async function loadSettings(): Promise<Settings> {
  const record = await (await openDb()).get('settings', SETTINGS_ID)
  return normaliseSettings(record?.value)
}

export async function saveSettings(settings: Settings): Promise<void> {
  await (await openDb()).put('settings', { id: SETTINGS_ID, value: toPlain(settings), updatedAt: now() })
}
